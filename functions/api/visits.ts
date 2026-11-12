import { isMainHost, isLocalHost } from '../../speed/src/site-routing.mjs';
type Statement = { bind(...values: unknown[]): Statement; run(): Promise<unknown>; first(): Promise<Record<string, unknown> | null> };
type VisitDatabase = { prepare(sql: string): Statement };
const ready = new WeakMap<object, Promise<void>>();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(body: unknown, status = 200) { const headers = { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }; return status === 204 ? new Response(null, { status, headers }) : Response.json(body, { status, headers }); }
async function initialize(db: VisitDatabase) {
  let pending = ready.get(db);
  if (!pending) {
    pending = (async () => {
      await db.prepare('CREATE TABLE IF NOT EXISTS site_visit_total (id INTEGER PRIMARY KEY CHECK(id=1), visits INTEGER NOT NULL DEFAULT 0, started_at TEXT NOT NULL)').run();
      await db.prepare('INSERT OR IGNORE INTO site_visit_total (id,visits,started_at) VALUES (1,0,?)').bind(new Date().toISOString()).run();
      await db.prepare('CREATE TABLE IF NOT EXISTS site_visit_events (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL)').run();
      await db.prepare('CREATE INDEX IF NOT EXISTS site_visit_events_created ON site_visit_events(created_at)').run();
      // The insert and increment commit together. Duplicate event IDs do not fire this trigger.
      await db.prepare('CREATE TRIGGER IF NOT EXISTS site_visit_increment AFTER INSERT ON site_visit_events BEGIN UPDATE site_visit_total SET visits=visits+1 WHERE id=1; END').run();
      await db.prepare('DELETE FROM site_visit_events WHERE created_at < ?').bind(Date.now() - 7 * 86400000).run();
    })();
    ready.set(db, pending);
  }
  try { await pending; } catch (error) { ready.delete(db); throw error; }
}
export async function onRequest({ request, env }: { request: Request; env: { DB?: VisitDatabase } }) {
  if (request.method === 'OPTIONS') return json(null, 204);
  if (!['GET', 'POST'].includes(request.method)) return json({ error: '仅支持读取或记录访问。' }, 405);
  if (!env.DB) return json({ error: '访问量数据库暂不可用。' }, 503);
  try {
    if (request.method === 'POST') {
      const url = new URL(request.url), origin = request.headers.get('Origin');
      if ((!isMainHost(url.hostname) && !isLocalHost(url.hostname) && url.hostname !== 'raptor.pages.dev') || (origin && origin !== url.origin)) return json({ error: '请从主站记录访问。' }, 403);
      if (!request.headers.get('Content-Type')?.includes('application/json')) return json({ error: '需要 JSON 请求。' }, 415);
      const reader = request.body?.getReader(), chunks: Uint8Array[] = []; let size = 0;
      if (reader) while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength; if (size > 256) { await reader.cancel(); return json({ error: '请求内容过大。' }, 413); }
        chunks.push(part.value);
      }
      const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const body = new TextDecoder().decode(bytes);
      let input: { id?: unknown }; try { input = JSON.parse(body); } catch { return json({ error: 'JSON 格式错误。' }, 400); }
      if (!input || typeof input.id !== 'string' || !UUID.test(input.id)) return json({ error: '访问记录格式错误。' }, 400);
      await initialize(env.DB);
      await env.DB.prepare('INSERT OR IGNORE INTO site_visit_events (id,created_at) VALUES (?,?)').bind(input.id, Date.now()).run();
    } else await initialize(env.DB);
    const row = await env.DB.prepare('SELECT visits,started_at FROM site_visit_total WHERE id=1').first();
    return json({ visits: Number(row.visits), startedAt: row.started_at, updatedAt: new Date().toISOString(), metric: 'pageviews' });
  } catch { return json({ error: '访问量暂不可用，请稍后重试。' }, 503); }
}
