import { randomBytes } from "node:crypto";

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !accountId) throw new Error("Cloudflare deployment credentials are required");
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/raptor`;

async function request(method, body) {
  const response = await fetch(endpoint, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Unable to configure portal authentication (HTTP ${response.status})`);
  return data.result;
}

const project = await request("GET");
const production = project.deployment_configs.production;
if (production.env_vars?.JWT_SECRET?.type === "secret_text") {
  console.log("Portal signing secret is already configured; preserving it.");
} else {
  await request("PATCH", { deployment_configs: { production: {
    env_vars: { JWT_SECRET: { type: "secret_text", value: randomBytes(48).toString("base64url") } },
    wrangler_config_hash: production.wrangler_config_hash,
  } } });
  console.log("Configured a private portal signing secret.");
}
