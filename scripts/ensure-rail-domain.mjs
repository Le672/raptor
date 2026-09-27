const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!accountId || !token) throw new Error("Cloudflare deployment secrets are missing");

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/raptor/domains`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(`Cloudflare domain API failed (${response.status}): ${JSON.stringify(payload.errors || [])}`);
  }
  return payload.result;
}

const domains = await request(endpoint);
if (!Array.isArray(domains)) throw new Error("Cloudflare returned an unexpected domain list");
let railDomain = domains.find((domain) => domain.name === "cr.yukino.bond");
if (!railDomain) {
  railDomain = await request(endpoint, { method: "POST", body: JSON.stringify({ name: "cr.yukino.bond" }) });
  console.log("Requested cr.yukino.bond for Pages project raptor");
} else {
  console.log("cr.yukino.bond is already attached to Pages project raptor");
}

try {
  let zoneId = railDomain?.zone_tag || domains.find((domain) => domain.name.endsWith(".yukino.bond") && domain.zone_tag)?.zone_tag;
  if (!zoneId) {
    const zones = await request("https://api.cloudflare.com/client/v4/zones?name=yukino.bond");
    zoneId = Array.isArray(zones) ? zones.find((item) => item.name === "yukino.bond")?.id : undefined;
  }
  if (!zoneId) throw new Error("Cloudflare token cannot read the yukino.bond zone");
  const dnsEndpoint = `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/dns_records`;
  let records;
  try {
    records = await request(`${dnsEndpoint}?name=cr.yukino.bond`);
  } catch {
    // A token can have DNS Edit without DNS Read. Creating an existing record
    // fails safely; it never replaces it.
    records = [];
  }
  if (!Array.isArray(records)) throw new Error("Cloudflare returned an unexpected DNS record list");
  if (records.length === 0) {
    await request(dnsEndpoint, {
      method: "POST",
      body: JSON.stringify({
        type: "CNAME", name: "cr.yukino.bond", content: "raptor.pages.dev", proxied: true,
      }),
    });
    console.log("Created cr.yukino.bond CNAME for raptor.pages.dev");
  } else if (records.length !== 1 || records[0].type !== "CNAME" || records[0].content !== "raptor.pages.dev") {
    throw new Error("cr.yukino.bond has a different DNS record; refusing to replace it");
  } else {
    console.log("cr.yukino.bond CNAME already points to raptor.pages.dev");
  }
} catch (cause) {
  console.warn(`Pages was deployed, but DNS still needs Zone Read and DNS Edit permissions: ${cause instanceof Error ? cause.message : String(cause)}`);
}
