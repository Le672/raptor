import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SOURCES,normalize} from '../server/sources.mjs';
import worker from '../server/worker.mjs';

let sequence=0;
const freshService=()=>import(`../server/service.mjs?quota-test=${++sequence}`);
const types=source=>[...new Set(Object.values(source.categories))];
const sample=(source,type,id)=>({
  vod_id:id,type_id:type,type_name:type===source.categories.movie?'动画片':'日韩动漫',
  vod_name:`${source.id} 缓存测试 ${id}`,vod_year:'2026',vod_time:'2026-10-20 10:00:00',
  vod_pic:'https://cdn.anime.example.com/cover.jpg',vod_remarks:'更新至第01集',
  vod_play_from:'m3u8',vod_play_url:'第01集$https://cdn.anime.example.com/video/index.m3u8',
});
function cacheEnv(initial=new Map()){
  const storage=new Map(initial),reads=[],writes=[];
  const env={COMIC_CACHE:{
    async get(key,format){reads.push(key);assert.equal(format,'json');return storage.has(key)?structuredClone(storage.get(key)):null;},
    async put(key,text,options){const value=JSON.parse(text);writes.push({key,value,options});storage.set(key,value);},
  }};
  return {env,storage,reads,writes};
}
function successfulUpstream(calls){return async input=>{
  const url=new URL(input),source=SOURCES.find(item=>new URL(item.api).hostname===url.hostname);
  assert(source,`unexpected source ${url.hostname}`);calls.push(url);
  const type=Number(url.searchParams.get('t')||source.categories.jp),id=Number(url.searchParams.get('ids'))||100000+calls.length;
  return Response.json({code:1,pagecount:2,list:[sample(source,type,id)]});
};}
function savedBundles(time){
  let id=200000;const entries=new Map();
  for(const source of SOURCES)entries.set('home:v1:'+source.id,{parts:types(source).map(type=>({
    key:`catalog:v1:${source.id}:${type}:1:`,entry:{time,value:{items:[normalize(sample(source,type,++id),source)],pagecount:2}},
  }))});
  return entries;
}

test('hourly refresh combines every source and category into one bounded snapshot write',async t=>{
  const {refreshCatalogs,KV_WRITES_PER_REFRESH}=await freshService(),cache=cacheEnv(),calls=[];
  const now=Date.parse('2026-10-20T12:00:00Z');t.mock.method(Date,'now',()=>now);
  t.mock.method(globalThis,'fetch',successfulUpstream(calls));
  const result=await refreshCatalogs(cache.env),partCount=SOURCES.reduce((sum,source)=>sum+types(source).length,0);
  assert.equal(calls.length,partCount);
  assert.equal(result.data.length,partCount);
  assert(result.sources.every(source=>source.state==='ok'));
  assert.equal(cache.writes.length,1);
  assert.equal(cache.writes.length,KV_WRITES_PER_REFRESH);
  assert(calls.length+cache.reads.length+cache.writes.length<=50,'cold refresh including legacy reads must fit the free edge subrequest budget');
  const config=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  assert.deepEqual(config.triggers.crons,['20 * * * *']);
  assert.equal(cache.writes.length*24,24);
  assert.equal(result.meta.scheduledMinutes,60);
  for(const source of SOURCES){
    const write=cache.writes[0],saved=write.value.sources[source.id];
    assert.equal(write.key,'home-snapshot:v2');assert.equal(write.value.version,2);
    assert.deepEqual(write.options,{expirationTtl:604800});
    assert.deepEqual(saved.parts.map(part=>part.key),types(source).map(type=>`catalog:v1:${source.id}:${type}:1:`));
    assert(saved.parts.every(part=>part.entry.time===now&&part.entry.value.items.length===1));
  }
  assert(new TextEncoder().encode(JSON.stringify(cache.writes[0].value)).byteLength<=8*1024*1024);
  assert(!cache.writes.some(write=>/^(catalog|detail):/.test(write.key)));
});

test('visitor browsing, searches, categories, manual refreshes and details never write KV',async t=>{
  const {catalog,detail,cached}=await freshService(),cache=cacheEnv(),calls=[];
  t.mock.method(globalThis,'fetch',successfulUpstream(calls));
  for(const query of ['', 'q=quota-search', 'category=jp', 'refresh=1', 'q=quota-search&refresh=1', 'category=west&refresh=1']){
    const result=await catalog(cache.env,new URLSearchParams(query));
    assert(result.data.length>0,query||'homepage');assert.equal(cache.writes.length,0);
  }
  const readsBefore=cache.reads.length;
  assert.equal((await detail(cache.env,'bf-900001')).value.id,'bf-900001');
  assert.equal((await detail(cache.env,'bf-900001',true)).value.id,'bf-900001');
  assert.equal(cache.reads.length,readsBefore,'detail requests do not read unused persistent keys');
  const request=await cached(cache.env,'default-request-cache',async()=>({items:['live']}));
  assert.deepEqual(request.value.items,['live']);assert.equal(cache.writes.length,0);
});

