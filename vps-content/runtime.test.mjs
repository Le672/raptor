import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { ContentStorage } from './storage.mjs';
import { start, assets, publicAddress } from './runtime.mjs';

test('local snapshots survive reopening, honor JSON binding forms and expire on time', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'yukino-storage-'));
  let store;
  try {
    let now = 1000;
    store = new ContentStorage(dir, { now: () => now });
    await store.put('snapshot', '{"items":[1,2]}', { expirationTtl: 60 });
    store.close(); store = new ContentStorage(dir, { now: () => now });
    assert.deepEqual(await store.get('snapshot', 'json'), { items: [1, 2] });
    assert.deepEqual(await store.get('snapshot', { type: 'json' }), { items: [1, 2] });
    now += 60001;
    assert.equal(await store.get('snapshot'), null);
  } finally { store?.close(); await rm(dir, { recursive: true }); }
});

test('response cache is bounded, survives restart and never saves private or cookie responses', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'yukino-responses-'));
  let store = new ContentStorage(dir, { maxCacheBytes: 10 });
  try {
    const key = new Request('https://novel.yukino.bond/cache');
    for (const headers of [{ 'Cache-Control': 'private, max-age=60' }, { 'Cache-Control': 'no-store, max-age=60' }, { 'Cache-Control': 'public, max-age=60', 'Set-Cookie': 'x=y' }]) {
      await store.cachePut(key, new Response('secret', { headers })); assert.equal(await store.match(key), undefined);
    }
    await store.cachePut(key, new Response('12345678', { headers: { 'Cache-Control': 'public, max-age=60' } }));
    store.close(); store = new ContentStorage(dir, { maxCacheBytes: 10 });
    assert.equal(await (await store.match(key)).text(), '12345678');
    await store.cachePut(new Request('https://novel.yukino.bond/other'), new Response('12345678', { headers: { 'Cache-Control': 'public, max-age=60' } }));
    assert.ok(store.stats().responseBytes <= 10);
  } finally { store.close(); await rm(dir, { recursive: true }); }
});

test('asset resolver rejects encoded traversal, hidden files and unsupported source extensions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'yukino-assets-'));
  try {
    await writeFile(join(dir, 'index.html'), '<html>shell</html>');
    const binding = assets(dir);
    for (const path of ['/%2eenv', '/%2e%2e%2fsecret.html', '/%5csecret.html', '/storage.sqlite', '/worker.mjs']) {
      assert.equal((await binding.fetch(new Request('https://cinema.yukino.bond' + path))).status, 404, path);
    }
    assert.equal((await binding.fetch(new Request('https://cinema.yukino.bond/'))).status, 200);
  } finally { await rm(dir, { recursive: true }); }
});

test('HTTP adapter preserves actual app login gates, origin separation, SPA routes and health proof', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'yukino-server-'));
  let app;
  try {
    for (const name of ['cinema', 'comic', 'novel', 'speed', 'status']) {
      await mkdir(join(dir, name, 'dist'), { recursive: true });
      const source = new URL(name === 'speed' ? './speed-worker.mjs' : name === 'status' ? './status-worker.mjs' : `../${name}/server/worker.mjs`, import.meta.url).href;
      await writeFile(join(dir, name, 'worker.mjs'), name === 'status' ? `export default { fetch: () => new Response('status') };` : `export { default } from ${JSON.stringify(source)};`);
      await writeFile(join(dir, name, 'dist/index.html'), `<html>${name} shell</html>`);
    }
    app = await start({ root: dir, data: join(dir, 'data'), port: 0, schedule: false, network: false });
    const base = `http://127.0.0.1:${app.server.address().port}`;
    for (const name of ['cinema', 'comic', 'novel']) {
      const get = (path, method = 'GET') => new Promise((done, reject) => {
        const req = httpRequest(base + path, { method, headers: { Host: `${name}.yukino.bond` } }, response => {
          const chunks = [];
          response.on('data', chunk => chunks.push(chunk));
          response.on('end', () => done(new Response(Buffer.concat(chunks), { status: response.statusCode, headers: response.headers })));
        });
        req.on('error', reject); req.end();
      });
      const shell = await get('/library');
      assert.equal(shell.status, 200); assert.match(await shell.text(), new RegExp(name + ' shell'));
      assert.equal(shell.headers.get('X-Yukino-Origin'), 'vps-content');
      const access = await get('/api/access'); assert.equal(access.status, 200); assert.equal((await access.json()).user, null);
      assert.equal((await get(name === 'novel' ? '/api/book/8/chapter/1' : '/api/media?token=fake')).status, 401);
      for (const path of ['/.env', '/storage.sqlite', '/worker.mjs', '/.git/config']) assert.equal((await get(path)).status, 404);
      assert.equal((await get('/__health', 'POST')).status, 405);
      assert.equal((await get('/api/access', 'POST')).status, 405);
      assert.equal((await (await get('/__health')).json()).storage, 'local-sqlite');
    }
    assert.equal((await fetch(base, { headers: { Host: 'foreign.example' } })).status, 404);
  } finally { await app?.close(); await rm(dir, { recursive: true }); }
});

test('outbound address policy excludes loopback, LAN, metadata, mapped IPv6 and non-IP names', () => {
  for (const value of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '198.18.0.1', '::1', '::ffff:127.0.0.1', 'localhost']) assert.equal(publicAddress(value), false, value);
  for (const value of ['1.1.1.1', '8.8.8.8', '172.32.0.1']) assert.equal(publicAddress(value), true, value);
});
