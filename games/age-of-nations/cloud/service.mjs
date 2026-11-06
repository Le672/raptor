export const LIMITS={saves:20,bytes:50*1024*1024,upload:2*1024*1024,versions:3};
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
export const reply=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
const fail=(code,status)=>reply({code},status);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const meta=r=>r?{id:r.id,kind:r.kind,name:r.name,turn:r.turn,era:r.era,schemaVersion:r.schema_version,revision:r.revision,hash:r.state_hash,size:r.size_bytes,deviceId:r.device_id,created:r.created_at,updated:r.updated_at,deleted:!!r.deleted_at}:null;
export async function sha256(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');}
async function boundedBody(request){if(Number(request.headers.get('Content-Length'))>LIMITS.upload)throw new Error('TOO_LARGE');const reader=request.body?.getReader();if(!reader)throw new Error('INVALID_SAVE');const chunks=[];let size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>LIMITS.upload){await reader.cancel();throw new Error('TOO_LARGE');}chunks.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(size);let pos=0;for(const part of chunks){bytes.set(part,pos);pos+=part.length;}if(size<3||bytes[0]!==31||bytes[1]!==139)throw new Error('INVALID_SAVE');return bytes;}
export async function handleSaves(request,env,user,waitUntil=()=>{}){
  const url=new URL(request.url),path=url.pathname.replace(/^\/api\/games\/age-of-nations\/?/,'').replace(/\/$/,'');
  if(path==='session'&&request.method==='GET')return reply({user:{id:user.userId,name:user.name},available:!!env.GAMES_SAVES,limits:LIMITS});
  const account=request.headers.get('X-Nations-Account');
  if(account!==String(user.userId))return fail('ACCOUNT_CHANGED',401);
  if(!env.GAMES_SAVES)return fail('CLOUD_UNAVAILABLE',503);
  if(!/^saves(?:\/[\w-]+)?$/.test(path))return fail('NOT_FOUND',404);
  const id=path.split('/')[1];if(id&&!uuid.test(id))return fail('INVALID_ID',400);
  const db=env.DB,owner=user.userId,now=Date.now();
  const get=()=>db.prepare('SELECT * FROM nations_saves WHERE id=? AND user_id=?').bind(id,owner).first();
  try{
    if(request.method==='GET'){
      if(!id){const {results}=await db.prepare('SELECT * FROM nations_saves WHERE user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 20').bind(owner).all();const usage=await db.prepare('SELECT COALESCE(SUM(size_bytes),0) AS bytes FROM nations_save_versions WHERE user_id=?').bind(owner).first();return reply({saves:results.map(meta),usage:Number(usage.bytes),limits:LIMITS});}
      const save=await get();if(!save||save.deleted_at)return fail('NOT_FOUND',404);
      const rev=url.searchParams.get('revision');let version=save;
      if(rev!==null){if(!/^\d+$/.test(rev))return fail('INVALID_REVISION',400);version=await db.prepare('SELECT * FROM nations_save_versions WHERE save_id=? AND user_id=? AND revision=?').bind(id,owner,Number(rev)).first();if(!version)return fail('NOT_FOUND',404);}
      const object=await env.GAMES_SAVES.get(version.r2_key);if(!object)return fail('CLOUD_UNAVAILABLE',503);
      return new Response(object.body,{headers:{...headers,'Content-Type':'application/gzip','ETag':`"${version.revision}"`,'X-State-Hash':version.state_hash,'X-Nations-Meta':encodeURIComponent(JSON.stringify({...meta(save),revision:version.revision,hash:version.state_hash}))}});
    }
    if(!['PUT','DELETE'].includes(request.method))return fail('METHOD_NOT_ALLOWED',405);
    if(request.headers.get('Origin')!==url.origin||!['same-origin','none',''].includes(request.headers.get('Sec-Fetch-Site')||'')||request.headers.get('X-Nations-Sync')!=='1')return fail('ORIGIN_REQUIRED',403);
    const minute=Math.floor(now/60000);const budget=await db.prepare('INSERT INTO nations_save_budget(user_id,minute,count) VALUES(?,?,1) ON CONFLICT(user_id) DO UPDATE SET count=CASE WHEN minute=excluded.minute THEN count+1 ELSE 1 END, minute=excluded.minute RETURNING count').bind(owner,minute).first();
    if(budget.count>60)return reply({code:'RATE_LIMITED'},429,{'Retry-After':'60'});
    if(request.method==='DELETE'){
      if(id){const row=await get();if(!row||row.deleted_at)return fail('NOT_FOUND',404);const expected=request.headers.get('If-Match');if(expected!==`"${row.revision}"`)return reply({code:'CONFLICT',save:meta(row)},409);
        const r=await db.prepare('UPDATE nations_saves SET deleted_at=?,updated_at=?,revision=revision+1 WHERE id=? AND user_id=? AND revision=? AND deleted_at IS NULL').bind(now,now,id,owner,row.revision).run();if(!r.meta.changes)return reply({code:'CONFLICT',save:meta(await get())},409);
      }else await db.prepare('UPDATE nations_saves SET deleted_at=?,updated_at=?,revision=revision+1 WHERE user_id=? AND deleted_at IS NULL').bind(now,now,owner).run();
      // Keep tombstones so an offline device cannot silently resurrect deleted saves.
      const {results}=await db.prepare('SELECT v.r2_key FROM nations_save_versions v JOIN nations_saves s ON s.id=v.save_id WHERE s.user_id=? AND s.deleted_at IS NOT NULL').bind(owner).all();
      await db.prepare('DELETE FROM nations_save_versions WHERE user_id=? AND save_id IN(SELECT id FROM nations_saves WHERE user_id=? AND deleted_at IS NOT NULL)').bind(owner,owner).run();
      waitUntil(Promise.all(results.map(r=>env.GAMES_SAVES.delete(r.r2_key))));return reply({deleted:true});
    }
    if(!id)return fail('INVALID_ID',400);
    const previous=await get(),match=request.headers.get('If-Match');if(!/^"\d+"$/.test(match||''))return fail('REVISION_REQUIRED',428);
    const base=Number(match.slice(1,-1));if((previous?.revision||0)!==base||previous?.deleted_at)return reply({code:'CONFLICT',save:meta(previous)},409);
    if(request.headers.get('Content-Type')!=='application/gzip')return fail('INVALID_SAVE',415);
    let input;try{const encoded=request.headers.get('X-Nations-Meta')||'';if(encoded.length>4096)throw 0;input=JSON.parse(decodeURIComponent(encoded));}catch{return fail('INVALID_META',400);}
    if(!input||!['auto','manual'].includes(input.kind)||typeof input.name!=='string'||input.name.length>80||!Number.isInteger(input.turn)||input.turn<1||input.turn>501||!Number.isInteger(input.era)||input.era<0||input.era>5||!Number.isInteger(input.schemaVersion)||input.schemaVersion<1||input.schemaVersion>1000||!uuid.test(input.deviceId))return fail('INVALID_META',400);
    let bytes;try{bytes=await boundedBody(request);}catch(e){return fail(e.message,e.message==='TOO_LARGE'?413:400);}
    const hash=await sha256(bytes);if(request.headers.get('X-State-Hash')!==hash)return fail('HASH_MISMATCH',400);
    const revision=base+1,token=crypto.randomUUID(),key=`nations/${owner}/${id}/${revision}-${token}.json.gz`;
    // Unique staging keys prevent a losing concurrent writer from replacing the winner's object.
    await env.GAMES_SAVES.put(key,bytes,{httpMetadata:{contentType:'application/gzip'}});
    try{
      const old=await db.prepare('SELECT r2_key FROM nations_save_versions WHERE save_id=? AND user_id=? AND revision<?').bind(id,owner,revision-2).all();
      const result=await db.batch([
        db.prepare('INSERT INTO nations_saves(id,user_id,kind,name,turn,era,schema_version,revision,state_hash,size_bytes,r2_key,device_id,write_token,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,name=excluded.name,turn=excluded.turn,era=excluded.era,schema_version=excluded.schema_version,revision=excluded.revision,state_hash=excluded.state_hash,size_bytes=excluded.size_bytes,r2_key=excluded.r2_key,device_id=excluded.device_id,write_token=excluded.write_token,updated_at=excluded.updated_at WHERE nations_saves.user_id=excluded.user_id AND nations_saves.revision=? AND nations_saves.deleted_at IS NULL').bind(id,owner,input.kind,input.name,input.turn,input.era,input.schemaVersion,revision,hash,bytes.byteLength,key,input.deviceId,token,previous?.created_at||now,now,base),
        db.prepare('DELETE FROM nations_save_versions WHERE save_id=? AND user_id=? AND revision<? AND EXISTS(SELECT 1 FROM nations_saves WHERE id=? AND user_id=? AND write_token=?)').bind(id,owner,revision-2,id,owner,token),
        db.prepare('INSERT INTO nations_save_versions(save_id,user_id,revision,r2_key,state_hash,size_bytes,created_at) SELECT id,user_id,revision,r2_key,state_hash,size_bytes,updated_at FROM nations_saves WHERE id=? AND user_id=? AND write_token=?').bind(id,owner,token)
      ]);
      if(!result[0].meta.changes){await env.GAMES_SAVES.delete(key);return reply({code:'CONFLICT',save:meta(await get())},409);}
      waitUntil(Promise.all(old.results.map(r=>env.GAMES_SAVES.delete(r.r2_key))));return reply({save:meta({id,kind:input.kind,name:input.name,turn:input.turn,era:input.era,schema_version:input.schemaVersion,revision,state_hash:hash,size_bytes:bytes.byteLength,device_id:input.deviceId,created_at:previous?.created_at||now,updated_at:now,deleted_at:null})},200,{'ETag':`"${revision}"`});
    }catch(e){await env.GAMES_SAVES.delete(key);if(/NATIONS_SAVE_(COUNT|BYTES)/.test(String(e)))return fail('QUOTA_EXCEEDED',413);throw e;}
  }catch{return fail('CLOUD_UNAVAILABLE',503);}
}
export async function cleanSaves(env){
  const db=env.DB;
  // Account deletion revokes access immediately; remove its game data on the next cleanup.
  const {results}=await db.prepare('SELECT v.r2_key FROM nations_save_versions v LEFT JOIN users u ON u.id=v.user_id WHERE u.id IS NULL').all();
  for(const row of results)await env.GAMES_SAVES.delete(row.r2_key);
  await db.batch([db.prepare('DELETE FROM nations_save_versions WHERE user_id NOT IN(SELECT id FROM users)'),db.prepare('DELETE FROM nations_saves WHERE user_id NOT IN(SELECT id FROM users)'),db.prepare('DELETE FROM nations_save_budget WHERE minute<?').bind(Math.floor(Date.now()/60000)-1440)]);
  // Also collect staged objects left by an interrupted upload or failed background deletion.
  let cursor;do{const page=await env.GAMES_SAVES.list({prefix:'nations/',limit:500,cursor});for(const object of page.objects){if(new Date(object.uploaded).getTime()>Date.now()-86400000)continue;const referenced=await db.prepare('SELECT 1 AS present FROM nations_save_versions WHERE r2_key=?').bind(object.key).first();if(!referenced)await env.GAMES_SAVES.delete(object.key);}cursor=page.truncated?page.cursor:undefined;}while(cursor);
}
