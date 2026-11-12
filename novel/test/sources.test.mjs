import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchHtml, parseLinovelList, parseLinovelBook, parseLinovelChapter, parseWenkuBook } from '../server/adapters.mjs';
import { parseWenkuCatalog, WENKU_CATALOG, WENKU_SITEMAP } from '../server/wenku-catalog.mjs';
import { imageSource, SOURCES, bookIdValid } from '../shared/sources.mjs';
import { normalizeBook } from '../server/service.mjs';
import worker from '../server/worker.mjs';
import * as fixture from './fixtures/sources.mjs';
import { authenticatedHeaders, portalIdentity } from './fixtures/access.mjs';

function environment(records={}) { const data=new Map(Object.entries(records));return{NOVEL_CACHE:{get:async key=>data.get(key)||null,put:async(key,value)=>data.set(key,JSON.parse(value))}}; }
const record=data=>({data,checkedAt:new Date().toISOString()});
const ctx={waitUntil:promise=>promise.catch(()=>{})};
const call=(path,env,authenticated=false)=>worker.fetch(new Request('https://test'+path,{headers:authenticated?authenticatedHeaders():{}}),env,ctx);

test('source parsers preserve namespace, source dates, and public versus subscription links',()=>{
  assert.deepEqual(parseLinovelChapter(fixture.linovelChapter).blocks,[{type:'text',text:'原创测试段落。'}]);
  const list=parseLinovelList(fixture.linovelList);assert.equal(list[0].id,'linovel-8');assert.equal(list[0].author,'纸页作者');
  assert.equal(parseLinovelBook(fixture.linovelDetail,'8').volumes[0].chapters.length,2);
  const wenku=parseWenkuBook(fixture.wenkuDetail,fixture.wenkuToc,'8');
  assert.equal(wenku.id,'wenku-8');assert.equal(wenku.volumes[0].chapters[0].sourceUrl,'https://www.wenku8.net/novel/0/8/11.htm');
  assert.match(wenku.cover,/https%3A/);assert.throws(()=>parseWenkuBook('<title>登录</title>','登录','8'),/未公开/);
});
test('public fetch decodes GBK and reports source restrictions and redirects',async()=>{
  assert.equal(await fetchHtml('https://test','gbk',async()=>new Response(new Uint8Array([0xd6,0xd0]))),'中');
  await assert.rejects(()=>fetchHtml('https://test','utf-8',async()=>new Response('',{status:403})),error=>error.status===403&&error.state==='restricted');
  await assert.rejects(()=>fetchHtml('https://test','utf-8',async(_url,options)=>{assert.equal(options.redirect,'manual');return new Response('',{status:302});}),/302/);
});
test('new image CDNs stay constrained to verified paths and raster formats',()=>{
  for(const url of ['https://rin.linovel.net/cover/20261019/8.jpg!min300jpg','http://img.wenku8.com/image/0/8/8s.jpg']) assert.match(imageSource(url),/^https:/);
  for(const url of ['https://rs.sfacg.com/web/novel/images/NovelCover/Big/a.jpg','https://rs.sfacg.com/api/account.jpg','https://rin.linovel.net/cover/a.svg','https://img.wenku8.com/image/0/8/8s.jpg@evil.test','https://rin.linovel.net:444/cover/a.png'])assert.equal(imageSource(url),'');
});
test('a restricted provider does not hide other sources or collide with legacy IDs',async t=>{
  const bili=normalizeBook({nid:8,name:'旧书架的书',labels:[]}),env=environment({'catalog:v1':record([bili])});
  t.mock.method(globalThis,'fetch',async url=>String(url).includes('linovel.net')?new Response(fixture.linovelList):new Response('',{status:403}));
  const response=await call('/api/books?source=all',env),result=await response.json();
  assert.equal(response.status,200);assert.deepEqual(result.data.items.map(x=>x.id).sort(),['8','linovel-8']);
  assert.equal(result.data.sources.length,6);assert.equal(result.data.sources.find(x=>x.id==='wenku').state,'restricted');
  assert.equal((await call('/api/books?source=evil',env)).status,400);
});
test('source search keeps remote alias matches while isolating a failed search',async t=>{
  const env=environment({'catalog:v1':record([])});
  t.mock.method(globalThis,'fetch',async url=>String(url).includes('linovel.net')?new Response(fixture.linovelList):new Response('',{status:403}));
  const result=await(await call('/api/books?source=all&q=别名',env)).json();
  assert.equal(result.data.items[0].id,'linovel-8');assert.equal(result.data.sources.find(x=>x.id==='wenku').state,'restricted');
});
test('chapter endpoints validate book membership and never fetch known VIP chapters',async t=>{
  const book=parseLinovelBook(fixture.linovelDetail,'8');book.volumes[0].chapters[1].restricted=true;
  const env=environment({'detail:v2:linovel-8':record(book)});let fetches=0;
  t.mock.method(globalThis,'fetch',async url=>{const portal=portalIdentity(url);if(portal)return portal;fetches++;return new Response(fixture.linovelChapter);});
  assert.equal((await call('/api/book/linovel-8/volume/999',env)).status,404);
  assert.equal((await call('/api/book/linovel-8/chapter/999',env,true)).status,404);
  assert.equal((await call('/api/book/linovel-8/chapter/12',env,true)).status,403);assert.equal(fetches,0);
  const chapter=await(await call('/api/book/linovel-8/chapter/11',env,true)).json();assert.equal(chapter.data.volumeId,'11');assert.equal(fetches,1);
});
test('an explicit chapter restriction cannot fall back to a previously cached body',async t=>{
  const book=parseLinovelBook(fixture.linovelDetail,'8'),env=environment({'detail:v2:linovel-8':record(book),'text:v2:linovel-8:11':{data:{blocks:[{type:'text',text:'old'}]},checkedAt:'2020-01-01T00:00:00Z'}});
  t.mock.method(globalThis,'fetch',async url=>portalIdentity(url)||new Response('',{status:403}));
  const response=await call('/api/book/linovel-8/chapter/11?refresh=1',env,true);assert.equal(response.status,403);assert.match((await response.json()).error,/登录/);
});
test('deep links render the app without redirecting the reader to the homepage',async()=>{
  const env={ASSETS:{fetch:async request=>new URL(request.url).pathname==='/'?new Response('<html>novel app</html>',{headers:{'Content-Type':'text/html'}}):new Response(null,{status:404})}};
  for(const path of ['/sources','/book/wenku-1973','/read/linovel-8/11/11']){
    const response=await call(path,env);assert.equal(response.status,200);assert.equal(response.headers.get('location'),null);assert.match(await response.text(),/novel app/);
  }
  assert.equal((await call('/missing.png',env)).status,404);
});
test('a Wenku server restriction is visible in source health and keeps an external reading entry',async t=>{
  const pending=[],context={waitUntil:promise=>pending.push(promise)},env=environment({'feed:v2:wenku':record(parseWenkuCatalog(fixture.wenkuCatalog,fixture.wenkuSitemap))});
  t.mock.method(globalThis,'fetch',async()=>new Response('',{status:403}));
  const response=await worker.fetch(new Request('https://test/api/book/wenku-8'),env,context);
  assert.equal(response.status,403);assert.equal((await response.json()).sourceUrl,'https://www.wenku8.net/book/8.htm');
  await Promise.all(pending);
  const status=await(await call('/api/status?source=wenku',env)).json();assert.equal(status.data.sources[0].state,'restricted');assert.equal(status.data.indexed,1);assert.match(status.data.sources[0].reason,/书目可检索/);
});

