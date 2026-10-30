import { afterEach, expect, it, vi } from 'vitest';
import { readStatusReport } from '../lib/status-client';
afterEach(() => vi.unstubAllGlobals());
it('always reads the independent status origin without sending main-site credentials', async () => {
  const report = { services: [], checkedAt: new Date().toISOString() };
  const fetcher = vi.fn(async () => Response.json(report)); vi.stubGlobal('fetch', fetcher);
  expect(await readStatusReport()).toEqual(report);
  expect(fetcher).toHaveBeenCalledWith('https://status.yukino.bond/api/status', expect.objectContaining({ credentials: 'omit', headers: { Accept: 'application/json' } }));
});
it('rejects successful HTML fallback and stale malformed data instead of inventing service health', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>fallback</html>', { headers: { 'Content-Type': 'text/html' } })));
  await expect(readStatusReport()).rejects.toThrow('暂时不可用');
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ services: [], checkedAt: 'invalid' })));
  await expect(readStatusReport()).rejects.toThrow('格式错误');
});
