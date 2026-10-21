// Preserve the live mailbox's storage, email and service bindings. A stale
// template must never silently detach its R2 bucket or change private settings.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
async function get(path) {
  const token = process.env.CLOUDFLARE_API_TOKEN, account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) throw new Error('Cloudflare deployment credentials are required');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/webmail${path}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Unable to inspect live mailbox configuration (HTTP ${response.status})`);
  return data.result;
}
export function buildMailConfig(settings, schedule, source = resolve('mailbox/mail-worker')) {
const config = {
  name: 'webmail', main: `${source}/src/index.js`, compatibility_date: settings.compatibility_date || '2025-06-04',
  keep_vars: true, workers_dev: true,
  assets: { binding: 'assets', directory: `${source}/dist`, not_found_handling: 'single-page-application', run_worker_first: true },
  // Omit routes: this is an existing deployment; keep all dashboard HTTP aliases.
  observability: { enabled: true },
};
if (settings.compatibility_flags?.length) config.compatibility_flags = settings.compatibility_flags;
const append = (key, entry) => (config[key] ||= []).push(entry);
const safeBindings = [];
for (const binding of settings.bindings || []) {
  const name = binding.name;
  switch (binding.type) {
    case 'plain_text': case 'json': case 'secret_text': break; // keep-vars; never log/copy their values.
    case 'assets':
      if (name !== 'assets') throw new Error('Unexpected live assets binding; review before deploying');
      break;
    case 'kv_namespace': append('kv_namespaces', { binding: name, id: binding.namespace_id }); break;
    case 'd1': append('d1_databases', { binding: name, database_id: binding.id, database_name: name }); break;
    case 'r2_bucket': append('r2_buckets', { binding: name, bucket_name: binding.bucket_name, ...(binding.jurisdiction ? { jurisdiction: binding.jurisdiction } : {}) }); break;
    case 'ai': config.ai = { binding: name }; break;
    case 'send_email': append('send_email', { name, ...(binding.destination_address ? { destination_address: binding.destination_address } : {}), ...(binding.allowed_destination_addresses ? { allowed_destination_addresses: binding.allowed_destination_addresses } : {}), ...(binding.allowed_sender_addresses ? { allowed_sender_addresses: binding.allowed_sender_addresses } : {}) }); break;
    case 'service': append('services', { binding: name, service: binding.service, ...(binding.environment ? { environment: binding.environment } : {}), ...(binding.entrypoint ? { entrypoint: binding.entrypoint } : {}) }); break;
    case 'analytics_engine': append('analytics_engine_datasets', { binding: name, dataset: binding.dataset }); break;
    case 'version_metadata': config.version_metadata = { binding: name }; break;
    default: throw new Error(`Unsupported live binding type ${binding.type}; refusing to detach it`);
  }
  if (!['plain_text', 'json', 'secret_text'].includes(binding.type)) safeBindings.push({ name, type: binding.type });
}
if (!config.d1_databases?.some(binding => binding.binding === 'db' && binding.database_id) || !config.kv_namespaces?.some(binding => binding.binding === 'kv' && binding.id)) {
  throw new Error('The live mailbox database/cache bindings are incomplete; refusing to deploy');
}
const current = Array.isArray(schedule) ? schedule : schedule.schedules;
if (!Array.isArray(current)) throw new Error('Cannot determine the live mailbox maintenance schedule');
// The half-hour statistics rewrite is retired; preserve other maintenance.
config.triggers = { crons: current.map(item => item.cron).filter(cron => cron !== '*/30 * * * *') };
if (!config.triggers.crons.length) config.triggers.crons.push('0 16 * * *');
return { config, safeBindings };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
const settings = await get('/settings'), schedule = await get('/schedules');
const { config, safeBindings } = buildMailConfig(settings, schedule);
await mkdir('.wrangler/mail-deploy', { recursive: true });
await writeFile('.wrangler/mail-deploy/wrangler.json', JSON.stringify(config, null, 2));
console.log(JSON.stringify({ mailbox: 'webmail', bindings: safeBindings, crons: config.triggers.crons, vars: 'preserved without copying values' }));
}
