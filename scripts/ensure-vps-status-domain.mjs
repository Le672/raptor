// Detach only the public status alias after the independent VPS is verified.
const account = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) throw new Error('Existing Pages deployment credentials are required');
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/raptor/domains`;
async function api(url, method = 'GET') {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Status domain metadata request failed (HTTP ${response.status})`);
  return data.result;
}
const domains = await api(endpoint), old = domains.find(item => item.name === 'status.yukino.bond');
if (!old) console.log('Status domain is already independent of Pages.');
else {
  const probe = await fetch('https://content-check.yukino.bond/__health', { redirect: 'error', signal: AbortSignal.timeout(15000) });
  const health = await probe.json();
  if (!probe.ok || probe.headers.get('X-Yukino-Origin') !== 'vps-content' || health.site !== 'status') throw new Error('Status VPS is not ready; the Pages domain was preserved');
  const report = await fetch('https://content-check.yukino.bond/api/status', { signal: AbortSignal.timeout(20000) });
  if (!report.ok || !Array.isArray((await report.json()).services)) throw new Error('Status detection is unavailable; the Pages domain was preserved');
  console.log(JSON.stringify({ statusDomainBefore: { name: old.name, id: old.id, zone_tag: old.zone_tag, status: old.status }, project: 'raptor' }));
  await api(endpoint + '/status.yukino.bond', 'DELETE');
  console.log('Detached only status.yukino.bond; VPS tunnel ingress is ready for its DNS cutover.');
}
