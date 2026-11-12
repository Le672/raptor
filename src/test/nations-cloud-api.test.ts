// @vitest-environment node
import {beforeEach,afterEach,describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createPortalDb} from './fixtures/portal-db';
import {signJWT} from '../../functions/_utils/auth';
import {onRequest} from '../../functions/api/games/age-of-nations/[[path]]';
import {sha256,cleanSaves} from '../../games/age-of-nations/cloud/service.mjs';
let authDb:ReturnType<typeof createPortalDb>,db:ReturnType<typeof createPortalDb>,env:any,tokens:string[],jobs:Promise<unknown>[],objects:Map<string,Uint8Array>;
const origin='https://games.yukino.bond',prefix='/api/games/age-of-nations/',device=crypto.randomUUID();
beforeEach(async()=>{authDb=createPortalDb();db=createPortalDb();const prepare=db.prepare.bind(db);db.prepare=(sql:string)=>{const statement=prepare(sql),bind=statement.bind.bind(statement);statement.bind=(...values:any[])=>bind(...values.map(value=>value instanceof ArrayBuffer?new Uint8Array(value):value));return statement;};db.sqlite.exec(readFileSync(new URL('../../games/age-of-nations/cloud/schema.sql',import.meta.url),'utf8'));const batch=db.batch.bind(db);let queue:Promise<any>=Promise.resolve();db.batch=(statements:any)=>{const task=queue.then(()=>batch(statements));queue=task.catch(()=>{});return task;};objects=new Map();jobs=[];env={DB:authDb,GAMES_DB:db,JWT_SECRET:'test-nations-private-signing-key',GAMES_SAVES:{put:async(key:string,bytes:Uint8Array)=>{objects.set(key,new Uint8Array(bytes));},get:async(key:string)=>objects.has(key)?{body:new Response(objects.get(key)!).body}:null,delete:async(key:string)=>{objects.delete(key);},list:async()=>({objects:[...objects.keys()].map(key=>({key,uploaded:new Date(0)})),truncated:false})}};tokens=[];for(let i=1;i<=2;i++){await authDb.prepare('INSERT INTO users(id,email,password_hash,name,role) VALUES(?,?,?,?,?)').bind(i,`u${i}@example.com`,'not-used',`user${i}`,'user').run();tokens.push(await signJWT({userId:i,email:`u${i}@example.com`,name:`user${i}`,role:'user'},env));}});
afterEach(async()=>{await Promise.allSettled(jobs);db.sqlite.close();authDb.sqlite.close();});
function request(path:string,method='GET',user=1,extra:Record<string,string>={},body?:Uint8Array){return onRequest({env,waitUntil:p=>jobs.push(p),request:new Request(origin+prefix+path,{method,headers:{Cookie:`__Secure-yukino_session=${tokens[user-1]}`,'X-Nations-Account':String(user),'X-Nations-Sync':'1',Origin:origin,...extra},body})});}
async function put(id:string,revision=0,user=1,byte=1,extra:Record<string,string>={}){const bytes=new Uint8Array([31,139,8,0,0,byte]);return request('saves/'+id,'PUT',user,{'Content-Type':'application/gzip','If-Match':`"${revision}"`,'X-State-Hash':await sha256(bytes),'X-Nations-Meta':encodeURIComponent(JSON.stringify({kind:'manual',name:'测试存档',turn:10+byte,era:1,schemaVersion:1,deviceId:device})),...extra},bytes);}
describe('authenticated private game saves',()=>{
  it('initializes fixed private tables before reporting availability while rejecting anonymous users',async()=>{
    const fresh=createPortalDb();env.GAMES_DB=fresh;
    try{for(let i=0;i<2;i++){const response=await onRequest({env,waitUntil:p=>jobs.push(p),request:new Request(origin+prefix+'session')});expect(response.status).toBe(401);expect(await response.json()).toMatchObject({available:true,storage:'d1',code:'LOGIN_REQUIRED'});}
      expect(fresh.sqlite.prepare("SELECT name FROM sqlite_master WHERE name='nations_save_chunks'").get()).toMatchObject({name:'nations_save_chunks'});expect(fresh.sqlite.prepare('SELECT COUNT(*) AS n FROM nations_saves').get()).toMatchObject({n:0});
    }finally{fresh.sqlite.close();env.GAMES_DB=db;}
  });
  it('requires verified portal identity, scopes all reads and checks browser origin/account',async()=>{expect((await onRequest({env,waitUntil:p=>jobs.push(p),request:new Request(origin+prefix+'session')})).status).toBe(401);expect((await(await request('session')).json()).user).toEqual({id:1,name:'user1'});expect((await request('saves','GET',1,{'X-Nations-Account':'2'})).status).toBe(401);const id=crypto.randomUUID();expect((await put(id)).status).toBe(200);expect((await request('saves/'+id,'GET',2)).status).toBe(404);expect((await request('saves/'+id,'DELETE',2,{'If-Match':'"1"'})).status).toBe(404);expect((await(await request('saves','GET',2)).json()).saves).toEqual([]);expect((await request('saves/'+id,'DELETE',1,{Origin:'https://foreign.invalid','If-Match':'"1"'})).status).toBe(401);const list=await(await request('saves')).json();expect(list.saves[0].name).toBe('测试存档');expect(JSON.stringify(list)).not.toMatch(/r2_key|user_id|write_token/);});
  it('uses optimistic revisions and retains the winning snapshot in a concurrent create',async()=>{const id=crypto.randomUUID();const results=await Promise.all([put(id,0,1,1),put(id,0,1,2)]);expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect((await db.prepare('SELECT COUNT(*) AS n FROM nations_save_chunks').first()as any).n).toBe(1);expect((await put(id,0,1,9)).status).toBe(409);const download=await request('saves/'+id);const body=await download.arrayBuffer();expect(await sha256(body)).toBe(download.headers.get('X-State-Hash'));expect(download.headers.get('ETag')).toBe('"1"');});
  it('retains exactly the latest three revisions and exposes only owned historical versions',async()=>{const id=crypto.randomUUID();for(let i=0;i<4;i++)expect((await put(id,i,1,i+1)).status).toBe(200);await Promise.all(jobs);expect((await db.prepare('SELECT COUNT(*) AS n FROM nations_save_chunks').first()as any).n).toBe(3);expect((await request('saves/'+id+'?revision=1')).status).toBe(404);const old=await request('saves/'+id+'?revision=2');expect(old.status).toBe(200);expect(old.headers.get('ETag')).toBe('"2"');expect((await request('saves/'+id+'?revision=2','GET',2)).status).toBe(404);});
  it('tombstones deletes, frees quota, and prevents an offline client from resurrecting progress',async()=>{const id=crypto.randomUUID();await put(id);expect((await request('saves/'+id,'DELETE',1,{'If-Match':'"0"'})).status).toBe(409);expect((await request('saves/'+id,'DELETE',1,{'If-Match':'"1"'})).status).toBe(200);expect((await put(id,1)).status).toBe(409);expect((await request('saves/'+id)).status).toBe(404);expect((await(await request('saves')).json()).usage).toBe(0);await Promise.all(jobs);expect(objects.size).toBe(0);});
  it('checks upload hashes, size bounds, quotas and durable write limits',async()=>{const id=crypto.randomUUID();const invalid=await request('saves/'+id,'PUT',1,{'Content-Type':'application/gzip','If-Match':'"0"','Content-Length':'2097153'});expect(invalid.status).toBe(400);for(let i=0;i<20;i++)expect((await put(crypto.randomUUID())).status).toBe(200);expect((await put(crypto.randomUUID())).status).toBe(413);expect((await db.prepare('SELECT COUNT(*) AS n FROM nations_save_chunks').first()as any).n).toBe(1);await db.prepare('UPDATE nations_save_budget SET count=60').run();expect((await put(crypto.randomUUID())).status).toBe(429);});
  it('rejects corrupted hashes and oversized uploads before creating D1 chunks',async()=>{expect((await put(crypto.randomUUID(),0,1,1,{'X-State-Hash':'0'.repeat(64)})).status).toBe(400);const body=new Uint8Array(2*1024*1024+1);body[0]=31;body[1]=139;const response=await request('saves/'+crypto.randomUUID(),'PUT',1,{'Content-Type':'application/gzip','If-Match':'"0"','X-State-Hash':'0'.repeat(64),'X-Nations-Meta':encodeURIComponent(JSON.stringify({kind:'manual',name:'large',turn:1,era:0,schemaVersion:1,deviceId:device}))},body);expect(response.status).toBe(413);expect(objects.size).toBe(0);});
  it('rolls back metadata and removes staged rows when the total byte quota is exhausted',async()=>{await put(crypto.randomUUID());await db.prepare('UPDATE nations_save_versions SET size_bytes=?').bind(52428800-4).run();expect((await put(crypto.randomUUID())).status).toBe(413);expect((await db.prepare('SELECT COUNT(*) AS n FROM nations_save_chunks').first()as any).n).toBe(1);expect((await db.prepare('SELECT COUNT(*) AS n FROM nations_saves').first()as any).n).toBe(1);});
  it('cleans data for deleted accounts and leaves the portal account store independent',async()=>{const id=crypto.randomUUID();await put(id);await authDb.prepare('DELETE FROM users WHERE id=1').run();await cleanSaves(env);expect(objects.size).toBe(0);expect((await db.prepare('SELECT COUNT(*) AS n FROM nations_saves').first()as any).n).toBe(0);});
});

  it('uses D1 without an R2 binding and avoids new versions for unchanged content or lost acknowledgements',async()=>{
    delete env.GAMES_SAVES;const id=crypto.randomUUID();expect((await(await request('session')).json()).available).toBe(true);
    expect((await put(id)).status).toBe(200);const retry=await(await put(id,0)).json();expect(retry.unchanged).toBe(true);expect(retry.save.revision).toBe(1);
    const unchanged=await(await put(id,1)).json();expect(unchanged.save.revision).toBe(1);expect((await db.prepare('SELECT COUNT(*) AS n FROM nations_save_versions').first()as any).n).toBe(1);
    expect((await request('saves/'+id)).status).toBe(200);expect(objects.size).toBe(0);
  });
  it('round-trips a full 2 MiB snapshot across eight bounded rows and rejects missing chunks',async()=>{
    const id=crypto.randomUUID(),bytes=new Uint8Array(2*1024*1024);bytes[0]=31;bytes[1]=139;for(let i=2;i<bytes.length;i++)bytes[i]=i%251;
    const response=await request('saves/'+id,'PUT',1,{'Content-Type':'application/gzip','If-Match':'"0"','X-State-Hash':await sha256(bytes),'X-Nations-Meta':encodeURIComponent(JSON.stringify({kind:'manual',name:'large',turn:1,era:0,schemaVersion:1,deviceId:device}))},bytes);
    expect(response.status).toBe(200);const sizes=await db.prepare('SELECT length(data) AS size FROM nations_save_chunks').all();expect(sizes.results).toHaveLength(8);expect(sizes.results.every((row:any)=>row.size<=262144)).toBe(true);
    const restored=await(await request('saves/'+id)).arrayBuffer();expect(restored.byteLength).toBe(bytes.byteLength);expect(await sha256(restored)).toBe(await sha256(bytes));
    await db.prepare('DELETE FROM nations_save_chunks WHERE chunk_index=3').run();expect((await request('saves/'+id)).status).toBe(503);
  });
  it('keeps shared bytes until the last referencing save is deleted',async()=>{
    const one=crypto.randomUUID(),two=crypto.randomUUID();await put(one);await put(two);expect((await db.prepare('SELECT COUNT(*) AS n FROM nations_save_chunks').first()as any).n).toBe(1);
    await request('saves/'+one,'DELETE',1,{'If-Match':'"1"'});expect((await request('saves/'+two)).status).toBe(200);
    await request('saves/'+two,'DELETE',1,{'If-Match':'"1"'});expect((await db.prepare('SELECT COUNT(*) AS n FROM nations_save_chunks').first()as any).n).toBe(0);
  });
  it('rolls back all metadata and retention when a BLOB insert fails mid-transaction',async()=>{
    const id=crypto.randomUUID();for(let i=0;i<3;i++)await put(id,i,1,i+1);
    db.sqlite.exec("CREATE TRIGGER fail_chunk BEFORE INSERT ON nations_save_chunks BEGIN SELECT RAISE(ABORT,'injected failure'); END");
    expect((await put(id,3,1,4)).status).toBe(503);expect((await db.prepare('SELECT revision FROM nations_saves').first()as any).revision).toBe(3);
    expect((await request('saves/'+id+'?revision=1')).status).toBe(200);expect((await db.prepare('SELECT COUNT(*) AS n FROM nations_save_chunks').first()as any).n).toBe(3);
  });
  it('continues reading imported private R2 snapshots without writing any new R2 objects',async()=>{
    const id=crypto.randomUUID();await put(id);const row=await db.prepare('SELECT state_hash FROM nations_saves').first()as any;
    const bytes=new Uint8Array([31,139,8,0,0,1]);objects.set('legacy-private',bytes);
    await db.prepare("UPDATE nations_saves SET r2_key='legacy-private'").run();await db.prepare("UPDATE nations_save_versions SET r2_key='legacy-private'").run();await db.prepare('DELETE FROM nations_save_chunks').run();
    expect(await sha256(await(await request('saves/'+id)).arrayBuffer())).toBe(row.state_hash);expect((await put(id,1,1,2)).status).toBe(200);expect(objects.size).toBe(1);
  });
  it('durably queues legacy object deletion and retries it during daily cleanup',async()=>{
    const id=crypto.randomUUID();await put(id);objects.set('legacy-delete',new Uint8Array([1]));
    await db.prepare("UPDATE nations_saves SET r2_key='legacy-delete'").run();await db.prepare("UPDATE nations_save_versions SET r2_key='legacy-delete'").run();
    await request('saves/'+id,'DELETE',1,{'If-Match':'"1"'});expect(objects.has('legacy-delete')).toBe(true);
    const remove=env.GAMES_SAVES.delete;env.GAMES_SAVES.delete=async()=>{throw new Error('temporary storage failure');};await expect(cleanSaves(env)).rejects.toThrow();
    expect((await db.prepare('SELECT COUNT(*) AS n FROM nations_legacy_gc').first()as any).n).toBe(1);env.GAMES_SAVES.delete=remove;await cleanSaves(env);expect(objects.size).toBe(0);
    expect((await db.prepare('SELECT COUNT(*) AS n FROM nations_legacy_gc').first()as any).n).toBe(0);
  });
