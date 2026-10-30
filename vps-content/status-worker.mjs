import { onRequestGet } from '../functions/api/status.ts';
export default { async fetch(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/status' && request.method === 'GET') return onRequestGet();
  if (url.pathname.startsWith('/api/')) return Response.json({ error: '此状态站独立提供检测，不依赖主站账户服务。' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  let result = await env.ASSETS.fetch(request);
  if (result.status === 404 && request.method === 'GET' && !/\.[\w]+$/.test(url.pathname)) result = await env.ASSETS.fetch(new Request(new URL('/', url), request));
  const headers = new Headers(result.headers);
  headers.set('X-Frame-Options', 'DENY'); headers.set('Referrer-Policy', 'no-referrer');
  return new Response(result.body, { status: result.status, headers });
} };
