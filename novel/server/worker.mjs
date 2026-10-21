import { SOURCE, imageSource } from './service.mjs';
import { bookIdValid, sourceBookUrl } from '../shared/sources.mjs';
import { allCatalog, findBooks, getBook, getVolume, getChapter, validPartId, synchronizeSnapshot } from './multi-source.mjs';
import { snapshotStatus } from './cache.mjs';
import { createAccessGuard } from '../../shared/content-access.mjs';
const access = createAccessGuard('novel');
const rate = new Map();
const policy = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://cloudflareinsights.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...policy, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
function throttle(request) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return false;
  const now = Date.now(), old = rate.get(ip);
  if (rate.size > 4000) for (const [key, value] of rate) if (value.until < now) rate.delete(key);
  if (!old || old.until < now) { rate.set(ip, { count: 1, until: now + 60000 }); return false; }
  return ++old.count > 150;
}
async function image(request, url) {
  const src = imageSource(url.searchParams.get('src'));
  if (!src) return json({ error: '无效的图片地址' }, 400);
  const cache = globalThis.caches?.default;
  const key = new Request(new URL(`/api/image?src=${encodeURIComponent(src)}`, url.origin));
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  const host = new URL(src).hostname;
  const referer = /sfacg\.com$/.test(host) ? 'https://book.sfacg.com/' : /linovel\.net$/.test(host) ? 'https://www.linovel.net/' : /wenku8\.(?:com|net)$/.test(host) ? 'https://www.wenku8.net/' : `${SOURCE}/`;
  const result = await fetch(src, { headers: { Referer: referer, Accept: 'image/avif,image/webp,image/*' }, signal: AbortSignal.timeout(18000), redirect: 'manual' });
  if (!result.ok) return json({ error: `图片源暂不可用（${result.status}）` }, 502);
  const type = (result.headers.get('content-type') || '').split(';')[0];
  if (!/^image\/(?:jpeg|png|webp|gif|avif)$/.test(type)) return json({ error: '图片源未返回支持的图片格式' }, 502);
  const bytes = await result.arrayBuffer();
  if (bytes.byteLength > 10 * 1024 * 1024) return json({ error: '图片超过大小限制' }, 502);
  const response = new Response(bytes, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
  if (cache) await cache.put(key, response.clone());
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      let response = await env.ASSETS.fetch(request);
      if (response.status === 404 && request.method === 'GET' && !/\.[\w]+$/.test(url.pathname)) response = await env.ASSETS.fetch(new Request(new URL('/', url), request));
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(policy)) headers.set(key, value);
      if (url.pathname === '/sw.js') headers.set('Cache-Control', 'no-cache');
      return new Response(response.body, { status: response.status, headers });
    }
    if (request.method !== 'GET') return json({ error: '仅支持 GET 请求' }, 405);
    try {
      if (url.pathname === '/api/access') return await access.status(request);
      const force = url.searchParams.get('refresh') === '1';
      const protectedRequest = force || /^\/api\/book\/[^/]+\/chapter\/[^/]+$/.test(url.pathname);
      if (protectedRequest) { const denied = await access.require(request, { refresh: force }); if (denied) return denied; }
      if (!protectedRequest && throttle(request)) return new Response(JSON.stringify({ error: '操作频繁，请稍后再试' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60', 'Cache-Control': 'no-store' } });
      if (url.pathname === '/api/image') return await image(request, url);
      if (url.pathname === '/api/status') {
        const result = await allCatalog(env, ctx, url.searchParams);
        return json({ data: { indexed: result.data.length, source: SOURCE, sources: result.sources, scheduledMinutes: 60, cacheMinutes: 5, persisted: Boolean(env.NOVEL_CACHE), persistence: await snapshotStatus(env), newestUpdate: result.data.map(x => x.updatedAt).filter(Boolean).sort().at(-1) }, meta: result.meta });
      }
      if (url.pathname === '/api/books') return json(await findBooks(env, ctx, url.searchParams));
      let match = url.pathname.match(/^\/api\/book\/([^/]+)(?:\/(volume|chapter)\/([^/]+))?$/);
      if (!match || !bookIdValid(match[1]) || (match[3] && !validPartId(match[3]))) return json({ error: '没有这个接口或书籍编号不正确' }, 404);
      const result = match[2] === 'volume' ? await getVolume(env, ctx, match[1], match[3], force) : match[2] === 'chapter' ? await getChapter(env, ctx, match[1], match[3], force) : await getBook(env, ctx, match[1], force);
      return json({ data: result.data, meta: result.meta });
    } catch (error) { const sourceUrl=sourceBookUrl(url.pathname.match(/^\/api\/book\/([^/]+)/)?.[1]||'');return json({ error: error instanceof Error ? error.message : '书源连接失败，请稍后重试', ...(sourceUrl?{sourceUrl}:{}) }, error.status || 503); }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(synchronizeSnapshot(env, ctx, event.scheduledTime).then(result => {
      console.log(`Novel catalog checked: ${result.data.length} books; snapshot persisted: ${result.persistence.persisted}; KV puts: ${result.persistence.writes}`);
      if(!result.persistence.persisted)console.warn(`Novel snapshot: ${result.persistence.reason}`);
      for (const item of result.sources) if (['error','restricted','stale'].includes(item.state)) console.warn(`${item.name}: ${item.reason}`);
    }).catch(error => console.error('Novel catalog synchronization failed:', error.message)));
  },
};
