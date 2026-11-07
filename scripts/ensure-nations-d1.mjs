import {readFile,writeFile} from 'node:fs/promises';
import {ensureGameDatabase,withGameDatabase} from './lib/nations-d1.mjs';
const result=await ensureGameDatabase({token:process.env.CLOUDFLARE_API_TOKEN,account:process.env.CLOUDFLARE_ACCOUNT_ID});
const portal=new URL('../wrangler.toml',import.meta.url);
await writeFile(portal,withGameDatabase(await readFile(portal,'utf8'),result.id));
const cleanup=new URL('../games/age-of-nations/cloud/d1-wrangler.jsonc',import.meta.url),config=JSON.parse(await readFile(cleanup,'utf8'));
config.d1_databases.find(db=>db.binding==='GAMES_DB').database_id=result.id;
await writeFile(cleanup,JSON.stringify(config,null,2)+'\n');
console.log(result.created?'Created a private D1 database for Age of Nations.':'The private Age of Nations D1 database is ready.');
