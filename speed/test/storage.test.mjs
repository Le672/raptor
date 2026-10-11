import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Reporter, saveRun, readRuns } from '../src/storage.mjs';
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
  reporter.request = async () => ({ accepted: true }); await reporter.flush(); assert.equal(Object.keys(storage).length, 0);
});
