// @vitest-environment node
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createPortalDb } from './fixtures/portal-db';
import { onRequest } from '../../functions/api/visits';
let DB: ReturnType<typeof createPortalDb>;
beforeEach(() => { DB = createPortalDb(); });
afterEach(() => DB.sqlite.close());
const get = () => onRequest({request:new Request('https://www.yukino.bond/api/visits'),env:{DB}});
const post = (id: string, origin = 'https://www.yukino.bond') => onRequest({request:new Request('https://www.yukino.bond/api/visits',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({id})}),env:{DB}});
it('starts at zero, persists totals, and never counts reads as visits',async () => {
  const first = await (await get()).json(); expect(first).toMatchObject({visits:0,metric:'pageviews'}); expect(Number.isFinite(Date.parse(first.startedAt))).toBe(true);
  expect(await (await get()).json()).toMatchObject({visits:0,startedAt:first.startedAt});
  const id = crypto.randomUUID(); await post(id);
  expect(await (await get()).json()).toMatchObject({visits:1,startedAt:first.startedAt});
});
it('increments atomically once per event despite concurrent retry and distinct visits',async () => {
  const id = crypto.randomUUID(); const responses = await Promise.all([post(id),post(id),post(id)]); expect(responses.every(response => response.ok)).toBe(true);
  expect(await (await get()).json()).toMatchObject({visits:1});
  await Promise.all([post(crypto.randomUUID()),post(crypto.randomUUID())]);
  expect(await (await get()).json()).toMatchObject({visits:3});
  expect(DB.sqlite.prepare('SELECT COUNT(*) AS count FROM site_visit_events').get()).toMatchObject({count:3});
  const columns = DB.sqlite.prepare('PRAGMA table_info(site_visit_events)').all().map(row => row.name);
  expect(columns).toEqual(['id','created_at']);
});
it('rejects foreign origins, subsite writes and malformed bodies without adding a visit',async () => {
  expect((await post(crypto.randomUUID(),'https://evil.example')).status).toBe(403);
  expect((await onRequest({request:new Request('https://ip.yukino.bond/api/visits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID()})}),env:{DB}})).status).toBe(403);
  expect((await post('not-an-id')).status).toBe(400);
  for (const [body, type, status] of [['{','application/json',400],['x'.repeat(300),'application/json',413],['{}','text/plain',415]] as const) expect((await onRequest({request:new Request('https://www.yukino.bond/api/visits',{method:'POST',headers:{'Content-Type':type},body}),env:{DB}})).status).toBe(status);
  expect(await (await get()).json()).toMatchObject({visits:0});
});
it('reports a missing database explicitly and supports read-only CORS without a payload',async () => {
  expect((await onRequest({request:new Request('https://www.yukino.bond/api/visits'),env:{}})).status).toBe(503);
  const options = await onRequest({request:new Request('https://www.yukino.bond/api/visits',{method:'OPTIONS'}),env:{}});
  expect(options.status).toBe(204); expect(await options.text()).toBe('');
  expect((await get()).headers.get('Cache-Control')).toBe('no-store');
});
