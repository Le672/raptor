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
});
