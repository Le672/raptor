import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {cp,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const root=fileURLToPath(new URL('../games/fog-harbor-files/',import.meta.url));
await build({configFile:resolve(root,'vite.config.ts')});
const output=resolve(root,'dist'),base='/fog-harbor-files/';
for(const name of ['title','lobby','archive','studio','security','office','pump','transfer','xu','shen','luo','zhou','tang','he']){
  const art=await readFile(resolve(output,'art',name+'.svg'),'utf8');
  if(!art.includes('<svg')||art.includes('<script'))throw new Error('Missing or invalid case artwork: '+name);
}
const html=await readFile(resolve(output,'index.html'),'utf8');
if(!html.includes(base+'assets/'))throw new Error('Mystery assets must use their own base path');
async function walk(dir){const found=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())found.push(...await walk(path));else if(!entry.name.endsWith('.map'))found.push(path);}return found;}
const paths=await walk(output),files=paths.map(path=>base+relative(output,path).replaceAll('\\','/'));
const shell=files.filter(path=>path.endsWith('/index.html')||/\/assets\/[^/]+\.(js|css)$/.test(path)||path.endsWith('mark.svg'));
const digest=createHash('sha256'),hashes={};let jsBytes=0,totalBytes=0;for(const path of paths){const bytes=await readFile(path);digest.update(bytes);hashes[base+relative(output,path).replaceAll('\\','/')]=createHash('sha256').update(bytes).digest('hex');totalBytes+=bytes.length;if(path.endsWith('.js'))jsBytes+=gzipSync(bytes).length;}
if(jsBytes>1024*1024)throw new Error('Mystery initial JavaScript exceeds 1 MB gzip');
const cache='fog-case-last-recording-v1-'+digest.digest('hex').slice(0,14);
await writeFile(resolve(output,'offline-manifest.json'),JSON.stringify({cache,files,hashes,contentVersion:'1.0.0',bytes:totalBytes}));
await writeFile(resolve(output,'sw.js'),`const NAME=${JSON.stringify(cache)},BASE=${JSON.stringify(base)},SHELL=${JSON.stringify(shell)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(NAME).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==self.location.origin||!u.pathname.startsWith(BASE)||/\\/(?:api|sw\\.js|offline-manifest\\.json)(?:\\/|$)/.test(u.pathname))return;event.respondWith((async()=>{const cache=await caches.open(NAME);try{const response=await fetch(event.request);if(response.ok&&response.type!=='opaque')await cache.put(event.request,response.clone());return response;}catch{const saved=await cache.match(event.request);if(saved)return saved;if(event.request.mode==='navigate')return(await cache.match(BASE+'index.html'))||Response.error();return Response.error();}})());});`);
await writeFile(resolve(output,'_headers'),`${base}sw.js\n  Cache-Control: no-store\n${base}offline-manifest.json\n  Cache-Control: no-cache\n${base}\n  Cache-Control: no-cache\n${base}index.html\n  Cache-Control: no-cache\n${base}assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`);
if(process.argv.includes('--portal')){const portal=fileURLToPath(new URL('../dist/',import.meta.url));await cp(output,resolve(portal,'fog-harbor-files'),{recursive:true});let headers=await readFile(resolve(portal,'_headers'),'utf8').catch(()=>'');headers+='\n'+await readFile(resolve(output,'_headers'),'utf8');await writeFile(resolve(portal,'_headers'),headers);}
console.log(`Fog Harbor Files: ${files.length} files, ${Math.round(jsBytes/1024)} KB JS gzip, ${(totalBytes/1024/1024).toFixed(1)} MB complete case.`);
