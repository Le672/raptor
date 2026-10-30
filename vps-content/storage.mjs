import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

// The binding contract stays compatible with the content applications, but all
// bytes live on the VPS. No request is forwarded to Cloudflare KV or Cache API.
export class ContentStorage {
  constructor(directory, { maxCacheBytes = 128 * 1024 * 1024, now = Date.now } = {}) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.now = now;
    this.maxCacheBytes = maxCacheBytes;
    this.db = new DatabaseSync(join(directory, 'storage.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER);
      CREATE TABLE IF NOT EXISTS responses (key TEXT PRIMARY KEY, status INTEGER NOT NULL,
        headers TEXT NOT NULL, body BLOB NOT NULL, expires INTEGER NOT NULL, touched INTEGER NOT NULL);`);
  }
  async get(key, options) {
    const row = this.db.prepare('SELECT value, expires FROM kv WHERE key=?').get(key);
    if (!row || (row.expires && row.expires <= this.now())) return null;
    return (typeof options === 'string' ? options : options?.type) === 'json' ? JSON.parse(row.value) : row.value;
  }
  async put(key, value, options = {}) {
    if (typeof value !== 'string' || Buffer.byteLength(value) > 25 * 1024 * 1024) throw new Error('Invalid local cache value');
    const expires = options.expiration ? options.expiration * 1000 : options.expirationTtl ? this.now() + options.expirationTtl * 1000 : null;
    this.db.prepare('INSERT OR REPLACE INTO kv(key,value,expires) VALUES(?,?,?)').run(key, value, expires);
  }
  async match(request) {
    if (request.method !== 'GET') return undefined;
    const row = this.db.prepare('SELECT * FROM responses WHERE key=? AND expires>?').get(request.url, this.now());
    if (!row) return undefined;
    const headers = new Headers(JSON.parse(row.headers));
    headers.set('Cache-Control', `public, max-age=${Math.max(0, Math.floor((row.expires - this.now()) / 1000))}`);
    return new Response(row.body, { status: row.status, headers });
  }
  async cachePut(request, response) {
    const control = response.headers.get('Cache-Control') || '';
    const ttl = Number(control.match(/(?:^|[,\s])(?:s-maxage|max-age)=(\d+)/i)?.[1] || 0);
    if (request.method !== 'GET' || response.status !== 200 || !ttl || /no-store|private/i.test(control) || response.headers.has('set-cookie') || response.headers.get('Vary') === '*') return;
    const maximum = 12 * 1024 * 1024;
    if (Number(response.headers.get('Content-Length')) > maximum) { await response.body?.cancel(); return; }
    const reader = response.body?.getReader(), parts = [];
    let length = 0;
    if (reader) for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) { await reader.cancel(); return; }
      parts.push(Buffer.from(value));
    }
    const headers = new Headers(response.headers);
    headers.delete('Content-Encoding'); headers.delete('Content-Length');
    this.db.prepare('INSERT OR REPLACE INTO responses VALUES(?,?,?,?,?,?)').run(request.url, response.status,
      JSON.stringify([...headers]), Buffer.concat(parts), this.now() + Math.min(ttl, 30 * 86400) * 1000, this.now());
    this.prune();
  }
  prune() {
    this.db.prepare('DELETE FROM responses WHERE expires<=?').run(this.now());
    this.db.prepare('DELETE FROM kv WHERE expires IS NOT NULL AND expires<=?').run(this.now());
    let total = this.db.prepare('SELECT coalesce(sum(length(body)),0) AS size FROM responses').get().size;
    if (total > this.maxCacheBytes) for (const row of this.db.prepare('SELECT key,length(body) AS size FROM responses ORDER BY touched').all()) {
      this.db.prepare('DELETE FROM responses WHERE key=?').run(row.key); total -= row.size;
      if (total <= this.maxCacheBytes) break;
    }
  }
  stats() {
    return { entries: this.db.prepare('SELECT count(*) AS count FROM kv WHERE expires IS NULL OR expires>?').get(this.now()).count,
      responseBytes: this.db.prepare('SELECT coalesce(sum(length(body)),0) AS size FROM responses').get().size };
  }
  databaseBinding() {
    const db = this.db;
    return { prepare(sql) {
      const statement = db.prepare(sql);
      function bound(values = []) { return {
        bind: (...next) => bound(next),
        async first() { return statement.get(...values) || null; },
        async all() { return { results: statement.all(...values), success: true }; },
        async run() { const result = statement.run(...values); return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }; },
      }; }
      return bound();
    } };
  }
  close() { this.db.close(); }
}
