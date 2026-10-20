import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../server/worker.mjs';
import { adapters } from '../server/adapters.mjs';
import * as fixture from './fixtures/sources.mjs';
import { remember } from '../server/multi-source.mjs';
import { CACHE_LIMITS, KV_WRITES_PER_REFRESH, SNAPSHOT_KEY, SNAPSHOT_KEYS, cached, persist, stored, snapshotStatus, cacheUsage } from '../server/cache.mjs';

const time = '2026-10-20T00:00:00Z';
const entry = data => ({ data, checkedAt: time });
const raw = nid => ({ nid, name: `测试书 ${nid}`, labels: [], volumes: [], updatedAt: time });
const book = id => ({ id, title: `测试书 ${id}`, author: '作者', tags: [], updatedAt: time, volumes: [{ id: '1', title: '卷一', chapters: [{ id: '1', title: '一', sourceUrl: 'https://book.sfacg.com/Novel/1/1/1/' }] }] });
function environment(initial = {}, fail = false) {
  const records = new Map(Object.entries(initial)), puts = [];
  return { NOVEL_CACHE: {
    async get(key) { return records.get(key) || null; },
    async put(key, value) { puts.push({ key, value: JSON.parse(value) }); if (fail) throw new Error('KV put quota exceeded'); records.set(key, JSON.parse(value)); },
    puts, records,
  } };
}
function context() { const pending = []; return { waitUntil: task => pending.push(task), async finish() { for (let i = 0; i < pending.length; i++) await pending[i]; } }; }
async function call(env, path, ctx = context()) {
  const response = await worker.fetch(new Request(`https://novel.yukino.bond${path}`), env, ctx);
  const value = await response.json(); await ctx.finish(); return { response, value };
}
function sources(t, failed = () => false) {
  t.mock.method(globalThis, 'fetch', async url => {
    if(failed())return new Response('',{status:503});
    if (String(url).endsWith('/novels')) return Response.json({ ok: true, data: [raw(1)] });
    if (String(url).includes('/chapter/')) return Response.json({ ok: true, data: { nid: 1, vid: 1, cid: 1, title: '章节', content: '<p>成功正文</p>' } });
    if (String(url).includes('/vol/')) return Response.json({ ok: true, data: { nid: 1, vid: 1, title: '卷一', chapters: [{ nid: 1, vid: 1, cid: 1, title: '章节' }] } });
    return Response.json({ ok: true, data: raw(1) });
  });
  for (const source of ['sf', 'linovel']) {
    t.mock.method(adapters[source], 'catalog', async () => { if(failed())throw new Error('source down');return [book(`${source}-1`)]; });
    t.mock.method(adapters[source], 'search', async () => [book(`${source}-1`)]);
    t.mock.method(adapters[source], 'book', async id => book(`${source}-${id}`));
    t.mock.method(adapters[source], 'chapter', async () => ({ title: '一', blocks: [{ type: 'text', text: '成功正文' }] }));
  }
}

test('all visitor routes, manual refresh and concurrent distinct searches spend zero KV puts', async t => {
  sources(t);
  const env = environment({}, true);
  for (const path of ['/api/status?refresh=1', '/api/books?refresh=1', '/api/book/1?refresh=1', '/api/book/1/volume/1?refresh=1', '/api/book/1/chapter/1?refresh=1', '/api/book/sf-1?refresh=1', '/api/book/sf-1/chapter/1?refresh=1']) {
    const { response, value } = await call(env, path);
    assert.equal(response.status, 200, `${path}: ${JSON.stringify(value)}`);
  }
  const searches = await Promise.all(Array.from({ length: 35 }, (_, index) => call(env, `/api/books?source=sf&q=query-${index}&refresh=1`)));
  assert.ok(searches.every(item => item.response.status === 200));
  assert.equal(env.NOVEL_CACHE.puts.length, 0);
});

test('configured hourly Cron has one aggregate write per run and 24 writes per day including discovered books and health', async t => {
  sources(t);
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(time) });
  t.mock.method(adapters.wenku, 'book', async id => book(`wenku-${id}`));
  const env = environment(Object.fromEntries(['sf', 'linovel', 'wenku'].map(source => [`discovered:v2:${source}`, entry([book(`${source}-1`)])])));
  const config = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(config, /"crons":\s*\["40 \* \* \* \*"\]/);
  for (let hour = 0; hour < 24; hour++) {
    if(hour)t.mock.timers.tick(3600000);
    const ctx = context(), before = env.NOVEL_CACHE.puts.length;
    await worker.scheduled({ scheduledTime: Date.parse(time) + hour * 3600000 }, env, ctx); await ctx.finish();
    assert.ok(env.NOVEL_CACHE.puts.length - before <= KV_WRITES_PER_REFRESH);
  }
  assert.equal(env.NOVEL_CACHE.puts.length, 24);
  assert.equal(adapters.sf.catalog.mock.callCount(), 24, 'each hourly event must actually recheck the source');
  assert.ok(env.NOVEL_CACHE.puts.every(item => item.key === SNAPSHOT_KEY));
  const snapshot = env.NOVEL_CACHE.records.get(SNAPSHOT_KEY);
  assert.deepEqual(Object.keys(snapshot.records).sort(), [...SNAPSHOT_KEYS].sort());
  assert.equal((await snapshotStatus(env)).lastPersistedAt, '2026-10-20T23:00:00.000Z');
});

