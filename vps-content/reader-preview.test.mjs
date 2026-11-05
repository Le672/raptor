import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { buildReaderPreview } from '../shared/reader-preview.mjs';
import { createPreviewGateway, previewFetch, previewReservations } from './reader-preview.mjs';

test('trial uses the canonical first public chapter, returns bounded plain text, and skips VIP', async () => {
  const getBook = async () => ({ data: { title: 'Book', volumes: [{ id: '1', chapters: [] }, { id: '2' }] } });
  const getVolume = async (_env, _ctx, id, vid) => {
    assert.deepEqual([id, vid], ['book', '2']);
    return { data: { chapters: [{ id: '3', restricted: true }, { id: '4' }, { id: '5' }] } };
  };
  const getChapter = async (_env, _ctx, id, cid) => {
    assert.equal(cid, '4');
    return { data: { bookId: id, volumeId: '2', id: cid, title: 'Chapter', blocks: [
      { type: 'image', src: 'image' }, { type: 'text', text: '😀'.repeat(2000) },
    ] } };
  };
  const deps = { getBook, getVolume, getChapter, validPartId: id => /^\d+$/.test(id) };
  const { data } = await buildReaderPreview({}, {}, 'book', deps);
  assert.equal(Array.from(data.paragraphs.join('')).length, 1800);
  assert.equal(data.chapterId, '4');
  await assert.rejects(buildReaderPreview({}, {}, 'book', { ...deps, getVolume: async () => ({ data: { chapters: [{ id: '3', restricted: true }] } }) }), { status: 404 });
});

test('guest refresh, chapter choice and a Worker without the VPS gateway cannot fetch an excerpt', async () => {
  const { createReaderWorker } = await import('../shared/reader-worker.mjs');
  const worker = createReaderWorker({ site: 'ln', origin: 'https://ln.yukino.bond', bookIdValid: id => /^\d+$/.test(id) });
  const base = 'https://ln.yukino.bond/api/preview/';
  const env = { READER_PREVIEW: { serve: () => assert.fail('Gateway called for invalid input') } };
  assert.equal((await worker.fetch(new Request(base + '1?refresh=1'), env, {})).status, 404);
  assert.equal((await worker.fetch(new Request(base + '1/2'), env, {})).status, 404);
  assert.equal((await worker.fetch(new Request(base + '1', { method: 'POST' }), env, {})).status, 405);
  assert.equal((await worker.fetch(new Request(base + '1'), {}, {})).status, 503);
});

test('concurrent same-book fetches coalesce and a recreated gateway shares the SQLite daily ceiling', async () => {
  const db = new DatabaseSync(':memory:');
  let time = 86400000, calls = 0;
  const now = () => time;
  const produce = async () => {
    await previewFetch(async (_, options) => { assert.equal(options.redirect, 'manual'); calls++; }, 'https://source.test', {});
    return { data: { excerpt: true } };
  };
  const request = (host, id) => new Request(`https://${host}.yukino.bond/api/preview/${id}`);
  const serve = createPreviewGateway(previewReservations(db, now, 1), now);
  try {
    const sameBook = await Promise.all([serve(request('ln', '1'), produce), serve(request('ln', '1'), produce)]);
    assert.deepEqual(sameBook.map(result => result.status), [200, 200]);
    assert.equal(calls, 1);
    const second = createPreviewGateway(previewReservations(db, now, 1), now);
    const limited = await second(request('novel', '2'), produce);
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).code, 'PREVIEW_BUDGET');
    assert.equal(calls, 1);
    time += 86400000;
    assert.equal((await second(request('novel', '2'), produce)).status, 200);
    assert.equal(calls, 2);
  } finally { db.close(); }
});
