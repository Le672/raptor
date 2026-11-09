type ThemeRequest = Request & { cf?: { timezone?: unknown } };

/** Cloudflare already resolves the connecting IP; no IP logging or database. */
export function onRequest({ request }: { request: ThemeRequest }) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  });
  const origin = request.headers.get('Origin');
  if (origin && /^https:\/\/(?:[a-z0-9-]+\.)?yukino\.bond$/.test(origin)) headers.set('Access-Control-Allow-Origin', origin);
  if (!['GET', 'HEAD'].includes(request.method)) {
    headers.set('Allow', 'GET, HEAD');
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }
  let timeZone: string | null = null;
  if (typeof request.cf?.timezone === 'string' && request.cf.timezone.length <= 100) {
    try { timeZone = new Intl.DateTimeFormat('en', { timeZone: request.cf.timezone }).resolvedOptions().timeZone; } catch { /* Client explicitly falls back to its device time zone. */ }
  }
  return new Response(request.method === 'HEAD' ? null : JSON.stringify({ timeZone, source: timeZone ? 'ip' : 'unavailable', now: Date.now() }), { headers });
}
