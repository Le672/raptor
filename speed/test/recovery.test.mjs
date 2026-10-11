import { describe, it, expect, vi, afterEach } from 'vitest';
import { DownloadRunner } from '../src/engine.mjs';
import { BrowserRunner } from '../src/browser-runner.mjs';
import { readTab, saveTab } from '../src/tab-state.mjs';
import { chartGeometry, nearestPoint } from '../src/chart.mjs';
const config = { url: 'https://speed.cloudflare.com/__down', kind: 'cloudflare', threads: 2, limitBytes: 40000, rateBps: 40000 };
const dataFetch = vi.fn(async url => new Response(new Uint8Array(Number(new URL(url).searchParams.get('bytes'))), { headers: { 'content-type': 'application/octet-stream' } }));
function runner(fetcher = dataFetch) { return new DownloadRunner({ fetcher, now: () => Date.now() }); }
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
describe('background recovery', () => {
  it('retains bytes and identity while offline and completes only the remaining quota', async () => {
    vi.useFakeTimers(); const task = runner(); task.start(config); await vi.advanceTimersByTimeAsync(260);
    task.setEnvironment({ online: false }); const saved = task.snapshot();
    expect(saved.status).toBe('recovering'); expect(saved.bytes).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(5000); expect(task.snapshot().elapsedMs).toBe(saved.elapsedMs);
    task.setEnvironment({ online: true }); await vi.advanceTimersByTimeAsync(1500); await task.task;
    expect(task.id).toBe(saved.id); expect(task.bytes).toBe(40000); expect(task.status).toBe('completed');
  });
  it('resumes a frozen task but never resumes an intentional pause', async () => {
    vi.useFakeTimers(); const task = runner(); task.start(config); await vi.advanceTimersByTimeAsync(130);
    task.setEnvironment({ frozen: true }); expect(task.status).toBe('recovering');
    task.setEnvironment({ frozen: false }); expect(task.status).toBe('running');
    task.pause(); const count = dataFetch.mock.calls.length;
    task.setEnvironment({ hidden: true }); task.setEnvironment({ online: false }); task.setEnvironment({ online: true, hidden: false });
    await vi.advanceTimersByTimeAsync(5000); expect(task.status).toBe('paused'); expect(dataFetch.mock.calls).toHaveLength(count); task.stop();
  });
  it('survives more than three transient failures in a background tab', async () => {
    vi.useFakeTimers(); let attempts = 0;
    const fetcher = vi.fn(async url => { if (++attempts <= 4) throw new TypeError('temporary connection loss'); return dataFetch(url); });
    const task = runner(fetcher); task.setEnvironment({ hidden: true }); task.start({ ...config, threads: 1 });
    await vi.advanceTimersByTimeAsync(7000); await task.task;
    expect(attempts).toBeGreaterThan(4); expect(task.bytes).toBe(40000); expect(task.status).toBe('completed');
  });
  it('still stops for an invalid file in the background', async () => {
    vi.useFakeTimers(); const fetcher = vi.fn(async () => new Response('<html/>', { headers: { 'content-type': 'text/html' } }));
    const task = runner(fetcher); task.setEnvironment({ hidden: true }); task.start(config);
    await vi.advanceTimersByTimeAsync(3000); await task.task; expect(task.status).toBe('error'); expect(task.bytes).toBe(0);
  });
  it('restores a discarded page without a new identity or a fresh quota', async () => {
    vi.useFakeTimers(); const original = runner(); original.start(config); await vi.advanceTimersByTimeAsync(260);
    const saved = original.snapshot(); original.pause(); const restored = runner(); restored.restore(saved);
    await vi.advanceTimersByTimeAsync(2000); await restored.task;
    expect(restored.id).toBe(saved.id); expect(restored.startedAt).toBe(saved.startedAt); expect(restored.bytes).toBe(40000);
    expect(restored.elapsed).toBeGreaterThan(saved.elapsedMs); expect(restored.status).toBe('completed');
  });
  it('does not issue requests for a restored completed quota or duration', () => {
    const task = runner(); const saved = { id: crypto.randomUUID(), startedAt: new Date().toISOString(), bytes: 40000, elapsedMs: 800, config, status: 'running' };
    task.restore(saved); expect(task.status).toBe('completed'); expect(dataFetch).not.toHaveBeenCalled();
    const other = runner(); other.restore({ ...saved, bytes: 100, elapsedMs: 1000, config: { ...config, durationMs: 1000 } });
    expect(other.status).toBe('completed'); expect(dataFetch).not.toHaveBeenCalled();
  });
  it('rejects malformed checkpoints and respects a quota lowered during recovery', async () => {
    const task = runner(); expect(() => task.restore({ id: 'x', bytes: 0, elapsedMs: 0, config })).toThrow();
    task.setEnvironment({ online: false }); task.restore({ id: crypto.randomUUID(), startedAt: new Date().toISOString(), bytes: 20000, elapsedMs: 500, config, status: 'running' });
    task.updateLimits({ limitBytes: 10000 }); task.setEnvironment({ online: true });
    expect(task.status).toBe('completed'); expect(dataFetch).not.toHaveBeenCalled();
  });
});
describe('browser checkpoints and worker boundary', () => {
  const storage = () => { const entries = new Map(); return { getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) }; };
  it('uses only this tab checkpoint, keeps manual pauses and discards terminal records', () => {
    const store = storage(); const state = { id: 'job', status: 'running', bytes: 1000, elapsedMs: 100 };
    expect(readTab(store, [state])).toBeNull(); saveTab(state, store);
    expect(readTab(store, [{ ...state, status: 'paused', bytes: 2000, elapsedMs: 200 }]).status).toBe('paused');
    expect(readTab(store, [{ ...state, status: 'stopped', bytes: 2000, elapsedMs: 200 }])).toBeNull();
    expect(readTab(store)).toBeNull();
  });
  it('ignores stale worker states without reverting the measured count', async () => {
    const worker = { postMessage: vi.fn(), terminate: vi.fn() }; const updates = [];
    const client = new BrowserRunner({ makeWorker: () => worker, onUpdate: state => updates.push(state) });
    const pending = client.pause(); const { requestId } = worker.postMessage.mock.calls[0][0];
    worker.onmessage({ data: { type: 'state', revision: 3, state: { bytes: 200, status: 'paused' } } });
    worker.onmessage({ data: { type: 'reply', requestId, revision: 2, state: { bytes: 100, status: 'running' } } });
    expect((await pending).bytes).toBe(200); expect(client.snapshot().bytes).toBe(200); expect(updates).toHaveLength(1); client.dispose(); expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('falls back to a real runner when workers are unavailable', async () => {
    const client = new BrowserRunner({ makeWorker: () => { throw new Error('unavailable'); } });
    client.fallback.fetcher = dataFetch;
    const started = await client.start({ ...config, rateBps: 0 }); await client.fallback.task;
    expect(started.id).toBeTruthy(); expect(client.snapshot().bytes).toBe(40000); client.dispose();
  });
});
describe('chart positions', () => {
  it('uses actual sample time and selects the nearest point across sampling gaps', () => {
    const { points } = chartGeometry([{ t: 1, bps: 100 }, { t: 2, bps: 200 }, { t: 40, bps: 300 }]);
    expect(points[1].x - points[0].x).toBeLessThan(20); expect(nearestPoint(points, 100).t).toBe(2);
    expect(nearestPoint(points, 680).bps).toBe(300);
    const recent = chartGeometry([{ t: 1, bps: 999999 }, { t: 70, bps: 10 }]); expect(recent.points).toHaveLength(1); expect(recent.max).toBe(125000);
  });
});
