// Reuse each existing worker's bindings without reading or changing their values.
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw new Error('Existing deployment credentials required');
for(const site of ['cinema','comic']){
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/yukino-${site}/settings`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)}),data=await response.json();
 if(!response.ok||!data.success)throw new Error(`Cannot inspect ${site} bindings (${response.status})`);
 const settings=data.result,config={name:'yukino-'+site,main:resolve(site,'server/worker.mjs'),compatibility_date:settings.compatibility_date||'2026-10-19',compatibility_flags:settings.compatibility_flags||[],keep_vars:true,assets:{directory:resolve(site,'dist'),binding:'ASSETS',run_worker_first:true},observability:{enabled:true}};
 for(const b of settings.bindings||[]){
  if(['assets','plain_text','secret_text','json'].includes(b.type))continue;
  if(b.type==='kv_namespace')(config.kv_namespaces||=[]).push({binding:b.name,id:b.namespace_id});
  else if(b.type==='d1')(config.d1_databases||=[]).push({binding:b.name,database_id:b.id,database_name:b.name});
  else if(b.type==='service')(config.services||=[]).push({binding:b.name,service:b.service,...(b.environment?{environment:b.environment}:{})});
  else if(b.type==='r2_bucket')(config.r2_buckets||=[]).push({binding:b.name,bucket_name:b.bucket_name,...(b.jurisdiction?{jurisdiction:b.jurisdiction}:{})});
  else throw new Error(`Unrecognized ${site} binding ${b.type}; preserving live deployment`);
 }
 await mkdir('.wrangler/content-ui',{recursive:true});await writeFile(`.wrangler/content-ui/${site}.json`,JSON.stringify(config,null,2));
 console.log(`${site}: prepared UI release using existing bindings; private variables preserved.`);
}
