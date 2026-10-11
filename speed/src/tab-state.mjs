const KEY = 'yukino-speed:active-tab:v1';
export const resumable = state => !!state?.id && ['running', 'paused', 'recovering'].includes(state.status);
export function saveTab(state, storage = globalThis.sessionStorage) {
  if (resumable(state)) storage.setItem(KEY, JSON.stringify(state));
  else storage.removeItem(KEY);
}
export function readTab(storage = globalThis.sessionStorage, records = []) {
  let cached;
  try { cached = JSON.parse(storage.getItem(KEY) || 'null'); } catch { return null; }
  if (!resumable(cached)) return null;
  const latest = records.find(record => record.id === cached.id);
  if (latest && (latest.bytes > cached.bytes || latest.elapsedMs >= cached.elapsedMs)) {
    if (!resumable(latest)) { storage.removeItem(KEY); return null; }
    return { ...cached, ...latest };
  }
  return cached;
}
