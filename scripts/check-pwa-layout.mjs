import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isAppWindow,observeAppWindow,applyAppWindowLayout} from '../shared/pwa/display-mode.mjs';
import {siteNavigation} from '../shared/shell/navigation.mjs';
const {chromium}=await import(process.env.PWA_PLAYWRIGHT_MODULE||pathToFileURL(resolve('.wrangler/pwa-check/node_modules/playwright/index.mjs')).href);
const root=process.cwd(),out=resolve('.wrangler/pwa-layout');await mkdir(out,{recursive:true});
const entries=siteNavigation.map(n=>({...n,href:n.href||'https://www.yukino.bond'+n.to,icon:''}));
const runtime=(await readFile('shared/shell/client.js','utf8')).replace('__YUKINO_NAVIGATION__',JSON.stringify(entries)).replace('__YUKINO_SITE__','"ln"').replace('__YUKINO_APP_WINDOW__',`const isAppWindow=${isAppWindow.toString()};const observeAppWindow=${observeAppWindow.toString()};const applyAppWindowLayout=${applyAppWindowLayout.toString()};`);
const html=`<!doctype html><html data-theme="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/novel/src/style.css"><link rel="stylesheet" href="/src/styles/chrome-refresh.css"><link rel="stylesheet" href="/shared/shell/independent.css"></head><body><div id="root"><div class="app"><aside class="sidebar"><nav><a href="/">发现故事</a><a href="/shelf">我的书架</a></nav></aside><div class="main"><header class="topbar"><span class="mobile-brand">轻小说书房</span></header><main class="content"><h2 class="book-title">测试书目</h2><p>书房内容</p></main></div><nav class="mobile-nav"><a href="/">发现</a><a href="/shelf">书架</a></nav></div></div><script src="/shell.js"></script></body></html>`;
const files=new Map([['/',{type:'text/html',body:html}],['/shell.js',{type:'text/javascript',body:runtime}]]);
for(const p of ['novel/src/style.css','src/styles/chrome-refresh.css','shared/shell/independent.css'])files.set('/'+p,{type:'text/css',body:await readFile(p)});
files.set('/yukino-shell/avatar.png',{type:'image/png',body:await readFile('public/favicon.png')});
const server=http.createServer((req,res)=>{const f=files.get(new URL(req.url,'http://localhost').pathname);res.writeHead(f?200:404,{'Content-Type':f?.type||'text/plain'});res.end(f?.body||'not found')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const mode of ['browser','standalone','ios-standalone']){
  const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:1});const page=await context.newPage();
  if(mode==='standalone'){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'display-mode',value:'standalone'}]});}
  if(mode==='ios-standalone')await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{get:()=>true}));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#yukino-global-header').waitFor({state:'attached'});
  const state=await page.evaluate(()=>{const h=document.querySelector('#yukino-global-header'),s=h.querySelector('.search-toggle'),book=document.querySelector('.book-title');return{header:getComputedStyle(h).display,sidebar:getComputedStyle(document.querySelector('.sidebar')).display,padding:getComputedStyle(document.body).paddingLeft,searchWidth:s.getBoundingClientRect().width,searchHeight:s.getBoundingClientRect().height,label:getComputedStyle(s.querySelector('.nav-search-label')).display,bodyWidth:document.documentElement.scrollWidth,bookColor:getComputedStyle(book).color,contentTop:book.getBoundingClientRect().top,independent:document.body.classList.contains('yukino-independent')}});
  if(mode==='browser'){assert.notEqual(state.header,'none');assert.equal(state.sidebar,'none');assert.ok(state.searchWidth>=32&&state.searchHeight<=40,JSON.stringify(state));assert.equal(state.label,'none');}
  else{assert.equal(state.header,'none');assert.equal(state.sidebar,'none');assert.equal(state.padding,'0px');assert.equal(state.independent,false);assert.ok(state.contentTop<150,JSON.stringify(state));const channels=state.bookColor.match(/\d+/g).map(Number);assert.ok(channels.slice(0,3).every(n=>n>120),'Dark book text must remain readable: '+state.bookColor);}
  assert.ok(state.bodyWidth<=393,JSON.stringify(state));await page.screenshot({path:resolve(out,mode+'.png')});console.log(mode,JSON.stringify(state));await context.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
