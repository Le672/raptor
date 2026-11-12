import assert from 'node:assert/strict';
import {ProxyAgent,setGlobalDispatcher} from 'undici';
const proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;if(proxy)setGlobalDispatcher(new ProxyAgent(proxy));
async function get(origin,path){const r=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(40000),cache:'no-store'});assert.equal(r.status,200,`${origin}${path}: ${r.status}`);return r;}
for(const [kind,origin,name]of [['light','https://ln.yukino.bond','轻小说书房'],['fiction','https://novel.yukino.bond','小说书房']]){
  let error;
  for(let attempt=0;attempt<12;attempt++){try{const html=await(await get(origin,'/install')).text();assert.ok(html.includes(`name="reader-kind" content="${kind}"`));error=null;break;}catch(e){error=e;await new Promise(done=>setTimeout(done,5000));}}
  if(error)throw error;
  const manifest=await(await get(origin,'/manifest.webmanifest')).json();assert.equal(manifest.short_name,name);assert.equal(manifest.display,'standalone');
  const png=Buffer.from(await(await get(origin,'/icons/icon-512.png')).arrayBuffer());assert.equal(png.readUInt32BE(16),512);
  const sw=await get(origin,'/sw.js');assert.match(sw.headers.get('Cache-Control'),/no-store/);
  for (const [path, type] of [['/preview/', 'text/html'], ['/preview/reading.css', 'text/css'], ['/preview/book.svg', 'image/svg+xml']]) {
    const preview = await get(origin, path);
    assert.equal(preview.headers.get('Content-Type')?.split(';')[0].trim(), type);
    assert.equal(preview.headers.get('X-Yukino-Delivery'), 'static-reader');
    assert.equal(preview.headers.has('Permissions-Policy'), false, `${path} must bypass the reader Worker`);
    if (type === 'text/html') {
      const html = await preview.text();
      assert.match(html, /免登录选读/);
      assert.match(html, /一屠晚归/);
      assert.match(html, /奂山山市/);
      assert.doesNotMatch(html, /<script\b|\/api\//i);
    } else await preview.body?.cancel();
  }
  const access=await(await get(origin,'/api/access')).json();assert.equal(access.user,null);assert.equal(new URL(new URL(access.loginUrl).searchParams.get('returnTo')).origin,origin);
  const id=kind==='light'?'wenku-1973':'zongheng-672340';
  const detail=await(await get(origin,'/api/book/'+id)).json();assert.ok(detail.data?.title&&detail.data.volumes?.length);
  const volume=await(await get(origin,`/api/book/${id}/volume/${detail.data.volumes[0].id}`)).json();assert.ok(volume.data.chapters.length);
  const previewResponse=await get(origin,`/api/preview/${id}`);
  assert.equal(previewResponse.headers.get('X-Yukino-Origin'),'vps-content');
  assert.equal(previewResponse.headers.get('X-Yukino-Delivery'),'vps-reader-preview');
  const {data: excerpt}=await previewResponse.json();
  assert.equal(excerpt.bookTitle,detail.data.title);
  assert.ok(excerpt.chapterId&&excerpt.volumeId&&excerpt.paragraphs.length);
  assert.ok(Array.from(excerpt.paragraphs.join('')).length<=1800);
  const rejected=await fetch(`${origin}/api/preview/${id}?refresh=1`,{signal:AbortSignal.timeout(10000)});
  assert.equal(rejected.status,404);
  assert.equal(rejected.headers.get('X-Yukino-Origin'),'vps-content');
  const chapter=await fetch(`${origin}/api/book/${id}/chapter/${volume.data.chapters[0].id}`,{signal:AbortSignal.timeout(30000)});assert.equal(chapter.status,401);assert.equal((await chapter.json()).code,'LOGIN_REQUIRED');
  const search=await(await get(origin,'/api/books?'+new URLSearchParams(kind==='light'?{source:'wenku',q:'实力'}:{source:'zongheng',q:'剑来'}))).json();assert.ok(search.data.items.some(b=>kind==='light'?b.title.includes('实力'):b.id==='zongheng-672340'),'Native search must return the real expected work');
  console.log(JSON.stringify({origin,name,search:search.data.total,title:detail.data.title,volumes:detail.data.volumes.length,pwa:true,preview:true,chapterGate:401}));
}
const redirect=await fetch('https://novel.yukino.bond/book/wenku-1973',{redirect:'manual',signal:AbortSignal.timeout(20000)});assert.equal(redirect.status,307);assert.equal(redirect.headers.get('Location'),'https://ln.yukino.bond/book/wenku-1973');
const transfer=await get('https://novel.yukino.bond','/migration/export');assert.match(transfer.headers.get('Content-Security-Policy'),/frame-ancestors https:\/\/ln\.yukino\.bond/);assert.equal(transfer.headers.get('X-Frame-Options'),null);assert.match(transfer.headers.get('Cache-Control'),/no-store/);
console.log('Both readers, native searches, real directories, install manifests, old links and migration boundary verified.');
