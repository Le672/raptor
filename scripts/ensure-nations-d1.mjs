import {appendFile,readFile,writeFile} from 'node:fs/promises';
import {ensureGameDatabase,withGameDatabase} from './lib/nations-d1.mjs';
const portal=new URL('../wrangler.toml',import.meta.url),source=await readFile(portal,'utf8');
const existing=source.split(/(?=^\[)/m).find(section=>section.startsWith('[[d1_databases]]')&&/^binding\s*=\s*"DB"\s*$/m.test(section));
const portalId=existing?.match(/^database_id\s*=\s*"([^"]+)"/m)?.[1];
if(!portalId)throw new Error('The existing portal D1 binding is missing');
// Reuse the database already authorized for the application. This does not need
// management API access or broader credentials. Independent storage is opt-in.
const independent=process.argv.includes('--independent');
const result=independent?await ensureGameDatabase({token:process.env.CLOUDFLARE_API_TOKEN,account:process.env.CLOUDFLARE_ACCOUNT_ID}):{id:portalId,created:false};
const name=independent?'yukino-nations':'yukino-portal';
await writeFile(portal,withGameDatabase(source,result.id,name));
const cleanup=new URL('../games/age-of-nations/cloud/d1-wrangler.jsonc',import.meta.url),config=JSON.parse(await readFile(cleanup,'utf8'));
Object.assign(config.d1_databases.find(db=>db.binding==='GAMES_DB'),{database_id:result.id,database_name:name});
await writeFile(cleanup,JSON.stringify(config,null,2)+'\n');
if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`independent=${independent}\n`);
console.log(!independent?'Configured private game tables in the existing application D1 binding. No management permissions or R2 activation are required.':result.created?'Created a private D1 database for Age of Nations.':'The private Age of Nations D1 database is ready.');
