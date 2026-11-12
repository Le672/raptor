// Read-only account inventory and KV analytics. Never read keys or print settings,
// environment variables, secret/plain_text bindings, tokens, or raw API errors.
// Analytics schema: https://developers.cloudflare.com/kv/observability/metrics-analytics/
import { pathToFileURL } from 'node:url';

const API = 'https://api.cloudflare.com/client/v4';
const QUERY = `query KvOperationsSample($accountTag: string!, $namespaceId: string, $start: Date, $end: Date) {
  viewer { accounts(filter: { accountTag: $accountTag }) {
    kvOperationsAdaptiveGroups(filter: { namespaceId: $namespaceId, date_geq: $start, date_leq: $end }, limit: 100, orderBy: [date_DESC]) {
      sum { requests } dimensions { date actionType }
    }
  } }
}`;
const safeText = (value, maximum = 128) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maximum) : '';
const namespaceId = value => typeof value === 'string' && /^[a-f0-9]{32}$/i.test(value) ? value : null;
const failure = (reason, status) => ({ state: 'unavailable', reason, ...(Number.isInteger(status) ? { httpStatus: status } : {}) });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function batches(values, callback) {
  const output = [];
  for (let index = 0; index < values.length; index += 4) output.push(...await Promise.all(values.slice(index, index + 4).map(callback)));
  return output;
}

