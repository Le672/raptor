export type Episode={id:string;title:string;kind:'hls'|'mp4'};
export type Line={id:string;name:string;episodes:Episode[]};
export type MediaKind='movie'|'series'|'variety'|'doc';
export type Media={id:string;mediaKind:MediaKind;source:string;sourceName:string;title:string;aliases:string;cover:string;category:string;year:string;area:string;language:string;tags:string[];remark:string;completed:boolean;updatedAt:string|null;score:number|null;episodeCount:number;variants?:{id:string;sourceName:string}[]};
export type Detail=Media&{description:string;actors:string;director:string;lines:Line[]};
export type Meta={checkedAt:string|null;stale:boolean;reason?:string;offline?:boolean};
export type SourceStatus={id:string;name:string;count:number;state:'ok'|'partial'|'stale'|'error'|'unsupported';reason?:string;checkedAt?:string};
export type Catalog={data:Media[];page:number;hasMore:boolean;sources:SourceStatus[];meta:Meta};
export type DetailResponse={data:Detail;meta:Meta};
export type PlayResponse={data:{url:string;kind:'hls'|'mp4';expiresAt:string;title:string};meta:Meta};
export const sourceNames:Record<string,string>={ikun:'iKun',bf:'暴风',ff:'非凡',lz:'量子'};
export const categories=[['all','全部'],['movie','电影'],['series','电视剧'],['variety','综艺'],['doc','纪录片']];
export const kindNames:Record<MediaKind,string>={movie:'电影',series:'电视剧',variety:'综艺',doc:'纪录片'};
export const genres:Record<string,Record<string,string>>={all:{all:'全部题材'},movie:{all:'全部题材',drama:'剧情',action:'动作',comedy:'喜剧',romance:'爱情',scifi:'科幻',horror:'恐怖',war:'战争',thriller:'惊悚',mystery:'悬疑',crime:'犯罪',family:'家庭',history:'历史',period:'古装',disaster:'灾难',short:'短片'},series:{all:'全部地区',cn:'国产剧',west:'欧美剧',hk:'香港剧',kr:'韩国剧',tw:'台湾剧',jp:'日本剧',overseas:'海外剧',th:'泰国剧'},variety:{all:'全部地区',cn:'大陆综艺',hk:'港台综艺',kr:'日韩综艺',west:'欧美综艺'},doc:{all:'全部纪录片'}};
export async function request<T>(path:string,signal?:AbortSignal):Promise<T>{
  let response:Response;
  try{response=await fetch(path,{signal});}catch(error){
    if(signal?.aborted)throw error;
    if(!path.includes('/play?')){try{const hit=await(await caches.open('cinema-data-v1')).match(path);if(hit){const data=await hit.json();data.meta={...data.meta,stale:true,offline:true,reason:'网络未连接，显示上次浏览的目录'};return data;}}catch{/* No offline copy. */}}
    throw new Error('网络连接失败，请检查网络后重试');
  }
  const value=await response.json().catch(()=>({error:'服务暂时没有返回有效数据'}));
  if(!response.ok)throw new Error(value.error||`请求失败（${response.status}）`);
  if(!path.includes('/play?')){try{const cache=await caches.open('cinema-data-v1');await cache.put(path,new Response(JSON.stringify(value)));const keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-80)))await cache.delete(key);}catch{/* Offline cache is optional. */}}
  return value;
}
export const watchPath=(id:string,line:string,episode:string)=>`/watch/${encodeURIComponent(id)}/${encodeURIComponent(line)}/${encodeURIComponent(episode)}`;
export function stamp(value:string|null|undefined){return value?new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Singapore'}).format(new Date(value)):'源站未标注';}
export function clock(value:number){if(!Number.isFinite(value)||value<0)return '00:00';const n=Math.floor(value);return (n>=3600?Math.floor(n/3600)+':':'')+String(Math.floor(n/60)%60).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
