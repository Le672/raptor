// Run only in the owner's manually dispatched workflow. Cloudflare's API token
// remains in Actions; the narrowly scoped connector token leaves only encrypted.
import { createCipheriv, createPublicKey, publicEncrypt, randomBytes, constants } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const recipient = createPublicKey(process.env.LAB_RECIPIENT_PUBLIC_KEY || "");
if (!account || !token) throw new Error("Existing Cloudflare deployment secrets are missing");
if (recipient.asymmetricKeyType !== "rsa" || recipient.asymmetricKeyDetails.modulusLength < 3072) {
  throw new Error("The connector handoff requires an RSA public key of at least 3072 bits");
}
const domains = ["drop.yukino.bond", "draw.yukino.bond", "tools.yukino.bond"];
const tunnelName = "yukino-lab-20261018";
const accountPath = `/accounts/${encodeURIComponent(account)}/cfd_tunnel`;

async function request(path, operation, method = "GET", body) {
  const response = await fetch("https://api.cloudflare.com/client/v4" + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    // No response bodies, credentials or account identifiers in public logs.
    throw new Error(`${operation} failed (HTTP ${response.status}; Cloudflare codes ${(data.errors || []).map(error => error.code).join(",")})`);
  }
  return data.result;
}

const zones = await request("/zones?name=yukino.bond", "Read Yukino zone");
const zone = zones.find(item => item.name === "yukino.bond");
if (!zone || zones.length !== 1) throw new Error("The existing Yukino zone could not be selected unambiguously");
const dnsPath = `/zones/${encodeURIComponent(zone.id)}/dns_records`;
const tunnels = await request(`${accountPath}?is_deleted=false&name=${encodeURIComponent(tunnelName)}`, "Read Lab tunnel");
const matchingTunnels = tunnels.filter(item => item.name === tunnelName && !item.deleted_at);
if (matchingTunnels.length > 1) throw new Error("More than one Lab tunnel has this name; existing tunnels were preserved");
let tunnel = matchingTunnels[0];
const records = await Promise.all(domains.map(name => request(`${dnsPath}?name=${encodeURIComponent(name)}`, `Read ${name} DNS`)));
for (let i = 0; i < domains.length; i++) {
  const list = records[i];
  if (list.length && !(tunnel && list.length === 1 && list[0].type === "CNAME" && list[0].proxied && list[0].content === `${tunnel.id}.cfargotunnel.com`)) {
    throw new Error(`${domains[i]} already has a different DNS record; it was preserved`);
  }
}

if (tunnel) {
  if (tunnel.config_src !== "cloudflare") throw new Error("An existing locally managed tunnel was preserved");
  const current = await request(`${accountPath}/${tunnel.id}/configurations`, "Read existing Lab routes");
  if (current.config?.ingress?.some(route => route.hostname && !domains.includes(route.hostname))) {
    throw new Error("The existing tunnel contains unrelated hostnames; its routes were preserved");
  }
} else {
  tunnel = await request(accountPath, "Create isolated Lab tunnel", "POST", { name: tunnelName, config_src: "cloudflare" });
}

await request(`${accountPath}/${tunnel.id}/configurations`, "Configure Lab ingress", "PUT", {
  config: { ingress: [...domains.map(hostname => ({ hostname, service: "http://edge:8080" })), { service: "http_status:404" }] },
});
for (let i = 0; i < domains.length; i++) {
  if (!records[i].length) await request(dnsPath, `Create ${domains[i]} DNS`, "POST", {
    type: "CNAME", name: domains[i], content: `${tunnel.id}.cfargotunnel.com`, proxied: true,
    comment: "Yukino Lab: isolated VPS tools, configured by the owner's lab-domains workflow",
  });
  console.log(`Configured https://${domains[i]}/`);
}

const connectorToken = await request(`${accountPath}/${tunnel.id}/token`, "Read Lab connector token");
if (typeof connectorToken !== "string" || connectorToken.length < 40) throw new Error("Unexpected connector token response");
console.log(`::add-mask::${connectorToken}`);
const key = randomBytes(32), iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const ciphertext = Buffer.concat([cipher.update(connectorToken, "utf8"), cipher.final()]);
const wrappedKey = publicEncrypt({ key: recipient, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, key);
await mkdir(".lab-connector", { recursive: true });
await writeFile(".lab-connector/connector.enc.json", JSON.stringify({
  version: 1, algorithm: "RSA-OAEP-SHA256+A256GCM", tunnelId: tunnel.id, domains,
  wrappedKey: wrappedKey.toString("base64"), iv: iv.toString("base64"),
  tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64"),
}, null, 2), { mode: 0o600 });
console.log("Connector handoff encrypted. Start the dedicated VPS connector, then verify all three HTTPS endpoints.");
