// @vitest-environment node
import { expect, it, vi } from 'vitest';
import worker from '../../vps-content/status-worker.mjs';
import { onRequestGet } from '../../functions/api/status';
vi.mock('../../functions/api/status', () => ({ onRequestGet: vi.fn() }));
it('persists the worst real result per hour and leaves unsampled hours empty', async () => {
  const values = new Map<string, string>();
  const env = { STATUS_STORAGE: {
    get: async (key: string) => values.has(key) ? JSON.parse(values.get(key)!) : null,
    put: async (key: string, value: string) => { values.set(key, value); },
  } };
  const checkedAt = new Date().toISOString();
  for (const state of ['reachable', 'error', 'reachable']) {
    vi.mocked(onRequestGet).mockResolvedValue(Response.json({ checkedAt, services: [{ url: 'https://www.yukino.bond/', state }] }));
    await worker.scheduled({}, env);
  }
  const result = await (await worker.fetch(new Request('https://status.yukino.bond/api/history'), env)).json();
  expect(result.hours).toHaveLength(72);
  expect(result.hours.slice(0, 71).every((hour: unknown) => hour === null)).toBe(true);
  expect(result.hours[71].states['https://www.yukino.bond/']).toBe('error');
});
