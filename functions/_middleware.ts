import { canonicalPageUrl } from '../speed/src/site-routing.mjs';
export function onRequest({ request, next }: { request: Request; next: () => Promise<Response> }) {
  if (!['GET', 'HEAD'].includes(request.method)) return next();
  const url = new URL(request.url), target = canonicalPageUrl(url.href);
  // Legacy speed pages must read their old origin's pending reports before leaving it.
  if (target && target !== url.href && !(new URL(target).hostname === 'speed.yukino.bond' && url.hostname !== 'speed.yukino.bond')) {
    return new Response(null, { status: 308, headers: { Location: target, 'Cache-Control': 'public, max-age=300' } });
  }
  return next();
}
