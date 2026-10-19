import { mkdir, readFile, writeFile } from 'node:fs/promises';
const token = process.env.CLOUDFLARE_API_TOKEN, account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account) throw new Error('Cloudflare deployment credentials are missing');
const api = 'https://api.cloudflare.com/client/v4';
async function request(path, method = 'GET', body) {
  const response = await fetch(api + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(`Cloudflare infrastructure request failed (${response.status}): ${JSON.stringify(result.errors || [])}`);
  return result.result;
}
const list = await request(`/accounts/${account}/storage/kv/namespaces?per_page=100`);
const namespace = list.find(x => x.title === 'yukino-novel-cache') || await request(`/accounts/${account}/storage/kv/namespaces`, 'POST', { title: 'yukino-novel-cache' });
if (!namespace?.id) throw new Error('Cannot create or locate the dedicated novel cache');
const config = JSON.parse(await readFile('novel/wrangler.jsonc', 'utf8'));
config.kv_namespaces[0].id = namespace.id;
config.main = '../server/worker.mjs'; config.assets.directory = '../dist';
try {
  const domains = await request(`/accounts/${account}/pages/projects/raptor/domains`);
  const zoneId = domains.find(x => x.name.endsWith('.yukino.bond') && x.zone_tag)?.zone_tag;
  if (zoneId) config.routes[0].zone_id = zoneId;
} catch { /* Wrangler can resolve the zone from the custom domain. */ }
await mkdir('novel/.deploy', { recursive: true });
await writeFile('novel/.deploy/wrangler.json', JSON.stringify(config, null, 2));
console.log('Dedicated novel cache and deployment configuration are ready.');
