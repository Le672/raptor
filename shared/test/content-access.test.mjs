import assert from 'node:assert/strict';
import test from 'node:test';
import { ACCESS_LIMITS, contentLoginUrl, createAccessGuard, privateMedia } from '../content-access.mjs';
import cinema from '../../cinema/server/worker.mjs';
import comic from '../../comic/server/worker.mjs';
import novel from '../../novel/server/worker.mjs';

const now = 1792497600000;
const token = (id = 'one', expiry = now + 3600000) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ exp: Math.floor(expiry / 1000), id })).toString('base64url')}.signature`;
const req = (jwt = token(), path = '/api/media?token=signed') => new Request(`https://cinema.yukino.bond${path}`, { headers: { Cookie: `__Secure-yukino_session=${jwt}` } });
const user = { id: 42, name: 'Reader', role: 'user' };
const success = () => Response.json({ user });

test('guest, malformed and expired sessions never contact identity service', async () => {
  const guard = createAccessGuard('cinema', { now: () => now, fetcher: () => { throw new Error('must not fetch'); } });
  for (const request of [new Request('https://cinema.yukino.bond/api/media'), req('garbage'), req(token('expired', now - 1000))]) {
    const response = await guard.require(request, { media: true });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'LOGIN_REQUIRED');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('well-shaped forged token still requires the real portal to validate it', async () => {
  let calls = 0;
  const guard = createAccessGuard('comic', { now: () => now, fetcher: async (url, init) => {
    calls++; assert.equal(url, 'https://www.yukino.bond/api/auth/access');
    assert.equal(init.headers.Authorization, `Bearer ${token()}`);
    assert.equal(init.redirect, 'manual');
    return Response.json({ error: 'invalid signature' }, { status: 401 });
  } });
  assert.equal((await guard.require(req())).status, 401);
  assert.equal((await guard.require(req())).status, 401);
  assert.equal(calls, 1);
});

test('identity redirects fail closed without following or forwarding the session to another origin', async () => {
  const calls = [];
  const guard = createAccessGuard('novel', { now: () => now, fetcher: async (url, init) => {
    calls.push({ url, init });
    assert.equal(url, 'https://www.yukino.bond/api/auth/access');
    assert.equal(init.redirect, 'manual');
    assert.equal(init.headers.Authorization, `Bearer ${token()}`);
    return new Response(null, { status: 302, headers: { Location: 'https://foreign.example/collect' } });
  } });
  const response = await guard.require(req());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'AUTH_UNAVAILABLE');
  assert.equal(response.headers.has('Location'), false);
  assert.equal(calls.length, 1);
});

test('positive checks deduplicate, cache for five minutes, and honor JWT expiry', async () => {
  let time = now, calls = 0;
  const guard = createAccessGuard('cinema', { now: () => time, fetcher: async () => { calls++; return success(); } });
  assert.deepEqual(await Promise.all(Array.from({ length: 20 }, () => guard.require(req(), { media: true }))), Array(20).fill(null));
  assert.equal(calls, 1);
  time += 300001;
  assert.equal(await guard.require(req(), { media: true }), null);
  assert.equal(calls, 2);
  time = now + 3600001;
  assert.equal((await guard.require(req(), { media: true })).status, 401);
});

test('identity outage fails closed without clearing a still-valid session or caching errors', async () => {
  let calls = 0;
  const guard = createAccessGuard('novel', { now: () => now, fetcher: () => { if (++calls === 1) throw new Error('offline'); return Promise.resolve(success()); } });
  assert.equal((await guard.require(req())).status, 503);
  assert.equal(await guard.require(req()), null);
  assert.equal(calls, 2);
});

test('generous action burst uses account identity; media segments never count; minute resets', async () => {
  let time = now;
  const guard = createAccessGuard('cinema', { now: () => time, fetcher: async () => success() });
  for (let i = 0; i < ACCESS_LIMITS.actionsPerMinute; i++) assert.equal(await guard.require(req()), null);
  // A second token for the same account does not bypass the burst counter.
  const limited = await guard.require(req(token('second')));
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '60');
  for (let i = 0; i < 300; i++) assert.equal(await guard.require(req(), { media: true }), null);
  time += 60001;
  assert.equal(await guard.require(req()), null);
  assert.equal(ACCESS_LIMITS.dailyLimit, null);
});

test('refresh bursts are independent from reading and do not impose a daily cap', async () => {
  const guard = createAccessGuard('novel', { now: () => now, fetcher: async () => success() });
  for (let i = 0; i < ACCESS_LIMITS.refreshesPerMinute; i++) assert.equal(await guard.require(req(), { refresh: true }), null);
  assert.equal((await guard.require(req(), { refresh: true })).status, 429);
  assert.equal(await guard.require(req()), null);
});

test('foreign-site ambient cookies cannot authorize resource requests', async () => {
  const guard = createAccessGuard('cinema', { now: () => now, fetcher: async () => success() });
  const request = req(); request.headers.set('Origin', 'https://foreign.example');
  assert.equal((await guard.require(request, { media: true })).status, 403);
});

test('session status exposes minimal identity and media responses cannot be reused after logout', async () => {
  const guard = createAccessGuard('cinema', { now: () => now, fetcher: async () => success() });
  assert.deepEqual((await (await guard.status(req())).json()).user, user);
  const response = privateMedia(new Response('segment', { status: 206, headers: { 'Content-Range': 'bytes 0-6/7', 'Cache-Control': 'public,max-age=3600' } }));
  assert.equal(response.status, 206); assert.equal(response.headers.get('content-range'), 'bytes 0-6/7');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(await response.text(), 'segment');
});

test('login links stay on the allowlisted canonical site and contain no session token', () => {
  const link = new URL(contentLoginUrl('cinema', '/watch/bf-1/0/0?resume=1'));
  assert.equal(link.origin, 'https://www.yukino.bond');
  assert.equal(link.searchParams.get('returnTo'), 'https://cinema.yukino.bond/watch/bf-1/0/0?resume=1');
  assert.equal(new URL(contentLoginUrl('novel', '/\\evil.example')).searchParams.get('returnTo'), 'https://novel.yukino.bond/');
});

test('all content Workers enforce gates before source/cache/network work while keeping source lists public', async () => {
  const endpoints = [
    [cinema, 'cinema', ['/api/title/bf-1/play?line=0&episode=0', '/api/media?token=old-signed-url', '/api/catalog?refresh=1']],
    [comic, 'comic', ['/api/anime/bf-1/play?line=0&episode=0', '/api/media?token=old-signed-url', '/api/catalog?refresh=1']],
    [novel, 'novel', ['/api/book/sf-1/chapter/1', '/api/books?refresh=1', '/api/status?refresh=1']],
  ];
  for (const [worker, site, paths] of endpoints) {
    for (const path of paths) {
      const response = await worker.fetch(new Request(`https://${site}.yukino.bond${path}`), {}, {});
      assert.equal(response.status, 401, `${site} ${path}`);
    }
    const status = await worker.fetch(new Request(`https://${site}.yukino.bond/api/access`), {}, {});
    assert.equal(status.status, 200); assert.equal((await status.json()).user, null);
    if (site !== 'novel') assert.equal((await worker.fetch(new Request(`https://${site}.yukino.bond/api/sources`), {}, {})).status, 200);
  }
});
