// Explicit user request: remove the dev subdomain without a redirect.
import { resolve4 } from 'node:dns/promises';
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw new Error('Existing deployment credentials required');
async function api(path,method='GET'){const r=await fetch('https://api.cloudflare.com/client/v4'+path,{method,headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok||!d.success)throw new Error(`Cloudflare ${method} failed (${r.status})`);return d.result;}
const root=`/accounts/${account}/pages/projects/raptor/domains`,domains=await api(root);
if(domains.some(d=>d.name==='dev.yukino.bond')){await api(root+'/dev.yukino.bond','DELETE');console.log('Removed dev.yukino.bond from Pages.');}
else console.log('dev.yukino.bond is detached from Pages.');
try { await resolve4('dev.yukino.bond'); } catch (error) { if (['ENOTFOUND','ENODATA'].includes(error.code)) { console.log('dev.yukino.bond no longer has a public DNS address.'); process.exit(0); } throw error; }
const zones=await api('/zones?name=yukino.bond'),zone=zones.find(z=>z.name==='yukino.bond');
if(!zone)throw new Error('Existing zone was not found');
const dns=`/zones/${zone.id}/dns_records`;
let records;try { records=await api(dns+'?name=dev.yukino.bond'); } catch (error) { if (!String(error).includes('(403)')) throw error; console.warn('::warning::dev is detached from Pages. The current token cannot edit DNS; remove its remaining DNS record through the existing zone owner account.'); process.exit(0); }
for(const r of records){if(r.name!=='dev.yukino.bond')throw new Error('Unexpected DNS record');await api(dns+'/'+r.id,'DELETE');}
console.log(`Retired dev.yukino.bond; removed ${records.length} DNS records. No redirect is configured.`);
