// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkService } from '../../functions/api/status';
import statusWorker from '../../vps-content/status-worker.mjs';
import edgeFrontend from '../../vps-content/edge-frontend.mjs';

afterEach(() => vi.unstubAllGlobals());
describe('status checks stay meaningful during quota failures', () => {
  it('redirects legacy status pages at the public edge and forwards API requests to the origin', async () => {
    const env = { ASSETS: { fetch: vi.fn(async () => new Response('status shell')) } };
    const origin = vi.fn(async () => Response.json({ hours: [] }));
    vi.stubGlobal('fetch', origin);
    const legacy = await edgeFrontend.fetch(new Request('https://status.yukino.bond/status?view=history'), env);
    expect(legacy.status).toBe(308);
    expect(legacy.headers.get('Location')).toBe('https://status.yukino.bond/?view=history');
    expect(await (await edgeFrontend.fetch(new Request('https://status.yukino.bond/'), env)).text()).toBe('status shell');
    const request = new Request('https://status.yukino.bond/api/history');
    await edgeFrontend.fetch(request, env);
    expect(origin).toHaveBeenCalledExactlyOnceWith(request);
  });
  it('serves the status root and redirects the old address for GET and HEAD without turning API failures into pages', async () => {
    const env = { ASSETS: { fetch: vi.fn(async (request: Request) => new URL(request.url).pathname === '/'
      ? new Response(request.method === 'HEAD' ? null : '<html>status</html>', { headers: { 'Content-Type': 'text/html' } })
      : new Response(null, { status: 404 })) } };
    for (const method of ['GET', 'HEAD']) {
      expect((await statusWorker.fetch(new Request('https://status.yukino.bond/', { method }), env)).status).toBe(200);
      const old = await statusWorker.fetch(new Request('https://status.yukino.bond/status?from=nav', { method }), env);
      expect(old.status).toBe(308);
      expect(old.headers.get('Location')).toBe('https://status.yukino.bond/?from=nav');
    }
    expect((await statusWorker.fetch(new Request('https://status.yukino.bond/api/auth/me'), env)).status).toBe(503);
  });
  it('does not report an HTML fallback with HTTP 200 as a healthy API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>quota fallback</html>', { headers: { 'Content-Type': 'text/html' } })));
    const result = await checkService({ name: 'API', url: 'https://www.yukino.bond/api/posts', jsonKeys: ['posts'] });
    expect(result.state).toBe('error'); expect(result.detail).toContain('未正常执行'); expect(result.code).toBe(200);
    expect((await checkService({ name: 'identity', url: 'https://www.yukino.bond/api/auth/access', jsonKeys: ['error'], expectedStatus: 401 })).state).toBe('error');
  });
  it('treats interrupted response bodies as unconfirmed instead of declaring an outage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({
      start(controller) { controller.error(new TypeError('Connection closed mid-response')); },
    }), { headers: { 'Content-Type': 'application/json' } })));
    expect((await checkService({ name: 'API', url: 'https://www.yukino.bond/api/posts', jsonKeys: ['posts'] })).state).toBe('unknown');
    expect((await checkService({ name: 'News', url: 'https://news.yukino.bond/api/news', probe: 'news' })).state).toBe('unknown');
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
  it('checks current reader samples on their own origin, retrying a missing book', async () => {
    const target = { name: '小说', url: 'https://novel.yukino.bond/api/books?source=biqu', probe: 'reader-source' as const, statusOnly: true };
    const fetch = vi.fn(async (input: string) => {
      if (input === target.url) return Response.json({ data: { items: [{ id: 'biqu-123' }, { id: 'biqu-456' }] }, meta: { stale: true } });
      if (input.endsWith('/biqu-123')) return Response.json({ error: '作品不存在' }, { status: 404 });
      if (input.endsWith('/volume/v12345678')) return Response.json({ data: { chapters: [{ id: '1' }] } });
      return Response.json({ data: { title: '示例', volumes: [{ id: 'v12345678' }] } });
    });
    vi.stubGlobal('fetch', fetch);
    expect(await checkService(target)).toMatchObject({ state: 'reachable', statusOnly: true, detail: expect.stringContaining('正文需登录') });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      target.url, 'https://novel.yukino.bond/api/book/biqu-123',
      'https://novel.yukino.bond/api/book/biqu-456', 'https://novel.yukino.bond/api/book/biqu-456/volume/v12345678',
    ]);
    fetch.mockImplementation(async input => input === target.url
      ? Response.json({ data: { items: [{ id: 'biqu-123' }] } })
      : Response.json({ error: '作品不存在' }, { status: 404 }));
    expect(await checkService(target)).toMatchObject({ state: 'unknown', code: 404, statusOnly: true });
    fetch.mockImplementation(async () => Response.json({ error: '服务故障' }, { status: 503 }));
    expect(await checkService({ ...target, probe: 'reader-catalog', statusOnly: false })).toMatchObject({ state: 'error', code: 503 });
  });
  it('confirms a page that returns 404 to HEAD by requesting it with GET', async () => {
    const fetch = vi.fn(async (_url: string, options: RequestInit) => new Response(null, { status: options.method === 'HEAD' ? 404 : 200 }));
    vi.stubGlobal('fetch', fetch);
    expect(await checkService({ name: '小说书房', url: 'https://novel.yukino.bond/' })).toMatchObject({ state: 'reachable', code: 200 });
  });
  it('follows JM search to book and chapter and rejects empty image lists', async () => {
    const target = { name: '姬漫', url: 'https://jm-api-yukino.3584643854.workers.dev/v1/search?q=love', probe: 'jm-detail' as const };
    vi.stubGlobal('fetch', vi.fn(async (input: string) => Response.json(input.includes('/v1/search') ? { items: [{ id: '123' }] } : input.includes('/v1/books/') ? { title: '漫画', chapters: [{ id: '456' }] } : { images: [] })));
    expect((await checkService(target)).state).toBe('error');
    vi.stubGlobal('fetch', vi.fn(async (input: string) => Response.json(input.includes('/v1/search') ? { items: [{ id: '123' }] } : input.includes('/v1/books/') ? { title: '漫画', chapters: [{ id: '456' }] } : { images: [{ url: '/v1/image/456/1.jpg' }] })));
    expect((await checkService(target)).state).toBe('reachable');
  });
});
