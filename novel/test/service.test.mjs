import test from 'node:test';
import assert from 'node:assert/strict';
import { cached, catalog, decodeEntities, imageSource, normalizeBook, parseContent, searchBooks, upstream } from '../server/service.mjs';
import worker from '../server/worker.mjs';

const meta = { checkedAt: new Date().toISOString() };
function store(initial = {}) { const data = new Map(Object.entries(initial)); return { get: async key => data.get(key) || null, put: async (key, value) => data.set(key, JSON.parse(value)), data }; }
const ctx = { waitUntil: () => {} };
const raw = (nid, name, labels = ['连载', '校园']) => ({ nid, name, labels, authors: [{ name: '一位作者', position: 'author' }, { name: '画师', position: 'illustrator' }], updatedAt: '2026-10-18T03:00:00Z', fetchedAt: '2026-10-19T03:00:00Z', done: true });

test('ingestion completion is not a novel completion status', () => {
  assert.equal(normalizeBook(raw(1, '连载书')).status, 'ongoing');
  assert.equal(normalizeBook(raw(2, '完结书', ['完结'])).status, 'completed');
  assert.equal(normalizeBook(raw(3, '未知', [])).status, 'unknown');
  assert.equal(normalizeBook({ ...raw(4, '下架'), isDeleted: true }), null);
  assert.equal(normalizeBook({ ...raw(0, '非法') }), null);
});
test('images cannot be used as an open proxy, redirected credential URL, or SVG endpoint', () => {
  assert.match(imageSource('https://lnovel.animes.garden/bili/img3/cover/1/2.jpg'), /^https:/);
  for (const src of ['https://example.com/1.jpg', 'http://127.0.0.1/1.jpg', 'https://lnovel.animes.garden@evil.test/bili/img3/x.jpg', 'https://lnovel.animes.garden/bili/img3/x.svg', 'https://lnovel.animes.garden/api/bili/novels', 'javascript:alert(1)']) assert.equal(imageSource(src), '');
});
test('chapter HTML becomes text and whitelisted images; executable markup is discarded', () => {
  const blocks = parseContent('<script>alert(1)</script><p>一段 &amp; 二段<br>下一行&#x3002;</p><img src="https://lnovel.animes.garden/bili/img3/1/2.jpg" onerror="alert(1)"><img src="https://evil.test/x.png"><svg><text>ignore</text></svg>');
  assert.deepEqual(blocks.slice(0, 2), [{ type: 'text', text: '一段 & 二段' }, { type: 'text', text: '下一行。' }]);
  assert.equal(blocks[2].type, 'image'); assert.match(blocks[2].src, /^\/api\/image/); assert.equal(blocks.length, 3);
  assert.throws(() => parseContent('<script>nothing</script>'), /未返回/);
  assert.equal(decodeEntities('&#1114112; &#xD800;'), ' ');
});
test('search intersects words, tags and status; pages clamp after filtering', () => {
  const books = Array.from({ length: 50 }, (_, i) => normalizeBook(raw(i + 1, `校园小说 ${i}`)));
  const data = searchBooks(books, new URLSearchParams('q=校园 一位作者&tag=校园&page=999'));
  assert.equal(data.total, 50); assert.equal(data.page, 3); assert.equal(data.items.length, 2);
  assert.equal(searchBooks(books, new URLSearchParams('status=completed')).total, 0);
  assert.equal(searchBooks([normalizeBook(raw(60, '关于邻家的天使的故事'))], new URLSearchParams('q=邻家天使')).total, 1);
});
test('upstream 200 HTML login and failed API envelopes are errors', async () => {
  await assert.rejects(() => upstream('novels', async () => new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } })), /非 JSON/);
  await assert.rejects(() => upstream('novels', async () => Response.json({ ok: false })), /有效数据/);
});
test('source failure preserves last successful data and timestamp with a stale reason', async () => {
  const checkedAt = '2026-01-01T00:00:00Z', env = { NOVEL_CACHE: store({ 'test:stale': { data: ['old'], checkedAt } }) };
  const result = await cached(env, ctx, 'test:stale', async () => { throw new Error('HTTP 403'); }, 1000);
  assert.deepEqual(result.data, ['old']); assert.equal(result.meta.stale, true); assert.equal(result.meta.checkedAt, checkedAt); assert.match(result.meta.reason, /403/);
});
test('refresh requests reuse results for one minute and concurrent fetches coalesce', async () => {
  let calls = 0; const env = { NOVEL_CACHE: store() };
  const producer = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return ['ok']; };
  await Promise.all([cached(env, ctx, 'test:coalesce', producer, 5000), cached(env, ctx, 'test:coalesce', producer, 5000)]);
  await cached(env, ctx, 'test:coalesce', producer, 5000, { force: true });
  assert.equal(calls, 1);
});
test('catalog deduplicates IDs and rejects an empty refresh without erasing a snapshot', async () => {
  const env = { NOVEL_CACHE: store() }; const fetcher = async () => Response.json({ ok: true, data: [raw(1, '同名'), raw(1, '同名'), raw(2, '第二本')] });
  const result = await catalog(env, ctx, { force: true }, fetcher); assert.equal(result.data.length, 2);
  const prior = env.NOVEL_CACHE.data.get('catalog:v1'); prior.checkedAt = '2026-01-01T00:00:00Z';
  const stale = await catalog(env, ctx, { force: true }, async () => Response.json({ ok: true, data: [] }));
  assert.equal(stale.data.length, 2); assert.equal(stale.meta.stale, true); assert.match(stale.meta.reason, /空索引/);
});
test('API refuses invalid IDs and unsupported methods before fetching a source', async () => {
  assert.equal((await worker.fetch(new Request('https://test/api/book/0'), {}, ctx)).status, 404);
  assert.equal((await worker.fetch(new Request('https://test/api/book/1/volume/no'), {}, ctx)).status, 404);
  assert.equal((await worker.fetch(new Request('https://test/api/books', { method: 'POST' }), {}, ctx)).status, 405);
});
test('source status distinguishes persisted cache and source publication time', async () => {
  const books = [normalizeBook(raw(4, '测试书'))], env = { NOVEL_CACHE: store({ 'catalog:v1': { data: books, ...meta } }) };
  const response = await worker.fetch(new Request('https://test/api/status'), env, ctx); const value = await response.json();
  assert.equal(value.data.persisted, true); assert.equal(value.data.newestUpdate, '2026-10-18T03:00:00.000Z'); assert.equal(value.meta.checkedAt, meta.checkedAt);
});
