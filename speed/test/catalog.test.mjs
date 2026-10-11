import test from 'node:test';
import assert from 'node:assert/strict';
import { SERVERS, SERVER_GROUPS, COUNTRIES } from '../src/servers.mjs';
import { filterServers } from '../src/catalog.mjs';

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
