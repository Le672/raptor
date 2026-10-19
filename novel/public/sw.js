const VERSION = 'yukino-novel-shell-v1';
self.addEventListener('install', event => { event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(self.__NOVEL_PRECACHE || ['/', '/book.svg']))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('yukino-novel-shell-') && key !== VERSION).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') event.respondWith(fetch(request).then(response => { if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(VERSION).then(cache => cache.put('/', copy))); } return response; }).catch(() => caches.match('/')));
  else if (url.pathname.startsWith('/assets/') || url.pathname === '/book.svg') event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => { if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(VERSION).then(cache => cache.put(request, copy))); } return response; })));
});
