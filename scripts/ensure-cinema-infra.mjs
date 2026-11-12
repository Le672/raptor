import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw new Error('Cloudflare deployment credentials are missing');
const api='https://api.cloudflare.com/client/v4';
async function request(path,method='GET',body){
  const response=await fetch(api+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  const data=await response.json();if(!response.ok||!data.success)throw new Error(`Cloudflare infrastructure failed (${response.status}): ${JSON.stringify(data.errors||[])}`);return data.result;
}
const list=await request(`/accounts/${account}/storage/kv/namespaces?per_page=100`);
const ns=list.find(x=>x.title==='yukino-cinema-cache')||await request(`/accounts/${account}/storage/kv/namespaces`,'POST',{title:'yukino-cinema-cache'});
if(!ns?.id)throw new Error('Cannot locate dedicated cinema cache');
const privateKeyPath=`/accounts/${account}/storage/kv/namespaces/${ns.id}/values/private%3Amedia-key`;
const existing=await fetch(api+privateKeyPath,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});
if(existing.status===404){const saved=await fetch(api+privateKeyPath,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'text/plain'},body:randomBytes(48).toString('base64url'),signal:AbortSignal.timeout(30000)});if(!saved.ok)throw new Error('Cannot prepare private playback signing key');}
else if(!existing.ok)throw new Error('Cannot check private playback signing key');
const config=JSON.parse(await readFile('cinema/wrangler.jsonc','utf8'));config.kv_namespaces[0].id=ns.id;config.main='../server/worker.mjs';config.assets.directory='../dist';
try{const domains=await request(`/accounts/${account}/pages/projects/raptor/domains`),zone=domains.find(x=>x.name.endsWith('.yukino.bond')&&x.zone_tag)?.zone_tag;if(zone)config.routes[0].zone_id=zone;}catch{/* Wrangler resolves the custom domain zone. */}
await mkdir('cinema/.deploy',{recursive:true});await writeFile('cinema/.deploy/wrangler.json',JSON.stringify(config,null,2));
console.log('Dedicated cinema cache, private playback signing and custom domain are ready.');
