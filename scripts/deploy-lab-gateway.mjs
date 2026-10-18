// Uses the same deployment token as Pages. Worker Custom Domains are managed
// through the supported Workers API, without requesting wider DNS permissions.
import { readFile } from "node:fs/promises";
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) throw new Error("Existing Cloudflare deployment secrets are missing");
const name = "yukino-lab-gateway";
const root = `/accounts/${encodeURIComponent(account)}/workers/scripts/${name}`;
const domains = ["drop.yukino.bond", "draw.yukino.bond", "tools.yukino.bond"];
async function request(path, operation, method = "GET", body) {
  const form = body instanceof FormData;
  const response = await fetch("https://api.cloudflare.com/client/v4" + path, {
    method, headers: { Authorization: `Bearer ${token}`, ...(form ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`${operation} failed (HTTP ${response.status}; Cloudflare codes ${(data.errors || []).map(error => error.code).join(",")})`);
  return data.result;
}
const zones = await request("/zones?name=yukino.bond", "Read Yukino zone");
const zone = zones.find(item => item.name === "yukino.bond");
if (!zone || zones.length !== 1) throw new Error("The Yukino zone could not be selected unambiguously");
const existing = await request(`/accounts/${encodeURIComponent(account)}/workers/domains`, "Read Worker domains");
for (const domain of existing.filter(item => domains.includes(item.hostname))) {
  if (domain.service !== name) throw new Error(`${domain.hostname} belongs to another Worker and was preserved`);
}
const source = await readFile(new URL("../workers/lab-gateway/worker.mjs", import.meta.url), "utf8");
const upload = new FormData();
let bindings = [];
try {
  const service = JSON.parse(await readFile(".lab-connector/service.json", "utf8"));
  if (typeof service.serviceId !== "string" || !service.serviceId) throw new Error("Missing private service ID");
  bindings = [{ type: "vpc_service", name: "PRIVATE_LAB", service_id: service.serviceId }];
} catch (error) { if (error.code !== "ENOENT") throw error; }
upload.set("metadata", JSON.stringify({ main_module: "worker.mjs", compatibility_date: "2026-10-01", compatibility_flags: ["allow_custom_ports"], bindings }));
upload.set("worker.mjs", new Blob([source], { type: "application/javascript+module" }), "worker.mjs");
await request(root, "Publish fixed Lab gateway", "PUT", upload);
const origins = domains.map(hostname => ({ hostname, zone_id: zone.id, zone_name: "yukino.bond", enabled: true, previews_enabled: false }));
// These are the same endpoints used by Wrangler's publishCustomDomains helper.
// Both overwrite flags remain false, including in a noninteractive workflow.
const changes = await request(`${root}/domains/changeset?replace_state=true`, "Check domain conflicts", "POST", origins);
if (changes.conflicting?.length || changes.removed?.length) throw new Error("Conflicting DNS or unrelated Worker domains were preserved");
await request(`${root}/domains/records`, "Attach Lab custom domains", "PUT", {
  origins, override_scope: true, override_existing_origin: false, override_existing_dns_record: false,
});
for (const domain of domains) console.log(`Configured https://${domain}/`);
console.log("Verify origin access, HTTPS certificates, uploads and rendered pages before publishing main-site links.");