test('Wenku catalog cross-checks official book IDs and keeps the newest duplicate row',()=>{
  const current=fixture.wenkuCatalog.pages['1'][0];
  const index={pages:{1:[current,{...current,aid:999},{...current,aid:9}],2:[{aid:8,title:'旧书名',author:'旧作者'}]}};
  const sitemap=fixture.wenkuSitemap+'<loc>https://evil.test/book/9.htm</loc><loc>https://www.wenku8.net/book/999.htm?fake=1</loc>';
  const books=parseWenkuCatalog(index,sitemap);
  assert.equal(books.length,1);assert.equal(books[0].id,'wenku-8');assert.equal(books[0].title,current.title);
  assert.equal(books[0].updatedAt,'2026-10-31T16:00:00.000Z');assert.deepEqual(books[0].tags,['幻想','校园','测试文库']);
  assert.equal(books[0].sourceUrl,'https://www.wenku8.net/book/8.htm');assert.match(books[0].cover,/^\/api\/image\?src=/);
  assert.equal(parseWenkuCatalog({pages:{1:[...Array(150).fill(null),current]}},fixture.wenkuSitemap).length,1,'some upstream pages contain more than one hundred rows');
  assert.throws(()=>parseWenkuCatalog(index,'<title>登录</title>'),/站点地图/);
  assert.throws(()=>parseWenkuCatalog({pages:[]},fixture.wenkuSitemap),/格式变化/);
  assert.throws(()=>parseWenkuCatalog({pages:{1:[{aid:8,title:''}]}},fixture.wenkuSitemap),/没有有效匹配/);
});

