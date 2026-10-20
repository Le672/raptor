import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SOURCES,queryPlan} from '../server/catalog.mjs';
import {normalize} from '../server/sources.mjs';
import worker from '../server/worker.mjs';

let moduleSequence=0;
const freshService=()=>import(`../server/service.mjs?cache-budget-test=${++moduleSequence}`);
const sample=(source,type,id)=>({
  vod_id:id,
  type_id:type,
  type_name:type===source.categories.series.cn?'国产剧':'剧情片',
  vod_name:`${source.id} 预算测试 ${id}`,
  vod_year:'2026',
  vod_time:'2026-10-19 10:00:00',
  vod_remarks:'正片',
  vod_pic:'https://cdn.cinema.example.com/poster.jpg',
  vod_play_from:'m3u8',
  vod_play_url:'正片$https://cdn.cinema.example.com/movie/index.m3u8',
});

function cacheEnv(initial=new Map()){
  const storage=new Map(initial),reads=[],writes=[];
  const env={CINEMA_CACHE:{
    async get(key,format){
      reads.push(key);
      assert.equal(format,'json');
      return storage.has(key)?structuredClone(storage.get(key)):null;
    },
    async put(key,text,options){
      const value=JSON.parse(text);
      writes.push({key,value,options});
      storage.set(key,value);
    },
  }};
  return {env,storage,reads,writes};
}

function successfulUpstream(calls){
  return async input=>{
    const url=new URL(input),source=SOURCES.find(item=>new URL(item.api).hostname===url.hostname);
    assert(source,`unexpected upstream ${url.hostname}`);
    calls.push(url);
    const type=Number(url.searchParams.get('t')||source.categories.movie.drama);
    const id=Number(url.searchParams.get('ids'))||100000+calls.length;
    return Response.json({code:1,pagecount:1,list:[sample(source,type,id)]});
  };
}

test('one scheduled refresh persists all homepage parts with one KV write per source',async t=>{
  const {refreshCatalogs,KV_WRITES_PER_REFRESH}=await freshService(),cache=cacheEnv(),calls=[];
  const now=Date.parse('2026-10-19T12:00:00Z');
  t.mock.method(Date,'now',()=>now);
  t.mock.method(globalThis,'fetch',successfulUpstream(calls));

  const result=await refreshCatalogs(cache.env);
  assert.equal(calls.length,SOURCES.length*3,'each source refreshes three homepage parts');
  assert.equal(cache.writes.length,SOURCES.length,'the refresh may spend only one KV write per source');
  assert.equal(cache.reads.length,SOURCES.length,'read only persisted homepage bundles, not unpersisted part keys');
  assert(calls.length+cache.reads.length+cache.writes.length<=50,'a cold scheduled refresh must fit the edge subrequest limit');
  const config=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  assert.deepEqual(config.triggers.crons,['0 * * * *'],'the deployed schedule must run only once an hour');
  assert.equal(KV_WRITES_PER_REFRESH,cache.writes.length);
  assert.equal(cache.writes.length*24,192,'cinema must reserve shared account quota for other sites');
  assert.equal(result.sources.length,SOURCES.length);
  assert(result.sources.every(source=>source.state==='ok'));
  assert.equal(result.data.length,SOURCES.length*3);
  assert.equal(result.meta.scheduledMinutes,60);
  assert.deepEqual(cache.writes.map(write=>write.key).sort(),SOURCES.map(source=>'home:v1:'+source.id).sort());

  let persistedParts=0;
  for(const source of SOURCES){
    const saved=cache.writes.find(write=>write.key==='home:v1:'+source.id);
    assert.deepEqual(saved.options,{expirationTtl:604800});
    const expectedKeys=queryPlan(source).types.map(type=>`catalog:v1:${source.id}:${type||'all'}:1:`);
    assert.deepEqual(saved.value.parts.map(part=>part.key),expectedKeys);
    assert.equal(saved.value.parts.length,3);
    for(const part of saved.value.parts){
      persistedParts++;
      assert.equal(part.entry.time,now);
      assert.equal(part.entry.value.items.length,1);
      assert.equal(part.entry.value.items[0].source,source.id);
      assert.equal(part.entry.value.pagecount,1);
    }
  }
  assert.equal(persistedParts,SOURCES.length*3,'bundling must not drop a successful category');
  assert(!cache.writes.some(write=>write.key.startsWith('catalog:')||write.key.startsWith('detail:')));
});

test('visitor homepage, search, category, manual refresh and detail reads spend no KV writes',async t=>{
  const {catalog,detail}=await freshService(),cache=cacheEnv(),calls=[];
  t.mock.method(globalThis,'fetch',successfulUpstream(calls));

  for(const query of [
    '',
    'q=budget-search',
    'category=movie&genre=drama',
    'refresh=1',
    'q=budget-search&refresh=1',
    'category=movie&genre=drama&refresh=1',
  ]){
    const result=await catalog(cache.env,new URLSearchParams(query));
    assert(result.data.length>0,`${query||'homepage'} should return usable live data`);
    assert.equal(cache.writes.length,0,`${query||'homepage'} must not spend persistent writes`);
  }
  const callsBeforeDetail=calls.length;
  assert.equal((await detail(cache.env,'bf-900001')).value.id,'bf-900001');
  assert.equal((await detail(cache.env,'bf-900001',true)).value.id,'bf-900001');
  assert.equal(calls.length,callsBeforeDetail+2,'normal and forced detail loads must actually reach upstream');
  assert.equal(cache.writes.length,0,'successful detail requests must remain in memory only');
  assert.equal(cache.storage.size,0);
});

