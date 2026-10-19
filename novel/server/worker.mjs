import { SOURCE, catalog, book, volume, chapter, searchBooks, validId, imageSource } from './service.mjs';
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
  const result = await fetch(src, { headers: { Referer: `${SOURCE}/`, Accept: 'image/avif,image/webp,image/*' }, signal: AbortSignal.timeout(18000), redirect: 'manual' });
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
      if (response.status === 404 && request.method === 'GET' && !/\.[\w]+$/.test(url.pathname)) response = await env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(policy)) headers.set(key, value);
      if (url.pathname === '/sw.js') headers.set('Cache-Control', 'no-cache');
      return new Response(response.body, { status: response.status, headers });
    }
    if (request.method !== 'GET') return json({ error: '仅支持 GET 请求' }, 405);
    if (throttle(request)) return new Response(JSON.stringify({ error: '操作频繁，请稍后再试' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60', 'Cache-Control': 'no-store' } });
    try {
      if (url.pathname === '/api/image') return await image(request, url);
      const force = url.searchParams.get('refresh') === '1';
      if (url.pathname === '/api/books' || url.pathname === '/api/status') {
        const result = await catalog(env, ctx, { force });
        if (url.pathname === '/api/status') return json({ data: { indexed: result.data.length, source: SOURCE, scheduledMinutes: 15, cacheMinutes: 5, persisted: Boolean(env.NOVEL_CACHE), newestUpdate: result.data.map(x => x.updatedAt).filter(Boolean).sort().at(-1) }, meta: result.meta });
        const ids = url.searchParams.get('ids');
        const data = ids !== null ? { items: result.data.filter(x => ids.split(',').slice(0, 200).includes(x.id)), indexed: result.data.length } : searchBooks(result.data, url.searchParams);
        return json({ data, meta: result.meta });
      }
      let match = url.pathname.match(/^\/api\/book\/([^/]+)(?:\/(volume|chapter)\/([^/]+))?$/);
      if (!match || !validId(match[1]) || (match[3] && !validId(match[3]))) return json({ error: '没有这个接口或书籍编号不正确' }, 404);
      const result = match[2] === 'volume' ? await volume(env, ctx, match[1], match[3], force) : match[2] === 'chapter' ? await chapter(env, ctx, match[1], match[3], force) : await book(env, ctx, match[1], force);
      return json({ data: result.data, meta: result.meta });
    } catch (error) { return json({ error: error instanceof Error ? error.message : '书源连接失败，请稍后重试' }, 503); }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(catalog(env, ctx, { force: true }).then(result => {
      if (result.meta.stale) console.warn(`Catalog refresh retained previous data: ${result.meta.reason}`);
      else console.log(`Novel catalog synchronized: ${result.data.length} books, ${result.meta.checkedAt}`);
    }).catch(error => console.error('Novel catalog synchronization failed:', error.message)));
  },
};
