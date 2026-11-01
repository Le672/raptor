import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { APPS, appForHost } from '../pwa/sites.mjs';
import { preparePwa } from '../../scripts/prepare-pwa.mjs';
import { createContentSignIn } from '../content-signin.mjs';
test('all 28 website origins have a distinct app name and valid opaque platform icons', async () => {
  assert.equal(APPS.length, 28); assert.equal(new Set(APPS.map(app => app.host)).size, 28);
  assert.equal(appForHost('status.yukino.bond').auth, 'none'); assert.equal(appForHost('yukino.bond').id, 'www');
  assert.equal(appForHost('api.yukino.bond'), undefined);
  for (const app of APPS) for (const size of [180, 192, 512]) {
    const png = await readFile(new URL(`../pwa/icons/${app.id}-${size}.png`, import.meta.url));
    assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  }
});
test('app packaging preserves its source, versions updates, caches landing dependencies and supports strict style CSP', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'yukino-pwa-'));
  try {
    await mkdir(join(directory, 'assets'));
    await writeFile(join(directory, 'index.html'), '<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><script type="module" src="/assets/web-1.js"></script><link rel="stylesheet" href="/assets/style-1.css"></head><body><div id="root"></div></body></html>');
    for (const [name, source] of [['web-1.js', 'import{value}from"./common-1.js";import("./private-1.js")'], ['common-1.js', 'export const value=1'], ['Focus-1.js', 'import{value}from"./common-1.js";export default value;'], ['private-1.js', 'private data'], ['style-1.css', 'body{color:black}']]) await writeFile(join(directory, 'assets', name), source);
    const result = await preparePwa(directory, 'portal'), again = await preparePwa(directory, 'portal');
    assert.equal(result.version, again.version);
    const html = await readFile(join(directory, 'index.html'), 'utf8'); assert.equal((html.match(/data-yukino-app/g) || []).length, 1);
    const app = result.sites['focus.yukino.bond']; assert.ok(app.assets.includes('/assets/Focus-1.js')); assert.ok(app.assets.includes('/assets/common-1.js')); assert.ok(!app.assets.includes('/assets/private-1.js'));
    const client = await readFile(join(directory, result.client), 'utf8'); assert.ok(!client.includes('<style>')); assert.match(client, /control-[a-f0-9]+\.css/);
    const manifest = JSON.parse(await readFile(join(directory, app.manifest), 'utf8')); assert.equal(manifest.name, 'Yukino 专注'); assert.equal(manifest.scope, '/'); assert.equal(manifest.display, 'standalone');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('shared worker never intercepts login, media, private lab HTML, files or non-GET traffic', async () => {
  const script = (await readFile(new URL('../pwa/sw-template.js', import.meta.url), 'utf8')).replace('__YUKINO_APP_WORKER__', JSON.stringify({ prefix: 'only-app-', cache: 'only-app-1', files: [], shell: '/shell.html', privateLab: true }));
  const handlers = {};
  runInNewContext(script, { self: { addEventListener: (key, fn) => { handlers[key] = fn; }, location: { origin: 'https://tools.yukino.bond' } }, URL });
  for (const [path, method] of [['/api/access', 'GET'], ['/api/auth/login', 'POST'], ['/lab/private/', 'GET'], ['/pasta/private', 'GET'], ['/file/private', 'GET'], ['/upload', 'POST'], ['https://other.example/', 'GET']]) {
    let intercepted = false; handlers.fetch({ request: { url: new URL(path, 'https://tools.yukino.bond').href, method, mode: 'navigate' }, respondWith: () => { intercepted = true; } }); assert.equal(intercepted, false, path);
  }
});
test('each protected content site issues and clears a domain-scoped persistent cookie, returning no bearer token', async () => {
  const now = Date.now(), token = `a.${Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + 604800 })).toString('base64url')}.b`;
  for (const site of ['novel', 'cinema', 'comic']) {
    const origin = `https://${site}.yukino.bond`, authenticate = createContentSignIn(site, { now: () => now, fetcher: async () => Response.json({ token, user: { id: 1, name: 'test reader', role: 'user' } }) });
    const request = path => new Request(origin + '/api/auth/' + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' }, body: JSON.stringify({ email: 'test@example.invalid', password: 'test-only', source: 'local' }) });
    const login = await authenticate(request('login')); assert.equal(login.status, 200); assert.match(login.headers.get('Set-Cookie'), /Domain=yukino\.bond; Path=\/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax/); assert.equal((await login.json()).token, undefined);
    const logout = await authenticate(request('logout')); assert.match(logout.headers.get('Set-Cookie'), /Domain=yukino\.bond; Path=\/; Max-Age=0/);
  }
});