test('same-isolate concurrent Cron events coalesce and repeated same-hour events cannot retry puts', async t => {
  sources(t); const env = environment(), contexts = Array.from({ length: 20 }, context);
  await Promise.all(contexts.map(ctx => worker.scheduled({ scheduledTime: Date.parse(time) }, env, ctx)));
  await Promise.all(contexts.map(ctx => ctx.finish()));
  assert.equal(env.NOVEL_CACHE.puts.length, 1);
  const again = context(); await worker.scheduled({ scheduledTime: Date.parse(time) }, env, again); await again.finish();
  assert.equal(env.NOVEL_CACHE.puts.length, 1);
  const freshInstance = { NOVEL_CACHE: env.NOVEL_CACHE }, repeated = context();
  await worker.scheduled({ scheduledTime: Date.parse(time) }, freshInstance, repeated); await repeated.finish();
  assert.equal(env.NOVEL_CACHE.puts.length, 1, 'a new instance also skips a successfully persisted same-hour snapshot');
});

test('exhausted KV retains old durable snapshot, reports failure honestly and does not break successful reading', async t => {
  sources(t);
  const previous = { version: 3, hour: 1, checkedAt: '2026-10-19T00:00:00Z', records: { 'catalog:v1': entry([book('1')]) } };
  const env = environment({ [SNAPSHOT_KEY]: previous }, true), ctx = context();
  await worker.scheduled({ scheduledTime: Date.parse(time) }, env, ctx); await ctx.finish();
  assert.equal(env.NOVEL_CACHE.puts.length, 1);
  assert.deepEqual(env.NOVEL_CACHE.records.get(SNAPSHOT_KEY), previous);
  const status = await snapshotStatus(env);
  assert.equal(status.state, 'error'); assert.equal(status.lastPersistedAt, previous.checkedAt); assert.match(status.reason, /持久化暂不可用/);
  const { response, value } = await call(env, '/api/book/1/chapter/1?refresh=1');
  assert.equal(response.status, 200); assert.equal(value.data.blocks[0].text, '成功正文'); assert.equal(value.meta.stale, false);
});

test('edge cache failure cannot turn successful source content stale and memory stays bounded', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis,'caches');
  Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:{match:async()=>null,put:async()=>{throw new Error('Cache API full');}}}});
  t.after(()=>{if(original)Object.defineProperty(globalThis,'caches',original);else delete globalThis.caches;});
  const env = environment({}, true);
  const value = await cached(env, context(), 'live:chapter', async () => ['正文'], 60000);
  assert.deepEqual(value.data, ['正文']); assert.equal(value.meta.stale, false);
  for (let index = 0; index < 200; index++) await persist(env, `body:${index}`, { data:'a'.repeat(100000),checkedAt:new Date().toISOString() }, 600);
  const usage = cacheUsage(env);
  assert.ok(usage.entries <= CACHE_LIMITS.entries); assert.ok(usage.bytes <= CACHE_LIMITS.bytes);
  assert.equal(env.NOVEL_CACHE.puts.length, 0);
});

test('concurrent discovered books merge rather than overwriting one another, with no KV writes', async () => {
  const env = environment();
  await Promise.all(Array.from({ length: 20 }, (_, index) => remember(env, book(`sf-${index + 1}`))));
  assert.equal((await stored(env, 'discovered:v2:sf')).data.length, 20);
  assert.equal(env.NOVEL_CACHE.puts.length, 0);
});

test('another instance can reuse Cache API chapter content without KV or an upstream request', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis,'caches'), responses = new Map();
  Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:{
    match:async key=>responses.get(key.url)?.clone(),
    put:async(key,response)=>responses.set(key.url,response.clone()),
  }}});
  t.after(()=>{if(original)Object.defineProperty(globalThis,'caches',original);else delete globalThis.caches;});
  const first = environment(), second = environment();
  await cached(first,context(),'chapter:v1:8:11',async()=>['共享正文'],60000);
  second.NOVEL_CACHE.get = async()=>{throw new Error('KV unavailable');};
  const shared = await cached(second,context(),'chapter:v1:8:11',async()=>{throw new Error('should not fetch');},60000);
  assert.deepEqual(shared.data,['共享正文']);assert.equal(shared.meta.stale,false);
  assert.equal(first.NOVEL_CACHE.puts.length+second.NOVEL_CACHE.puts.length,0);
});

