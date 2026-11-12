import http from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {ProxyAgent,setGlobalDispatcher} from 'undici';
import worker from '../cinema/server/worker.mjs';
if(process.env.HTTPS_PROXY||process.env.HTTP_PROXY)setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY||process.env.HTTP_PROXY));
const root=resolve('.cinema-work/local-kv');await mkdir(root,{recursive:true});
const env={CINEMA_MEDIA_SECRET:'local-preview-only-not-a-production-secret',CINEMA_CACHE:{async get(key,type){try{const text=await readFile(resolve(root,encodeURIComponent(key)+'.json'),'utf8');return type==='json'?JSON.parse(text):text;}catch{return null;}},async put(key,value){await writeFile(resolve(root,encodeURIComponent(key)+'.json'),value);}}};
const vite=await createServer({configFile:resolve('cinema/vite.config.ts'),server:{middlewareMode:true},appType:'spa'});
const server=http.createServer(async(req,res)=>{
  if(!req.url.startsWith('/api/')){vite.middlewares(req,res);return;}
  try{const response=await worker.fetch(new Request('http://127.0.0.1:5188'+req.url,{method:req.method,headers:req.headers}),env,{waitUntil:p=>p.catch(e=>console.error(e.message))});res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body){const reader=response.body.getReader();for(;;){const{done,value}=await reader.read();if(done)break;if(!res.write(Buffer.from(value)))await new Promise(r=>res.once('drain',r));}}res.end();}catch(e){if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
});
server.listen(5188,'127.0.0.1',()=>console.log('Yukino Cinema local preview: http://127.0.0.1:5188'));
process.on('SIGINT',()=>{server.close();void vite.close().then(()=>process.exit(0));});
