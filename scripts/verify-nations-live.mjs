const origin='https://games.yukino.bond',path='/age-of-nations/';
async function get(url){const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-cache'}});if(!response.ok)throw new Error(`Game request failed: ${response.status} ${url}`);return response;}
const html=await(await get(origin+path)).text();
if(!html.includes('列国纪元')||!html.includes('/age-of-nations/assets/'))throw new Error('The game path returned the portal or an obsolete game page');
const assets=[...html.matchAll(/(?:src|href)="(\/age-of-nations\/assets\/[^"?#]+\.(?:js|css))"/g)].map(match=>match[1]);
if(assets.length<2)throw new Error('Missing game JS/CSS entry assets');
for(const asset of assets){const response=await get(origin+asset),body=await response.text();if(/text\/html/.test(response.headers.get('content-type')||'')||body.trimStart().startsWith('<!'))throw new Error(`The SPA fallback intercepted ${asset}`);if(asset.endsWith('.js')){const worker=body.match(/ai\.worker-[\w-]+\.js/);if(!worker)throw new Error('Missing AI Worker reference');const workerResponse=await get(origin+path+'assets/'+worker[0]);if(!/(?:javascript|ecmascript)/.test(workerResponse.headers.get('content-type')||''))throw new Error('AI Worker has an incorrect MIME type');}}
const catalogue=await(await get(origin+'/')).text();if(catalogue.includes('<title>列国纪元'))throw new Error('Game catalogue root was replaced');
console.log(`Verified game document, ${assets.length} entry assets, AI Worker and the existing game catalogue.`);
