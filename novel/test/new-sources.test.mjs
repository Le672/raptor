import test from 'node:test';
import assert from 'node:assert/strict';
import { parseKxgList,parseKxgBook,parseKxgChapter,parseEncyclopediaBook,parseEncyclopediaChapter,parseRezeroBook,parseRezeroChapter,encyclopediaCatalog,newSourceAdapters } from '../server/new-source-adapters.mjs';
import { SOURCES,bookIdValid,bookSource,sourceBookUrl,imageSource } from '../shared/sources.mjs';
import { allCatalog,findBooks } from '../server/multi-source.mjs';
import * as fixture from './fixtures/new-sources.mjs';

test('Kxg includes only Japanese light novels and reads their complete same-book TOC',()=>{
  const list=parseKxgList(fixture.kxgList+fixture.kxgList.replaceAll('日本轻小说','都市小说').replaceAll('/info/8','/info/9'));
  assert.equal(list.length,1);assert.equal(list[0].id,'kxg-8');assert.equal(list[0].author,'纸页作者');
  const book=parseKxgBook(fixture.kxgBook,fixture.kxgToc,'8');assert.equal(book.author,'纸页作者');assert.equal(book.volumes.length,2);
  assert.deepEqual(book.volumes.flatMap(v=>v.chapters.map(c=>c.id)),['11','12']);
  assert.throws(()=>parseKxgBook(fixture.kxgBook.replaceAll('日本轻小说','都市小说'),fixture.kxgToc,'8'),error=>error.status===404);
  assert.throws(()=>parseKxgBook(fixture.kxgBook,'<h2>空目录</h2>','8'),/完整公开目录/);
});

test('new chapter parsers keep actual content and credits, normalize images and discard executable markup',()=>{
  const kxg=parseKxgChapter(fixture.kxgChapter,'https://kxgxs.com/index.php/book/read/8/11');
  assert.equal(kxg.blocks.filter(b=>b.type==='image').length,1);assert.ok(!JSON.stringify(kxg).includes('unsafe'));
  const encyclopedia=parseEncyclopediaChapter(fixture.encyclopediaChapter,'https://lnovel.org/chapters-11');assert.equal(encyclopedia.blocks.filter(b=>b.type==='image').length,1);
  const rezero=parseRezeroChapter(fixture.rezeroChapter,'https://re0zero.top/mdbook/book/markdown/ch/chapter010/00.html');
  assert.ok(rezero.blocks.some(b=>b.type==='text'&&b.text.includes('翻译与校对说明')));assert.equal(rezero.blocks.filter(b=>b.type==='image').length,1);
  for(const parse of [parseKxgChapter,parseEncyclopediaChapter,parseRezeroChapter])assert.throws(()=>parse('<title>登录</title>','https://test'),/正文/);
  assert.throws(()=>parseRezeroChapter('<main><h1>只有标题</h1></main>','https://re0zero.top/'),/未返回可阅读内容|正文为空/);
  assert.throws(()=>parseRezeroChapter('<main><h1>序章</h1><p>暂无译文，敬请期待。</p></main>','https://re0zero.top/'),/尚未公开完整中文译文/);
});

test('encyclopedia bootstraps all actual public title pages and refreshes only two when an index exists',async()=>{
  const requested=[],fetcher=async url=>{requested.push(url);return url.includes('?page=2')?fixture.encyclopediaSecond:fixture.encyclopediaList;};
  const initial=await encyclopediaCatalog([],fetcher);assert.deepEqual(initial.map(b=>b.id),['encyclopedia-8','encyclopedia-9']);assert.equal(requested.length,2);
  const previous=Array.from({length:145},(_,i)=>({...initial[0],id:`encyclopedia-${i+100}`}));requested.length=0;
  const refreshed=await encyclopediaCatalog(previous,fetcher);assert.equal(requested.length,2);assert.equal(refreshed.length,147);
  await assert.rejects(()=>encyclopediaCatalog([],async url=>url.includes('?')?'<title>登录</title>':fixture.encyclopediaList),/分页为空/);
  await assert.rejects(()=>encyclopediaCatalog([],async()=>fixture.encyclopediaList),/分页结构变化/);
});

test('encyclopedia detail binds public chapter IDs to the selected book and exposes source update time',()=>{
  const book=parseEncyclopediaBook(fixture.encyclopediaBook,'8');assert.equal(book.author,'纸页作者');assert.equal(book.volumes[0].chapters.length,1);
  assert.equal(book.volumes[0].chapters[0].sourceUrl,'https://lnovel.org/chapters-11');assert.equal(book.updatedAt,'2026-10-31T16:00:00.000Z');
  assert.throws(()=>parseEncyclopediaBook('<h1>登录</h1>','8'),/公开目录/);
});

test('Re0 is a single translated WEB series, with stable chapter links and no raw-language or foreign entries',()=>{
  const book=parseRezeroBook(fixture.rezeroBook);assert.equal(book.id,'rezero-1');assert.equal(book.author,'长月达平');assert.equal(book.volumes[0].chapters.length,2);
  assert.ok(book.volumes[0].chapters.every(c=>/^v[0-9a-f]{8}$/.test(c.id)));assert.deepEqual(parseRezeroBook(fixture.rezeroBook).volumes,book.volumes);
  assert.equal(bookIdValid('rezero-2'),false);assert.equal(bookIdValid('rezero-1'),true);assert.equal(bookIdValid('sf-8'),false);
  for(const id of ['kxg-8','encyclopedia-8','rezero-1'])assert.equal(bookSource(id),id.split('-')[0]);
  assert.equal(sourceBookUrl('rezero-1'),'https://re0zero.top/mdbook/book/index.html');assert.equal(SOURCES.length,6);
});

test('new adapters reject foreign chapter URLs and unknown Re0 book IDs before fetching',async t=>{
  let fetches=0;t.mock.method(globalThis,'fetch',async()=>{fetches++;throw new Error('must not fetch');});
  for(const adapter of Object.values(newSourceAdapters))await assert.rejects(()=>adapter.chapter('https://evil.test/chapters-11'),error=>error.status===400);
  await assert.rejects(()=>newSourceAdapters.rezero.book('2'),error=>error.status===404);assert.equal(fetches,0);
  for(const url of ['https://kxgxs.com/api/private.jpg','https://lnovel.org/api/user.jpg','https://re0zero.top/private.jpg','https://kxgxs.com:444/uploads/novel-covers/a.jpg'])assert.equal(imageSource(url),'');
});

test('new source feeds and locally indexed title search work on a clean instance',async t=>{
  const env={},ctx={waitUntil:promise=>promise.catch(()=>{})};
  t.mock.method(newSourceAdapters.kxg,'catalog',async()=>parseKxgList(fixture.kxgList));
  t.mock.method(newSourceAdapters.kxg,'search',async()=>parseKxgList(fixture.kxgList));
  t.mock.method(newSourceAdapters.encyclopedia,'catalog',async()=>encyclopediaCatalog([],async url=>url.includes('?')?fixture.encyclopediaSecond:fixture.encyclopediaList));
  t.mock.method(newSourceAdapters.rezero,'catalog',async()=>{const {volumes,...book}=parseRezeroBook(fixture.rezeroBook);return[book];});
  for(const source of ['kxg','encyclopedia','rezero']){
    const result=await allCatalog(env,ctx,new URLSearchParams({source}));assert.ok(result.data.length);assert.equal(result.sources[0].state,'ok');
    const search=await findBooks(env,ctx,new URLSearchParams({source,q:source==='rezero'?'从零':'灯塔'}));assert.ok(search.data.items.length);
  }
});
