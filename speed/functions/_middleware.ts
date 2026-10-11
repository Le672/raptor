import { canonicalPageUrl } from '../src/site-routing.mjs';
export function onRequest({ request, next }) {
  const target = ['GET', 'HEAD'].includes(request.method) && canonicalPageUrl(request.url);
  return target && target !== request.url ? new Response(null, { status: 308, headers: { Location: target, 'Cache-Control': 'public, max-age=300' } }) : next();
}
