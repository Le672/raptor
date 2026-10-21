import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCES as cinemaSources,queryPlan} from '../server/catalog.mjs';
import {normalize as normalizeCinema} from '../server/sources.mjs';
import {SOURCES as comicSources,normalize as normalizeComic} from '../../comic/server/sources.mjs';
import {HOME_SNAPSHOT_KEY,MAX_SNAPSHOT_BYTES,usableBundle,writeHomeSnapshot} from '../../shared/catalog-snapshot.mjs';

let sequence=0;
const sites=[
  {name:'cinema',sources:cinemaSources,binding:'CINEMA_CACHE',normalize:normalizeCinema,types:source=>queryPlan(source).types,homeTypes:source=>queryPlan(source).types,service:'../server/service.mjs'},
  {name:'comic',sources:comicSources,binding:'COMIC_CACHE',normalize:normalizeComic,types:source=>[...new Set(Object.values(source.categories))],homeTypes:source=>[source.categories.jp,source.categories.cn],service:'../../comic/server/service.mjs'},
];
const freshService=site=>import(`${site.service}?combined-snapshot-test=${++sequence}`);
const key=(source,type,site)=>`catalog:v1:${source.id}:${type||(site.name==='cinema'?'all':'search')}:1:`;
function sample(site,source,type,id){
  return {vod_id:id,type_id:type||(site.name==='cinema'?source.categories.movie.drama:source.categories.jp),
    type_name:site.name==='cinema'?(type===source.categories.series.cn?'国产剧':'剧情片'):(type===source.categories.movie?'动画片':'日韩动漫'),
    vod_name:`${site.name} ${source.id} 合并测试 ${id}`,vod_year:'2026',vod_time:'2026-10-21 10:00:00',vod_remarks:'第01集',
    vod_pic:'https://cdn.example.com/poster.jpg',vod_play_from:'m3u8',vod_play_url:'第01集$https://cdn.example.com/index.m3u8'};
}
function snapshot(site,time){
  let id=400000;
  return {version:2,sources:Object.fromEntries(site.sources.map(source=>[source.id,{parts:site.types(source).map(type=>({
    key:key(source,type,site),entry:{time,value:{items:[site.normalize(sample(site,source,type,++id),source)],pagecount:1}},
  }))}]))};
}
function storage(site,initial){
  const records=new Map(initial),reads=[],writes=[];
  return {records,reads,writes,env:{[site.binding]:{
    async get(key,format){assert.equal(format,'json');reads.push(key);return structuredClone(records.get(key)||null);},
    async put(key,text,options){const value=JSON.parse(text);writes.push({key,value,options});records.set(key,value);},
  }}};
}

