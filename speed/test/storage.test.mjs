import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Reporter, fetchApi, saveRun, readRuns } from '../src/storage.mjs';
function memoryStorage() {
  const storage = {};
  Object.defineProperties(storage, { length: { get: () => Object.keys(storage).length }, key: { value: i => Object.keys(storage)[i] }, getItem: { value: key => storage[key] ?? null }, setItem: { value: (key, value) => { storage[key] = value; } }, removeItem: { value: key => delete storage[key] } });
  return storage;
}
test('checkpoints from the same task replace each other while different tab tasks retain their totals', () => {
  const storage = memoryStorage(); const one = { id: crypto.randomUUID(), startedAt: '2026-10-11T01:00:00Z', bytes: 1000, elapsedMs: 1000, status: 'running' };
  saveRun(one, storage); saveRun({ ...one, bytes: 2000 }, storage); saveRun({ ...one, id: crypto.randomUUID(), bytes: 500 }, storage);
  assert.equal(readRuns(storage).length, 2); assert.equal(readRuns(storage).reduce((sum, run) => sum + run.bytes, 0), 2500);
});
test('report retries keep the same secret, and a newer checkpoint is not erased by an older response', async () => {
  const storage = memoryStorage(); const reporter = new Reporter('/api/speed', () => {}, storage);
  const state = { id: crypto.randomUUID(), bytes: 1000, elapsedMs: 1000, status: 'running' };
  reporter.enqueue(state); const first = JSON.parse(storage.getItem('yukino-speed:report:' + state.id));
  reporter.request = async path => { if (path === '/report') reporter.enqueue({ ...state, bytes: 2000 }); return { accepted: true }; };
  await reporter.flush(); const pending = JSON.parse(storage.getItem('yukino-speed:report:' + state.id));
  assert.equal(pending.bytes, 2000); assert.equal(pending.token, first.token);
  reporter.request = async () => ({ accepted: true }); await reporter.flush(); assert.equal(storage.getItem('yukino-speed:report:' + state.id), null);
  assert.equal(storage.getItem('yukino-speed:identity:' + state.id), first.token);
});

test('acknowledged tasks retain their identity across new checkpoints, completion and app restart', async () => {
  const storage = memoryStorage(); let reporter = new Reporter('/api/speed', () => {}, storage);
  const state = { id: crypto.randomUUID(), bytes: 1000, elapsedMs: 1000, status: 'running' };
  reporter.enqueue(state); const secret = JSON.parse(storage.getItem('yukino-speed:report:' + state.id)).token;
  const send = async (_path, body) => { assert.equal(body.token, secret); return { accepted: true }; };
  reporter.request = send; await reporter.flush();
  reporter = new Reporter('/api/speed', () => {}, storage); reporter.request = send;
  reporter.enqueue({ ...state, bytes: 2000, elapsedMs: 2000, status: 'completed' }); await reporter.flush();
  reporter.enqueue({ ...state, bytes: 2000, elapsedMs: 2000, status: 'completed' }); await reporter.flush();
  assert.equal(storage.getItem('yukino-speed:report:' + state.id), null);
  assert.equal(storage.getItem('yukino-speed:identity:' + state.id), secret);
});

test('legacy conflicts are discarded only when the server already acknowledged the whole checkpoint', async () => {
  const storage = memoryStorage(); const results = []; const reporter = new Reporter('/api/speed', result => results.push(result), storage);
  const state = { id: crypto.randomUUID(), bytes: 1000, elapsedMs: 1000, status: 'completed' };
  reporter.request = async path => { assert.equal(path, '/session'); const error = new Error('Conflict'); error.status = 409; error.data = { acknowledged: { bytes: 1000, durationMs: 1000, finished: true } }; throw error; };
  reporter.enqueue(state); await reporter.flush(); assert.equal(storage.getItem('yukino-speed:report:' + state.id), null); assert.equal(results.at(-1).ok, true);
  reporter.enqueue({ ...state, bytes: 2000 }); await reporter.flush(); assert.ok(storage.getItem('yukino-speed:report:' + state.id)); assert.equal(results.at(-1).ok, false);
});

test('one failed task does not prevent independent queued tasks from being reported', async () => {
  const storage = memoryStorage(); const reporter = new Reporter('/api/speed', () => {}, storage);
  const one = { id: crypto.randomUUID(), bytes: 1000, elapsedMs: 1000, status: 'completed' }, two = { ...one, id: crypto.randomUUID() };
  reporter.enqueue(one); reporter.enqueue(two); let delivered = 0;
  reporter.request = async (path, body) => { if (body.id === one.id) throw new Error('Temporary failure'); if (path === '/report') delivered++; return { accepted: true }; };
  await reporter.flush(); assert.equal(delivered, 1); assert.ok(storage.getItem('yukino-speed:report:' + one.id)); assert.equal(storage.getItem('yukino-speed:report:' + two.id), null);
});

test('network fallback resends the same report body to the shared backup service', async () => {
  const original = globalThis.fetch, calls = [], body = JSON.stringify({ id: crypto.randomUUID(), bytes: 1000 });
  try {
    globalThis.fetch = async (url, options) => { calls.push({ url, body: options.body }); if (url.startsWith('https://primary.example')) throw new TypeError('Connection closed'); return new Response('{"accepted":true}', { status: 200 }); };
    const response = await fetchApi(['https://primary.example', 'https://backup.example'], '/report', { method: 'POST', body });
    assert.equal(response.status, 200); assert.deepEqual(calls, [{ url: 'https://primary.example/report', body }, { url: 'https://backup.example/report', body }]);
  } finally { globalThis.fetch = original; }
});
