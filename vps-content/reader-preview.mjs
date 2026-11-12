import { AsyncLocalStorage } from 'node:async_hooks';

const scope = new AsyncLocalStorage();
const DAY = 86400000;
export const PREVIEW_LIMITS = Object.freeze({ dailyFetches: 600, fetchesPerBook: 12, concurrentBooks: 3, perIpMinute: 12, requestsPerSecond: 30 });

export function previewFetch(fetcher, input, options) {
  const work = scope.getStore();
  if (!work) return fetcher(input, options);
  if (work.signal.aborted || work.left <= 0 || !work.reserve()) {
    work.exhausted = true;
    return Promise.reject(new Error('Preview origin budget exhausted'));
  }
  work.left--;
  const signal = options?.signal ? AbortSignal.any([work.signal, options.signal]) : work.signal;
  return fetcher(input, { ...options, redirect: 'manual', signal });
}

// A single persistent counter shared by both reader hosts. Reservations happen
// before network I/O, including failed attempts. No Cloudflare bindings.
export function previewReservations(db, now = Date.now, limit = PREVIEW_LIMITS.dailyFetches) {
  db.exec('CREATE TABLE IF NOT EXISTS reader_preview_budget (id INTEGER PRIMARY KEY CHECK(id=1), day INTEGER NOT NULL, used INTEGER NOT NULL)');
  const reserve = db.prepare(`INSERT INTO reader_preview_budget VALUES(1, ?, 1)
    ON CONFLICT(id) DO UPDATE SET day=excluded.day, used=CASE WHEN excluded.day>day THEN 1 ELSE used+1 END
    WHERE excluded.day>day OR (excluded.day=day AND used<?)`);
  return () => reserve.run(Math.floor(now() / DAY), limit).changes === 1;
}

export function createPreviewGateway(reserve, now = Date.now) {
  const pending = new Map(), ips = new Map();
  let second = -1, requests = 0;
  const response = (data, status = 200, headers = {}) => Response.json(data, { status, headers: {
    'Cache-Control': 'no-store', 'X-Yukino-Delivery': 'vps-reader-preview', ...headers,
  } });
  const limited = (retry = 60) => response({ error: '试读请求较多，请稍后重试。', code: 'PREVIEW_BUSY' }, 429, { 'Retry-After': String(retry) });
  return async (request, produce) => {
    const url = new URL(request.url), time = now(), slot = Math.floor(time / 1000);
    if (second !== slot) { second = slot; requests = 0; }
    if (++requests > PREVIEW_LIMITS.requestsPerSecond) return limited(1);
    const ip = request.headers.get('CF-Connecting-IP') || 'local', minute = Math.floor(time / 60000);
    if (ips.get(ip)?.minute !== minute) {
      for (const [key, item] of ips) if (item.minute !== minute) ips.delete(key);
      if (ips.size >= 2048) return limited();
      ips.set(ip, { minute, count: 0 });
    }
    if (++ips.get(ip).count > PREVIEW_LIMITS.perIpMinute) return limited();
    const key = new Request(new URL('/__reading-cache/preview-v1' + url.pathname, url.origin));
    const cache = globalThis.caches?.default;
    const hit = await cache?.match(key).catch(() => null);
    if (hit) return response(await hit.json());
    let task = pending.get(key.url);
    if (!task) {
      if (pending.size >= PREVIEW_LIMITS.concurrentBooks) return limited(15);
      const work = { signal: AbortSignal.timeout(20000), left: PREVIEW_LIMITS.fetchesPerBook, reserve, exhausted: false };
      task = scope.run(work, async () => {
        try {
          const data = await produce();
          await cache?.put(key, Response.json(data, { headers: { 'Cache-Control': 'public, max-age=86400' } })).catch(() => {});
          return { data };
        } catch (error) {
          return work.exhausted
            ? { status: 429, error: '试读取源达到保护上限，请稍后再试。', code: 'PREVIEW_BUDGET' }
            : { status: error.status === 404 || error.status === 403 ? error.status : 503, error: error.message };
        }
      }).finally(() => pending.delete(key.url));
      pending.set(key.url, task);
    }
    const { data, error, status, code } = await task;
    return data ? response(data) : response({ error, ...(code && { code }) }, status, status === 429 ? { 'Retry-After': '60' } : {});
  };
}
