const dropAssets = new Set(['/', '/guide', '/guide.html', '/lab-upload.js', '/lab-brand.js', '/lab-brand.css',
  '/static/aes.js', '/static/water.css', '/static/favicon.ico', '/static/logo.png', '/static/jszip.min.js']);

export default {
  async fetch(request, env) {
    const { hostname, pathname } = new URL(request.url);
    const read = request.method === 'GET' || request.method === 'HEAD';
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
