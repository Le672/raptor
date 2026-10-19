import {SOURCES,sourceById,splitId,normalize,mergeCatalog} from './sources.mjs';
import {CATEGORIES,GENRES,queryPlan} from './catalog.mjs';
const memory=new Map(),pending=new Map();
const FRESH_MS=5*60000,STALE_MS=7*86400000;
const failure=(message,status=503)=>Object.assign(new Error(message),{status});
export async function cached(env,key,loader,force=false,persist=true){
  let entry=memory.get(key);
  if(!entry&&env.CINEMA_CACHE){try{entry=await env.CINEMA_CACHE.get(key,'json');}catch{/* A cache outage does not block the live source. */}}
  if(entry&&Date.now()-entry.time<FRESH_MS&&!force)return {value:entry.value,checkedAt:new Date(entry.time).toISOString(),stale:false};
  if(!pending.has(key))pending.set(key,(async()=>{
    const value=await loader(),saved={time:Date.now(),value};memory.set(key,saved);if(memory.size>400)memory.delete(memory.keys().next().value);
    if(persist&&env.CINEMA_CACHE){try{await env.CINEMA_CACHE.put(key,JSON.stringify(saved),{expirationTtl:604800});}catch{/* Keep the successful live response. */}}
    return saved;
  })().finally(()=>pending.delete(key)));
  try{entry=await pending.get(key);return {value:entry.value,checkedAt:new Date(entry.time).toISOString(),stale:false};}
  catch(error){if(entry&&Date.now()-entry.time<STALE_MS)return {value:entry.value,checkedAt:new Date(entry.time).toISOString(),stale:true,reason:error.message};throw error;}
}
export async function upstream(source,params={}){
  const url=new URL(source.api);for(const[key,value]of Object.entries(params))if(value!==undefined)url.searchParams.set(key,String(value));
  let response;try{response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'YukinoCinema/1.0 (+https://cinema.yukino.bond)'},signal:AbortSignal.timeout(18000),redirect:'manual'});}catch{throw failure(`${source.name}暂时连接失败，请切换其他片源`);}
  if(!response.ok)throw failure(`${source.name}返回 HTTP ${response.status}`);
  const text=await response.text();if(text.length>8*1024*1024)throw failure(`${source.name}返回内容过大`);
  let data;try{data=JSON.parse(text);}catch{throw failure(`${source.name}未返回有效目录`);}
  if(!Array.isArray(data.list)||(data.code!==undefined&&Number(data.code)!==1))throw failure(`${source.name}目录格式发生变化`);
  return data;
}
export async function detail(env,id,force=false){
  const parts=splitId(id);if(!parts)throw failure('影视编号无效',400);
  return cached(env,'detail:v1:'+id,async()=>{
    const data=await upstream(parts.source,{ac:'detail',ids:parts.native}),record=data.list.find(x=>String(x.vod_id)===parts.native),media=record&&normalize(record,parts.source);
    if(!media)throw failure('这个片源没有找到该影视作品',404);return media;
  },force,false);
}
export async function catalog(env,params=new URLSearchParams(),persistHome=false){
  const q=(params.get('q')||'').trim().slice(0,80),page=Math.max(1,Math.min(500,Math.floor(Number(params.get('page'))||1))),category=params.get('category')||'all',genre=params.get('genre')||'all',selected=params.get('source')||'all',force=params.get('refresh')==='1';
  if(!Object.hasOwn(CATEGORIES,category)||!Object.hasOwn(GENRES[category],genre)||(selected!=='all'&&!sourceById(selected)))throw failure('筛选条件无效',400);
  const sources=selected==='all'?SOURCES:[sourceById(selected)];
  const results=await Promise.all(sources.map(async source=>{
    const plan=queryPlan(source,{category,genre,q,page});
    if(!plan.types.length)return {source,state:'unsupported',reason:'此片源未单列该题材',items:[],hasMore:false};
    const home=category==='all'&&!q&&page===1,homeKey='home:v1:'+source.id;
    if(home&&env.CINEMA_CACHE){try{const saved=await env.CINEMA_CACHE.get(homeKey,'json');for(const part of saved?.parts||[])if(part.key.startsWith('catalog:v1:'+source.id+':')&&part.entry?.value&&Number.isFinite(part.entry.time)&&Date.now()-part.entry.time<STALE_MS&&!memory.has(part.key))memory.set(part.key,part.entry);}catch{/* The live source remains usable without persistent cache. */}}
    const cacheKeys=plan.types.map(t=>`catalog:v1:${source.id}:${t||'all'}:${plan.nativePage}:${q}`);
    const reads=await Promise.allSettled(plan.types.map((t,index)=>cached(env,cacheKeys[index],async()=>{
      const data=await upstream(source,{ac:'detail',t,pg:plan.nativePage,...(q?{wd:q}:{})});
      return {items:data.list.map(x=>normalize(x,source)).filter(x=>x&&(category==='all'||x.mediaKind===category)),pagecount:Math.max(1,Number(data.pagecount)||1)};
    },force,false)));
    const parts=reads.filter(x=>x.status==='fulfilled').map(x=>x.value),errors=reads.filter(x=>x.status==='rejected').map(x=>x.reason.message);
    if(!parts.length)return {source,state:'error',reason:errors.join('；'),items:[],hasMore:plan.hasNextGroup};
    // Only the scheduled homepage refresh persists, once per source (384 writes/day).
    // Searches, detail requests and manual refreshes cannot consume KV write quota.
    if(home&&persistHome&&env.CINEMA_CACHE&&parts.some(part=>!part.stale)){try{await env.CINEMA_CACHE.put(homeKey,JSON.stringify({parts:reads.flatMap((read,index)=>read.status==='fulfilled'?[{key:cacheKeys[index],entry:{time:Date.parse(read.value.checkedAt),value:read.value.value}}]:[])}),{expirationTtl:604800});}catch{/* Preserve successful live responses if storage is unavailable. */}}
    for(const part of parts)for(const item of part.value.items)memory.set('detail:v1:'+item.id,{time:Date.parse(part.checkedAt),value:item});while(memory.size>500)memory.delete(memory.keys().next().value);
    return {source,state:errors.length?'partial':parts.some(x=>x.stale)?'stale':'ok',reason:[...errors,...parts.filter(x=>x.reason).map(x=>x.reason)].join('；')||undefined,
      checkedAt:parts.map(x=>x.checkedAt).sort()[0],items:parts.flatMap(x=>x.value.items),stale:parts.some(x=>x.stale),hasMore:plan.hasNextGroup||parts.some(x=>x.value.pagecount>plan.nativePage)};
  }));
  if(!results.some(x=>['ok','partial','stale'].includes(x.state)))throw failure(results.map(x=>x.reason).join('；')||'暂时没有可用片源');
  return {data:mergeCatalog(results.flatMap(x=>x.items)),page,hasMore:results.some(x=>x.hasMore),sources:results.map(({source,items,hasMore,stale,...status})=>({id:source.id,name:source.name,count:new Set(items.map(x=>x.id)).size,...status})),
    meta:{checkedAt:results.map(x=>x.checkedAt).filter(Boolean).sort()[0]||null,stale:results.some(x=>x.stale),scheduledMinutes:15,cacheMinutes:5}};
}
export async function refreshCatalogs(env){return catalog(env,new URLSearchParams('refresh=1'),true);}