test('a failed scheduled refresh retains old snapshots and original detail timestamps without renewing expiry',async t=>{
  const {refreshCatalogs,catalog,detail}=await freshService(),now=Date.parse('2026-10-20T12:00:00Z'),oldTime=now-20*60000;
  const initial=savedBundles(oldTime),cache=cacheEnv(initial);
  t.mock.method(Date,'now',()=>now);t.mock.method(globalThis,'fetch',async()=>{throw Error('source offline');});
  const result=await refreshCatalogs(cache.env);
  assert(result.sources.every(source=>source.state==='stale'));
  assert.equal(result.meta.checkedAt,new Date(oldTime).toISOString());assert.equal(result.meta.stale,true);
  assert.equal(cache.writes.length,0);assert.deepEqual(cache.storage,initial);
  const movies=await catalog(cache.env,new URLSearchParams('category=movie'));
  assert.equal(movies.data.length,3);assert.equal(movies.sources.find(source=>source.id==='ff').state,'unsupported');
  const anime=await detail(cache.env,result.data[0].id);
  assert.equal(anime.checkedAt,new Date(oldTime).toISOString());assert.equal(anime.stale,true);
  assert.equal(cache.writes.length,0);
});

test('old individual category caches remain readable during migration and never get rewritten',async t=>{
  const {catalog}=await freshService(),source=SOURCES.find(source=>source.id==='bf'),time=Date.now()-600000;
  const key=`catalog:v1:bf:${source.categories.jp}:1:`,entry={time,value:{items:[normalize(sample(source,source.categories.jp,333001),source)],pagecount:1}};
  const cache=cacheEnv(new Map([[key,entry]]));
  t.mock.method(globalThis,'fetch',async()=>{throw Error('offline');});
  const result=await catalog(cache.env,new URLSearchParams('source=bf&category=jp'));
  assert.equal(result.data[0].id,'bf-333001');assert.equal(result.meta.stale,true);
  assert.equal(result.meta.checkedAt,new Date(time).toISOString());assert.equal(cache.writes.length,0);
});

test('stale snapshots older than seven days cannot masquerade as usable fallback data',async t=>{
  const {catalog}=await freshService(),cache=cacheEnv(savedBundles(Date.now()-8*86400000));
  t.mock.method(globalThis,'fetch',async()=>{throw Error('offline');});
  await assert.rejects(catalog(cache.env),{status:503});assert.equal(cache.writes.length,0);
});

test('KV read/write quota failures preserve live results and never cause write retries',async t=>{
  const {refreshCatalogs,catalog}=await freshService(),calls=[];let attempts=0;
  const env={COMIC_CACHE:{get:async()=>{throw Error('KV get limit exceeded');},put:async()=>{attempts++;throw Error('KV put limit exceeded');}}};
  t.mock.method(globalThis,'fetch',successfulUpstream(calls));
  const scheduled=await refreshCatalogs(env);assert(scheduled.data.length>0);assert(scheduled.sources.every(source=>source.state==='ok'));
  assert.equal(attempts,1);
  const visitor=await catalog(env,new URLSearchParams('refresh=1'));assert(visitor.data.length>0);
  assert.equal(attempts,1,'visitor refresh cannot retry writes blocked by the account quota');
});

test('one failed category keeps other categories from that source and reports partial state',async t=>{
  const {catalog}=await freshService(),cache=cacheEnv(),calls=[];const live=successfulUpstream(calls);
  t.mock.method(globalThis,'fetch',async input=>new URL(input).searchParams.get('t')==='40'?new Response('offline',{status:503}):live(input));
  const result=await catalog(cache.env,new URLSearchParams('source=bf&refresh=1'));
  assert.equal(result.data.length,1);assert.equal(result.sources[0].state,'partial');
  assert.match(result.sources[0].reason,/HTTP 503/);assert.equal(cache.writes.length,0);
});

test('manual API refresh requires login and cannot enable KV persistence after authorization',async t=>{
  const cache=cacheEnv(),calls=[],live=successfulUpstream(calls);
  t.mock.method(globalThis,'fetch',async input=>new URL(input).hostname==='www.yukino.bond'?Response.json({user:{id:200,name:'Budget Viewer',role:'user'}}):live(input));
  const session=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.budget`,headers={Cookie:`__Secure-yukino_session=${session}`};
  for(const path of ['/api/catalog?refresh=1&persistHome=1','/api/catalog?q=public-route-budget&refresh=1','/api/anime/bf-901001?refresh=1']){
    const guest=await worker.fetch(new Request('https://comic.yukino.bond'+path),cache.env,{});
    assert.equal(guest.status,401,path);assert.equal((await guest.json()).code,'LOGIN_REQUIRED');
    const response=await worker.fetch(new Request('https://comic.yukino.bond'+path,{headers}),cache.env,{});
    assert.equal(response.status,200,path);assert.equal(cache.writes.length,0);
  }
  const sources=await(await worker.fetch(new Request('https://comic.yukino.bond/api/sources'),cache.env,{})).json();
  assert.equal(sources.scheduledMinutes,60);
});
