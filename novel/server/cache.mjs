// Public reading caches must never spend the account's KV write allowance.
// Only persistSnapshot(), called by the hourly Cron, may write to NOVEL_CACHE.
export const SNAPSHOT_KEY = 'catalog-snapshot:v3';
export const KV_WRITES_PER_REFRESH = 1;
export const SNAPSHOT_KEYS = Object.freeze([
  'catalog:v1', 'feed:v2:sf', 'feed:v2:linovel',
  'discovered:v2:sf', 'discovered:v2:linovel', 'discovered:v2:wenku', 'health:v2:wenku',
]);
export const CACHE_LIMITS = Object.freeze({ entries: 128, bytes: 16 * 1024 * 1024, entryBytes: 8 * 1024 * 1024, snapshotBytes: 20 * 1024 * 1024 });
const DAY = 86400;
export function retentionSeconds(key) { return key.startsWith('health:') || key.startsWith('search:') ? 3600 : /^(?:chapter|text):/.test(key) ? 7 * DAY : 30 * DAY; }
function expiresAt(key, value, retention = retentionSeconds(key)) {
  const sourceTime = Date.parse(value?.checkedAt), explicit = Date.parse(value?.expiresAt);
  return Math.min(sourceTime + Math.min(retention, retentionSeconds(key)) * 1000, Number.isFinite(explicit) ? explicit : Infinity);
}
function usable(key, value) { return validRecord(value) && expiresAt(key, value) > Date.now(); }
const states = new WeakMap();
const bytes = value => new TextEncoder().encode(value).byteLength;
function state(env) {
  if (!states.has(env)) states.set(env, { memory: new Map(), bytes: 0, inflight: new Map(), updates: new Map(), snapshot: null, snapshotReadAt: 0, snapshotTask: null, scheduledTask: null, attemptedHour: null, persistenceError: '', persistenceNotice: '' });
  return states.get(env);
}
function retain(env, key, value, retention = retentionSeconds(key)) {
  const current = state(env), serialized = JSON.stringify(value), size = bytes(serialized);
  const old = current.memory.get(key);
  if (old) { current.bytes -= old.size; current.memory.delete(key); }
  const expires = expiresAt(key, value, retention);
  if (size > CACHE_LIMITS.entryBytes || expires <= Date.now()) return;
  while (current.memory.size >= CACHE_LIMITS.entries || current.bytes + size > CACHE_LIMITS.bytes) {
    const first = current.memory.keys().next().value;
    const removed = current.memory.get(first); current.memory.delete(first); current.bytes -= removed.size;
  }
  current.memory.set(key, { value, size, expires }); current.bytes += size;
}
function local(env, key) {
  const current = state(env), item = current.memory.get(key);
  if (!item) return null;
  current.memory.delete(key);
  if (item.expires <= Date.now()) { current.bytes -= item.size; return null; }
  current.memory.set(key, item); return item.value;
}
const cacheKey = key => new Request(`https://novel.yukino.bond/__reading-cache/v3/${encodeURIComponent(key)}`);
const edge = () => globalThis.caches?.default;
function validRecord(value) { return value && typeof value === 'object' && Number.isFinite(Date.parse(value.checkedAt)); }
async function readSnapshot(env) {
  const current = state(env);
  if (!env.NOVEL_CACHE) return null;
  if (current.snapshotReadAt && Date.now() - current.snapshotReadAt < 60000) return current.snapshot;
  if (current.snapshotTask) return current.snapshotTask;
  current.snapshotTask = (async () => {
    try {
      const value = await env.NOVEL_CACHE.get(SNAPSHOT_KEY, { type: 'json' });
      if (value?.version === 3 && value.records && typeof value.records === 'object') current.snapshot = value;
      current.snapshotReadAt = Date.now();
    } catch { /* Previously read snapshots remain available during a KV outage. */ }
    return current.snapshot;
  })();
  try { return await current.snapshotTask; } finally { current.snapshotTask = null; }
}
export async function stored(env, key) {
  const hit = local(env, key); if (hit) return hit;
  try {
    const response = await edge()?.match(cacheKey(key));
    const value = response ? await response.json() : null;
    if (usable(key, value)) { retain(env, key, value); return value; }
  } catch { /* Cache API eviction/unavailability must not break reading. */ }
  const snapshot = await readSnapshot(env);
  const record = snapshot?.records?.[key];
  if (SNAPSHOT_KEYS.includes(key) && usable(key, record)) { retain(env, key, record); return record; }
  // Migration keeps existing successful KV entries readable, without renewing them.
  try {
    const old = await env.NOVEL_CACHE?.get(key, { type: 'json' });
    if (usable(key, old)) { retain(env, key, old); return old; }
  } catch { /* The caller can still fetch a live source when KV is exhausted. */ }
  return null;
}
export async function persist(env, key, value, ttl) {
  const expires = expiresAt(key, value, ttl), remaining = Math.floor((expires - Date.now()) / 1000);
  if (remaining <= 0) return value;
  const record = { ...value, expiresAt: new Date(expires).toISOString() };
  retain(env, key, record, ttl);
  try {
    const serialized = JSON.stringify(record);
    if (bytes(serialized) <= CACHE_LIMITS.entryBytes && edge()) await edge().put(cacheKey(key), new Response(serialized, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${remaining}` } }));
  } catch { /* A successful source response remains successful even if edge caching fails. */ }
  return value;
}
export async function updateStored(env, key, update, ttl) {
  const current = state(env), previous = current.updates.get(key) || Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    const value = await update(await stored(env, key));
    if (value) await persist(env, key, value, ttl);
  });
  current.updates.set(key, task);
  try { await task; } finally { if (current.updates.get(key) === task) current.updates.delete(key); }
}
async function refresh(env, key, producer, retention) {
  const current = state(env);
  if (current.inflight.has(key)) return current.inflight.get(key);
  const task = (async () => {
    const result = { data: await producer(), checkedAt: new Date().toISOString() };
    await persist(env, key, result, retention); return result;
  })();
  current.inflight.set(key, task);
  try { return await task; } finally { current.inflight.delete(key); }
}
export async function cached(env, ctx, key, producer, ttl, { force = false, background = false, retention = 30 * 86400, provider = 'lnovel · 哔哩轻小说', staleOnRestricted = true } = {}) {
  const old = await stored(env, key);
  const age = old ? Date.now() - Date.parse(old.checkedAt) : Infinity;
  const meta = (record, stale, reason = '') => ({ ...record, meta: { checkedAt: record.checkedAt, stale, reason, provider, refreshMinutes: Math.round(ttl / 60000) } });
  if (old && age < (force ? 60000 : ttl)) return meta(old, false);
  const task = () => refresh(env, key, producer, retention);
  if (old && background && !force) {
    ctx.waitUntil(task().catch(() => {}));
    return meta(old, true, '正在后台同步，当前显示上次成功获取的数据');
  }
  try { return meta(await task(), false); }
  catch (error) { if (!staleOnRestricted && [400,401,403,404].includes(error.status)) throw error; if (old) return meta(old, true, error instanceof Error ? error.message : '书源连接失败'); throw error; }
}
// One configured hourly event -> at most one put, containing only seven fixed keys.
// KV is not an atomic lock: a Cloudflare duplicate event in another isolate can
// repeat the put. Visitors have no route or option that invokes this writer.
export async function persistSnapshot(env, records, scheduledTime = Date.now()) {
  const current = state(env), hour = Math.floor(scheduledTime / 3600000);
  if (!env.NOVEL_CACHE) return { persisted: false, reason: 'KV 未配置', writes: 0 };
  const old = await readSnapshot(env);
  if (old?.hour >= hour || current.attemptedHour >= hour) return { persisted: false, reason: '本小时已完成或尝试持久化', writes: 0 };
  const selected = Object.fromEntries(SNAPSHOT_KEYS.filter(key => usable(key, records[key])).map(key => [key, records[key]]));
  if (!Object.keys(selected).length) return { persisted: false, reason: '没有成功索引可保存', writes: 0 };
  const advanced = Object.entries(selected).some(([key, record]) => key !== 'health:v2:wenku' && Array.isArray(record.data) && record.data.length && Date.parse(record.checkedAt) > (Date.parse(old?.records?.[key]?.checkedAt) || 0));
  if (!advanced) {
    current.persistenceNotice = '书源未返回更新，保留上次成功快照';
    return { persisted: false, reason: current.persistenceNotice, writes: 0 };
  }
  const value = { version: 3, hour, checkedAt: new Date().toISOString(), records: selected };
  const serialized = JSON.stringify(value);
  if (bytes(serialized) > CACHE_LIMITS.snapshotBytes) {
    current.persistenceError = '索引快照超过安全大小，保留上次持久化结果';
    return { persisted: false, reason: current.persistenceError, writes: 0 };
  }
  current.attemptedHour = hour;
  try {
    const latestExpiry = Math.max(...Object.entries(selected).map(([key, record]) => expiresAt(key, record)));
    await env.NOVEL_CACHE.put(SNAPSHOT_KEY, serialized, { expirationTtl: Math.max(60, Math.floor((latestExpiry - Date.now()) / 1000)) });
    current.snapshot = value; current.snapshotReadAt = Date.now(); current.persistenceError = ''; current.persistenceNotice = '';
    return { persisted: true, checkedAt: value.checkedAt, writes: 1 };
  } catch (error) {
    current.persistenceError = 'KV 持久化暂不可用，继续使用临时缓存与上次成功快照';
    console.warn('novel-snapshot-persistence-failed', { name: error?.name });
    return { persisted: false, reason: current.persistenceError, writes: 1 };
  }
}
export async function snapshotStatus(env) {
  const snapshot = await readSnapshot(env);
  const current = state(env), expired = snapshot && !Object.entries(snapshot.records).some(([key, record]) => key !== 'health:v2:wenku' && SNAPSHOT_KEYS.includes(key) && usable(key, record));
  const stale = snapshot && Date.now() - Date.parse(snapshot.checkedAt) > 2 * 3600000;
  return { mode: 'hourly-snapshot', scheduledWritesPerDay: 24, lastPersistedAt: snapshot?.checkedAt || null, state: current.persistenceError ? 'error' : expired ? 'expired' : current.persistenceNotice || stale ? 'stale' : snapshot ? 'ok' : 'pending', reason: current.persistenceError || (expired ? '上次索引快照已过期，等待书源恢复后重新保存' : current.persistenceNotice || (stale ? '尚未保存新的索引快照' : '')) };
}
export async function hourlyTask(env, action) {
  const current = state(env);
  if (current.scheduledTask) return current.scheduledTask;
  current.scheduledTask = action();
  try { return await current.scheduledTask; } finally { current.scheduledTask = null; }
}
export function cacheUsage(env) { const current = state(env); return { entries: current.memory.size, bytes: current.bytes }; }
