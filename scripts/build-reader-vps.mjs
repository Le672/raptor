import {build} from 'esbuild';
import {cp,mkdir,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=resolve(fileURLToPath(new URL('..',import.meta.url))),root=resolve('.wrangler/reader-release');
if(root!==resolve(repo,'.wrangler','reader-release')||!root.startsWith(repo+sep))throw new Error('Unexpected reader bundle destination');
await rm(root,{recursive:true,force:true});await mkdir(root,{recursive:true});
for(const[name,source,assets]of [['ln','novel','ln'],['novel','fiction','fiction']]){
  await build({entryPoints:[`${source}/server/worker.mjs`],outfile:`${root}/${name}/worker.mjs`,bundle:true,platform:'node',target:'node22',format:'esm'});
  await cp(`${assets}/dist`,`${root}/${name}/dist`,{recursive:true});
}
console.log('Both reader bundles prepared for VPS.');
