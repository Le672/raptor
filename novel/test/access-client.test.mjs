import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { request, loginUrlForPage, access } from '../src/api.ts';

function browser(t, fetcher) {
  const values = { location: { origin:'https://novel.yukino.bond',href:'https://novel.yukino.bond/read/sf-8/10/11?mode=night#bookmark' }, window:new EventTarget() };
  const calls={open:0,match:0,put:0};
  const envelope={data:{title:'old body',blocks:[{type:'text',text:'cached private chapter'}]},meta:{checkedAt:'2026-10-21T00:00:00Z',stale:false}};
  values.caches={open:async()=>{calls.open++;return{match:async()=>{calls.match++;return Response.json(envelope);},put:async()=>{calls.put++;},keys:async()=>[]};}};
  for(const [key,value] of Object.entries(values)){
    const old=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true});
    t.after(()=>{if(old)Object.defineProperty(globalThis,key,old);else delete globalThis[key];});
  }
  t.mock.method(globalThis,'fetch',fetcher);
  return{...values,calls,envelope};
}

test('chapter 401 prompts canonical login preserving route, without looking at old body caches',async t=>{
  const env=browser(t,async(_path,options)=>{assert.equal(options.credentials,'same-origin');return Response.json({error:'登录后阅读',code:'LOGIN_REQUIRED',loginUrl:'https://evil.test/'},{status:401});});
  let notice;env.window.addEventListener('novel-login-required',event=>{notice=event.detail;});
  await assert.rejects(()=>request('/api/book/sf-8/chapter/11'),error=>error.status===401&&error.code==='LOGIN_REQUIRED');
  assert.deepEqual(env.calls,{open:0,match:0,put:0});
  const login=new URL(notice.loginUrl);assert.equal(login.origin,'https://www.yukino.bond');assert.equal(login.pathname,'/login');
  assert.equal(login.searchParams.get('returnTo'),env.location.href);assert.equal(loginUrlForPage(),login.href);
});

test('network failure never makes a protected chapter available through offline caches',async t=>{
  const env=browser(t,async()=>{throw new Error('offline');});
  await assert.rejects(()=>request('/api/book/8/chapter/11'),/offline/);
  assert.equal(env.calls.open,0);assert.equal(env.calls.match,0);
});

test('successful authenticated chapter responses are not saved for unauthenticated offline reuse',async t=>{
  const env=browser(t,async()=>Response.json({data:{blocks:[{type:'text',text:'authorized'}]},meta:{stale:false,checkedAt:'2026-10-21T00:00:00Z'}}));
  const result=await request('/api/book/8/chapter/11');assert.equal(result.data.blocks[0].text,'authorized');
  assert.equal(env.calls.open,0);assert.equal(env.calls.put,0);
});

test('public metadata retains offline fallback while explicit refresh cannot fall back around authentication',async t=>{
  const env=browser(t,async()=>{throw new Error('offline');});
  const result=await request('/api/book/8');assert.equal(result.meta.offline,true);assert.equal(env.calls.match,1);
  await assert.rejects(()=>request('/api/book/8?refresh=1'),/offline/);assert.equal(env.calls.match,1);
});

test('access status is a credentialed uncached request and never returns offline account data',async t=>{
  const env=browser(t,async(path,options)=>{assert.equal(path,'/api/access');assert.equal(options.cache,'no-store');assert.equal(options.credentials,'same-origin');return Response.json({user:null,loginUrl:'https://www.yukino.bond/login'});});
  assert.equal((await access()).user,null);assert.equal(env.calls.open,0);
});
test('a double slash in the current path cannot turn the login return target into another origin',async t=>{
  const env=browser(t,async()=>Response.json({user:null}));env.location.href='https://novel.yukino.bond//evil.test/path';
  assert.equal(new URL(new URL(loginUrlForPage()).searchParams.get('returnTo')).origin,'https://novel.yukino.bond');
});

test('service worker upgrade deletes only old chapter bodies and keeps catalog and book metadata',async()=>{
  const listeners={},deleted=[],keys=['https://novel.yukino.bond/api/book/8/chapter/11','https://novel.yukino.bond/api/book/8','https://novel.yukino.bond/api/books?q=hello'];
  const cache={keys:async()=>keys.map(url=>({url})),delete:async key=>{deleted.push(key.url);return true;}};
  runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self:{addEventListener:(name,fn)=>{listeners[name]=fn;},clients:{claim:async()=>{}}},caches:{keys:async()=>[],open:async()=>cache,delete:async()=>true},URL,Promise});
  let task;listeners.activate({waitUntil:value=>{task=value;}});await task;
  assert.deepEqual(deleted,[keys[0]]);
});
