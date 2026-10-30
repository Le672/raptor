import { handleSpeed } from '../speed/cloudflare/api.mjs';
export default { async fetch(request, env) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    if (!/^\/api\/speed(?:\/|$)/.test(url.pathname)) return new Response(null, { status: 404 });
    return handleSpeed(request, env);
  }
  let result = await env.ASSETS.fetch(request);
  if (result.status === 404 && ['GET', 'HEAD'].includes(request.method) && !/\.[\w]+$/.test(url.pathname)) result = await env.ASSETS.fetch(new Request(new URL('/', url), request));
  const headers = new Headers(result.headers);
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Frame-Options', 'DENY');
  return new Response(result.body, { status: result.status, headers });
} };
