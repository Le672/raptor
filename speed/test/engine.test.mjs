import { describe, expect, it, vi, afterEach } from 'vitest';
import { DownloadRunner, validateConfig, formatBytes, requestSpec } from '../src/engine.mjs';
function dataFetch(length, options = {}) {
  return vi.fn(async (url, request) => {
    const requested = new URL(url).searchParams.get('bytes') || Number(request.headers.Range?.split('-')[1]) + 1;
    const amount = length ?? Number(requested);
    return { ok: true, status: options.status || 200, headers: new Headers({ 'content-type': options.type || 'application/octet-stream' }),
      body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(amount)); controller.close(); } }) };
  });
}
afterEach(() => vi.useRealTimers());
const config = { url: 'https://speed.cloudflare.com/__down', kind: 'cloudflare', threads: 4, limitBytes: 5_000_000, rateBps: 0, durationMs: 0 };
describe('received bytes and shared controls', () => {
  it('reserves a shared quota across concurrent requests without clipping measured data', async () => {
    const fetcher = dataFetch(); const runner = new DownloadRunner({ fetcher });
    runner.start(config); await runner.task;
    expect(runner.snapshot().status).toBe('completed'); expect(runner.bytes).toBe(5_000_000);
    expect(fetcher.mock.calls.reduce((sum, [url]) => sum + Number(new URL(url).searchParams.get('bytes')), 0)).toBe(5_000_000);
  });
  it('counts the whole chunk when a server ignores the requested Range', async () => {
    const runner = new DownloadRunner({ fetcher: dataFetch(64000) });
    runner.start({ ...config, kind: 'file', url: 'https://example.com/test.bin', threads: 1, limitBytes: 1000 }); await runner.task;
    expect(runner.bytes).toBe(64000); expect(runner.snapshot().status).toBe('completed');
  });
  it('paces requests before download using one aggregate bandwidth budget', async () => {
    vi.useFakeTimers(); const issued = [];
    const fetcher = dataFetch(); const runner = new DownloadRunner({ fetcher: (url, opts) => { issued.push(Date.now()); return fetcher(url, opts); } });
    runner.start({ ...config, limitBytes: 40000, rateBps: 40000 });
    await vi.advanceTimersByTimeAsync(1000); await runner.task;
    expect(runner.bytes).toBe(40000); expect(issued.length).toBe(16);
    expect(issued[15] - issued[0]).toBeGreaterThanOrEqual(937);
  });
  it('pauses all downloads, freezes time, then resumes the same measured task', async () => {
    vi.useFakeTimers(); const runner = new DownloadRunner({ fetcher: dataFetch(), now: () => Date.now() });
    runner.start({ ...config, limitBytes: 40000, rateBps: 40000 }); await vi.advanceTimersByTimeAsync(260);
    runner.pause(); const paused = runner.snapshot(); await vi.advanceTimersByTimeAsync(3000);
    expect(runner.snapshot().elapsedMs).toBe(paused.elapsedMs); expect(runner.bytes).toBe(paused.bytes);
    runner.resume(); await vi.advanceTimersByTimeAsync(1500); await runner.task;
    expect(runner.id).toBe(paused.id); expect(runner.bytes).toBe(40000);
  });
  it('applies a reduced quota immediately and never lets stale responses start another task', async () => {
    vi.useFakeTimers(); const runner = new DownloadRunner({ fetcher: dataFetch() });
    runner.start({ ...config, rateBps: 40000 }); await vi.advanceTimersByTimeAsync(260);
    runner.updateLimits({ limitBytes: 5000 }); expect(runner.snapshot().status).toBe('completed');
    runner.start({ ...config, limitBytes: 1000 }); await vi.advanceTimersByTimeAsync(1000); await runner.task;
    expect(runner.bytes).toBe(1000); expect(runner.snapshot().status).toBe('completed');
  });
  it('rejects pages and stops after bounded failures instead of inventing download bytes', async () => {
    vi.useFakeTimers(); const runner = new DownloadRunner({ fetcher: dataFetch(1000, { type: 'text/html' }) });
    runner.start({ ...config, threads: 1 }); await vi.advanceTimersByTimeAsync(2500); await runner.task;
    expect(runner.bytes).toBe(0); expect(runner.workers[0].failures).toBe(3); expect(runner.status).toBe('error');
  });
  it('automatically stops a stalled request at the configured duration', async () => {
    vi.useFakeTimers(); const fetcher = (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Aborted'))));
    const runner = new DownloadRunner({ fetcher }); runner.start({ ...config, durationMs: 1000 }); await vi.advanceTimersByTimeAsync(1250);
    expect(runner.status).toBe('completed'); expect(runner.controllers.size).toBe(0); expect(runner.bytes).toBe(0);
  });
  it('validates URL, thread and quota bounds; formats decimal units', () => {
    expect(() => validateConfig({ url: 'file:///C:/data', threads: 4 })).toThrow();
    expect(() => validateConfig({ url: 'https://user:password@example.com/file' })).toThrow();
    expect(() => validateConfig({ ...config, threads: 33 })).toThrow();
    expect(() => validateConfig({ ...config, rateBps: Infinity })).toThrow();
    expect(formatBytes(1e9)).toBe('1.00 GB'); expect(requestSpec(config, 500, 1).url).toContain('bytes=500');
  });
});
