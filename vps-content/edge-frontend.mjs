import { canonicalPageUrl } from '../speed/src/site-routing.mjs';

export function retiredDev() {
  return new Response('此子域名已关闭。', { status: 410, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export function withSiteShell(response, env) {
  if (!response.headers.get('Content-Type')?.includes('text/html') || !env.SHELL_SCRIPT || !env.SHELL_STYLE) return response;
  const rewritten = new HTMLRewriter()
    .on('head', { element(el) { el.append(`<link rel="stylesheet" href="${env.SHELL_STYLE}" data-yukino-shell><script src="${env.SHELL_SCRIPT}" defer data-yukino-shell></script>`, { html: true }); } })
    .on('script[src*="lab-brand"]', { element(el) { el.remove(); } })
    .on('link[href*="lab-brand"]', { element(el) { el.remove(); } })
    .transform(response);
  const headers = new Headers(rewritten.headers);
  headers.delete('Content-Length'); headers.delete('ETag');
  headers.set('Cache-Control', 'private, no-store');
  return new Response(rewritten.body, { status: rewritten.status, statusText: rewritten.statusText, headers });
}

export default {
  async fetch(request, env) {
    const { hostname, pathname } = new URL(request.url);
    if (hostname === 'dev.yukino.bond') return retiredDev();
    const read = request.method === 'GET' || request.method === 'HEAD';
    if (pathname.startsWith('/yukino-shell/')) return env.ASSETS.fetch(request);
    if (['tools.yukino.bond', 'draw.yukino.bond'].includes(hostname) && /^\/lab-brand[^/]*\.js$/.test(pathname)) {
      return new Response("(()=>{if(document.querySelector('.collection-header')||sessionStorage.getItem('yukino-tools-upgraded'))return;sessionStorage.setItem('yukino-tools-upgraded','1');Promise.resolve(navigator.serviceWorker?.getRegistrations()).then(r=>Promise.all((r||[]).filter(x=>new URL(x.active?.scriptURL||location.href).pathname==='/sw.js').map(x=>x.unregister()))).finally(()=>location.reload());})();", { headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' } });
    }
    if (['tools.yukino.bond', 'draw.yukino.bond'].includes(hostname) && (pathname === '/api' || pathname.startsWith('/api/'))) {
      const url = new URL(request.url); url.hostname = 'www.yukino.bond';
      return fetch(new Request(url, request));
    }
    // Replace the previous upstream Workbox registrations without touching
    // origin-local files, drawings, or any browser storage owned by the user.
    if (['tools.yukino.bond', 'draw.yukino.bond'].includes(hostname) && pathname === '/sw.js') {
      return new Response("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister().then(()=>self.clients.claim())));", { headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' } });
    }
    if (read && ['status.yukino.bond', 'tools.yukino.bond', 'draw.yukino.bond'].includes(hostname)) {
      const target = canonicalPageUrl(request.url);
      // Keep the browser's old-origin speed recovery available.
      if (target && target !== request.url && new URL(target).hostname !== 'speed.yukino.bond') {
        return new Response(null, { status: 308, headers: { Location: target, 'Cache-Control': 'public, max-age=300' } });
      }
    }
    const useOrigin = hostname === 'drop.yukino.bond'
      ? true
      : hostname === 'tools.yukino.bond'
        ? !read || pathname === '/lab' || pathname.startsWith('/lab/')
        : pathname === '/api' || pathname.startsWith('/api/');
    if (useOrigin) {
      // The existing proxied DNS record sends origin requests to the VPS Tunnel.
      const response = await fetch(request);
      return withSiteShell(response, env);
    }
    return env.ASSETS.fetch(request);
  },
};
