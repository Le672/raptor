import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCES,normalize,mergeCatalog,publicUrl,plain} from '../server/sources.mjs';
import {cached,catalog,upstream} from '../server/service.mjs';
import {mediaPath,verifyMedia,rewriteManifest} from '../server/media.mjs';
import worker from '../server/worker.mjs';
const source=SOURCES.find(s=>s.id==='bf'),sample={vod_id:875,type_id:41,type_name:'日韩动漫',vod_name:'测试番 &amp; 旅程',vod_year:'2026',vod_time:'2026-10-19 10:00:00',vod_remarks:'更新至第02集',vod_pic:'https://cdn.anime.example.com/cover.jpg',vod_content:'<p>一个故事 &amp; 旅程</p><script>bad()</script>',vod_play_from:'share$$$bfm3u8',vod_play_url:'第一集$https://cdn.anime.example.com/share/1$$$第01集$https://cdn.anime.example.com/video/index.m3u8#第02集$https://cdn.anime.example.com/video/2.m3u8#非法$javascript:alert(1)'};
test('normalizes public anime only and preserves original line and episode identifiers',()=>{
  const anime=normalize(sample,source);assert.equal(anime.title,'测试番 & 旅程');assert.equal(anime.description,'一个故事 & 旅程');assert.equal(anime.lines.length,1);assert.equal(anime.lines[0].id,'1');assert.equal(anime.lines[0].episodes.length,2);assert.equal(anime.updatedAt,'2026-10-19T10:00:00+08:00');
  assert.equal(normalize({...sample,type_id:31,type_name:'国产剧'},source),null);assert.equal(normalize({...sample,type_name:'里番动漫'},source),null);assert.equal(normalize({...sample,vod_id:'bad'},source),null);
  const merged=mergeCatalog([anime,{...anime,id:'ff-25',source:'ff',sourceName:'非凡'}]);assert.equal(merged.length,1);assert.equal(merged[0].variants.length,2);assert(!('lines'in merged[0]));assert(!('imageUrl'in merged[0]));assert.equal(plain('<style>bad</style><p>good &lt; text</p>'),'good < text');
});
test('refuses internal addresses, alternate schemes, embedded credentials and ports',()=>{
  for(const url of ['http://127.0.0.1/x','http://0x7f000001/x','http://[::1]/','http://localhost/','http://service.internal/x','file:///x','javascript:alert(1)','https://user:pass@cdn.example.com/a','https://cdn.example.com:8080/a'])assert.equal(publicUrl(url),null,url);
  assert(publicUrl('https://cdn.example.com/a.m3u8'));
  assert(publicUrl('https://kkzycdn.com:65/video/part.ts'));assert.equal(publicUrl('https://other.example.com:65/part.ts'),null);
});
test('signs playback links, rejects tampering and rewrites HLS media, sub-playlists and key URIs',async()=>{
  const env={COMIC_MEDIA_SECRET:'a-long-test-key'};const path=await mediaPath(env,'https://cdn.example.com/video/index.m3u8');const token=new URL(path,'https://comic.yukino.bond').searchParams.get('token');assert.equal((await verifyMedia(env,token)).u,'https://cdn.example.com/video/index.m3u8');await assert.rejects(verifyMedia(env,token+'bad'),{status:403});const expired=await mediaPath(env,'https://cdn.example.com/x.m3u8',Date.now()-1000);await assert.rejects(verifyMedia(env,new URL(expired,'https://comic.yukino.bond').searchParams.get('token')),{status:403});
  const text=await rewriteManifest('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXT-X-STREAM-INF:BANDWIDTH=100\nlevel/index.m3u8\n#EXTINF:6,\n../part.ts\n','https://cdn.example.com/video/index.m3u8',env,Date.now()+60000);
  assert(!text.includes('URI="key.bin"'));assert(text.includes('URI="/api/media?token='));for(const link of text.split('\n').filter(x=>x.startsWith('/api/'))){const value=await verifyMedia(env,new URL(link,'https://comic.yukino.bond').searchParams.get('token'));assert(value.u.startsWith('https://cdn.example.com/'));}
  await assert.rejects(rewriteManifest('<html>no video</html>','https://cdn.example.com/a',env,Date.now()+60000));await assert.rejects(rewriteManifest('#EXTM3U\nhttp://127.0.0.1/secret','https://cdn.example.com/a',env,Date.now()+60000));
});
test('retains last successful cache with its original timestamp on an upstream failure',async()=>{
  const old={time:Date.now()-600000,value:{items:['saved']}};const env={COMIC_CACHE:{get:async()=>old,put:async()=>{throw Error('KV offline');}}};const result=await cached(env,'stale-test',async()=>{throw Error('upstream offline');});assert.equal(result.stale,true);assert.deepEqual(result.value.items,['saved']);assert.equal(result.checkedAt,new Date(old.time).toISOString());assert.equal(result.reason,'upstream offline');
});
test('keeps partial multi-source results and reports failed providers explicitly',async t=>{
  t.mock.method(globalThis,'fetch',async(input)=>{const u=new URL(input);if(u.hostname!=='bfzyapi.com')throw Error('offline');return Response.json({code:1,pagecount:2,list:[sample,{...sample,vod_id:876,type_id:31,type_name:'国产剧'}]});});
  const result=await catalog({},new URLSearchParams('q=partial-test'));assert.equal(result.data.length,1);assert.equal(result.sources.find(x=>x.id==='bf').state,'ok');assert.equal(result.sources.find(x=>x.id==='ff').state,'error');assert.equal(result.hasMore,true);
});
test('uses the Cloudflare-compatible manual redirect mode and refuses source redirects',async t=>{
  let mode;
  t.mock.method(globalThis,'fetch',async(_url,options)=>{mode=options.redirect;return new Response('',{status:302,headers:{Location:'https://other.example.com/'}});});
  await assert.rejects(upstream(source,{ac:'detail',t:41}),/HTTP 302/);assert.equal(mode,'manual');
});
test('serves deep links and protects the media proxy while returning only episode metadata',async t=>{
  const env={COMIC_MEDIA_SECRET:'test-secret',ASSETS:{fetch:async request=>new URL(request.url).pathname==='/index.html'?new Response('<div id="root"></div>',{headers:{'Content-Type':'text/html'}}):new Response('not found',{status:404})}};
  const deep=await worker.fetch(new Request('https://comic.yukino.bond/watch/bf-875/1/0'),env,{});assert.equal(deep.status,200);assert.match(await deep.text(),/id="root"/);assert.match(deep.headers.get('Content-Security-Policy'),/media-src 'self' blob:/);
  assert.equal((await worker.fetch(new Request('https://comic.yukino.bond/api/media?url=https://localhost/x'),env,{})).status,403);assert.equal((await worker.fetch(new Request('https://comic.yukino.bond/api/catalog',{method:'POST'}),env,{})).status,405);
  t.mock.method(globalThis,'fetch',async input=>{const u=new URL(input);if(u.hostname==='bfzyapi.com')return Response.json({code:1,list:[{...sample,vod_id:999}]});if(u.pathname.endsWith('.m3u8'))return new Response('#EXTM3U\n#EXTINF:6,\nchunk.ts\n#EXT-X-ENDLIST',{headers:{'Content-Type':'application/vnd.apple.mpegurl'}});return new Response(new Uint8Array([71,64,0,0]),{headers:{'Content-Type':'video/mp2t'}});});
  const details=await(await worker.fetch(new Request('https://comic.yukino.bond/api/anime/bf-999'),env,{})).json();assert.equal(details.data.lines[0].episodes[0].title,'第01集');assert(!('url'in details.data.lines[0].episodes[0]));
  const play=await(await worker.fetch(new Request('https://comic.yukino.bond/api/anime/bf-999/play?line=1&episode=0'),env,{})).json();assert(play.data.url.startsWith('/api/media?token='));const manifest=await worker.fetch(new Request(new URL(play.data.url,'https://comic.yukino.bond')),env,{});assert.equal(manifest.status,200);assert.match(await manifest.text(),/\/api\/media\?token=/);
});
