import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchHtml, parseSfList, parseSfBook, parseSfChapter, parseLinovelList, parseLinovelBook, parseWenkuBook } from '../server/adapters.mjs';
import { imageSource } from '../shared/sources.mjs';
import { normalizeBook } from '../server/service.mjs';
import worker from '../server/worker.mjs';
import * as fixture from './fixtures/sources.mjs';

function environment(records={}) { const data=new Map(Object.entries(records));return{NOVEL_CACHE:{get:async key=>data.get(key)||null,put:async(key,value)=>data.set(key,JSON.parse(value))}}; }
const record=data=>({data,checkedAt:new Date().toISOString()});
const ctx={waitUntil:promise=>promise.catch(()=>{})};
const call=(path,env)=>worker.fetch(new Request('https://test'+path),env,ctx);

test('source parsers preserve namespace, source dates, and public versus subscription links',()=>{
  const sf=parseSfBook(fixture.sfDetail,fixture.sfToc,'8');
  assert.equal(sf.id,'sf-8');assert.equal(sf.updatedAt,'2026-10-19T04:30:00.000Z');
  assert.equal(sf.volumes[0].chapters.length,2);assert.equal(sf.volumes[0].chapters[1].restricted,true);
  assert.match(sf.volumes[1].id,/^v[0-9a-f]{8}$/);
  assert.deepEqual(parseSfChapter(fixture.sfChapter).blocks,[{type:'text',text:'原创测试段落。'}]);
  assert.equal(parseSfList(fixture.sfList)[0].author,'灯塔作者');
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
  for(const url of ['https://rs.sfacg.com/web/novel/images/NovelCover/Big/a.jpg','https://rin.linovel.net/cover/20261019/8.jpg!min300jpg','http://img.wenku8.com/image/0/8/8s.jpg']) assert.match(imageSource(url),/^https:/);
  for(const url of ['https://rs.sfacg.com/api/account.jpg','https://rin.linovel.net/cover/a.svg','https://img.wenku8.com/image/0/8/8s.jpg@evil.test','https://rin.linovel.net:444/cover/a.png'])assert.equal(imageSource(url),'');
});
test('a restricted provider does not hide other sources or collide with legacy IDs',async t=>{
  const bili=normalizeBook({nid:8,name:'旧书架的书',labels:[]}),env=environment({'catalog:v1':record([bili])});
  t.mock.method(globalThis,'fetch',async url=>String(url).includes('linovel.net')?new Response(fixture.linovelList):new Response('',{status:403}));
  const response=await call('/api/books?source=all',env),result=await response.json();
  assert.equal(response.status,200);assert.deepEqual(result.data.items.map(x=>x.id).sort(),['8','linovel-8']);
  assert.equal(result.data.sources.find(x=>x.id==='sf').state,'restricted');assert.equal(result.data.sources.find(x=>x.id==='wenku').state,'limited');
  assert.equal((await call('/api/books?source=evil',env)).status,400);
});
test('source search keeps remote alias matches while isolating a failed search',async t=>{
  const env=environment({'catalog:v1':record([])});
  t.mock.method(globalThis,'fetch',async url=>String(url).includes('linovel.net')?new Response(fixture.linovelList):new Response('',{status:403}));
  const result=await(await call('/api/books?source=all&q=别名',env)).json();
  assert.equal(result.data.items[0].id,'linovel-8');assert.equal(result.data.sources.find(x=>x.id==='sf').state,'restricted');
});
test('chapter endpoints validate book membership and never fetch known VIP chapters',async t=>{
  const book=parseSfBook(fixture.sfDetail,fixture.sfToc,'8'),env=environment({'detail:v2:sf-8':record(book)});let fetches=0;
  t.mock.method(globalThis,'fetch',async()=>{fetches++;return new Response(fixture.sfChapter);});
  assert.equal((await call('/api/book/sf-8/volume/999',env)).status,404);
  assert.equal((await call('/api/book/sf-8/chapter/999',env)).status,404);
  assert.equal((await call('/api/book/sf-8/chapter/12',env)).status,403);assert.equal(fetches,0);
  const chapter=await(await call('/api/book/sf-8/chapter/11',env)).json();assert.equal(chapter.data.volumeId,'10');assert.equal(fetches,1);
});
test('an explicit chapter restriction cannot fall back to a previously cached body',async t=>{
  const book=parseSfBook(fixture.sfDetail,fixture.sfToc,'8'),env=environment({'detail:v2:sf-8':record(book),'text:v2:sf-8:11':{data:{blocks:[{type:'text',text:'old'}]},checkedAt:'2020-01-01T00:00:00Z'}});
  t.mock.method(globalThis,'fetch',async()=>new Response('',{status:403}));
  const response=await call('/api/book/sf-8/chapter/11?refresh=1',env);assert.equal(response.status,403);assert.match((await response.json()).error,/登录/);
});
