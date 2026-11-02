import {mkdir,writeFile} from 'node:fs/promises';
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw new Error('Cloudflare deployment credentials are missing');
async function api(path,method='GET',body){
  const response=await fetch('https://api.cloudflare.com/client/v4'+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  const result=await response.json();if(!response.ok||!result.success)throw new Error(`Cloudflare routing failed (${response.status}; ${result.errors?.map(e=>e.code).join(',')})`);return result.result;
}
const zones=await api('/zones?name=yukino.bond'),zone=zones.find(z=>z.name==='yukino.bond');
if(!zone)throw new Error('The existing Yukino zone is missing');
const root=`/zones/${zone.id}`,routes=await api(root+'/workers/routes'),before={routes:routes.filter(r=>/^(?:ln|novel)\.yukino\.bond\//.test(r.pattern)),dns:[]};
await mkdir('.wrangler',{recursive:true});
for(const [host,script]of [['ln.yukino.bond','yukino-ln'],['novel.yukino.bond','yukino-novel']]){
  const records=await api(root+'/dns_records?name='+host);before.dns.push(...records);
  await writeFile('.wrangler/reader-routing-before.json',JSON.stringify(before,null,2));
  // Routes intercept the existing proxied hostname. Keep the old novel Tunnel
  // CNAME intact so the origin can be restored without a destructive DNS change.
  if(!records.length)await api(root+'/dns_records','POST',{type:'AAAA',name:host,content:'100::',proxied:true,ttl:1});
  else if(records.some(r=>!r.proxied))throw new Error(`${host}: existing DNS must be proxied before the reader route can serve it`);
  const pattern=host+'/*',existing=routes.find(r=>r.pattern===pattern);
  if(existing?.script===script){console.log(`${host}: existing reader route kept`);continue;}
  await api(root+'/workers/routes'+(existing?'/'+existing.id:''),existing?'PUT':'POST',{pattern,script});
  console.log(`${host}: connected to ${script}`);
}
