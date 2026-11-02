// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkService } from '../../functions/api/status';
import statusWorker from '../../vps-content/status-worker.mjs';

afterEach(() => vi.unstubAllGlobals());
describe('status checks stay meaningful during quota failures', () => {
  it('serves the status deep link to GET and HEAD without turning API failures into pages', async () => {
    const env = { ASSETS: { fetch: vi.fn(async (request: Request) => new URL(request.url).pathname === '/'
      ? new Response(request.method === 'HEAD' ? null : '<html>status</html>', { headers: { 'Content-Type': 'text/html' } })
      : new Response(null, { status: 404 })) } };
    for (const method of ['GET', 'HEAD']) expect((await statusWorker.fetch(new Request('https://status.yukino.bond/status', { method }), env)).status).toBe(200);
    expect((await statusWorker.fetch(new Request('https://status.yukino.bond/api/auth/me'), env)).status).toBe(503);
  });
  it('does not report an HTML fallback with HTTP 200 as a healthy API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>quota fallback</html>', { headers: { 'Content-Type': 'text/html' } })));
    const result = await checkService({ name: 'API', url: 'https://www.yukino.bond/api/posts', jsonKeys: ['posts'] });
    expect(result.state).toBe('error'); expect(result.detail).toContain('未正常执行'); expect(result.code).toBe(200);
    expect((await checkService({ name: 'identity', url: 'https://www.yukino.bond/api/auth/access', jsonKeys: ['error'], expectedStatus: 401 })).state).toBe('error');
  });
  it('recognizes an intentional anonymous 401 JSON response as a running identity API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: '未登录' }, { status: 401 })));
    const result = await checkService({ name: 'identity', url: 'https://www.yukino.bond/api/auth/access', jsonKeys: ['error'], expectedStatus: 401 });
    expect(result.state).toBe('reachable'); expect(result.code).toBe(401);
  });
  it('rejects wrong JSON shapes and preserves a real upstream failure code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ wrong: [] })));
    expect((await checkService({ name: 'API', url: 'https://www.yukino.bond/api/posts', jsonKeys: ['posts'] })).state).toBe('error');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('limit', { status: 503 })));
    expect((await checkService({ name: 'API', url: 'https://www.yukino.bond/api/posts', jsonKeys: ['posts'] })).code).toBe(503);
  });
  it('checks actual weather fields and does not treat an empty forecast as healthy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ current: { temperature: 22, time: new Date().toISOString() }, daily: [], provider: 'open-meteo' })));
    expect((await checkService({ name: '天气', url: 'https://www.yukino.bond/api/weather', probe: 'weather' })).state).toBe('error');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ current: { temperature: 22, time: new Date().toISOString() }, daily: [{}], provider: 'open-meteo' })));
    expect((await checkService({ name: '天气', url: 'https://www.yukino.bond/api/weather', probe: 'weather' })).state).toBe('reachable');
  });
  it('checks novel details and actual volume contents, preserving stale and restricted distinctions', async () => {
    const target = { name: '小说', url: 'https://novel.yukino.bond/api/book/rezero-1', probe: 'novel-detail' as const };
    vi.stubGlobal('fetch', vi.fn(async (input: string) => Response.json(input.endsWith('/volume/1') ? { data: { chapters: [] } } : { data: { title: '示例', volumes: [{ id: '1' }] } })));
    expect((await checkService(target)).state).toBe('error');
    vi.stubGlobal('fetch', vi.fn(async (input: string) => Response.json(input.endsWith('/volume/1') ? { data: { chapters: [{ id: '1' }] } } : { data: { title: '示例', volumes: [{ id: '1' }] } })));
    expect((await checkService(target)).detail).toContain('正文需登录');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: {}, meta: { stale: true } })));
    expect((await checkService(target)).state).toBe('unknown');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'restricted' }, { status: 403 })));
    expect((await checkService(target)).state).toBe('unknown');
  });
  it('follows JM search to book and chapter and rejects empty image lists', async () => {
    const target = { name: '姬漫', url: 'https://jm-api-yukino.3584643854.workers.dev/v1/search?q=love', probe: 'jm-detail' as const };
    vi.stubGlobal('fetch', vi.fn(async (input: string) => Response.json(input.includes('/v1/search') ? { items: [{ id: '123' }] } : input.includes('/v1/books/') ? { title: '漫画', chapters: [{ id: '456' }] } : { images: [] })));
    expect((await checkService(target)).state).toBe('error');
    vi.stubGlobal('fetch', vi.fn(async (input: string) => Response.json(input.includes('/v1/search') ? { items: [{ id: '123' }] } : input.includes('/v1/books/') ? { title: '漫画', chapters: [{ id: '456' }] } : { images: [{ url: '/v1/image/456/1.jpg' }] })));
    expect((await checkService(target)).state).toBe('reachable');
  });
});
