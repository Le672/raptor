import assert from 'node:assert/strict';
import {ProxyAgent,setGlobalDispatcher} from 'undici';
if(process.env.HTTPS_PROXY||process.env.HTTP_PROXY)setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY||process.env.HTTP_PROXY));
const origin=process.env.CINEMA_ORIGIN||'https://cinema.yukino.bond';
async function get(path){let error;for(let attempt=0;attempt<5;attempt++){try{const response=await fetch(origin+path,{signal:AbortSignal.timeout(55000),redirect:'manual'});assert.equal(response.status,200,path+' must respond without a redirect');return response;}catch(e){error=e;if(attempt<4)await new Promise(r=>setTimeout(r,5000));}}throw error;}
const index=await(await get('/')).text();assert.match(index,/影视馆/);assert.match(index,/\/assets\/[^" ]+\.js/);
const sourceList=await(await get('/api/sources')).json();assert.equal(sourceList.scheduledMinutes,60);assert.equal(sourceList.data.length,8);for(const id of ['jy','md','hn','dz'])assert(sourceList.data.some(source=>source.id===id),'new source '+id+' missing');
for(const path of ['/library','/history','/settings','/title/bf-1','/watch/bf-1/0/0']){assert.match(await(await get(path)).text(),/id="root"/);}
const catalog=await(await get('/api/catalog?category=series&genre=cn')).json();assert(catalog.data.length>0);assert(catalog.sources.some(s=>s.state==='ok'||s.state==='stale'));
const first=catalog.data.find(a=>a.episodeCount>0);assert(first);const detail=await(await get('/api/title/'+first.id)).json();assert(detail.data.lines.length>0);assert(detail.data.lines[0].episodes.length>0);
assert.equal(detail.data.mediaKind,'series');
const movies=await(await get('/api/catalog?category=movie&genre=drama')).json();assert(movies.data.length>0);assert(movies.data.every(item=>item.mediaKind==='movie'));
assert(!JSON.stringify(detail).includes('vod_play_url'));assert(!JSON.stringify(detail).includes('imageUrl'));
const invalid=await fetch(origin+'/api/media?token=invalid');assert.equal(invalid.status,403);
console.log(JSON.stringify({origin,works:catalog.data.length,sources:catalog.sources.map(s=>({name:s.name,state:s.state})),detail:first.id,episodes:detail.data.episodeCount,deepLinks:true,signedMedia:true}));