test('failed sources and freshly recorded health errors cannot renew old snapshots hour after hour', async t => {
  let down=false;
  const origin=Date.parse(time);t.mock.timers.enable({apis:['Date'],now:origin});sources(t,()=>down);
  t.mock.method(adapters.wenku,'book',async id=>{if(down)throw new Error('source down');return book(`wenku-${id}`);});
  const env=environment({'discovered:v2:wenku':entry([book('wenku-1')])}),first=context();
  await worker.scheduled({scheduledTime:origin},env,first);await first.finish();
  const saved=env.NOVEL_CACHE.records.get(SNAPSHOT_KEY);assert.equal(env.NOVEL_CACHE.puts.length,1);
  down=true;
  for(let hour=1;hour<5;hour++){t.mock.timers.tick(3600000);const ctx=context();await worker.scheduled({scheduledTime:origin+hour*3600000},env,ctx);await ctx.finish();}
  assert.equal(env.NOVEL_CACHE.puts.length,1);assert.deepEqual(env.NOVEL_CACHE.records.get(SNAPSHOT_KEY),saved);
  const status=await snapshotStatus(env);assert.equal(status.lastPersistedAt,saved.checkedAt);assert.equal(status.state,'stale');
});

test('edge and memory hydration preserve original expiry and expired snapshot records cannot resurrect',async t=>{
  const origin=Date.parse(time);t.mock.timers.enable({apis:['Date'],now:origin});
  const original=Object.getOwnPropertyDescriptor(globalThis,'caches'),response={data:['old'],checkedAt:new Date(origin-3600000+1000).toISOString()};
  Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:{match:async key=>key.url.includes('search%3A')?Response.json(response):undefined}}});
  t.after(()=>{if(original)Object.defineProperty(globalThis,'caches',original);else delete globalThis.caches;});
  const env=environment();assert.deepEqual((await stored(env,'search:v2:sf:old')).data,['old']);
  t.mock.timers.tick(1001);assert.equal(await stored(env,'search:v2:sf:old'),null);
  const expired={data:['expired'],checkedAt:new Date(origin-31*86400000).toISOString()};
  const old={version:3,hour:0,checkedAt:expired.checkedAt,records:{'catalog:v1':expired}};
  const cold=environment({[SNAPSHOT_KEY]:old,'catalog:v1':expired});
  assert.equal(await stored(cold,'catalog:v1'),null);
  assert.equal((await snapshotStatus(cold)).state,'expired');
  await assert.rejects(()=>cached(cold,context(),'catalog:v1',async()=>{throw new Error('source down');},60000),/source down/);
});

test('cold scheduled refresh with all known sources fits below 45 shared fetch and Cache API operations',async t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse(time)+3600000});
  let external=0,cacheOps=0;
  t.mock.method(globalThis,'fetch',async input=>{
    external++;const url=String(input);
    if(url.includes('/api/bili/novels'))return Response.json({ok:true,data:[raw(8)]});
    if(url.includes('sfacg.com/List'))return new Response(fixture.sfList);
    if(url.includes('MainIndex'))return new Response(fixture.sfToc);
    if(url.includes('sfacg.com/Novel'))return new Response(fixture.sfDetail);
    if(url.includes('linovel.net/cat'))return new Response(fixture.linovelList);
    if(url.includes('linovel.net/book'))return new Response(fixture.linovelDetail);
    return new Response(url.includes('/book/')?fixture.wenkuDetail:fixture.wenkuToc);
  });
  const original=Object.getOwnPropertyDescriptor(globalThis,'caches');
  Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:{match:async()=>{cacheOps++;return undefined;},put:async()=>{cacheOps++;}}}});
  t.after(()=>{if(original)Object.defineProperty(globalThis,'caches',original);else delete globalThis.caches;});
  const env=environment(Object.fromEntries(['sf','linovel','wenku'].map(source=>[`discovered:v2:${source}`,entry([book(`${source}-8`),book(`${source}-9`),book(`${source}-10`)])]))),ctx=context();
  await worker.scheduled({scheduledTime:Date.now()},env,ctx);await ctx.finish();
  console.log(`Cold novel Cron subrequests: ${external} fetch + ${cacheOps} Cache API = ${external+cacheOps}`);
  assert.equal(external,8);assert.ok(external+cacheOps<45,`${external} fetch + ${cacheOps} cache operations`);
  assert.equal(env.NOVEL_CACHE.puts.length,1);
});
