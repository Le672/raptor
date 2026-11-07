import {readFile} from 'node:fs/promises';
import {cloudflareD1,importLegacySaves} from './lib/nations-d1.mjs';
const config=JSON.parse(await readFile(new URL('../games/age-of-nations/cloud/d1-wrangler.jsonc',import.meta.url),'utf8'));
const request=cloudflareD1({token:process.env.CLOUDFLARE_API_TOKEN,account:process.env.CLOUDFLARE_ACCOUNT_ID});
const query=async(id,sql,params=[])=>{const result=await request(`/${id}/query`,{method:'POST',body:JSON.stringify({sql,params})});if(!Array.isArray(result)||result.some(item=>item.success===false)||!Array.isArray(result[0]?.results))throw new Error('Invalid D1 migration response');return result[0].results;};
const result=await importLegacySaves({source:config.d1_databases.find(db=>db.binding==='DB').database_id,target:config.d1_databases.find(db=>db.binding==='GAMES_DB').database_id,query});
console.log(result.alreadyDone?'Legacy save import was already completed.':`Preserved ${result.imported} legacy save records; the portal database and private objects were not changed.`);
