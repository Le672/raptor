import assert from 'node:assert/strict';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) setGlobalDispatcher(new ProxyAgent(proxy));
const origin = process.env.NOVEL_ORIGIN || 'https://novel.yukino.bond';
const get = async path => { const response = await fetch(origin + path, { signal: AbortSignal.timeout(25000), redirect: 'manual', cache: 'no-store' }); assert.equal(response.status, 200, path); assert.equal(response.headers.get('X-Yukino-Origin'), 'vps-content'); return response; };
const html = await (await get('/install')).text();
assert.match(html, /apple-touch-icon/); assert.match(html, /viewport-fit=cover/);
assert.match(await (await get('/login?returnTo=%2Fshelf')).text(), /Yukino Novel/);
const manifest = await (await get('/manifest.webmanifest')).json();
assert.equal(manifest.display, 'standalone'); assert.equal(manifest.id, '/'); assert.equal(manifest.scope, '/');
for (const [size, purpose] of [[192, 'any'], [512, 'any'], [512, 'maskable']]) {
  const icon = manifest.icons.find(item => item.sizes === `${size}x${size}` && item.purpose === purpose); assert.ok(icon);
  const response = await get(icon.src); assert.match(response.headers.get('Content-Type'), /image\/png/);
  const png = Buffer.from(await response.arrayBuffer()); assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
}
const apple = Buffer.from(await (await get('/icons/apple-touch-icon.png')).arrayBuffer()); assert.equal(apple.readUInt32BE(16), 180);
const version = html.match(/name="novel-app-version" content="([a-f0-9]+)"/)?.[1]; assert.ok(version, 'Versioned update script is required');
const swResponse = await get(`/sw.js?v=${version}`), sw = await swResponse.text();
assert.match(swResponse.headers.get('Cache-Control'), /no-cache/); assert.match(sw, /SKIP_WAITING/);
const assets = Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g), match => match[1]);
for (const path of assets) { assert.ok(sw.includes(path)); await get(path); }
assert.equal((await (await get('/api/access')).json()).user, null);
const post = async (path, body, caller = origin) => fetch(origin + path, { method: 'POST', headers: { Origin: caller, 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(25000) });
assert.equal((await post('/api/auth/login', {}, 'https://example.invalid')).status, 403);
assert.equal((await post('/api/auth/login', {})).status, 400);
const denied = await post('/api/auth/login', { email: 'pwa-verification@example.invalid', password: 'nonexistent-test-credential', source: 'local', remember: true });
assert.equal(denied.status, 401, 'Real portal must reject nonexistent credentials rather than fail to connect'); assert.equal(denied.headers.get('Set-Cookie'), null);
const logout = await post('/api/auth/logout', {}); assert.equal(logout.status, 200); assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0; HttpOnly; Secure; SameSite=Lax/);
const gate = await fetch(origin + '/api/book/8/chapter/11', { signal: AbortSignal.timeout(25000) }); assert.equal(gate.status, 401); assert.equal((await gate.json()).code, 'LOGIN_REQUIRED');
console.log(JSON.stringify({ origin, pwa: 'ready', icons: 4, assets: assets.length, login: 'same-origin portal connected', credentials: 'invalid account correctly rejected', session: 'HttpOnly cookie logout verified', protectedChapters: true }));
