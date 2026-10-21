import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'node:url';

test('a denied manual refresh does not turn later public searches or book navigation into protected refreshes',async t=>{
  const dom=new JSDOM('<div id="app"></div>',{url:'https://novel.yukino.bond/'});
  const restore=[];let cleanup=async()=>{};
  t.after(async()=>{await cleanup();dom.window.close();restore.forEach(fn=>fn());});
  for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,location:dom.window.location,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true})){
    const old=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true});
    restore.push(()=>{if(old)Object.defineProperty(globalThis,key,old);else delete globalThis[key];});
  }
  const seen=[];t.mock.method(globalThis,'fetch',async path=>{
    seen.push(path);
    return path.includes('refresh=1')?Response.json({error:'登录后同步',code:'LOGIN_REQUIRED'},{status:401}):Response.json({data:{title:path},meta:{stale:false,checkedAt:new Date().toISOString()}});
  });
  const compiled=await build({stdin:{contents:"export { useResource } from './novel/src/App.tsx';",resolveDir:fileURLToPath(new URL('../../',import.meta.url))},bundle:true,write:false,format:'esm',platform:'node',packages:'external',loader:{'.css':'empty'},jsx:'automatic',logLevel:'silent'});
  const code=compiled.outputFiles[0].text.replace(/from "([^".][^"]*)"/g,(_all,specifier)=>`from ${JSON.stringify(import.meta.resolve(specifier))}`);
  const {useResource}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  const {createElement,act}=await import('react'),{createRoot}=await import('react-dom/client');
  function Harness({path}){const resource=useResource(path);return createElement('button',{onClick:resource.reload},resource.error||resource.result?.data.title||'loading');}
  const root=createRoot(dom.window.document.getElementById('app'));cleanup=async()=>{await act(()=>root.unmount());};
  await act(async()=>root.render(createElement(Harness,{path:'/api/books?q=first'})));
  await act(async()=>dom.window.document.querySelector('button').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
  assert.equal(seen.at(-1),'/api/books?q=first&refresh=1');assert.match(dom.window.document.querySelector('button').textContent,/登录/);
  await act(async()=>root.render(createElement(Harness,{path:'/api/books?q=next'})));
  assert.equal(seen.at(-1),'/api/books?q=next');assert.equal(dom.window.document.querySelector('button').textContent,'/api/books?q=next');
  await act(async()=>root.render(createElement(Harness,{path:'/api/book/8'})));
  assert.equal(seen.at(-1),'/api/book/8');
});