export async function auditCloudflareKV({
  token = process.env.CLOUDFLARE_API_TOKEN,
  account = process.env.CLOUDFLARE_ACCOUNT_ID,
  fetcher = fetch,
  now = new Date(),
  log = value => console.log(JSON.stringify(value)),
  sleep = pause,
} = {}) {
  if (!token || !/^[a-f0-9]{32}$/i.test(account || '')) {
    log({ type: 'audit', ...failure('cloudflare-credentials-unavailable') });
    return { state: 'unavailable' };
  }
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  log({ type: 'audit', state: 'started', mode: 'read-only', timezone: 'UTC', start: yesterday, end: today, generatedAt: now.toISOString() });

  async function request(path, body) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetcher(`${API}${path}`, {
          method: body ? 'POST' : 'GET',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
          body: body ? JSON.stringify(body) : undefined,
          redirect: 'error', signal: AbortSignal.timeout(20000),
        });
      } catch {
        if (attempt < 2) { await sleep(500 * 2 ** attempt); continue; }
        return failure('network-or-timeout');
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await response.body?.cancel().catch(() => {});
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        return failure(response.status === 401 || response.status === 403 ? 'api-permission-unavailable' : 'api-http-error', response.status);
      }
      try { return { state: 'available', data: await response.json() }; }
      catch { return failure('invalid-api-json', response.status); }
    }
    return failure('request-unavailable');
  }

  async function inventory(path) {
    const items = [], seen = new Set();
    for (let page = 1; page <= 100; page++) {
      const response = await request(`${path}?per_page=100&page=${page}`);
      if (response.state !== 'available') return { ...response, items, complete: false };
      if (response.data?.success !== true || !Array.isArray(response.data.result)) return { ...failure('inventory-api-unavailable'), items, complete: false };
      const rows = response.data.result;
      let added = 0;
      for (const row of rows) {
        if (typeof row?.id !== 'string' || seen.has(row.id)) continue;
        seen.add(row.id); items.push(row); added++;
      }
      const pages = response.data.result_info?.total_pages;
      const total = response.data.result_info?.total_count;
      if (Number.isInteger(pages) && page < pages) continue;
      if (Number.isInteger(total) && seen.size < total) {
        if (!added) return { ...failure('inventory-pagination-unavailable'), items, complete: false };
        continue;
      }
      if (response.data.result_info?.cursor) return { ...failure('inventory-cursor-pagination-unavailable'), items, complete: false };
      // Workers list APIs may return every script without pagination metadata.
      // Namespaces use page/per_page; duplicate pages are never assumed complete.
      if (Number.isInteger(pages) || !rows.length || (!path.endsWith('/namespaces')) || rows.length < 100) return { state: 'available', items, complete: true };
      if (!added) return { ...failure('inventory-pagination-unavailable'), items, complete: false };
    }
    return { ...failure('inventory-page-limit-reached'), items, complete: false };
  }

  const base = `/accounts/${account}`;
  const [workerInventory, namespaceInventory] = await Promise.all([
    inventory(`${base}/workers/scripts`), inventory(`${base}/storage/kv/namespaces`),
  ]);
  const workers = workerInventory.items.map(row => ({ name: safeText(row.id) })).filter(row => row.name);
  const namespaces = namespaceInventory.items.map(row => ({ id: namespaceId(row.id), title: safeText(row.title) })).filter(row => row.id);
  log({ type: 'workerInventory', state: workerInventory.state, complete: workerInventory.complete, count: workers.length, ...(workerInventory.reason ? { reason: workerInventory.reason, httpStatus: workerInventory.httpStatus } : {}) });
  log({ type: 'namespaceInventory', state: namespaceInventory.state, complete: namespaceInventory.complete, count: namespaces.length, ...(namespaceInventory.reason ? { reason: namespaceInventory.reason, httpStatus: namespaceInventory.httpStatus } : {}) });

  const details = await batches(workers.flatMap(worker => [
    { name: worker.name, kind: 'schedules' }, { name: worker.name, kind: 'settings' },
  ]), async item => {
    const response = await request(`${base}/workers/scripts/${encodeURIComponent(item.name)}/${item.kind}`);
    if (response.state !== 'available') return { ...item, result: response };
    if (response.data?.success !== true) return { ...item, result: failure('worker-metadata-api-unavailable') };
    if (item.kind === 'schedules') {
      const schedules = response.data.result?.schedules;
      if (!Array.isArray(schedules)) return { ...item, result: failure('schedule-metadata-unavailable') };
      return { ...item, result: { state: 'available', crons: schedules.map(row => safeText(row?.cron, 100)).filter(Boolean) } };
    }
    const bindings = response.data.result?.bindings;
    if (!Array.isArray(bindings)) return { ...item, result: failure('binding-metadata-unavailable') };
    return { ...item, result: { state: 'available', kvBindings: bindings.filter(row => row?.type === 'kv_namespace').map(row => ({
      type: 'kv_namespace', name: safeText(row.name), namespaceId: namespaceId(row.namespace_id),
    })) } };
  });
  const references = new Map(namespaces.map(row => [row.id, []]));
  for (const worker of workers) {
    const schedules = details.find(row => row.name === worker.name && row.kind === 'schedules')?.result || failure('schedule-metadata-unavailable');
    const settings = details.find(row => row.name === worker.name && row.kind === 'settings')?.result || failure('binding-metadata-unavailable');
    for (const binding of settings.kvBindings || []) {
      if (!binding.namespaceId) continue;
      if (!references.has(binding.namespaceId)) references.set(binding.namespaceId, []);
      references.get(binding.namespaceId).push({ worker: worker.name, binding: binding.name });
    }
    log({ type: 'worker', name: worker.name, schedules, settings });
  }
  for (const item of namespaces) log({ type: 'namespace', id: item.id, title: item.title, workers: references.get(item.id) || [] });

  const analytics = await batches([...references.keys()], async id => {
    const response = await request('/graphql', { query: QUERY, variables: { accountTag: account, namespaceId: id, start: yesterday, end: today } });
    if (response.state !== 'available') return { type: 'kvOperations', namespaceId: id, start: yesterday, end: today, ...response, usage: null };
    // Never interpret missing permissions, errors, or absent data as zero usage.
    if (response.data?.errors?.length) return { type: 'kvOperations', namespaceId: id, start: yesterday, end: today, ...failure('analytics-unavailable-check-account-analytics-permission'), usage: null };
    const accounts = response.data?.data?.viewer?.accounts;
    const rows = Array.isArray(accounts) && accounts.length === 1 ? accounts[0]?.kvOperationsAdaptiveGroups : null;
    if (!Array.isArray(rows)) return { type: 'kvOperations', namespaceId: id, start: yesterday, end: today, ...failure('analytics-data-unavailable'), usage: null };
    const usage = rows.map(row => ({
      date: row?.dimensions?.date,
      actionType: safeText(row?.dimensions?.actionType, 40),
      requests: row?.sum?.requests,
    }));
    if (usage.some(row => ![yesterday, today].includes(row.date) || !row.actionType || typeof row.requests !== 'number' || !Number.isFinite(row.requests) || row.requests < 0)) {
      return { type: 'kvOperations', namespaceId: id, start: yesterday, end: today, ...failure('analytics-record-format-unavailable'), usage: null };
    }
    return { type: 'kvOperations', namespaceId: id, start: yesterday, end: today, state: 'available', coverage: usage.length ? 'returned-date-action-groups-only' : 'no-rows-returned-usage-not-assumed-zero', usage };
  });
  for (const item of analytics) log(item);
  const complete = workerInventory.complete && namespaceInventory.complete && details.every(row => row.result.state === 'available') && analytics.every(row => row.state === 'available');
  const summary = {
    type: 'auditSummary', state: complete ? 'complete' : 'partial',
    workers: workers.length, namespacesInventoried: namespaces.length, namespacesQueried: analytics.length,
    analyticsAvailable: analytics.filter(row => row.state === 'available').length,
    analyticsUnavailable: analytics.filter(row => row.state !== 'available').length,
    note: 'UTC today is partial; metrics can be delayed. Missing rows or permissions are not zero usage. No keys, schedules, or settings were modified.',
  };
  log(summary);
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await auditCloudflareKV();
    if (result.state === 'unavailable') process.exitCode = 1;
  } catch {
    console.log(JSON.stringify({ type: 'audit', ...failure('audit-unexpected-failure-no-sensitive-details-logged') }));
    process.exitCode = 1;
  }
}
