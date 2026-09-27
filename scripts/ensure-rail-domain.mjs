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
if (!domains.some((domain) => domain.name === "cr.yukino.bond")) {
  await request(endpoint, { method: "POST", body: JSON.stringify({ name: "cr.yukino.bond" }) });
  console.log("Requested cr.yukino.bond for Pages project raptor");
} else {
  console.log("cr.yukino.bond is already attached to Pages project raptor");
}
