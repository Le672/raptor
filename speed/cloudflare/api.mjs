const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORIGINS = ['https://speed.yukino.bond', 'https://www.yukino.bond', 'https://yukino.bond', 'https://raptor.pages.dev', 'https://yukino-speed.pages.dev'];
function cors(request) {
  const origin = request.headers.get('Origin');
  return { 'Access-Control-Allow-Origin': origin && (ORIGINS.includes(origin) || origin === 'null' || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) ? origin : 'https://speed.yukino.bond', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
}
function json(request, value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { ...cors(request), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }); }
async function hash(value) { const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))); return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }
export async function totals(db) {
  const value = await db.prepare('SELECT COALESCE(SUM(bytes),0) AS bytes, COUNT(CASE WHEN bytes>0 THEN 1 END) AS sessions FROM speed_runs').first();
  return { bytes: Number(value.bytes), sessions: Number(value.sessions), updatedAt: new Date().toISOString(), source: 'anonymous-client-reports' };
}
let directoryCache = new Map();
const initializedDatabases = new WeakMap();
async function initialize(db) {
  if (!initializedDatabases.has(db)) initializedDatabases.set(db, (async () => {
    await db.prepare('CREATE TABLE IF NOT EXISTS speed_runs (id TEXT PRIMARY KEY,token_hash TEXT NOT NULL,bytes INTEGER NOT NULL DEFAULT 0,duration_ms INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,finished INTEGER NOT NULL DEFAULT 0)').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS speed_runs_updated ON speed_runs(updated_at)').run();
  })().catch(error => { initializedDatabases.delete(db); throw error; }));
  await initializedDatabases.get(db);
}
async function servers(q) {
  const key = q.toLowerCase(); const old = directoryCache.get(key); if (old && old.until > Date.now()) return old.value;
  const address = new URL('https://www.speedtest.net/api/js/servers'); address.searchParams.set('engine', 'js'); address.searchParams.set('limit', '30');
  if (q) address.searchParams.set('search', q);
  const response = await fetch(address.href, { headers: { Accept: 'application/json', 'User-Agent': 'Yukino-Speed/1.0' }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`运营商节点目录暂不可用（HTTP ${response.status}），请使用公开测试文件或自定义下载链接。`);
  const data = await response.json(); if (!Array.isArray(data)) throw new Error('节点目录返回格式异常。');
  const list = data.slice(0, 30).flatMap(item => {
    try {
      const original = new URL(item.url); if (!['http:', 'https:'].includes(original.protocol) || original.username || original.password || !/\/upload\.php$/.test(original.pathname)) return [];
      original.pathname = original.pathname.replace(/upload\.php$/, 'random4000x4000.jpg'); original.search = '';
      // The compatibility URL is deliberately labelled; a directory entry does not prove availability.
      return [{ id: 'ookla-' + String(item.id), name: `${String(item.sponsor || '运营商').slice(0, 90)} · ${String(item.name || '').slice(0, 60)}`,
        url: original.href.replace(/^http:/, 'https:'), httpUrl: original.href, kind: 'file', region: `${String(item.name || '')} / ${String(item.country || '')}`,
        note: 'Speedtest 目录节点的兼容测试文件；需要服务器提供该文件，网页版还需 HTTPS / CORS。此节点尚未经本机验证。' }];
    } catch { return []; }
  });
  if (directoryCache.size >= 30) directoryCache.delete(directoryCache.keys().next().value);
  const value = { servers: list, source: 'Speedtest public server directory', checkedAt: new Date().toISOString() };
  directoryCache.set(key, { until: Date.now() + 300000, value }); return value;
}
export async function handleSpeed(request, env) {
  const route = new URL(request.url).pathname.replace(/^\/api\/speed/, '').replace(/\/$/, '') || '/';
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
  try {
    if (request.method === 'GET' && route === '/servers') return json(request, await servers((new URL(request.url).searchParams.get('q') || '').trim().slice(0, 80)));
    if (!env.DB) return json(request, { error: '全站流量数据库尚未绑定。' }, 503);
    await initialize(env.DB);
    if (request.method === 'GET' && route === '/totals') return json(request, await totals(env.DB));
    if (request.method !== 'POST' || !['/session', '/report'].includes(route)) return json(request, { error: '接口不存在。' }, 404);
    const origin = request.headers.get('Origin');
    if (origin && cors(request)['Access-Control-Allow-Origin'] !== origin) return json(request, { error: '来源未获允许。' }, 403);
    if (!(request.headers.get('Content-Type') || '').includes('application/json')) return json(request, { error: '需要 JSON 请求。' }, 415);
    if (Number(request.headers.get('Content-Length')) > 2048) return json(request, { error: '请求内容过大。' }, 413);
    const reader = request.body?.getReader(); let text = '', size = 0;
    if (reader) {
      const decoder = new TextDecoder();
      while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 2048) { await reader.cancel(); return json(request, { error: '请求内容过大。' }, 413); } text += decoder.decode(part.value, { stream: true }); }
      text += decoder.decode();
    }
    let input; try { input = JSON.parse(text); } catch { return json(request, { error: 'JSON 格式错误。' }, 400); }
    if (!UUID.test(input.id || '') || typeof input.token !== 'string' || input.token.length !== 72 || !UUID.test(input.token.slice(0, 36)) || !UUID.test(input.token.slice(36))) return json(request, { error: '任务凭据格式错误。' }, 400);
    const tokenHash = await hash(input.token); const now = Date.now();
    if (route === '/session') {
      await env.DB.prepare('INSERT OR IGNORE INTO speed_runs (id,token_hash,created_at,updated_at) VALUES (?,?,?,?)').bind(input.id, tokenHash, now, now).run();
      const row = await env.DB.prepare('SELECT token_hash,bytes,duration_ms,finished FROM speed_runs WHERE id=?').bind(input.id).first();
      return json(request, row?.token_hash === tokenHash ? { id: input.id } : { error: '此任务的凭据不匹配。', acknowledged: row ? { bytes: Number(row.bytes), durationMs: Number(row.duration_ms), finished: row.finished === 1 } : null }, row?.token_hash === tokenHash ? 200 : 409);
    }
    const bytes = Number(input.bytes), durationMs = Number(input.durationMs);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > 100_000_000_000_000 || !Number.isSafeInteger(durationMs) || durationMs < 0 || durationMs > 31_536_000_000 || bytes > (durationMs + 1000) * 12_500_000) return json(request, { error: '统计数值不符合范围。' }, 400);
    const row = await env.DB.prepare('SELECT token_hash FROM speed_runs WHERE id=?').bind(input.id).first();
    if (!row || row.token_hash !== tokenHash) return json(request, { error: '任务凭据无效。' }, 403);
    await env.DB.prepare('UPDATE speed_runs SET bytes=MAX(bytes,?),duration_ms=MAX(duration_ms,?),finished=MAX(finished,?),updated_at=? WHERE id=? AND token_hash=?').bind(bytes, durationMs, input.finished === true ? 1 : 0, now, input.id, tokenHash).run();
    return json(request, { accepted: true, total: await totals(env.DB) });
  } catch (error) { return json(request, { error: route === '/servers' ? error.message : '全站统计暂不可用，请稍后重试。' }, 503); }
}
