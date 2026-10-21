// A scheduled catalog refresh writes one bounded record for the whole Worker.
// Inner timestamps, rather than the outer KV TTL, determine fallback freshness.
export const HOME_SNAPSHOT_KEY = 'home-snapshot:v2';
export const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
const STALE_MS = 7 * 86400000;

export function usableBundle(bundle, source, now = Date.now()) {
  const parts = Array.isArray(bundle?.parts) ? bundle.parts.filter(part =>
    typeof part?.key === 'string' && part.key.startsWith(`catalog:v1:${source}:`) &&
    Number.isFinite(part.entry?.time) && part.entry.time > 0 && part.entry.time <= now && now - part.entry.time < STALE_MS &&
    Array.isArray(part.entry.value?.items) && Number.isFinite(part.entry.value.pagecount)
  ) : [];
  return parts.length ? { parts } : null;
}

export async function readHomeSnapshot(cache, sources) {
  const bundles = new Map();
  if (!cache) return bundles;
  let snapshot;
  try { snapshot = await cache.get(HOME_SNAPSHOT_KEY, 'json'); } catch { /* Live sources remain available. */ }
  await Promise.all(sources.map(async source => {
    let bundle = usableBundle(snapshot?.sources?.[source.id], source.id);
    // Keep source bundles from the earlier deployment readable during migration.
    if (!bundle) {
      try { bundle = usableBundle(await cache.get(`home:v1:${source.id}`, 'json'), source.id); } catch { /* Optional fallback. */ }
    }
    if (bundle) bundles.set(source.id, bundle);
  }));
  return bundles;
}

export function retainParts(bundles, source, parts) {
  const merged = new Map((usableBundle(bundles.get(source), source)?.parts || []).map(part => [part.key, part]));
  for (const part of parts) merged.set(part.key, part);
  const bundle = usableBundle({ parts: [...merged.values()] }, source);
  if (bundle) bundles.set(source, bundle); else bundles.delete(source);
}

export async function writeHomeSnapshot(cache, bundles, hasFreshData) {
  if (!cache || !hasFreshData) return false;
  const sources = Object.create(null);
  for (const [source, saved] of bundles) {
    const bundle = usableBundle(saved, source);
    if (bundle) sources[source] = bundle;
  }
  if (!Object.keys(sources).length) return false;
  const text = JSON.stringify({ version: 2, sources });
  if (new TextEncoder().encode(text).byteLength > MAX_SNAPSHOT_BYTES) {
    console.warn('Catalog snapshot exceeds 8 MiB; keeping the previous snapshot without writing KV.');
    return false;
  }
  try { await cache.put(HOME_SNAPSHOT_KEY, text, { expirationTtl: 604800 }); return true; }
  catch { console.warn('Catalog snapshot could not be saved; live results remain available.'); return false; }
}
