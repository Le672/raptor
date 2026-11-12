import * as biqu from './biqu.mjs';
import * as zongheng from './zongheng.mjs';
import {cached,persist,stored,persistSnapshot,snapshotStatus,hourlyTask} from '../../novel/server/cache.mjs';
import {searchBooks} from '../../novel/server/service.mjs';
import {SourceError} from '../../novel/server/html-fetch.mjs';
import {SOURCES,sourceInfo,bookIdValid,bookSource,sourceBookUrl,imageSource,partIdValid} from '../shared/sources.mjs';
export {bookIdValid,sourceBookUrl,imageSource,snapshotStatus};
export const SOURCE='https://www.zongheng.com',validPartId=partIdValid;
const modules={biqu,zongheng};
function selected(params){const id=params.get('source');if(!id||id==='all')return SOURCES;if(!sourceInfo(id))throw new SourceError('请选择普通小说书源，轻小说已迁至 ln.yukino.bond',400);return[sourceInfo(id)];}
function aggregate(results,sources){const data=[],statuses=[];for(let i=0;i<results.length;i++){const r=results[i],info=sources[i];if(r.status==='fulfilled'){data.push(...r.value.data);statuses.push({...info,...r.value.meta,count:r.value.data.length,state:r.value.meta.stale?'stale':'ok'});}else statuses.push({...info,count:0,state:r.reason.state||'error',checkedAt:null,stale:false,reason:r.reason.message});}
 const usable=statuses.filter(s=>s.checkedAt),old=usable.map(s=>s.checkedAt).sort()[0]||null,stale=statuses.some(s=>s.state!=='ok');return{data:[...new Map(data.map(b=>[b.id,b])).values()],sources:statuses,meta:{checkedAt:old,provider:'普通小说书库',refreshMinutes:5,stale,reason:statuses.filter(s=>s.reason).map(s=>s.name+'：'+s.reason).join('；')}};
}
export async function allCatalog(env,ctx,params=new URLSearchParams()){const active=selected(params),results=await Promise.allSettled(active.map(s=>modules[s.id].catalog(env,ctx,params.get('refresh')==='1')));const result=aggregate(results,active);if(!result.data.length){const old=await stored(env,'catalog:v1');if(old?.data?.length){result.data=old.data.filter(b=>active.some(s=>s.id===b.source));result.meta.stale=true;result.meta.checkedAt=old.checkedAt;}}return result;}
export async function findBooks(env,ctx,params){
 const active=selected(params),q=(params.get('q')||'').trim().slice(0,120),force=params.get('refresh')==='1';
 if(params.has('ids')){const ids=[...new Set(params.get('ids').split(','))].filter(bookIdValid).slice(0,200),result=await allCatalog(env,ctx,params),known=new Map(result.data.map(b=>[b.id,b]));const previous=await Promise.all(ids.map(async id=>({id,at:Date.parse((await stored(env,`fiction:${bookSource(id)==='zongheng'?'zh:book':'book'}:${id}`))?.checkedAt)||0})));previous.sort((a,b)=>a.at-b.at);const checks=await Promise.allSettled(previous.slice(0,6).map(({id})=>getBook(env,ctx,id,force)));for(const r of checks)if(r.status==='fulfilled'){const{volumes,...book}=r.value.data;known.set(book.id,book);}return{data:{items:ids.map(id=>known.get(id)).filter(Boolean),indexed:known.size,sources:result.sources,scope:'收藏更新，每次轮流检查六本的源站详情'},meta:result.meta};}
 const result=q?aggregate(await Promise.allSettled(active.map(s=>modules[s.id].search(env,ctx,q,force))),active):await allCatalog(env,ctx,params);
 const filters=new URLSearchParams(params);if(q){filters.delete('q');if(!filters.has('sort')){const rank=b=>b.title===q?0:b.title.includes(q)?1:b.author.includes(q)?2:3;result.data.sort((a,b)=>rank(a)-rank(b));filters.set('sort','relevance');}}return{data:{...searchBooks(result.data,filters),sources:result.sources,scope:q?'纵横当前前 100 条搜索结果与补充源的书名搜索；作者、标签以各源标注为准':'纵横首页公开推荐与补充源最近更新，不代表全站作品总数'},meta:result.meta};
}
export async function getBook(env,ctx,id,force=false){if(!bookIdValid(id))throw new SourceError('普通小说编号不正确',404);return modules[bookSource(id)].getBook(env,ctx,id,force);}
export async function getVolume(env,ctx,id,vid,force=false){if(!bookIdValid(id))throw new SourceError('普通小说编号不正确',404);return modules[bookSource(id)].getVolume(env,ctx,id,vid,force);}
export async function getChapter(env,ctx,id,cid,force=false){if(!bookIdValid(id))throw new SourceError('普通小说编号不正确',404);return modules[bookSource(id)].getChapter(env,ctx,id,cid,force);}
export async function synchronizeSnapshot(env,ctx,time=Date.now()){return hourlyTask(env,async()=>{const result=await allCatalog(env,ctx,new URLSearchParams('refresh=1'));if(result.data.length)await persist(env,'catalog:v1',{data:result.data,checkedAt:result.meta.checkedAt},30*86400);return{...result,persistence:await persistSnapshot(env,{'catalog:v1':await stored(env,'catalog:v1')},time)};});}
