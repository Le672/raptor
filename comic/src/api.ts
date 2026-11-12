export type Episode={id:string;title:string;kind:'hls'|'mp4'};
export type Line={id:string;name:string;episodes:Episode[]};
export type Anime={id:string;source:string;sourceName:string;title:string;aliases:string;cover:string;category:string;year:string;area:string;language:string;tags:string[];remark:string;completed:boolean;updatedAt:string|null;score:number|null;episodeCount:number;variants?:{id:string;sourceName:string}[]};
export type Detail=Anime&{description:string;actors:string;director:string;lines:Line[]};
export type Meta={checkedAt:string|null;stale:boolean;reason?:string;offline?:boolean};
export type SourceStatus={id:string;name:string;count:number;state:'ok'|'partial'|'stale'|'error'|'unsupported';reason?:string;checkedAt?:string};
export type Catalog={data:Anime[];page:number;hasMore:boolean;sources:SourceStatus[];meta:Meta};
export type DetailResponse={data:Detail;meta:Meta};
export type PlayResponse={data:{url:string;kind:'hls'|'mp4';expiresAt:string;title:string};meta:Meta};
export const sourceNames:Record<string,string>={ikun:'iKun',bf:'暴风',ff:'非凡',lz:'量子'};
export const categories=[['all','全部'],['jp','日韩动漫'],['cn','国产动漫'],['west','欧美动漫'],['movie','动画电影']];
export {request,ApiError,loginUrl,isLoginRequired} from './access';
export const watchPath=(id:string,line:string,episode:string)=>`/watch/${encodeURIComponent(id)}/${encodeURIComponent(line)}/${encodeURIComponent(episode)}`;
export function stamp(value:string|null|undefined){return value?new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Singapore'}).format(new Date(value)):'源站未标注';}
export function clock(value:number){if(!Number.isFinite(value)||value<0)return '00:00';const n=Math.floor(value);return (n>=3600?Math.floor(n/3600)+':':'')+String(Math.floor(n/60)%60).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
