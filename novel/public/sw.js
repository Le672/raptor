const VERSION = 'yukino-novel-shell-v1';
self.addEventListener('install', event => { event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(self.__NOVEL_PRECACHE || ['/', '/book.svg'])).then(() => { if (!self.registration.active) return self.skipWaiting(); })); });
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(Promise.all([
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('yukino-novel-shell-') && key !== VERSION).map(key => caches.delete(key)))),
  caches.open('yukino-novel-data-v1').then(async cache => {
    const keys = await cache.keys();
    await Promise.all(keys.map(async key => {
      const url = new URL(key.url);
      if (/^\/api\/book\/[^/]+\/chapter\//.test(url.pathname) || /^\/api\/book\/sf-/.test(url.pathname) || url.searchParams.get('source') === 'sf') return cache.delete(key);
      if (['/api/books', '/api/status'].includes(url.pathname) && cache.match) {
        const response = await cache.match(key), value = await response?.json().catch(() => null);
        if (value?.data?.sources?.some(source => source.id === 'sf') || value?.data?.items?.some(book => /^sf-/.test(book.id))) await cache.delete(key);
      }
    }));
  }),
]).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (url.pathname.startsWith('/migration')) return;
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') event.respondWith((async () => {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(request, { signal: controller.signal });
      if (response.ok && response.headers.get('Content-Type')?.includes('text/html')) { const copy = response.clone(); event.waitUntil(caches.open(VERSION).then(cache => cache.put('/', copy))); }
      return response;
    } catch { return await (await caches.open(VERSION)).match('/') || new Response('书房暂时无法连接，请联网后重试。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
    finally { clearTimeout(timeout); }
  })());
  else if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || ['/book.svg', '/manifest.webmanifest'].includes(url.pathname)) event.respondWith(caches.open(VERSION).then(async cache => await cache.match(request) || fetch(request).then(response => { if (response.ok) { const copy = response.clone(); event.waitUntil(cache.put(request, copy)); } return response; })));
});
