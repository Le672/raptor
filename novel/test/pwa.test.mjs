import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import worker from '../server/worker.mjs';
test('the update script forbids both browser and CDN caching at the real worker boundary', async () => {
  const response = await worker.fetch(new Request('https://ln.yukino.bond/sw.js'), { ASSETS: { fetch: async () => new Response('worker', { headers: { 'Content-Type': 'application/javascript' } }) } }, {});
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  assert.equal(response.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
  assert.equal(response.headers.get('CDN-Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Service-Worker-Allowed'), '/');
});
test('install manifest supplies a stable app identity, scoped shortcuts and genuine PNGs for each platform', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url)));
  assert.equal(manifest.id, '/'); assert.equal(manifest.scope, '/'); assert.equal(manifest.display, 'standalone');
  for (const [size, purpose] of [[192, 'any'], [512, 'any'], [512, 'maskable']]) {
    const icon = manifest.icons.find(item => item.sizes === `${size}x${size}` && item.purpose === purpose);
    assert.ok(icon); const png = readFileSync(new URL(`../public${icon.src}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG'); assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  }
  const apple = readFileSync(new URL('../public/icons/apple-touch-icon.png', import.meta.url)); assert.equal(apple.readUInt32BE(16), 180);
  for (const shortcut of manifest.shortcuts) assert.ok(shortcut.url.startsWith('/') && !shortcut.url.startsWith('//'));
});
test('service worker leaves all identity, chapter, non-GET and foreign-origin traffic on the network', () => {
  const listeners = {};
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self: { location: { origin: 'https://ln.yukino.bond' }, addEventListener: (name, fn) => { listeners[name] = fn; } }, URL });
  for (const [path, method] of [['/api/access', 'GET'], ['/api/auth/login', 'POST'], ['/api/auth/logout', 'POST'], ['/api/book/8/chapter/11', 'GET'], ['/api/books', 'GET'], ['https://www.yukino.bond/login', 'GET']]) {
    let intercepted = false; listeners.fetch({ request: { url: new URL(path, 'https://ln.yukino.bond').href, method }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, path);
  }
});
test('offline deep links open the app shell, while updates wait for an explicit request', async () => {
  const listeners = {}; let skipped = 0, response;
  const shell = new Response('<html>offline shell</html>', { headers: { 'Content-Type': 'text/html' } });
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self: { location: { origin: 'https://ln.yukino.bond' }, registration: { active: {} }, addEventListener: (name, fn) => { listeners[name] = fn; }, skipWaiting: () => { skipped++; } },
    caches: { open: async () => ({ addAll: async () => {}, match: async key => key === '/' ? shell : undefined }) }, fetch: async () => { throw new Error('offline'); }, URL, Response, AbortController, setTimeout, clearTimeout,
  });
  let install; listeners.install({ waitUntil: task => { install = task; } }); await install; assert.equal(skipped, 0);
  listeners.fetch({ request: { method: 'GET', url: 'https://ln.yukino.bond/shelf', mode: 'navigate' }, respondWith: value => { response = value; } });
  assert.match(await (await response).text(), /offline shell/);
  listeners.message({ data: { type: 'SKIP_WAITING' } }); assert.equal(skipped, 1);
});
