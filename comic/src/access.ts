export type AccessUser={id:number;name:string;role:'admin'|'user'};
export type AccessStatus={user:AccessUser|null;loginUrl:string;limits?:{dailyLimit:number|null;actionsPerMinute:number;refreshesPerMinute:number}};
const SITE='https://comic.yukino.bond';
export const LOGIN_EVENT='yukino:comic:login-required';

export function loginUrl(path=typeof window==='undefined'?'/':window.location.pathname+window.location.search+window.location.hash){
  let target=new URL('/',SITE);
  try{const candidate=new URL(path,SITE);if(path.startsWith('/')&&!path.startsWith('//')&&!/[\\\u0000-\u0020\u007f]/.test(path)&&candidate.origin===SITE)target=candidate;}catch{/* Return to the site root for an invalid route. */}
  const url=new URL('https://www.yukino.bond/login');url.searchParams.set('returnTo',target.href);return url.href;
}
export class ApiError extends Error{
  readonly status:number;readonly code?:string;readonly loginUrl?:string;
  constructor(message:string,status:number,code?:string,serverLoginUrl?:string){
    super(message);this.name='ApiError';this.status=status;this.code=code;
    if(status===401){try{const url=new URL(serverLoginUrl||loginUrl());if(url.origin==='https://www.yukino.bond'&&url.pathname==='/login')this.loginUrl=url.href;}catch{/* Untrusted links never become login targets. */}}
  }
}
export function isLoginRequired(error:unknown):error is ApiError{return error instanceof ApiError&&error.status===401;}
function publicMetadata(path:string){
  try{const url=new URL(path,SITE);return url.origin===SITE&&url.searchParams.get('refresh')!=='1'&&(url.pathname==='/api/catalog'||/^\/api\/anime\/[a-z]+-[1-9]\d*$/.test(url.pathname));}catch{return false;}
}
export async function request<T>(path:string,signal?:AbortSignal):Promise<T>{
  const cacheable=publicMetadata(path);let response:Response;
  try{response=await fetch(path,{signal,credentials:'same-origin',cache:'no-store'});}catch(error){
    if(signal?.aborted)throw error;
    if(cacheable){try{const hit=await(await caches.open('comic-data-v1')).match(path);if(hit){const data=await hit.json();data.meta={...data.meta,stale:true,offline:true,reason:'网络未连接，显示上次浏览的目录'};return data;}}catch{/* No public offline copy. */}}
    throw new ApiError('网络连接失败，请检查网络后重试',0);
  }
  const value=await response.json().catch(()=>({error:'服务暂时没有返回有效数据'}));
  if(!response.ok){
    const error=new ApiError(value.error||`请求失败（${response.status}）`,response.status,value.code,value.loginUrl);
    if(isLoginRequired(error)&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent(LOGIN_EVENT,{detail:error}));
    throw error;
  }
  if(cacheable){try{const cache=await caches.open('comic-data-v1');await cache.put(path,new Response(JSON.stringify(value)));const keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-80)))await cache.delete(key);}catch{/* Public offline cache is optional. */}}
  return value;
}

