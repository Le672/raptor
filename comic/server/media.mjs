import { publicUrl } from './sources.mjs';
const encoder=new TextEncoder(), keys=new WeakMap();
const error=(message,status=502)=>Object.assign(new Error(message),{status});
function base64(bytes){let value='';for(const byte of bytes)value+=String.fromCharCode(byte);return btoa(value).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function unbase64(text){return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0));}
async function key(env) {
  if(!keys.has(env)) keys.set(env,(async()=>{
    const secret=env.COMIC_MEDIA_SECRET||await env.COMIC_CACHE?.get('private:media-key');
    if(!secret)throw error('播放器签名尚未配置，请稍后再试',503);
    return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  })().catch(e=>{keys.delete(env);throw e;}));
  return keys.get(env);
}
export async function mediaPath(env,url,expires=Date.now()+12*3600000) {
  if(!publicUrl(url))throw error('源站返回了不支持的播放地址');
  const data=base64(encoder.encode(JSON.stringify({u:url,e:expires})));
  const sig=base64(new Uint8Array(await crypto.subtle.sign('HMAC',await key(env),encoder.encode(data))));
  return '/api/media?token='+data+'.'+sig;
}
export async function verifyMedia(env,token) {
  try {
    if(!token||token.length>9000)throw 0;
    const [data,sig,...rest]=token.split('.');if(rest.length||!data||!sig)throw 0;
    if(!await crypto.subtle.verify('HMAC',await key(env),unbase64(sig),encoder.encode(data)))throw 0;
    const value=JSON.parse(new TextDecoder().decode(unbase64(data)));
    if(!publicUrl(value.u)||!Number.isFinite(value.e)||value.e<Date.now()||value.e>Date.now()+13*3600000)throw 0;
    return value;
  }catch(e){if(e?.status===503)throw e;throw error('播放链接已失效，请刷新播放器',403);}
}
export async function safeFetch(input,options={}) {
  let url=publicUrl(input);if(!url)throw error('源站地址不受支持');
  for(let redirects=0;redirects<4;redirects++){
    let response;try{response=await fetch(url,{...options,signal:AbortSignal.timeout(25000),redirect:'manual'});}catch{throw error('视频线路连接失败，请重试或切换其他番源');}
    if([301,302,303,307,308].includes(response.status)){
      const next=publicUrl(new URL(response.headers.get('location')||'',url).href);if(!next)throw error('源站跳转到不支持的地址');url=next;continue;
    }
    return {response,url:url.href};
  }
  throw error('源站跳转次数过多');
}
export async function rewriteManifest(text,base,env,expires) {
  if(!text.trimStart().startsWith('#EXTM3U'))throw error('番源没有返回 HLS 视频，请尝试其他番源');
  const lines=text.split(/\r?\n/);
  return (await Promise.all(lines.map(async line=>{
    if(!line.trim())return line;
    if(!line.startsWith('#'))return mediaPath(env,new URL(line.trim(),base).href,expires);
    const matches=[...line.matchAll(/URI="([^"]+)"/g)];
    let result=line;for(const match of matches)result=result.replace(match[0],`URI="${await mediaPath(env,new URL(match[1],base).href,expires)}"`);
    return result;
  }))).join('\n');
}
export async function serveMedia(request,env,url) {
  const token=await verifyMedia(env,url.searchParams.get('token'));
  const headers={Accept:'*/*'};const range=request.headers.get('range');if(range&&/^bytes=\d+-\d*$/.test(range))headers.Range=range;
  const result=await safeFetch(token.u,{headers}), upstream=result.response;
  if(!upstream.ok)throw error(`此线路返回 HTTP ${upstream.status}，请切换其他番源`);
  const type=upstream.headers.get('content-type')||'';
  if(/\.m3u8(?:$|\?)/i.test(result.url)||/mpegurl/i.test(type)){
    const text=await upstream.text();if(text.length>2*1024*1024)throw error('HLS 清单超过大小限制');
    return new Response(await rewriteManifest(text,result.url,env,token.e),{headers:{'Content-Type':'application/vnd.apple.mpegurl','Cache-Control':'private, max-age=120','X-Content-Type-Options':'nosniff'}});
  }
  if(/text\/html|application\/json/i.test(type))throw error('番源返回了错误页面，请切换其他番源');
  if(Number(upstream.headers.get('content-length'))>50*1024*1024)throw error('视频分片超过大小限制');
  const out=new Headers({'Content-Type':type||'application/octet-stream','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'});
  for(const name of ['content-length','content-range','accept-ranges'])if(upstream.headers.has(name))out.set(name,upstream.headers.get(name));
  return new Response(upstream.body,{status:upstream.status,headers:out});
}
export async function probeMedia(input) {
  const {response,url}=await safeFetch(input,{headers:{Accept:'application/vnd.apple.mpegurl,*/*'}});
  if(!response.ok)throw error(`此线路返回 HTTP ${response.status}，请切换其他番源`);
  if(/\.m3u8(?:$|\?)/i.test(url)){
    const text=await response.text();if(!text.trimStart().startsWith('#EXTM3U'))throw error('此线路暂时没有返回视频清单');
  }else response.body?.cancel();
  return url;
}
