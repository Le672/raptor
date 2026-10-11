const accountId = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
if (!accountId || !token) throw new Error('Cloudflare deployment secrets are missing');
const root = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}`;
export async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Cloudflare API ${response.status}: ${JSON.stringify(data.errors || [])}`);
  return data.result;
}
if (process.argv.includes('--domain')) {
  const project = await request(root + '/pages/projects/yukino-speed');
  const domains = await request(root + '/pages/projects/yukino-speed/domains');
  const name = 'speed.yukino.bond'; let domain = domains.find(item => item.name === name);
  if (!domain) domain = await request(root + '/pages/projects/yukino-speed/domains', { method: 'POST', body: JSON.stringify({ name }) });
  if (domain.status !== 'active') {
    const zones = await request('https://api.cloudflare.com/client/v4/zones?name=yukino.bond');
    const zoneId = domain.zone_tag || zones.find(zone => zone.name === 'yukino.bond')?.id;
    if (!zoneId) throw new Error('Missing yukino.bond DNS permissions');
    const endpoint = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
    const records = await request(endpoint + '?name=' + encodeURIComponent(name));
    if (!records.length) await request(endpoint, { method: 'POST', body: JSON.stringify({ type: 'CNAME', name, content: project.subdomain, proxied: true }) });
    else if (records.length !== 1 || records[0].type !== 'CNAME' || records[0].content !== project.subdomain) throw new Error('speed.yukino.bond has a conflicting DNS record; it was preserved');
  }
  console.log(`Configured ${name} -> ${project.subdomain}; current Pages status: ${domain.status}`);
} else {
  const projects = await request(root + '/pages/projects');
  if (!projects.some(project => project.name === 'yukino-speed')) await request(root + '/pages/projects', { method: 'POST', body: JSON.stringify({ name: 'yukino-speed', production_branch: 'master' }) });
  console.log('Yukino Speed Pages project is ready. The API initializes its durable traffic tables through the bound D1 database.');
}
