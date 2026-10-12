import type { PortalDatabase } from './db';

type Payload = Record<string, any>;
type Row = { payload: string; expires_at: number; retry_at: number; lease_until: number; warning: string; updated_at: number };
type Options = { key: string; db: PortalDatabase; seed?: unknown; load: () => Promise<Response>; waitUntil?: (task: Promise<unknown>) => void };
const ready = new WeakMap<object, Promise<void>>();
const pending = new WeakMap<object, Map<string, Promise<Response>>>();
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' };

export function validF1Snapshot(value: unknown): value is Payload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Payload;
  if (typeof data.fetchedAt !== 'string' || !Number.isFinite(Date.parse(data.fetchedAt)) || Date.parse(data.fetchedAt) > Date.now() + 60000 || typeof data.source !== 'string' || !Array.isArray(data.errors) || !data.errors.every((error: unknown) => typeof error === 'string') || data.unavailable || data.stale) return false;
  return Array.isArray(data.races) && data.races.length > 0 && Array.isArray(data.drivers) && Array.isArray(data.teams)
    || !!data.race && Array.isArray(data.results) && data.results.length > 0
    || Array.isArray(data.fourths) && data.available?.current === true && data.available?.results === true && data.available?.sprint === true;
}

async function schema(db: PortalDatabase) {
  let task = ready.get(db);
  if (!task) {
    task = db.prepare(`CREATE TABLE IF NOT EXISTS f1_data_cache (
      cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL DEFAULT '', expires_at INTEGER NOT NULL DEFAULT 0,
      retry_at INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0,
      warning TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL DEFAULT 0
    )`).run().then(() => {});
    ready.set(db, task);
  }
  try { await task; } catch (error) { ready.delete(db); throw error; }
}
function parse(text: string): Payload | undefined {
  try { const value: unknown = JSON.parse(text); return validF1Snapshot(value) ? value : undefined; } catch { return undefined; }
}
function cached(value: Payload, stale: boolean, warning = '') {
  const payload = stale ? { ...value, stale: true, errors: [...new Set([...value.errors, warning || '正在更新数据源，暂时保留最近一次成功记录。'])] } : value;
  return new Response(JSON.stringify(payload), { headers: { ...headers, 'Cache-Control': `public, max-age=${stale ? 30 : 300}`, 'X-F1-Cache': stale ? 'stale' : 'hit' } });
}
function unavailable(warning: string, seconds = 30) {
  return new Response(JSON.stringify({ error: warning || '赛事数据正在更新，请稍后重试。', fetchedAt: new Date().toISOString() }), { status: 503, headers: { ...headers, 'Cache-Control': 'no-store', 'Retry-After': String(seconds) } });
}
export function retrySeconds(value: string | null, now = Date.now()) {
  const seconds = value && /^\d+$/.test(value) ? Number(value) : value ? Math.ceil((Date.parse(value) - now) / 1000) : 60;
  return Number.isFinite(seconds) ? Math.max(1, Math.min(86400, seconds)) : 60;
}

// Only schedules, results and standings use this cache. Live timing never falls back to it.
export async function cachedF1(options: Options): Promise<Response> {
  const { db, key, load, waitUntil } = options;
  const seed = validF1Snapshot(options.seed) ? options.seed : undefined;
  let row: Row | null;
  try {
    await schema(db);
    await db.prepare('INSERT OR IGNORE INTO f1_data_cache(cache_key) VALUES (?)').bind(key).run();
    if (seed) {
      const time = Date.parse(seed.fetchedAt);
      await db.prepare('UPDATE f1_data_cache SET payload=?, updated_at=?, expires_at=? WHERE cache_key=? AND updated_at < ?')
        .bind(JSON.stringify(seed), time, time + 300000, key, time).run();
    }
    row = await db.prepare('SELECT payload, expires_at, retry_at, lease_until, warning, updated_at FROM f1_data_cache WHERE cache_key=?').bind(key).first<Row>();
  } catch {
    const response = await load();
    return !response.ok && seed ? cached(seed, true, '数据源暂时无法更新，保留已核实的历史记录。') : response;
  }
  const stored = row?.payload ? parse(row.payload) : seed;
  if (stored && row!.expires_at > Date.now()) return cached(stored, false);
  if (row!.retry_at > Date.now()) return stored ? cached(stored, true, row!.warning) : unavailable(row!.warning, Math.ceil((row!.retry_at - Date.now()) / 1000));
  let claimed;
  try {
    claimed = await db.prepare('UPDATE f1_data_cache SET lease_until=? WHERE cache_key=? AND lease_until<=? AND retry_at<=?')
      .bind(Date.now() + 45000, key, Date.now(), Date.now()).run();
  } catch {
    const response = await load();
    return !response.ok && stored ? cached(stored, true, '数据源暂时无法更新，保留最近一次成功记录。') : response;
  }
  let jobs = pending.get(db); if (!jobs) { jobs = new Map(); pending.set(db, jobs); }
  if (!claimed.meta.changes) {
    if (stored) return cached(stored, true, row!.warning);
    const active = jobs.get(key);
    return active ? (await active).clone() : unavailable('赛事数据正在更新，请稍后重试。', 5);
  }
  const refresh = (async () => {
    let response: Response;
    try { response = await load(); }
    catch { response = unavailable('数据源暂时无法连接，请稍后重试。', 60); }
    let value: Payload = {};
    try { value = await response.clone().json(); } catch { /* Keep the last valid payload. */ }
    const good = response.ok && validF1Snapshot(value) && !value.errors.length;
    const publishedEmpty = !stored && response.ok && Array.isArray(value.errors) && !value.errors.length && typeof value.fetchedAt === 'string';
    const warning = typeof value.error === 'string' ? value.error : Array.isArray(value.errors) && value.errors.length ? value.errors.slice(0, 3).join('；') : '数据源暂时无法更新，保留最近一次成功记录。';
    try {
      if (good) {
        const time = Date.parse(value.fetchedAt);
        await db.prepare("UPDATE f1_data_cache SET payload=?, updated_at=?, expires_at=?, retry_at=0, lease_until=0, warning='' WHERE cache_key=?")
          .bind(JSON.stringify(value), time, time + 300000, key).run();
      } else if (publishedEmpty) {
        await db.prepare("UPDATE f1_data_cache SET retry_at=0, lease_until=0, warning='' WHERE cache_key=?").bind(key).run();
      } else {
        await db.prepare('UPDATE f1_data_cache SET retry_at=?, lease_until=0, warning=? WHERE cache_key=?')
          .bind(Date.now() + retrySeconds(response.headers.get('Retry-After')) * 1000, warning, key).run();
      }
    } catch { /* Storage failures must not discard a successful upstream response. */ }
    return !good && stored ? cached(stored, true, warning) : response;
  })();
  jobs.set(key, refresh);
  const work = refresh.finally(() => jobs!.delete(key));
  if (stored && waitUntil) { waitUntil(work); return cached(stored, true, row!.warning); }
  return work;
}
