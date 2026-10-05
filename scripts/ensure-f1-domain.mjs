// Uses existing GitHub Actions deployment secrets. Never prints credentials.
import { appendFile } from "node:fs/promises";
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!accountId || !token) throw new Error("Cloudflare deployment secrets are missing");
const domainName = "f1.yukino.bond";
const root = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/raptor`;
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Cloudflare API failed (${response.status}): ${JSON.stringify(data.errors || [])}`);
  return data.result;
}
const [project, domains] = await Promise.all([request(root), request(`${root}/domains`)]);
if (!Array.isArray(domains) || typeof project.subdomain !== "string" || !project.subdomain.endsWith(".pages.dev")) throw new Error("Unexpected Cloudflare project/domain response");
let domain = domains.find((item) => item.name === domainName);
if (!domain) { domain = await request(`${root}/domains`, { method: "POST", body: JSON.stringify({ name: domainName }) }); console.log(`Attached ${domainName} to Pages project raptor`); }
else console.log(`${domainName} is already attached`);
if (domain.status === "active") console.log(`${domainName} is active in Cloudflare Pages; existing DNS was preserved`);
else {
  try {
    let zoneId = domain?.zone_tag || domains.find((item) => item.name.endsWith(".yukino.bond") && item.zone_tag)?.zone_tag;
    if (!zoneId) { const zones = await request("https://api.cloudflare.com/client/v4/zones?name=yukino.bond"); zoneId = Array.isArray(zones) ? zones.find((item) => item.name === "yukino.bond")?.id : undefined; }
    if (!zoneId) throw new Error("Cannot resolve yukino.bond zone; Zone Read and DNS Edit permissions are required");
    const dns = `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/dns_records`;
    let records;
    try { records = await request(`${dns}?name=${encodeURIComponent(domainName)}`); }
    catch { records = []; } // DNS Edit-only tokens can safely create a missing record.
    if (!Array.isArray(records)) throw new Error("Unexpected DNS response");
    if (!records.length) { await request(dns, { method: "POST", body: JSON.stringify({ type: "CNAME", name: domainName, content: project.subdomain, proxied: true }) }); console.log(`Created ${domainName} CNAME -> ${project.subdomain}`); }
    else if (records.length !== 1 || records[0].type !== "CNAME" || records[0].content !== project.subdomain) throw new Error(`${domainName} already has a different DNS record; it was preserved`);
    else console.log(`${domainName} DNS already points to ${project.subdomain}`);
    console.log("F1 domain and DNS configured. TLS availability is verified separately after deployment.");
  } catch (error) {
    if (!/Cloudflare API failed \(403\)|Cannot resolve yukino.bond zone/.test(String(error))) throw error;
    const note = `F1 pages were published and the custom domain is attached, but DNS permissions are missing. Add a proxied CNAME: ${domainName} -> ${project.subdomain}. The main site /f1 remains available.`;
    console.warn(`::warning::${note}`);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n### F1 domain needs DNS configuration\n\n${note}\n`);
  }
}
