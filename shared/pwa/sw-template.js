const CONFIG = __YUKINO_APP_WORKER__;
const CACHE = CONFIG.cache;
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CONFIG.files)).then(() => { if (!self.registration.active) return self.skipWaiting(); })); });
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CONFIG.prefix) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  // Identity, media, shared files, private laboratory HTML and all mutations
  // stay on the network. Never copy credentials or private API data to caches.
  if (request.method !== 'GET' || url.origin !== self.location.origin || /^\/(?:api|upload|pasta|file|raw|auth|admin)(?:\/|$)/.test(url.pathname) || (CONFIG.privateLab && /^\/lab(?:\/|$)/.test(url.pathname))) return;
  if (request.mode === 'navigate') {
    if (CONFIG.onlineOnly && url.pathname !== '/') return;
    event.respondWith((async () => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 6000);
      try { return await fetch(request, { signal: controller.signal }); }
      catch { return await caches.match(CONFIG.shell) || new Response('当前离线，请联网后重新打开应用。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
      finally { clearTimeout(timer); }
    })()); return;
  }
  const asset = CONFIG.files.includes(url.pathname) || (/^\/(?:assets|yukino-app-assets)\//.test(url.pathname) && /\.(?:js|mjs|css|woff2?|png|svg|webp)$/.test(url.pathname));
  if (asset) event.respondWith(caches.open(CACHE).then(async cache => await cache.match(request) || fetch(request).then(response => {
    if (response.ok && !response.headers.has('Set-Cookie') && !/private|no-store/.test(response.headers.get('Cache-Control') || '')) event.waitUntil(cache.put(request, response.clone()));
    return response;
  })));
});
