// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPortalDb } from './fixtures/portal-db';
import type { PortalDatabase } from '../../functions/_utils/db';

let fixture: ReturnType<typeof createPortalDb>;
beforeEach(() => { vi.resetModules(); fixture = createPortalDb(); });
afterEach(() => { fixture.sqlite.close(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('F1 public API persistent cache', () => {
  it('shares the same season records across subdomains and ignores unrelated query parameters', async () => {
    const fetcher = vi.fn(async () => Response.json({ MRData: { RaceTable: { Races: [{ season: '1987', round: '1' }] } } }));
    vi.stubGlobal('fetch', fetcher);
    const { onRequestGet } = await import('../../functions/api/f1');
    const env = { DB: fixture as unknown as PortalDatabase };
    const first = await onRequestGet({ request: new Request('https://f1.yukino.bond/api/f1?action=season&year=1987'), env });
    expect(first.status).toBe(200);
    const second = await onRequestGet({ request: new Request('https://ip.yukino.bond/api/f1?action=season&year=1987&round=3&kind=qualifying&session=99&drivers=1'), env });
    expect(second.headers.get('X-F1-Cache')).toBe('hit'); expect((await second.json()).races).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect((fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM f1_data_cache').get() as {n: number}).n).toBe(1);
  });
  it('does not apply archive fallback to real-time session requests', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    const { onRequestGet } = await import('../../functions/api/f1');
    const response = await onRequestGet({ request: new Request('https://f1.yukino.bond/api/f1?action=live&year=2026'), env: { DB: fixture as unknown as PortalDatabase } });
    expect(response.status).toBe(503); expect((await response.json()).error).toContain('订阅凭据');
    expect(fixture.sqlite.prepare("SELECT name FROM sqlite_master WHERE name='f1_data_cache'").get()).toBeUndefined();
  });
});
