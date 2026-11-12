import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../dist/',import.meta.url))),base='/fog-harbor-files/';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:5197');
 if(url.pathname==='/api/games/fog-harbor-files/session'){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({code:'LOGIN_REQUIRED',available:false}));return;}
 if(!url.pathname.startsWith(base)){res.writeHead(404);res.end();return;}
 try{let path=resolve(root,decodeURIComponent(url.pathname.slice(base.length))||'index.html');if(path!==root&&!path.startsWith(root+sep))throw 0;if((await stat(path)).isDirectory())path=resolve(path,'index.html');const bytes=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(404);res.end();}
}).listen(5197,'127.0.0.1');
