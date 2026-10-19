import { SOURCES, splitId } from './sources.mjs';
import { catalog, detail, refreshCatalogs } from './service.mjs';
import { mediaPath, serveMedia, safeFetch, probeMedia } from './media.mjs';
const policy={
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':"default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' https://cloudflareinsights.com; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...policy,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const throttle=new Map();
function limited(request){const ip=request.headers.get('CF-Connecting-IP');if(!ip)return false;const now=Date.now(),v=throttle.get(ip);if(throttle.size>5000)for(const[k,x]of throttle)if(x.until<now)throttle.delete(k);if(!v||v.until<now){throttle.set(ip,{count:1,until:now+60000});return false;}return ++v.count>100;}
async function cover(env,id){
  const cache=globalThis.caches?.default,key=new Request('https://comic.yukino.bond/api/cover/'+id);if(cache){const hit=await cache.match(key);if(hit)return hit;}
  const {value}=await detail(env,id);if(!value.imageUrl)return new Response(null,{status:404});
  const {response}=await safeFetch(value.imageUrl,{headers:{Accept:'image/avif,image/webp,image/*'}});
  if(!response.ok)return new Response(null,{status:502});const type=(response.headers.get('content-type')||'').split(';')[0];
  if(!/^image\/(?:jpeg|png|webp|gif|avif)$/.test(type))return new Response(null,{status:502});
  const bytes=await response.arrayBuffer();if(bytes.byteLength>8*1024*1024)return new Response(null,{status:502});
  const result=new Response(bytes,{headers:{'Content-Type':type,'Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff'}});if(cache)await cache.put(key,result.clone());return result;
}
export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/')){
      let result=await env.ASSETS.fetch(request);
      if(result.status===404&&request.method==='GET'&&!/\.[\w]+$/.test(url.pathname))result=await env.ASSETS.fetch(new Request(new URL('/index.html',url),request));
      const headers=new Headers(result.headers);for(const[k,v]of Object.entries(policy))headers.set(k,v);
      if(url.pathname==='/sw.js'||headers.get('content-type')?.includes('text/html'))headers.set('Cache-Control','no-cache');
      return new Response(result.body,{status:result.status,headers});
    }
    if(request.method!=='GET')return json({error:'仅支持 GET 请求'},405);
    try{
      // Signed media and cached covers have separate traffic patterns from catalog searches.
      if(url.pathname==='/api/media')return await serveMedia(request,env,url);
      let match=url.pathname.match(/^\/api\/cover\/([^/]+)$/);if(match){if(!splitId(match[1]))return json({error:'番剧编号无效'},400);return await cover(env,match[1]);}
      if(limited(request))return new Response(JSON.stringify({error:'操作频繁，请稍后再试'}),{status:429,headers:{'Content-Type':'application/json','Retry-After':'60'}});
      if(url.pathname==='/api/catalog')return json(await catalog(env,url.searchParams));
      if(url.pathname==='/api/sources')return json({data:SOURCES.map(({id,name,home,categories})=>({id,name,home,categories:Object.keys(categories)})),scheduledMinutes:15,cacheMinutes:5});
      match=url.pathname.match(/^\/api\/anime\/([^/]+)(?:\/(play))?$/);
      if(!match||!splitId(match[1]))return json({error:'没有这个接口或番剧编号无效'},404);
      const result=await detail(env,match[1],url.searchParams.get('refresh')==='1');
      const {imageUrl,lines,...anime}=result.value;
      if(!match[2])return json({data:{...anime,lines:lines.map(line=>({...line,episodes:line.episodes.map(({url,...episode})=>episode)}))},meta:{checkedAt:result.checkedAt,stale:result.stale,reason:result.reason}});
      const line=lines.find(x=>x.id===url.searchParams.get('line')),episode=line?.episodes.find(x=>x.id===url.searchParams.get('episode'));
      if(!episode)return json({error:'这条线路没有该剧集，请重新选集'},404);
      const target=await probeMedia(episode.url),expires=Date.now()+12*3600000;
      return json({data:{url:await mediaPath(env,target,expires),kind:episode.kind,expiresAt:new Date(expires).toISOString(),title:episode.title},meta:{checkedAt:result.checkedAt,stale:result.stale}});
    }catch(error){console.error('Comic request failed:',url.pathname,error.message);return json({error:error.message||'番源暂时不可用，请稍后重试'},error.status||503);}
  },
  async scheduled(_event,env,ctx){ctx.waitUntil(refreshCatalogs(env).then(results=>{for(const result of results)if(result.status==='rejected')console.warn('Comic catalog sync failed:',result.reason?.message);console.log('Comic catalog refresh complete');}));},
};