test('fresh Wenku browsing and title, author, tag searches work without previously opened books',async t=>{
  const env=environment(),requested=[];
  t.mock.method(globalThis,'fetch',async url=>{
    requested.push(String(url));
    if(String(url)===WENKU_SITEMAP)return new Response(fixture.wenkuSitemap);
    if(String(url)===WENKU_CATALOG)return Response.json(fixture.wenkuCatalog);
    throw new Error(`Unexpected source request: ${url}`);
  });
  for(const query of ['', '灯塔', '纸页作者', '校园']){
    const response=await call(`/api/books?source=wenku&q=${encodeURIComponent(query)}`,env),result=await response.json();
    assert.equal(response.status,200);assert.equal(result.data.total,1);assert.equal(result.data.items[0].id,'wenku-8');assert.equal(result.data.sources[0].state,'ok');
  }
  assert.deepEqual(requested.sort(),[WENKU_CATALOG,WENKU_SITEMAP].sort(),'metadata and official sitemap only; no detail-page crawl');
});

test('empty Wenku index cannot erase a successful cached catalog',async t=>{
  const books=parseWenkuCatalog(fixture.wenkuCatalog,fixture.wenkuSitemap);
  const env=environment({'feed:v2:wenku':{data:books,checkedAt:new Date(Date.now()-600000).toISOString()}});
  t.mock.method(globalThis,'fetch',async url=>portalIdentity(url)||(String(url)===WENKU_SITEMAP?new Response(fixture.wenkuSitemap):Response.json({pages:{}})));
  const response=await call('/api/books?source=wenku&refresh=1',env,true),result=await response.json();
  assert.equal(response.status,200);assert.equal(result.data.total,1);assert.equal(result.data.sources[0].state,'stale');assert.equal(result.meta.stale,true);assert.match(result.data.sources[0].reason,/有效匹配/);
});

test('removed source never returns old cached books or triggers source requests',async t=>{
  const env=environment({'feed:v2:sf':record([{id:'sf-8',title:'old'}]),'detail:v2:sf-8':record({id:'sf-8',title:'old'})});
  let fetches=0;t.mock.method(globalThis,'fetch',async()=>{fetches++;throw new Error('must not fetch');});
  assert.deepEqual(SOURCES.map(source=>source.id),['bili','linovel','wenku','kxg','encyclopedia','rezero']);assert.equal(bookIdValid('sf-8'),false);
  for(const path of ['/api/books?source=sf','/api/status?source=sf','/api/book/sf-8','/api/book/sf-8/chapter/11'])assert.equal((await call(path,env)).status,410,path);
  assert.equal(fetches,0);
});
