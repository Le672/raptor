const PREFIX = 'yukino-speed:run:';
export function saveRun(state, storage = globalThis.localStorage) {
  if (!state.id) return;
  const { history, workers, ...record } = state;
  storage.setItem(PREFIX + state.id, JSON.stringify(record));
}
export function readRuns(storage = globalThis.localStorage) {
  const records = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    try { const entry = JSON.parse(storage.getItem(key)); if (entry.id && Number.isFinite(entry.bytes) && entry.bytes >= 0) records.push(entry); } catch { /* malformed local record */ }
  }
  return records.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}
export class Reporter {
  constructor(api, onResult = (result) => {}, storage = globalThis.localStorage) { this.api = api; this.onResult = onResult; this.storage = storage; this.busy = false; }
  enqueue(state) {
    if (!state.id || !state.bytes) return;
    const key = 'yukino-speed:report:' + state.id;
    let previous = {};
    try { previous = JSON.parse(this.storage.getItem(key) || '{}'); } catch { /* recover */ }
    this.storage.setItem(key, JSON.stringify({ ...previous, id: state.id, token: previous.token || crypto.randomUUID() + crypto.randomUUID(), bytes: state.bytes,
      durationMs: Math.round(state.elapsedMs), finished: !['running', 'paused'].includes(state.status) }));
  }
  async request(path, body) {
    const response = await fetch(this.api + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || `统计接口 HTTP ${response.status}`); return result;
  }
  async flush() {
    if (this.busy) return;
    this.busy = true;
    try {
      const keys = Object.keys(this.storage).filter(key => key.startsWith('yukino-speed:report:'));
      for (const key of keys) {
        const item = JSON.parse(this.storage.getItem(key) || 'null'); if (!item) continue;
        await this.request('/session', { id: item.id, token: item.token });
        const result = await this.request('/report', item);
        const current = JSON.parse(this.storage.getItem(key) || 'null');
        if (current && current.bytes === item.bytes && current.finished === item.finished) this.storage.removeItem(key);
        this.onResult({ ok: true, ...result });
      }
    } catch (error) { this.onResult({ ok: false, error: error.message }); }
    finally { this.busy = false; }
  }
}