for(const site of sites){
  test(`${site.name}: a cold isolate reads one combined snapshot and keeps stale timestamps during an outage`,async t=>{
    const now=Date.parse('2026-10-21T02:00:00Z'),time=now-20*60000,initial=snapshot(site,time),cache=storage(site,[[HOME_SNAPSHOT_KEY,initial]]);
    const service=await freshService(site);let calls=0;
    t.mock.method(Date,'now',()=>now);t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('offline');});
    const result=await service.catalog(cache.env);
    assert.deepEqual(cache.reads,[HOME_SNAPSHOT_KEY],'the combined snapshot must be read only once per catalog');
    assert.equal(result.data.length,site.sources.reduce((sum,source)=>sum+site.homeTypes(source).length,0));
    assert(result.sources.every(source=>source.state==='stale'));
    assert.equal(result.meta.checkedAt,new Date(time).toISOString());assert.equal(result.meta.stale,true);
    assert.equal(calls,result.data.length);assert.equal(cache.writes.length,0);
    assert.deepEqual(cache.records.get(HOME_SNAPSHOT_KEY),initial);
  });

  test(`${site.name}: a source absent from the combined snapshot still uses its legacy bundle`,async t=>{
    const now=Date.parse('2026-10-21T02:00:00Z'),initial=snapshot(site,now-20*60000),missing=site.sources[0],legacy=initial.sources[missing.id];
    delete initial.sources[missing.id];
    const cache=storage(site,[[HOME_SNAPSHOT_KEY,initial],[`home:v1:${missing.id}`,legacy]]),service=await freshService(site);
    t.mock.method(Date,'now',()=>now);t.mock.method(globalThis,'fetch',async()=>{throw Error('offline');});
    const result=await service.catalog(cache.env);
    assert(result.sources.every(source=>source.state==='stale'));
    assert.deepEqual(cache.reads,[HOME_SNAPSHOT_KEY,`home:v1:${missing.id}`]);
    assert.equal(cache.writes.length,0);
  });

  test(`${site.name}: one refreshed snapshot retains failed sources/categories without extending inner expiry`,async t=>{
    let now=Date.parse('2026-10-21T02:00:00Z');
    const oldTime=now-6.9*86400000,initial=snapshot(site,oldTime),cache=storage(site,[[HOME_SNAPSHOT_KEY,initial]]);
    const failed=site.sources[0],partial=site.sources[1],partialType=site.types(partial)[0],partialKey=key(partial,partialType,site);
    const service=await freshService(site);let native=500000;
    t.mock.method(Date,'now',()=>now);
    t.mock.method(globalThis,'fetch',async input=>{
      const url=new URL(input),source=site.sources.find(source=>new URL(source.api).hostname===url.hostname),type=url.searchParams.has('t')?Number(url.searchParams.get('t')):undefined;
      if(source.id===failed.id||(source.id===partial.id&&type===partialType))throw Error('one source/category is offline');
      return Response.json({code:1,pagecount:1,list:[sample(site,source,type,++native)]});
    });
    const result=await service.refreshCatalogs(cache.env);
    assert.equal(cache.writes.length,1);assert.equal(cache.writes[0].key,HOME_SNAPSHOT_KEY);
    assert.equal(result.sources.find(source=>source.id===failed.id).state,'stale');
    const saved=cache.writes[0].value;
    assert.deepEqual(saved.sources[failed.id],initial.sources[failed.id]);
    assert.equal(saved.sources[partial.id].parts.find(part=>part.key===partialKey).entry.time,oldTime);
    assert(saved.sources[partial.id].parts.some(part=>part.entry.time===now),'successful categories keep their new timestamps');
    assert.deepEqual(cache.writes[0].options,{expirationTtl:604800});

    now+=.2*86400000;
    t.mock.method(globalThis,'fetch',async()=>{throw Error('offline');});
    const cold=await freshService(site),afterExpiry=await cold.catalog(cache.env);
    assert.equal(afterExpiry.sources.find(source=>source.id===failed.id).state,'error');
    assert(!afterExpiry.data.some(item=>item.source===failed.id),'rewriting the outer snapshot must not renew an expired inner source');
    assert.equal(cache.writes.length,1);
  });

  test(`${site.name}: all-source failure performs zero writes against a combined snapshot`,async t=>{
    const now=Date.parse('2026-10-21T02:00:00Z'),initial=snapshot(site,now-600000),cache=storage(site,[[HOME_SNAPSHOT_KEY,initial]]),service=await freshService(site);
    t.mock.method(Date,'now',()=>now);t.mock.method(globalThis,'fetch',async()=>{throw Error('offline');});
    const result=await service.refreshCatalogs(cache.env);
    assert(result.sources.every(source=>source.state==='stale'));
    assert.equal(cache.writes.length,0);assert.deepEqual(cache.records.get(HOME_SNAPSHOT_KEY),initial);
    assert.deepEqual(cache.reads,[HOME_SNAPSHOT_KEY]);
  });
}

test('snapshot size is bounded by UTF-8 bytes and an oversized update leaves the prior record untouched',async t=>{
  const old={version:2,sources:{}},records=new Map([[HOME_SNAPSHOT_KEY,old]]);let writes=0;
  const cache={async put(key,text){writes++;records.set(key,JSON.parse(text));}};
  const warnings=[];t.mock.method(console,'warn',message=>warnings.push(message));
  const bundles=new Map([['bf',{parts:[{key:'catalog:v1:bf:40:1:',entry:{time:Date.now(),value:{items:[{title:'雪'.repeat(Math.ceil(MAX_SNAPSHOT_BYTES/3))}],pagecount:1}}}]}]]);
  assert.equal(await writeHomeSnapshot(cache,bundles,true),false);
  assert.equal(writes,0);assert.equal(records.get(HOME_SNAPSHOT_KEY),old);assert.match(warnings[0],/8 MiB/);
});

test('snapshot validation drops expired, future and foreign-source parts rather than renewing them',()=>{
  const now=Date.now(),entry=time=>({time,value:{items:[],pagecount:1}});
  const bundle=usableBundle({parts:[
    {key:'catalog:v1:bf:40:1:',entry:entry(now-8*86400000)},
    {key:'catalog:v1:bf:41:1:',entry:entry(now+60000)},
    {key:'catalog:v1:ff:40:1:',entry:entry(now)},
    {key:'catalog:v1:bf:42:1:',entry:entry(now-1000)},
  ]},'bf',now);
  assert.deepEqual(bundle.parts.map(part=>part.key),['catalog:v1:bf:42:1:']);
});
