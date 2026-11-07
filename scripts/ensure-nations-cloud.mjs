import {appendFile,readFile,writeFile} from 'node:fs/promises';
import {ensureGameStorage,withoutGameStorage} from './lib/nations-deployment.mjs';

const result=await ensureGameStorage({token:process.env.CLOUDFLARE_API_TOKEN,account:process.env.CLOUDFLARE_ACCOUNT_ID,allowUnavailable:process.argv.includes('--allow-unavailable')});
if(!result.ready){
  // Change only the ephemeral CI checkout. Tracked config retains the R2 binding
  // so the next release can restore cloud sync as soon as the account is ready.
  const config=new URL('../wrangler.toml',import.meta.url);
  await writeFile(config,withoutGameStorage(await readFile(config,'utf8')));
  console.log('::warning::R2 is not enabled. Both games use D1 saves; the optional bucket is needed only to read legacy objects. No storage or account data was deleted.');
}else console.log(result.created?'Created private game save storage.':'Private game save bucket is already configured.');
// Only legacy imported saves need an optional R2 binding in the D1 cleaner.
const cleaner=new URL('../games/age-of-nations/cloud/d1-wrangler.jsonc',import.meta.url),settings=JSON.parse(await readFile(cleaner,'utf8'));
if(result.ready)settings.r2_buckets=[{binding:'GAMES_SAVES',bucket_name:'yukino-games-saves'}];else delete settings.r2_buckets;
await writeFile(cleaner,JSON.stringify(settings,null,2)+'\n');
if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`ready=${result.ready}\n`);
