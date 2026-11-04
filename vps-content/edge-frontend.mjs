import { canonicalPageUrl } from '../speed/src/site-routing.mjs';

const dropAssets = new Set(['/', '/guide', '/guide.html', '/lab-upload.js', '/lab-brand.js', '/lab-brand.css',
  '/static/aes.js', '/static/water.css', '/static/favicon.ico', '/static/logo.png', '/static/jszip.min.js']);

export default {
  async fetch(request, env) {
    const { hostname, pathname } = new URL(request.url);
    const read = request.method === 'GET' || request.method === 'HEAD';
    if (read && hostname === 'status.yukino.bond') {
      const target = canonicalPageUrl(request.url);
      // Keep the browser's old-origin speed recovery available.
      if (target && target !== request.url && new URL(target).hostname !== 'speed.yukino.bond') {
        return new Response(null, { status: 308, headers: { Location: target, 'Cache-Control': 'public, max-age=300' } });
      }
    }
    const useOrigin = hostname === 'drop.yukino.bond'
      ? !read || !dropAssets.has(pathname)
      : hostname === 'tools.yukino.bond'
        ? !read || pathname === '/lab' || pathname.startsWith('/lab/')
        : pathname === '/api' || pathname.startsWith('/api/');
    if (useOrigin) {
      // The existing proxied DNS record sends origin requests to the VPS Tunnel.
      return fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
