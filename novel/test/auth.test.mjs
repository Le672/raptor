import test from 'node:test';
import assert from 'node:assert/strict';
import { createNovelAuth } from '../server/auth.mjs';
import { createAccessGuard } from '../../shared/content-access.mjs';
const origin = 'https://ln.yukino.bond';
const timestamp = Date.now();
const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ exp: Math.floor(timestamp / 1000) + 7 * 86400, userId: 12 })).toString('base64url')}.signature`;
const user = { id: 12, name: 'Test reader', role: 'user' };
const login = (body = {}, headers = {}, path = 'login') => new Request(`${origin}/api/auth/${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ email: 'reader@example.test', password: 'test-only', source: 'local', ...body }) });
test('same-origin login issues a persistent HttpOnly session, without exposing tokens or saving passwords', async () => {
  const auth = createNovelAuth({ now: () => timestamp, fetcher: async (url, options) => {
    assert.equal(url, 'https://www.yukino.bond/api/auth/login?action=login');
    assert.equal(options.redirect, 'manual'); assert.equal(options.headers.Origin, 'https://www.yukino.bond');
    assert.equal(options.headers.Cookie, undefined); assert.equal(JSON.parse(options.body).source, 'local');
    return Response.json({ token, user: { ...user, email: 'reader@example.test' } });
  } });
  const result = await auth(login()), cookie = result.headers.get('Set-Cookie');
  assert.equal(result.status, 200); assert.match(cookie, /Domain=yukino\.bond; Path=\/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax/);
  assert.deepEqual((await result.json()).user, user); assert.match(result.headers.get('Cache-Control'), /no-store/);
  // A new process/guard sees only a persisted cookie, and must validate it again.
  const reopened = createAccessGuard('novel', { now: () => timestamp, fetcher: async (url, options) => {
    assert.equal(url, 'https://www.yukino.bond/api/auth/access'); assert.equal(options.headers.Authorization, `Bearer ${token}`); return Response.json({ user });
  } });
  assert.deepEqual((await (await reopened.status(new Request(origin + '/api/access', { headers: { Cookie: cookie.split(';')[0] } }))).json()).user, user);
  const short = await auth(login({ remember: false })); assert.doesNotMatch(short.headers.get('Set-Cookie'), /Max-Age/);
});
test('logout clears the persisted session and does not call an upstream or delete reading data', async () => {
  const auth = createNovelAuth({ fetcher: async () => { throw new Error('must not call upstream'); } });
  const response = await auth(login({}, {}, 'logout'));
  assert.equal(response.status, 200); assert.match(response.headers.get('Set-Cookie'), /Max-Age=0; HttpOnly; Secure; SameSite=Lax/);
  assert.equal((await response.json()).user, null);
});
test('foreign origins, missing origins and invalid bodies never forward credentials', async () => {
  let calls = 0; const auth = createNovelAuth({ fetcher: async () => { calls++; return Response.json({}); } });
  for (const headers of [{ Origin: 'https://evil.test' }, { 'Sec-Fetch-Site': 'cross-site' }]) assert.equal((await auth(login({}, headers))).status, 403);
  const absent = login(); absent.headers.delete('Origin'); assert.equal((await auth(absent)).status, 403);
  assert.equal((await auth(login({ source: 'other' }))).status, 400);
  assert.equal((await auth(login({ email: 'x'.repeat(5000) }))).status, 400); assert.equal(calls, 0);
});
test('invalid credentials, redirects, malformed or expired sessions never issue a cookie', async () => {
  for (const upstream of [Response.json({ error: '邮箱或密码错误' }, { status: 401 }), new Response(null, { status: 302, headers: { Location: 'https://evil.test' } }), Response.json({ token: 'broken', user }), Response.json({ token: `a.${Buffer.from('{"exp":1}').toString('base64url')}.b`, user })]) {
    const auth = createNovelAuth({ fetcher: async () => upstream }); const result = await auth(login());
    assert.ok([401, 503].includes(result.status)); assert.equal(result.headers.get('Set-Cookie'), null);
  }
});
test('login retry bursts are bounded and recover after ten minutes', async () => {
  let time = timestamp, calls = 0;
  const auth = createNovelAuth({ now: () => time, fetcher: async () => { calls++; return Response.json({ error: 'invalid' }, { status: 401 }); } });
  for (let i = 0; i < 10; i++) assert.equal((await auth(login())).status, 401);
  assert.equal((await auth(login())).status, 429); assert.equal(calls, 10);
  time += 600001; assert.equal((await auth(login())).status, 401); assert.equal(calls, 11);
});
