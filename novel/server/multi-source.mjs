import { SOURCES, sourceInfo, bookSource, bookIdValid, nativeBookId } from '../shared/sources.mjs';
import { adapters, SourceError } from './adapters.mjs';
import { catalog, book, volume, chapter, cached, stored, persist, searchBooks } from './service.mjs';
import { SNAPSHOT_KEYS, updateStored, persistSnapshot, hourlyTask } from './cache.mjs';

const freshMeta = (provider, checkedAt = null) => ({ checkedAt, stale: false, reason: '', provider, refreshMinutes: 5 });
const metadata = book => { const { volumes, ...rest } = book; return rest; };
const merge = (...groups) => [...new Map(groups.flat().map(item => [item.id, item])).values()];
const rememberedKey = source => `discovered:v2:${source}`;
async function wenkuHealth(env,state,reason=''){
  const key='health:v2:wenku',old=await stored(env,key);
  if(old?.state===state&&old?.reason===reason&&Date.now()-Date.parse(old.checkedAt)<300000)return;
  await persist(env,key,{state,reason,checkedAt:new Date().toISOString()},3600);
}
export async function remember(env, value, checkedAt = new Date().toISOString()) {
  const source = bookSource(value.id);
  if (source === 'bili') return;
  await updateStored(env, rememberedKey(source), old => {
    const items = merge(old?.data || [], [metadata(value)]).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
    return { data: items.slice(0,1000), checkedAt: old?.checkedAt > checkedAt ? old.checkedAt : checkedAt };
  }, 30 * 86400);
}
async function feed(source, env, ctx, force) {
  if (source === 'bili') {
    const result = await catalog(env,ctx,{force});
    return { ...result, data: result.data.map(item=>({...item,source:'bili',sourceName:sourceInfo('bili').name})) };
  }
  const old = await stored(env, rememberedKey(source));
  if (source === 'wenku') {
    const health=await stored(env,'health:v2:wenku');
    const failed=health&&health.state!=='limited'&&Date.now()-Date.parse(health.checkedAt)<3600000;
    return { data: old?.data || [], meta: {...freshMeta(sourceInfo(source).name,old?.checkedAt),state:failed?health.state:'limited',reason:failed?health.reason:sourceInfo(source).note,stale:Boolean(failed&&old?.data?.length)} };
  }
  const result = await cached(env,ctx,`feed:v2:${source}`,()=>adapters[source].catalog(),5*60000,{force,background:true,provider:sourceInfo(source).name});
  return {...result,data:merge(old?.data||[],result.data)};
}
function selectedSources(params) {
  const selected=params.get('source');
  if (selected && selected !== 'all' && !sourceInfo(selected)) throw new SourceError('书源编号不正确',400);
  return selected && selected !== 'all' ? [selected] : SOURCES.map(item=>item.id);
}
function summarize(source, result, error) {
  const info=sourceInfo(source);
  if (error) return {...info,count:0,state:error.state||'error',stale:false,checkedAt:null,reason:error.message || '书源连接失败'};
  return {...info,count:result.data.length,state:source==='wenku'?(result.meta.state||'limited'):result.meta.stale?'stale':'ok',stale:result.meta.stale,checkedAt:result.meta.checkedAt,reason:result.meta.reason};
}
export async function allCatalog(env,ctx,params=new URLSearchParams()) {
  const force=params.get('refresh')==='1', selected=selectedSources(params);
  const results=await Promise.all(selected.map(async source=>{try{return{source,result:await feed(source,env,ctx,force)}}catch(error){return{source,error}}}));
  const books=merge(...results.filter(x=>x.result).map(x=>x.result.data));
  const sources=results.map(x=>summarize(x.source,x.result,x.error));
  const times=sources.map(x=>x.checkedAt).filter(Boolean).sort();
  return{data:books,sources,meta:{...freshMeta('多书源聚合',times.at(-1)||null),stale:books.length>0 && sources.filter(x=>x.count>0).every(x=>x.stale),reason:sources.some(x=>x.state==='error'||x.state==='restricted')?'部分书源暂不可用，其他结果正常显示':''}};
}
async function searchRemote(source,query,env,ctx,force) {
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(query)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  return cached(env,ctx,`search:v2:${source}:${hash}`,()=>adapters[source].search(query),5*60000,{force,retention:3600,provider:sourceInfo(source).name});
}
export async function findBooks(env,ctx,params) {
  const query=(params.get('q')||'').trim().slice(0,120), selected=selectedSources(params), force=params.get('refresh')==='1';
  if (!query) {
    const result=await allCatalog(env,ctx,params);
    const ids=params.get('ids');
    const wanted=new Set((ids||'').split(',').slice(0,200));
    if(ids!==null){
      // Bound outbound requests; longer shelves rotate by last successful source fetch.
      const known=new Map(result.data.map(item=>[item.id,item]));
      const pending=[...wanted].filter(id=>bookIdValid(id)&&bookSource(id)!=='bili'&&selected.includes(bookSource(id)))
        .sort((a,b)=>(known.get(a)?.sourceFetchedAt||'').localeCompare(known.get(b)?.sourceFetchedAt||'')).slice(0,6);
      const checks=await Promise.allSettled(pending.map(id=>getBook(env,ctx,id,force)));
      checks.forEach((check,index)=>{if(check.status==='fulfilled')known.set(pending[index],metadata(check.value.data));});
      const stale=checks.some(check=>check.status==='rejected'||check.value.meta.stale);
      return{data:{items:[...known.values()].filter(item=>wanted.has(item.id)),indexed:known.size,sources:result.sources,scope:'收藏书目，每次最多检查六本新增书源作品，其余轮流检查'},meta:stale?{...result.meta,stale:true,reason:'部分收藏正在同步或获取失败，保留上次书目信息'}:result.meta};
    }
    const data=searchBooks(result.data,params);
    return{data:{...data,sources:result.sources,scope:'各源当前发现书目'},meta:result.meta};
  }
  const results=await Promise.all(selected.map(async source=>{
    try {
      const result=source==='bili'||source==='wenku'?await feed(source,env,ctx,force):await searchRemote(source,query,env,ctx,force);
      return{source,result};
    } catch(error){return{source,error};}
  }));
  const sources=results.map(x=>summarize(x.source,x.result,x.error)), items=merge(...results.filter(x=>x.result).map(x=>x.result.data));
  // The source's own search can match aliases which are absent from its result title.
  const filteredParams=new URLSearchParams(params);filteredParams.delete('q');
  const matching=items.filter(item=>!['bili','wenku'].includes(bookSource(item.id)) || searchBooks([item],params).total>0);
  const data=searchBooks(matching,filteredParams),times=sources.map(x=>x.checkedAt).filter(Boolean).sort();
  return{data:{...data,sources,scope:'哔哩索引与各新增书源当前返回的公开搜索结果'},meta:{...freshMeta('多书源搜索',times.at(-1)||null),stale:false,reason:''}};
}
export async function getBook(env,ctx,id,force=false,rememberEntry=true) {
  if(!bookIdValid(id))throw new SourceError('书籍编号不正确',404);
  const source=bookSource(id);if(source==='bili')return book(env,ctx,id,force);
  let result;
  try{
    result=await cached(env,ctx,`detail:v2:${id}`,()=>adapters[source].book(nativeBookId(id)),5*60000,{force,background:true,provider:sourceInfo(source).name});
    if(source==='wenku'&&!result.meta.stale)await wenkuHealth(env,'limited').catch(()=>{});
  }catch(error){if(source==='wenku')await wenkuHealth(env,error.state||'error',error.message).catch(()=>{});throw error;}
  if(rememberEntry&&!result.meta.stale)ctx.waitUntil(remember(env,result.data,result.meta.checkedAt).catch(()=>{}));return result;
}
export async function getVolume(env,ctx,id,vid,force=false) {
  if(bookSource(id)==='bili')return volume(env,ctx,id,vid,force);
  const result=await getBook(env,ctx,id,force),item=result.data.volumes.find(x=>x.id===vid);
  if(!item)throw new SourceError('分卷不在当前书籍目录中',404);
  return{data:{...item,bookId:id},meta:result.meta};
}
export async function getChapter(env,ctx,id,cid,force=false) {
  const source=bookSource(id);if(source==='bili')return chapter(env,ctx,id,cid,force);
  const detail=await getBook(env,ctx,id,force);
  const vol=detail.data.volumes.find(x=>x.chapters.some(ch=>ch.id===cid)),item=vol?.chapters.find(x=>x.id===cid);
  if(!item)throw new SourceError('章节不在当前书籍目录中',404);
  if(item.restricted)throw new SourceError('此章节需要在源站登录订阅，请前往源站阅读',403,'restricted');
  return cached(env,ctx,`text:v2:${id}:${cid}`,async()=>{
    const data=await adapters[source].chapter(item.sourceUrl);
    return{id:cid,bookId:id,volumeId:vol.id,title:data.title||item.title,blocks:data.blocks,sourceUrl:item.sourceUrl,source,sourceName:sourceInfo(source).name};
  },15*60000,{force,retention:7*86400,provider:sourceInfo(source).name,staleOnRestricted:false});
}
export function validPartId(value){return /^(?:[1-9]\d{0,15}|v[0-9a-f]{8})$/.test(String(value));}
export async function refreshKnownSources(env,ctx) {
  await Promise.all(['sf','linovel','wenku'].map(async source=>{
    const old=await stored(env,rememberedKey(source));if(!old?.data?.length)return;
    // Fetches and Cache API operations share the free Worker's 50-subrequest limit.
    const batch=[...old.data].sort((a,b)=>(a.sourceFetchedAt||'').localeCompare(b.sourceFetchedAt||'')).slice(0,1);
    const results=await Promise.allSettled(batch.map(item=>getBook(env,ctx,item.id,true,false)));
    const changed=results.filter(item=>item.status==='fulfilled'&&!item.value.meta.stale).map(item=>metadata(item.value.data));
    if(changed.length)await persist(env,rememberedKey(source),{data:merge(old.data,changed),checkedAt:new Date().toISOString()},30*86400);
  }));
}
export async function synchronizeSnapshot(env,ctx,scheduledTime=Date.now()) {
  return hourlyTask(env,async()=>{
    const [catalogResult]=await Promise.all([allCatalog(env,ctx,new URLSearchParams('refresh=1')),refreshKnownSources(env,ctx)]);
    const entries=await Promise.all(SNAPSHOT_KEYS.map(async key=>[key,await stored(env,key)]));
    const persistence=await persistSnapshot(env,Object.fromEntries(entries),scheduledTime);
    return { ...catalogResult, persistence };
  });
}
