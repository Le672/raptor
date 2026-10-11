import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleSpeed } from '../cloudflare/api.mjs';
const id = crypto.randomUUID(), token = crypto.randomUUID() + crypto.randomUUID();
function database() {
  const sqlite = new DatabaseSync(':memory:'); sqlite.exec(readFileSync(new URL('../cloudflare/schema.sql', import.meta.url), 'utf8'));
  return { sqlite, prepare: sql => ({ run: async () => sqlite.prepare(sql).run(), bind: (...values) => ({ run: async () => sqlite.prepare(sql).run(...values), first: async () => sqlite.prepare(sql).get(...values) }), first: async () => sqlite.prepare(sql).get() }) };
}
function request(route, body, origin = 'https://speed.yukino.bond') { return new Request('https://speed.yukino.bond/api/speed/' + route, body ? { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) } : {}); }
test('durable global totals are idempotent, monotonic and protected by a per-task secret', async () => {
  const DB = database();
  try {
    assert.equal((await handleSpeed(request('session', { id, token }), { DB })).status, 200);
    assert.equal((await handleSpeed(request('session', { id, token }), { DB })).status, 200);
    for (const bytes of [1000, 1000, 500, 2000]) assert.equal((await handleSpeed(request('report', { id, token, bytes, durationMs: 1000 }), { DB })).status, 200);
    let total = await (await handleSpeed(request('totals'), { DB })).json(); assert.equal(total.bytes, 2000); assert.equal(total.sessions, 1);
    const wrong = crypto.randomUUID() + crypto.randomUUID();
    assert.equal((await handleSpeed(request('session', { id, token: wrong }), { DB })).status, 409);
    assert.equal((await handleSpeed(request('report', { id, token: wrong, bytes: 3000, durationMs: 1000 }), { DB })).status, 403);
    assert.equal((await handleSpeed(request('report', { id, token, bytes: -1, durationMs: 1000 }), { DB })).status, 400);
    assert.equal((await handleSpeed(request('report', { id, token, bytes: 1e14 + 1, durationMs: 1000 }), { DB })).status, 400);
    assert.equal((await handleSpeed(request('report', { id, token, bytes: 3000, durationMs: 1000 }, 'https://evil.example'), { DB })).status, 403);
    total = await (await handleSpeed(request('totals'), { DB })).json(); assert.equal(total.bytes, 2000);
  } finally { DB.sqlite.close(); }
});
test('a missing database and malformed reports have explicit error responses', async () => {
  assert.equal((await handleSpeed(request('totals'), {})).status, 503);
  const DB = database(); try {
    assert.equal((await handleSpeed(new Request('https://speed.yukino.bond/api/speed/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'invalid' }), { DB })).status, 400);
    assert.equal((await handleSpeed(new Request('https://speed.yukino.bond/api/speed/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(3000) }), { DB })).status, 413);
    assert.equal((await handleSpeed(new Request('https://speed.yukino.bond/api/speed/report', { method: 'OPTIONS', headers: { Origin: 'null' } }), { DB })).status, 204);
  } finally { DB.sqlite.close(); }
});
