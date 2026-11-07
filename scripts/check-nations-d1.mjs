import {Miniflare} from 'miniflare';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const built=await build({stdin:{contents:"import {handleSaves} from './games/age-of-nations/cloud/service.mjs';export default{fetch(request,env){return handleSaves(request,env,{userId:1,name:'D1 runtime check'});}}",resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'js'},bundle:true,platform:'browser',format:'esm',write:false});
const runtime=new Miniflare({modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-01-01',d1Databases:{DB:'portal-check',GAMES_DB:'nations-check'}});
try{
  const db=await runtime.getD1Database('GAMES_DB');
  // exec accepts a single SQL statement per line, so use prepare for full SQL
  // statements including trigger bodies, just as the remote migration does.
  const schema=await readFile(new URL('../games/age-of-nations/cloud/schema.sql',import.meta.url),'utf8');
  const statements=schema.match(/CREATE TRIGGER[\s\S]*?END;|CREATE (?:TABLE|INDEX)[\s\S]*?;/g);
  for(const statement of statements)await db.prepare(statement).run();
  const id=crypto.randomUUID(),origin='https://games.yukino.bond',path=origin+'/api/games/age-of-nations/saves/'+id;
  const payload=new Uint8Array(2*1024*1024);for(let i=0;i<payload.length;i++)payload[i]=i%251;payload[0]=31;payload[1]=139;
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  const put=(revision,bytes)=>runtime.dispatchFetch(path,{method:'PUT',headers:{Origin:origin,'X-Nations-Account':'1','X-Nations-Sync':'1','Content-Type':'application/gzip','If-Match':`"${revision}"`,'X-State-Hash':hash(bytes),'X-Nations-Meta':encodeURIComponent(JSON.stringify({kind:'auto',name:'Runtime verification',turn:revision+1,era:0,schemaVersion:1,deviceId:id}))},body:bytes});
  const first=await put(0,payload);assert.equal(first.status,200,await first.text());
  const chunks=await db.prepare('SELECT length(data) AS size FROM nations_save_chunks').all();assert.equal(chunks.results.length,8);assert.ok(chunks.results.every(row=>row.size<=262144));
  const restored=await runtime.dispatchFetch(path,{headers:{'X-Nations-Account':'1'}});assert.equal(restored.status,200);assert.equal(hash(new Uint8Array(await restored.arrayBuffer())),hash(payload));
  await db.prepare("CREATE TRIGGER injected_failure BEFORE INSERT ON nations_save_chunks WHEN NEW.chunk_index=1 BEGIN SELECT RAISE(ABORT,'injected D1 failure'); END").run();
  const changed=payload.slice();changed[2]++;
  assert.equal((await put(1,changed)).status,503);
  assert.equal((await db.prepare('SELECT revision FROM nations_saves').first()).revision,1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM nations_save_chunks').first()).count,8);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM nations_save_versions').first()).count,1);
  console.log('Verified the real Workers D1 runtime: eight BLOB chunks, exact 2 MiB restoration, and atomic rollback after a mid-write failure. No R2 binding was used.');
}finally{await runtime.dispose();}
