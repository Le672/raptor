import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/worker.mjs';
import {parseDetail,parseChapter,getChapter} from '../server/zongheng.mjs';
import {parseBook as parseBiquBook} from '../server/biqu.mjs';
import {bookIdValid,imageSource} from '../shared/sources.mjs';
import {persistSnapshot,stored,SNAPSHOT_KEY} from '../../novel/server/cache.mjs';

const html='<meta name="og:title" content="测试长篇"><meta name="og:novel:author" content="测试作者"><meta name="og:novel:status" content="连载中"><meta name="og:novel:update_time" content="2026-11-02 10:00:00">';
const catalog={code:0,result:{chapterList:[{tome:{tomeId:17,tomeName:'第一卷'},chapterViewList:[{bookId:23,chapterId:31,chapterName:'免费章',level:0},{bookId:23,chapterId:32,chapterName:'订阅章',level:1},{bookId:999,chapterId:33,chapterName:'其他作品',level:0}]}]}};
test('official directories preserve free/VIP boundaries and reject foreign-book chapters',()=>{
  const book=parseDetail(html,catalog,'23');assert.equal(book.id,'zongheng-23');assert.equal(book.author,'测试作者');assert.equal(book.volumes[0].chapters.length,2);
  assert.deepEqual(book.volumes[0].chapters.map(c=>c.restricted),[false,true]);assert.match(book.volumes[0].chapters[1].sourceUrl,/\/23\/32\.html$/);
  assert.equal(parseChapter('<h1>公开章</h1><div class="content" data-prescription="0" data-decoder=""><p>这是供测试的公开段落。</p><script>bad()</script></div>').blocks[0].text,'这是供测试的公开段落。');
  assert.throws(()=>parseChapter('<div class="content" data-prescription="1">订阅后阅读</div>'),error=>error.status===403);
});
test('a VIP or foreign chapter never causes an upstream body request',async t=>{
  let requests=0; t.mock.method(globalThis,'fetch',async url=>{requests++;return String(url).includes('getChapterList')?Response.json(catalog):new Response(html);});
  const env={},ctx={waitUntil:p=>p.catch(()=>{})};
  await assert.rejects(()=>getChapter(env,ctx,'zongheng-23','32'),e=>e.status===403);assert.equal(requests,2);
  await assert.rejects(()=>getChapter(env,ctx,'zongheng-23','33'),e=>e.status===404);assert.equal(requests,2);
});
test('large ordinary directories keep all chapters, leading-zero paths and stable chapter IDs',()=>{
  const links=Array.from({length:405},(_,i)=>`<li><a href="/chapter/00123/${String(i).padStart(9,'0')}.html">章 ${i}</a></li>`).join('');
  const b=parseBiquBook('<meta property="og:title" content="测试小说"><ul class="info">'+links+'</ul>','00123');
  assert.equal(b.id,'biqu-00123');assert.deepEqual(b.volumes.map(v=>v.chapters.length),[200,200,5]);assert.equal(new Set(b.volumes.flatMap(v=>v.chapters.map(c=>c.id))).size,405);
  assert.match(b.volumes[0].chapters[0].sourceUrl,/\/00123\/000000000\.html$/);
  assert.ok(bookIdValid('biqu-00123'));assert.ok(!bookIdValid('wenku-123'));assert.ok(!imageSource('https://static.zongheng.com.evil.test/upload/cover/a.jpg'));assert.ok(!imageSource('http://127.0.0.1/a.jpg'));
});
test('old light links migrate to LN while ordinary links stay in their own reader',async()=>{
  const env={ASSETS:{fetch:async()=>new Response('ordinary shell')}},ctx={};
  const old=await worker.fetch(new Request('https://novel.yukino.bond/read/wenku-1973/11/22?mode=night'),env,ctx);assert.equal(old.status,307);assert.equal(old.headers.get('Location'),'https://ln.yukino.bond/read/wenku-1973/11/22?mode=night');
  const ordinary=await worker.fetch(new Request('https://novel.yukino.bond/book/zongheng-672340'),env,ctx);assert.equal(ordinary.status,200);assert.equal(await ordinary.text(),'ordinary shell');
  const migration=await worker.fetch(new Request('https://novel.yukino.bond/migration/export'),env,ctx);assert.match(migration.headers.get('Content-Security-Policy'),/frame-ancestors https:\/\/ln\.yukino\.bond/);assert.equal(migration.headers.get('X-Frame-Options'),null);
});
test('both protected reader endpoints require login before any source access',async t=>{
  t.mock.method(globalThis,'fetch',()=>{throw new Error('must not fetch');});
  const response=await worker.fetch(new Request('https://novel.yukino.bond/api/book/zongheng-23/chapter/31'),{},{});assert.equal(response.status,401);const data=await response.json();assert.equal(data.code,'LOGIN_REQUIRED');assert.equal(new URL(new URL(data.loginUrl).searchParams.get('returnTo')).hostname,'novel.yukino.bond');
});
test('shared KV binding keeps the original light snapshot and ordinary snapshot independent',async()=>{
  const values=new Map(),binding={async get(key){return values.has(key)?JSON.parse(values.get(key)):null;},async put(key,value){values.set(key,value);}};
  const checkedAt=new Date().toISOString(),light={NOVEL_CACHE:binding,READER_CACHE_ORIGIN:'https://ln.yukino.bond'},ordinary={NOVEL_CACHE:binding,READER_CACHE_ORIGIN:'https://novel.yukino.bond'};
  await persistSnapshot(light,{'catalog:v1':{checkedAt,data:[{id:'8',title:'旧轻小说'}]}});
  await persistSnapshot(ordinary,{'catalog:v1':{checkedAt,data:[{id:'zongheng-23',title:'普通小说'}]}});
  assert.deepEqual([...values.keys()].sort(),[SNAPSHOT_KEY,'fiction:'+SNAPSHOT_KEY].sort());
  assert.equal((await stored({...light},'catalog:v1')).data[0].id,'8');assert.equal((await stored({...ordinary},'catalog:v1')).data[0].id,'zongheng-23');
});
