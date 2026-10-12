// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cachedF1, retrySeconds, validF1Snapshot } from '../../functions/_utils/f1-cache';
import type { PortalDatabase } from '../../functions/_utils/db';
import { createPortalDb } from './fixtures/portal-db';

let fixture: ReturnType<typeof createPortalDb>, db: PortalDatabase;
const key = 'action=season&year=2026&round=last&kind=results&session=latest&drivers=';
const data = (age = 0) => ({ year: 2026, races: [{ round: '1', raceName: 'Australian Grand Prix' }], drivers: [{ points: '100' }], teams: [], errors: [], source: 'Jolpica F1', fetchedAt: new Date(Date.now() - age).toISOString() });
beforeEach(() => { fixture = createPortalDb(); db = fixture as unknown as PortalDatabase; });
afterEach(() => { fixture.sqlite.close(); vi.restoreAllMocks(); });

describe('shared last-good F1 records', () => {
  it('shares one stored snapshot across callers and preserves its actual source timestamp', async () => {
    const value = data(), load = vi.fn(async () => Response.json(value));
    const first = await cachedF1({ key, db, load });
    expect(await first.json()).toEqual(value);
    const second = await cachedF1({ key, db, load });
    expect(second.headers.get('X-F1-Cache')).toBe('hit');
    expect((await second.json()).fetchedAt).toBe(value.fetchedAt);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('survives a cold edge instance using a verified deployment snapshot without an upstream call', async () => {
    const seed = data(), load = vi.fn(async () => new Response('{}', { status: 429 }));
    const response = await cachedF1({ key, db, seed, load });
    expect(response.status).toBe(200); expect(await response.json()).toEqual(seed); expect(load).not.toHaveBeenCalled();
    expect(fixture.sqlite.prepare('SELECT payload FROM f1_data_cache').get()).toBeTruthy();
  });
  it('retains valid records during a 429 and respects Retry-After instead of repeatedly querying the source', async () => {
    const seed = data(3600000), load = vi.fn(async () => Response.json({ error: 'Jolpica 请求频率受限' }, { status: 503, headers: { 'Retry-After': '1800' } }));
    const response = await cachedF1({ key, db, seed, load });
    const value = await response.json();
    expect(response.status).toBe(200); expect(value.stale).toBe(true); expect(value.races).toEqual(seed.races);
    expect(value.fetchedAt).toBe(seed.fetchedAt); expect(value.errors).toContain('Jolpica 请求频率受限');
    const again = await cachedF1({ key, db, seed, load });
    expect((await again.json()).stale).toBe(true); expect(load).toHaveBeenCalledTimes(1);
    const row = fixture.sqlite.prepare('SELECT retry_at, payload FROM f1_data_cache').get() as {retry_at: number; payload: string};
    expect(row.retry_at).toBeGreaterThan(Date.now() + 1700000); expect(JSON.parse(row.payload)).toEqual(seed);
  });
  it('does not overwrite a complete snapshot with empty or partial upstream data', async () => {
    const seed = data(3600000), load = async () => Response.json({ ...data(), races: [], errors: ['赛历连接失败'] });
    const response = await cachedF1({ key, db, seed, load });
    expect((await response.json()).races).toEqual(seed.races);
    const row = fixture.sqlite.prepare('SELECT payload FROM f1_data_cache').get() as {payload: string};
    expect(JSON.parse(row.payload)).toEqual(seed);
  });
  it('updates an expired snapshot in the background and returns fresh data on the next request', async () => {
    const seed = data(3600000), fresh = data(); let work: Promise<unknown> | undefined;
    const response = await cachedF1({ key, db, seed, load: async () => Response.json(fresh), waitUntil: task => { work = task; } });
    expect((await response.json()).stale).toBe(true);
    await work;
    const next = await cachedF1({ key, db, seed, load: async () => { throw new Error('must use cache'); } });
    expect(await next.json()).toEqual(fresh);
  });
  it('coordinates concurrent refreshes with an atomic database lease', async () => {
    let finish!: (value: Response) => void;
    const load = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    const first = cachedF1({ key, db, load });
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    const second = cachedF1({ key, db, load });
    finish(Response.json(data()));
    expect((await first).status).toBe(200); expect((await second).status).toBe(200); expect(load).toHaveBeenCalledTimes(1);
  });
  it('keeps explicit unavailable state when no verified records exist', async () => {
    const load = vi.fn(async () => Response.json({ error: 'Jolpica 请求频率受限' }, { status: 503, headers: { 'Retry-After': '120' } }));
    expect((await cachedF1({ key, db, load })).status).toBe(503);
    const again = await cachedF1({ key, db, load }); expect(again.status).toBe(503);
    expect((await again.json()).error).toContain('频率受限'); expect(load).toHaveBeenCalledTimes(1);
  });
  it('keeps an unpublished empty season distinct from a failed source', async () => {
    const load = async () => Response.json({ ...data(), races: [], drivers: [], teams: [] });
    expect((await cachedF1({ key, db, load })).status).toBe(200);
    expect((await cachedF1({ key, db, load })).status).toBe(200);
  });
  it('preserves a verified fallback when the cache database cannot be reached', async () => {
    const broken = { prepare: () => { throw new Error('DB offline'); } } as unknown as PortalDatabase;
    const seed = data(3600000);
    const response = await cachedF1({ key, db: broken, seed, load: async () => new Response('{}', { status: 503 }) });
    expect(response.status).toBe(200); expect((await response.json()).fetchedAt).toBe(seed.fetchedAt);
  });
  it('rejects invalid snapshots and parses bounded retry delays', () => {
    expect(validF1Snapshot({ ...data(), unavailable: true })).toBe(false);
    expect(validF1Snapshot({ ...data(), stale: true })).toBe(false);
    expect(validF1Snapshot({ ...data(), fetchedAt: 'bad date' })).toBe(false);
    expect(validF1Snapshot({ ...data(), fetchedAt: new Date(Date.now() + 3600000).toISOString() })).toBe(false);
    expect(retrySeconds('3600')).toBe(3600); expect(retrySeconds('bad')).toBe(60);
    expect(retrySeconds('9999999')).toBe(86400);
    expect(retrySeconds(new Date(Date.now() + 120000).toUTCString())).toBeGreaterThanOrEqual(119);
  });
});
