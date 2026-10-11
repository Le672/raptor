const PREFIX = 'yukino-speed:run:';
export async function fetchApi(bases, path, options = {}) {
  const addresses = [...new Set(Array.isArray(bases) ? bases : [bases])];
  let failure;
  for (const address of addresses) {
    try {
      const response = await fetch(address + path, { ...options, signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) });
      if (response.status >= 500) throw new Error(`统计接口 HTTP ${response.status}`);
      return response;
    } catch (error) { if (options.signal?.aborted) throw error; failure = error; }
  }
  throw failure;
}
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
    const identityKey = 'yukino-speed:identity:' + state.id;
    let previous = {};
    try { previous = JSON.parse(this.storage.getItem(key) || '{}'); } catch { /* recover */ }
    const token = this.storage.getItem(identityKey) || previous.token || crypto.randomUUID() + crypto.randomUUID();
    // Acknowledging a checkpoint removes the queue entry, never the task identity.
    this.storage.setItem(identityKey, token);
    this.storage.setItem(key, JSON.stringify({ ...previous, id: state.id, token, bytes: state.bytes,
      durationMs: Math.round(state.elapsedMs), finished: !['running', 'paused'].includes(state.status) }));
  }
  async request(path, body) {
    const response = await fetchApi(this.api, path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) { const error = new Error(result.error || `统计接口 HTTP ${response.status}`); error.status = response.status; error.data = result; throw error; }
    return result;
  }
  async flush() {
    if (this.busy) return;
    this.busy = true;
    try {
      const keys = Object.keys(this.storage).filter(key => key.startsWith('yukino-speed:report:'));
      let failure, lastResult;
      for (const key of keys) {
        try {
          const item = JSON.parse(this.storage.getItem(key) || 'null'); if (!item) continue;
          try { await this.request('/session', { id: item.id, token: item.token }); }
          catch (error) {
            // v1.0.0 could lose a secret after acknowledgement. Reconcile only data
            // the server already received; never recreate an ID or add duplicate bytes.
            const ack = error.status === 409 && error.data?.acknowledged;
            if (!ack || !Number.isSafeInteger(ack.bytes) || !Number.isSafeInteger(ack.durationMs) || typeof ack.finished !== 'boolean' || ack.bytes < item.bytes || ack.durationMs < item.durationMs || (item.finished && !ack.finished)) throw error;
            const current = JSON.parse(this.storage.getItem(key) || 'null');
            if (current && current.bytes === item.bytes && current.durationMs === item.durationMs && current.finished === item.finished) this.storage.removeItem(key);
            continue;
          }
          lastResult = await this.request('/report', item);
          const current = JSON.parse(this.storage.getItem(key) || 'null');
          if (current && current.bytes === item.bytes && current.durationMs === item.durationMs && current.finished === item.finished) this.storage.removeItem(key);
        } catch (error) { failure = error; }
      }
      if (keys.length) this.onResult(failure ? { ok: false, error: failure.message } : { ok: true, ...lastResult });
    } catch (error) { this.onResult({ ok: false, error: error.message }); }
    finally { this.busy = false; }
  }
}