test('a cold homepage restores bundled data during an outage and retains the original check time',async t=>{
  const {catalog,detail}=await freshService(),now=Date.parse('2026-10-19T12:00:00Z'),oldTime=now-10*60000;
  const initial=new Map(),expectedIds=[];
  let native=200000;
  for(const source of SOURCES){
    const parts=queryPlan(source).types.map(type=>{
      const media=normalize(sample(source,type||source.categories.movie.drama,++native),source);
      expectedIds.push(media.id);
      return {key:`catalog:v1:${source.id}:${type||'all'}:1:`,entry:{time:oldTime,value:{items:[media],pagecount:1}}};
    });
    initial.set('home:v1:'+source.id,{parts});
  }
  const cache=cacheEnv(initial),calls=[];
  t.mock.method(Date,'now',()=>now);
  t.mock.method(globalThis,'fetch',async input=>{calls.push(new URL(input));throw Error('upstream offline');});

  const result=await catalog(cache.env);
  assert.equal(calls.length,SOURCES.length*3,'stale homepage parts should attempt live refresh before falling back');
  assert.deepEqual(result.data.map(item=>item.id).sort(),expectedIds.sort());
  assert.equal(result.meta.stale,true);
  assert.equal(result.meta.checkedAt,new Date(oldTime).toISOString());
  for(const source of result.sources){
    assert.equal(source.state,'stale');
    assert.equal(source.count,3);
    assert.equal(source.checkedAt,new Date(oldTime).toISOString());
    assert.match(source.reason,/暂时连接失败/);
  }
  assert(SOURCES.every(source=>cache.reads.includes('home:v1:'+source.id)));
  assert.equal(cache.writes.length,0,'outage fallback must not renew the bundle lifetime');
  assert.deepEqual(cache.storage,initial,'stored successful timestamps and rows remain unchanged');

  const savedDetail=await detail(cache.env,expectedIds[0]);
  assert.equal(savedDetail.stale,true);
  assert.equal(savedDetail.checkedAt,new Date(oldTime).toISOString(),'homepage seeding must preserve detail freshness too');
  assert.equal(cache.writes.length,0);
});

test('a failed scheduled refresh keeps stale bundles without renewing their KV lifetime',async t=>{
  const {refreshCatalogs}=await freshService(),now=Date.parse('2026-10-19T12:00:00Z'),oldTime=now-20*60000;
  const initial=new Map();
  for(const [index,source]of SOURCES.entries()){
    const parts=queryPlan(source).types.map((type,part)=>({
      key:`catalog:v1:${source.id}:${type||'all'}:1:`,
      entry:{time:oldTime,value:{items:[normalize(sample(source,type||source.categories.movie.drama,300000+index*10+part),source)],pagecount:1}},
    }));
    initial.set('home:v1:'+source.id,{parts});
  }
  const cache=cacheEnv(initial);
  t.mock.method(Date,'now',()=>now);
  t.mock.method(globalThis,'fetch',async()=>{throw Error('offline');});

  const result=await refreshCatalogs(cache.env);
  assert.equal(result.meta.stale,true);
  assert.equal(result.meta.checkedAt,new Date(oldTime).toISOString());
  assert.equal(result.data.length,SOURCES.length*3);
  assert.equal(cache.writes.length,0,'the scheduled path must persist only successfully refreshed data');
  assert.deepEqual(cache.storage,initial);
});

test('KV quota exhaustion cannot turn a successful scheduled refresh into an outage',async t=>{
  const {refreshCatalogs,cached}=await freshService(),cache=cacheEnv(),calls=[];
  let attemptedWrites=0;
  cache.env.CINEMA_CACHE.put=async()=>{attemptedWrites++;throw Error('KV put limit exceeded');};
  t.mock.method(globalThis,'fetch',successfulUpstream(calls));
  const result=await refreshCatalogs(cache.env);
  assert.equal(result.data.length,SOURCES.length*3);
  assert(result.sources.every(source=>source.state==='ok'));
  assert.equal(attemptedWrites,SOURCES.length,'do not retry a quota-blocked write');
  const memoryOnly=await cached(cache.env,'default-request-no-put',async()=>({items:['live']}));
  assert.deepEqual(memoryOnly.value.items,['live']);
  assert.equal(attemptedWrites,SOURCES.length,'the generic request cache must never persist');
});

test('public API refresh flags cannot opt visitors into the scheduler persistence path',async t=>{
  const cache=cacheEnv(),calls=[];t.mock.method(globalThis,'fetch',successfulUpstream(calls));
  for(const path of ['/api/catalog?refresh=1&persistHome=1','/api/catalog?q=public-route-budget&refresh=1','/api/title/bf-901001?refresh=1']){
    const response=await worker.fetch(new Request('https://cinema.yukino.bond'+path),cache.env,{});
    assert.equal(response.status,200,path);assert.equal(cache.writes.length,0);
  }
  const sources=await(await worker.fetch(new Request('https://cinema.yukino.bond/api/sources'),cache.env,{})).json();
  assert.equal(sources.scheduledMinutes,60);
});
