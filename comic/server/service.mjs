import { SOURCES, sourceById, splitId, normalize, mergeCatalog } from './sources.mjs';
const memory = new Map(), pending = new Map();
const FRESH_MS = 5 * 60000, STALE_MS = 7 * 86400000;
export const KV_WRITES_PER_REFRESH = SOURCES.length;
function failure(message,status=503) { return Object.assign(new Error(message),{status}); }
export async function cached(env,key,loader,force=false,readPersistent=true) {
  let entry = memory.get(key);
  if (!entry && readPersistent && env.COMIC_CACHE) { try { entry = await env.COMIC_CACHE.get(key,'json'); } catch { /* A cache outage does not block the live source. */ } }
  if (entry && Date.now() - entry.time < FRESH_MS && !force) return { value: entry.value, checkedAt: new Date(entry.time).toISOString(), stale: false };
  if (!pending.has(key)) pending.set(key,(async()=>{
    const value = await loader(), saved = { time: Date.now(), value };
    memory.set(key,saved); if(memory.size>250) memory.delete(memory.keys().next().value);
    // Visitor loads never persist. The hourly scheduler writes one source bundle below.
    return saved;
  })().finally(()=>pending.delete(key)));
  try { entry = await pending.get(key); return { value: entry.value, checkedAt: new Date(entry.time).toISOString(), stale:false }; }
  catch (error) { if(entry && Date.now()-entry.time<STALE_MS) return { value: entry.value, checkedAt:new Date(entry.time).toISOString(), stale:true, reason:error.message }; throw error; }
}
export async function upstream(source,params={}) {
  const url=new URL(source.api); for(const [key,value] of Object.entries(params)) if(value!==undefined)url.searchParams.set(key,String(value));
  let response; try { response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'YukinoComic/1.0 (+https://comic.yukino.bond)'},signal:AbortSignal.timeout(18000),redirect:'manual'}); } catch { throw failure(`${source.name}暂时连接失败，请切换其他番源`); }
  if(!response.ok) throw failure(`${source.name}返回 HTTP ${response.status}`);
  const text=await response.text(); if(text.length>8*1024*1024) throw failure(`${source.name}返回内容过大`);
  let result; try { result=JSON.parse(text); }catch{ throw failure(`${source.name}未返回有效目录`); }
  if(!Array.isArray(result.list) || (result.code!==undefined && Number(result.code)!==1)) throw failure(`${source.name}目录格式发生变化`);
  return result;
}
export async function detail(env,id,force=false) {
  const parts=splitId(id); if(!parts)throw failure('番剧编号无效',400);
  const result=await cached(env,'detail:v1:'+id,async()=>{
    const data=await upstream(parts.source,{ac:'detail',ids:parts.native});
    const item=data.list.find(x=>String(x.vod_id)===parts.native), anime=item&&normalize(item,parts.source);
    if(!anime)throw failure('这个番源没有找到该动漫',404);return anime;
  },force,false);
  return result;
}
export async function catalog(env,params=new URLSearchParams(),persistHome=false) {
  const q=(params.get('q')||'').trim().slice(0,80), page=Math.max(1,Math.min(500,Math.floor(Number(params.get('page'))||1)));
  const category=params.get('category')||'all', selected=params.get('source')||'all', force=params.get('refresh')==='1';
  if(!['all','jp','cn','west','movie'].includes(category) || (selected!=='all'&&!sourceById(selected)))throw failure('筛选条件无效',400);
  const sources=selected==='all'?SOURCES:[sourceById(selected)];
  const results=await Promise.all(sources.map(async source=>{
    try {
      const categories=persistHome?[...new Set(Object.values(source.categories))]:q&&category==='all'?[undefined]:category==='all'?[source.categories.jp,source.categories.cn]:[source.categories[category]];
      if(categories.every(x=>x===undefined)&&!(q&&category==='all')) return {source,state:'unsupported',reason:'此番源未单列该分类',items:[],pagecount:1};
      const home=!q&&page===1,homeKey='home:v1:'+source.id;
      if(home&&env.COMIC_CACHE){try{const saved=await env.COMIC_CACHE.get(homeKey,'json');for(const part of saved?.parts||[])if(part.key.startsWith('catalog:v1:'+source.id+':')&&part.entry?.value&&Number.isFinite(part.entry.time)&&Date.now()-part.entry.time<STALE_MS&&!memory.has(part.key))memory.set(part.key,part.entry);}catch{/* Source reads stay usable when KV is unavailable. */}}
      const cacheKeys=categories.map(t=>`catalog:v1:${source.id}:${t||'search'}:${page}:${q}`);
      const reads=await Promise.allSettled(categories.map((t,index)=>cached(env,cacheKeys[index],async()=>{
        const data=await upstream(source,{ac:'detail',t,pg:page,...(q?{wd:q}:{})});
        const items=data.list.map(x=>normalize(x,source)).filter(Boolean);
        return {items,pagecount:Math.min(500,Number(data.pagecount)||1)};
      },force,home)));
      const parts=reads.filter(read=>read.status==='fulfilled').map(read=>read.value),errors=reads.filter(read=>read.status==='rejected').map(read=>read.reason.message);
      if(!parts.length)return {source,state:'error',reason:errors.join('；'),items:[],pagecount:1};
      // Four sources, one bundled write each hour: at most 96 scheduled writes/day.
      // Old per-category records remain readable during migration and are never rewritten.
      if(home&&persistHome&&env.COMIC_CACHE&&parts.some(part=>!part.stale)){try{await env.COMIC_CACHE.put(homeKey,JSON.stringify({parts:reads.flatMap((read,index)=>read.status==='fulfilled'?[{key:cacheKeys[index],entry:{time:Date.parse(read.value.checkedAt),value:read.value.value}}]:[])}),{expirationTtl:604800});}catch{/* Exhausted KV quota must not discard a successful source response. */}}
      // Feed responses already contain the complete episode list. Reuse them for covers and details in this isolate.
      for(const part of parts)for(const item of part.value.items)memory.set('detail:v1:'+item.id,{time:Date.parse(part.checkedAt),value:item});
      while(memory.size>400)memory.delete(memory.keys().next().value);
      const stale=parts.some(x=>x.stale);
      return {source,state:errors.length?'partial':stale?'stale':'ok',checkedAt:parts.map(x=>x.checkedAt).sort()[0],reason:[...errors,...parts.filter(x=>x.reason).map(x=>x.reason)].join('；')||undefined,stale,items:parts.flatMap(x=>x.value.items),pagecount:Math.max(...parts.map(x=>x.value.pagecount))};
    }catch(error){return {source,state:'error',reason:error.message,items:[],pagecount:1};}
  }));
  if(!results.some(x=>['ok','partial','stale'].includes(x.state)))throw failure(results.map(x=>x.reason).join('；')||'暂时没有可用番源');
  return { data:mergeCatalog(results.flatMap(x=>x.items)), page, hasMore:results.some(x=>x.pagecount>page),
    sources:results.map(({source,items,pagecount,stale,...status})=>({id:source.id,name:source.name,count:items.length,...status})),
    meta:{checkedAt:results.map(x=>x.checkedAt).filter(Boolean).sort()[0]||null,stale:results.some(x=>x.stale),scheduledMinutes:60,cacheMinutes:5} };
}
export async function refreshCatalogs(env) { return catalog(env,new URLSearchParams('refresh=1'),true); }
