import { canonicalPageUrl } from '../speed/src/site-routing.mjs';
import { onRequestGet } from '../functions/api/status.ts';
async function sample(env) {
  const response = await onRequestGet();
  const report = await response.clone().json();
  const hour = Math.floor(Date.parse(report.checkedAt) / 3600000) * 3600000;
  const key = 'status:hour:' + hour;
  const old = await env.STATUS_STORAGE.get(key, 'json');
  const severity = { reachable: 0, unknown: 1, error: 2 };
  const states = old?.states || {};
  for (const service of report.services) {
    const previous = states[service.url];
    if (!previous || severity[service.state] > severity[previous]) states[service.url] = service.state;
  }
  await env.STATUS_STORAGE.put(key, JSON.stringify({ hour, states }), { expirationTtl: 91 * 86400 });
  return response;
}
export default { async fetch(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/status' && request.method === 'GET') return onRequestGet();
  if (url.pathname === '/api/history' && request.method === 'GET') {
    const end = Math.floor(Date.now() / 3600000) * 3600000;
    const hours = await Promise.all(Array.from({ length: 72 }, (_, i) => env.STATUS_STORAGE.get('status:hour:' + (end - (71 - i) * 3600000), 'json')));
    return Response.json({ end, hours }, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' } });
  }
  if (url.pathname.startsWith('/api/')) return Response.json({ error: '此状态站独立提供检测，不依赖主站账户服务。' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const target = ['GET', 'HEAD'].includes(request.method) && canonicalPageUrl(url.href);
  if (target && target !== url.href && new URL(target).hostname !== 'speed.yukino.bond') {
    return new Response(null, { status: 308, headers: { Location: target, 'Cache-Control': 'public, max-age=300' } });
  }
  let result = await env.ASSETS.fetch(request);
  if (result.status === 404 && ['GET', 'HEAD'].includes(request.method) && !/\.[\w]+$/.test(url.pathname)) result = await env.ASSETS.fetch(new Request(new URL('/', url), request));
  const headers = new Headers(result.headers);
  headers.set('X-Frame-Options', 'DENY'); headers.set('Referrer-Policy', 'no-referrer');
  return new Response(result.body, { status: result.status, headers });
}, async scheduled(_event, env) { await sample(env); } };
