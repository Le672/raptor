import test from 'node:test';
import assert from 'node:assert/strict';
import { SERVERS, SERVER_GROUPS, COUNTRIES } from '../src/servers.mjs';
import { filterServers } from '../src/catalog.mjs';
import { readFileSync } from 'node:fs';

test('catalog URLs, identities and metadata remain valid across both clients',()=>{
 const ids=new Set(),urls=new Set(),groups=new Set(SERVER_GROUPS.map(g=>g.id)),countries=new Set(COUNTRIES.map(c=>c.id));
 for(const s of SERVERS){assert.ok(!ids.has(s.id));ids.add(s.id);assert.ok(groups.has(s.group));assert.ok(countries.has(s.country));if(!s.url){assert.equal(s.id,'custom');continue;}const url=new URL(s.url);assert.ok(['http:','https:'].includes(url.protocol));assert.ok(!url.username&&!url.password);assert.ok(!urls.has(url.href));urls.add(url.href);assert.equal(new URL(s.source).protocol,'https:');assert.match(s.checkedAt,/^\d{4}-\d{2}-\d{2}$/);if(!s.desktopOnly){assert.equal(url.protocol,'https:');assert.ok(!s.referrer);}if(s.referrer){assert.equal(new URL(s.referrer).protocol,'https:');assert.equal(s.desktopOnly,true);}assert.ok(!/免流|公免|定向/.test(s.name));}
});
test('all four mainland carriers and Steam have selectable full file addresses',()=>{
 for(const group of ['telecom','unicom','mobile','broadnet','steam'])assert.ok(filterServers(SERVERS,{group}).length);
});
test('country and provider searches combine instead of broadening the result',()=>{
 const result=filterServers(SERVERS,{country:'JP',query:'vultr 日本'});assert.ok(result.length);assert.ok(result.every(s=>s.country==='JP'&&s.name.includes('Vultr')));
});
test('queries support domains, whitespace and English country names',()=>{
 assert.ok(filterServers(SERVERS,{query:'  HOSTHATCH.COM  '}).length);assert.ok(filterServers(SERVERS,{query:'United States',country:'US'}).length);assert.ok(filterServers(SERVERS,{query:'不存在的测速源'}).length===0);
});
test('web-only filter excludes HTTP, missing-CORS and referrer-dependent sources',()=>{
 const result=filterServers(SERVERS,{client:'web'});assert.ok(result.length);assert.ok(result.every(s=>s.url.startsWith('https:')&&!s.desktopOnly&&!s.referrer));assert.equal(filterServers(SERVERS,{client:'web',group:'steam'}).length,0);
});
test('Windows-only view and combined filters preserve compatibility labels',()=>{
 const result=filterServers(SERVERS,{client:'windows',group:'global',country:'US'});assert.ok(result.length);assert.ok(result.every(s=>s.desktopOnly&&s.group==='global'&&s.country==='US'));
});

test('provider selection intersects country and browser compatibility',()=>{
 const input=[{url:'https://a.test/file',provider:'A',country:'CN'},{url:'https://b.test/file',provider:'B',country:'CN'},{url:'https://c.test/file',provider:'A',country:'US'},{url:'https://d.test/file',provider:'A',country:'CN',desktopOnly:true}];
 assert.deepEqual(filterServers(input,{provider:'A',country:'CN',client:'web'}),[input[0]]);
 assert.equal(filterServers(input,{provider:'missing'}).length,0);
});

test('each selectable preset has matching payload and compatibility evidence',()=>{
 const health=JSON.parse(readFileSync(new URL('../data/source-health.json',import.meta.url),'utf8'));
 const evidence=new Map(health.sources.map(s=>[s.id,s]));
 for(const source of SERVERS.filter(s=>s.url)) {
  const check=evidence.get(source.id); assert.ok(check,source.id);
  assert.ok(check.status>=200&&check.status<300); assert.ok(check.bytes>=1024);
  assert.equal(!source.desktopOnly,check.web); assert.equal(source.rangeSupported,check.rangeSupported);
  assert.equal(source.cacheBust,check.cacheBust); assert.equal(source.checkedAt,check.checkedAt.slice(0,10));
 }
 assert.ok(health.retired.every(s=>!SERVERS.some(preset=>preset.id===s.id)));
});
