import {ensureSchema} from './schema.mjs';
export const LIMITS={saves:20,bytes:50*1024*1024,upload:2*1024*1024,versions:3};
export const CHUNK_BYTES=256*1024;
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
export const reply=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
const fail=(code,status)=>reply({code},status);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const meta=r=>r?{id:r.id,kind:r.kind,name:r.name,chapter:r.chapter,caseId:r.case_id,schemaVersion:r.schema_version,revision:r.revision,hash:r.state_hash,size:r.size_bytes,deviceId:r.device_id,created:r.created_at,updated:r.updated_at,deleted:!!r.deleted_at}:null;
export async function sha256(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');}
async function boundedBody(request){
  if(Number(request.headers.get('Content-Length'))>LIMITS.upload)throw new Error('TOO_LARGE');
  const reader=request.body?.getReader();if(!reader)throw new Error('INVALID_SAVE');const chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>LIMITS.upload){await reader.cancel();throw new Error('TOO_LARGE');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let pos=0;for(const part of chunks){bytes.set(part,pos);pos+=part.length;}
  if(size<3||bytes[0]!==31||bytes[1]!==139)throw new Error('INVALID_SAVE');return bytes;
}
const garbage=(db,owner)=>db.prepare('DELETE FROM fog_save_chunks WHERE user_id=? AND NOT EXISTS(SELECT 1 FROM fog_save_versions v WHERE v.user_id=fog_save_chunks.user_id AND v.state_hash=fog_save_chunks.state_hash)').bind(owner);
const equivalent=(previous,input,hash)=>previous&&!previous.deleted_at&&previous.state_hash===hash&&previous.kind===input.kind&&previous.name===input.name&&previous.chapter===input.chapter&&previous.case_id===input.caseId&&previous.schema_version===input.schemaVersion;

export async function handleSaves(request,env,user){
  const url=new URL(request.url),path=url.pathname.replace(/^\/api\/games\/fog-harbor-files\/?/,'').replace(/\/$/,'');
  if(path==='session'&&request.method==='GET')return reply({user:{id:user.userId,name:user.name},available:!!env.DB,storage:'d1',limits:LIMITS});
  if(request.headers.get('X-Fog-Account')!==String(user.userId))return fail('ACCOUNT_CHANGED',401);
  if(!env.DB)return fail('CLOUD_UNAVAILABLE',503);
  if(!/^saves(?:\/[\w-]+)?$/.test(path))return fail('NOT_FOUND',404);
  const id=path.split('/')[1];if(id&&!uuid.test(id))return fail('INVALID_ID',400);
  const db=env.DB,owner=user.userId,now=Date.now();
  const get=()=>db.prepare('SELECT * FROM fog_saves WHERE id=? AND user_id=?').bind(id,owner).first();
  try{
    if(request.method==='GET'){
      if(!id){
        const {results}=await db.prepare('SELECT * FROM fog_saves WHERE user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 20').bind(owner).all();
        const usage=await db.prepare('SELECT COALESCE(SUM(size_bytes),0) AS bytes FROM fog_save_versions WHERE user_id=?').bind(owner).first();
        return reply({saves:results.map(meta),usage:Number(usage.bytes),limits:LIMITS});
      }
      const save=await get();if(!save||save.deleted_at)return fail('NOT_FOUND',404);
      const rev=url.searchParams.get('revision');let version=save;
      if(rev!==null){if(!/^\d+$/.test(rev))return fail('INVALID_REVISION',400);version=await db.prepare('SELECT * FROM fog_save_versions WHERE save_id=? AND user_id=? AND revision=?').bind(id,owner,Number(rev)).first();if(!version)return fail('NOT_FOUND',404);}
      let body;
      if(version.r2_key.startsWith('d1:')){
        const {results}=await db.prepare('SELECT chunk_index,data FROM fog_save_chunks WHERE user_id=? AND state_hash=? ORDER BY chunk_index').bind(owner,version.state_hash).all();
        if(!results.length||results.length>Math.ceil(LIMITS.upload/CHUNK_BYTES)||results.some((row,i)=>row.chunk_index!==i))return fail('CLOUD_UNAVAILABLE',503);
        const parts=results.map(row=>new Uint8Array(row.data));
        if(parts.reduce((size,part)=>size+part.byteLength,0)!==version.size_bytes)return fail('CLOUD_UNAVAILABLE',503);
        body=new Blob(parts);
      }else{
        // Previously enabled R2 accounts retain read access to imported saves.
        const object=await env.GAMES_SAVES?.get(version.r2_key);if(!object)return fail('CLOUD_UNAVAILABLE',503);body=object.body;
      }
      return new Response(body,{headers:{...headers,'Content-Type':'application/gzip','ETag':`"${version.revision}"`,'X-State-Hash':version.state_hash,'X-Fog-Meta':encodeURIComponent(JSON.stringify({...meta(save),revision:version.revision,hash:version.state_hash}))}});
    }
    if(!['PUT','DELETE'].includes(request.method))return fail('METHOD_NOT_ALLOWED',405);
    if(request.headers.get('Origin')!==url.origin||!['same-origin','none',''].includes(request.headers.get('Sec-Fetch-Site')||'')||request.headers.get('X-Fog-Sync')!=='1')return fail('ORIGIN_REQUIRED',403);
    const minute=Math.floor(now/60000),budget=await db.prepare('INSERT INTO fog_save_budget(user_id,minute,count) VALUES(?,?,1) ON CONFLICT(user_id) DO UPDATE SET count=CASE WHEN minute=excluded.minute THEN count+1 ELSE 1 END, minute=excluded.minute RETURNING count').bind(owner,minute).first();
    if(budget.count>60)return reply({code:'RATE_LIMITED'},429,{'Retry-After':'60'});
    if(request.method==='DELETE'){
      if(id){
        const row=await get();if(!row||row.deleted_at)return fail('NOT_FOUND',404);
        if(request.headers.get('If-Match')!==`"${row.revision}"`)return reply({code:'CONFLICT',save:meta(row)},409);
        const token=crypto.randomUUID(),result=await db.batch([
          db.prepare('UPDATE fog_saves SET deleted_at=?,updated_at=?,revision=revision+1,write_token=? WHERE id=? AND user_id=? AND revision=? AND deleted_at IS NULL').bind(now,now,token,id,owner,row.revision),
          db.prepare("INSERT OR IGNORE INTO fog_legacy_gc SELECT r2_key,? FROM fog_save_versions WHERE save_id=? AND user_id=? AND r2_key NOT LIKE 'd1:%' AND EXISTS(SELECT 1 FROM fog_saves WHERE id=? AND write_token=?)").bind(now,id,owner,id,token),
          db.prepare('DELETE FROM fog_save_versions WHERE save_id=? AND user_id=? AND EXISTS(SELECT 1 FROM fog_saves WHERE id=? AND write_token=?)').bind(id,owner,id,token),garbage(db,owner)
        ]);
        if(!result[0].meta.changes)return reply({code:'CONFLICT',save:meta(await get())},409);
      }else await db.batch([
        db.prepare('UPDATE fog_saves SET deleted_at=?,updated_at=?,revision=revision+1 WHERE user_id=? AND deleted_at IS NULL').bind(now,now,owner),
        db.prepare("INSERT OR IGNORE INTO fog_legacy_gc SELECT r2_key,? FROM fog_save_versions WHERE user_id=? AND r2_key NOT LIKE 'd1:%' AND save_id IN(SELECT id FROM fog_saves WHERE user_id=? AND deleted_at IS NOT NULL)").bind(now,owner,owner),
        db.prepare('DELETE FROM fog_save_versions WHERE user_id=? AND save_id IN(SELECT id FROM fog_saves WHERE user_id=? AND deleted_at IS NOT NULL)').bind(owner,owner),garbage(db,owner)
      ]);
      return reply({deleted:true});
    }
    if(!id)return fail('INVALID_ID',400);
    const match=request.headers.get('If-Match');if(!/^"\d+"$/.test(match||''))return fail('REVISION_REQUIRED',428);
    const base=Number(match.slice(1,-1));if(!Number.isSafeInteger(base))return fail('INVALID_REVISION',400);
    const previous=await get();
    if(previous?.deleted_at)return reply({code:'CONFLICT',save:meta(previous)},409);
    if(request.headers.get('Content-Type')!=='application/gzip')return fail('INVALID_SAVE',415);
    let input;try{const encoded=request.headers.get('X-Fog-Meta')||'';if(encoded.length>4096)throw 0;input=JSON.parse(decodeURIComponent(encoded));}catch{return fail('INVALID_META',400);}
    if(!input||!['auto','manual'].includes(input.kind)||typeof input.name!=='string'||input.name.length>80||!Number.isInteger(input.chapter)||input.chapter<1||input.chapter>5||input.caseId!=='last-recording'||!Number.isInteger(input.schemaVersion)||input.schemaVersion<1||input.schemaVersion>1000||!uuid.test(input.deviceId))return fail('INVALID_META',400);
    let bytes;try{bytes=await boundedBody(request);}catch(e){return fail(e.message,e.message==='TOO_LARGE'?413:400);}
    const hash=await sha256(bytes);if(request.headers.get('X-State-Hash')!==hash)return fail('HASH_MISMATCH',400);
    // Lost acknowledgements and unchanged content do not allocate new versions.
    if(equivalent(previous,input,hash)&&base<=previous.revision)return reply({save:meta(previous),unchanged:true});
    if((previous?.revision||0)!==base)return reply({code:'CONFLICT',save:meta(previous)},409);
    const revision=base+1,token=crypto.randomUUID(),key=`d1:${hash}:${token}`;
    const statements=[
      db.prepare('INSERT INTO fog_saves(id,user_id,kind,name,chapter,case_id,schema_version,revision,state_hash,size_bytes,r2_key,device_id,write_token,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,name=excluded.name,chapter=excluded.chapter,case_id=excluded.case_id,schema_version=excluded.schema_version,revision=excluded.revision,state_hash=excluded.state_hash,size_bytes=excluded.size_bytes,r2_key=excluded.r2_key,device_id=excluded.device_id,write_token=excluded.write_token,updated_at=excluded.updated_at WHERE fog_saves.user_id=excluded.user_id AND fog_saves.revision=? AND fog_saves.deleted_at IS NULL').bind(id,owner,input.kind,input.name,input.chapter,input.caseId,input.schemaVersion,revision,hash,bytes.byteLength,key,input.deviceId,token,previous?.created_at||now,now,base),
      db.prepare("INSERT OR IGNORE INTO fog_legacy_gc SELECT r2_key,? FROM fog_save_versions WHERE save_id=? AND user_id=? AND revision<? AND r2_key NOT LIKE 'd1:%' AND EXISTS(SELECT 1 FROM fog_saves WHERE id=? AND user_id=? AND write_token=?)").bind(now,id,owner,revision-2,id,owner,token),
      db.prepare('DELETE FROM fog_save_versions WHERE save_id=? AND user_id=? AND revision<? AND EXISTS(SELECT 1 FROM fog_saves WHERE id=? AND user_id=? AND write_token=?)').bind(id,owner,revision-2,id,owner,token),
      db.prepare('INSERT INTO fog_save_versions(save_id,user_id,revision,r2_key,state_hash,size_bytes,created_at) SELECT id,user_id,revision,r2_key,state_hash,size_bytes,updated_at FROM fog_saves WHERE id=? AND user_id=? AND write_token=?').bind(id,owner,token)
    ];
    // Up to eight BLOB rows, far below D1's 2 MB row limit. Everything commits
    // together; losing writers add nothing and identical snapshots share bytes.
    for(let offset=0;offset<bytes.length;offset+=CHUNK_BYTES)statements.push(db.prepare('INSERT INTO fog_save_chunks(user_id,state_hash,chunk_index,data) SELECT user_id,state_hash,?,? FROM fog_saves WHERE id=? AND user_id=? AND write_token=? ON CONFLICT(user_id,state_hash,chunk_index) DO NOTHING').bind(offset/CHUNK_BYTES,bytes.slice(offset,offset+CHUNK_BYTES).buffer,id,owner,token));
    statements.push(garbage(db,owner));
    const result=await db.batch(statements);
    if(!result[0].meta.changes)return reply({code:'CONFLICT',save:meta(await get())},409);
    return reply({save:meta({id,kind:input.kind,name:input.name,chapter:input.chapter,case_id:input.caseId,schema_version:input.schemaVersion,revision,state_hash:hash,size_bytes:bytes.byteLength,device_id:input.deviceId,created_at:previous?.created_at||now,updated_at:now,deleted_at:null})},200,{'ETag':`"${revision}"`});
  }catch(e){if(/FOG_SAVE_(COUNT|BYTES)/.test(String(e)))return fail('QUOTA_EXCEEDED',413);return fail('CLOUD_UNAVAILABLE',503);}
}

export async function cleanSaves(env){
  if(!env.DB)return;
  const db=env.DB;await ensureSchema(db);const {results}=await db.prepare('SELECT DISTINCT user_id FROM fog_saves').all();
  // Account identity and game data use separate tables in the portal DB.
  for(let offset=0;offset<results.length;offset+=100){
    const ids=results.slice(offset,offset+100).map(row=>row.user_id);
    const users=await env.DB.prepare(`SELECT id FROM users WHERE id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all(),alive=new Set(users.results.map(row=>row.id));
    for(const owner of ids)if(!alive.has(owner))await db.batch([
      db.prepare("INSERT OR IGNORE INTO fog_legacy_gc SELECT r2_key,? FROM fog_save_versions WHERE user_id=? AND r2_key NOT LIKE 'd1:%'").bind(Date.now(),owner),
      db.prepare('DELETE FROM fog_save_versions WHERE user_id=?').bind(owner),db.prepare('DELETE FROM fog_save_chunks WHERE user_id=?').bind(owner),db.prepare('DELETE FROM fog_saves WHERE user_id=?').bind(owner),db.prepare('DELETE FROM fog_save_budget WHERE user_id=?').bind(owner)
    ]);
  }
  await db.prepare('DELETE FROM fog_save_budget WHERE minute<?').bind(Math.floor(Date.now()/60000)-1440).run();
  if(env.GAMES_SAVES){
    const pending=await db.prepare('SELECT r2_key FROM fog_legacy_gc ORDER BY queued_at LIMIT 500').all();
    for(const row of pending.results){await env.GAMES_SAVES.delete(row.r2_key);await db.prepare('DELETE FROM fog_legacy_gc WHERE r2_key=?').bind(row.r2_key).run();}
  }
}
