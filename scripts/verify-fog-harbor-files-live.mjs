const origin='https://games.yukino.bond',base='/fog-harbor-files/';
async function get(path){const r=await fetch(origin+path,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Mystery request failed ${r.status}: ${path}`);return r;}
const html=await(await get(base)).text();if(!html.includes('雾港档案')||!html.includes(base+'assets/'))throw new Error('Mystery URL returned wrong document');
const refs=[...html.matchAll(/(?:src|href)="(\/fog-harbor-files\/assets\/[^"?#]+\.(?:js|css))"/g)].map(m=>m[1]);if(refs.length<2)throw new Error('Missing game JS/CSS');
for(const ref of refs){const r=await get(ref);if((r.headers.get('Content-Type')||'').includes('text/html'))throw new Error('SPA fallback intercepted mystery asset');}
const manifest=await(await get(base+'offline-manifest.json')).json();if(!manifest.files.some(path=>path.endsWith('/art/archive.svg')))throw new Error('Archive art missing');
await get(base+'art/archive.svg');await get(base+'privacy.html');await get(base+'sw.js');
for(const headers of [{},{Authorization:'Bearer forged-session'}]){
 let ready=false;
 for(let attempt=0;attempt<5;attempt++){
  const r=await fetch(origin+'/api/games/fog-harbor-files/session',{headers:{...headers,'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)}),body=await r.json();
  if(r.status===401&&body.code==='LOGIN_REQUIRED'&&body.available===true&&body.storage==='d1'){ready=true;break;}
  if(attempt<4)await new Promise(resolve=>setTimeout(resolve,3000));
 }
 if(!ready)throw new Error('Mystery D1 must be ready and reject missing or forged sessions');
}
console.log(`Verified Fog Harbor Files document, ${refs.length} assets, case artwork, offline manifest and available authenticated D1 API.`);
