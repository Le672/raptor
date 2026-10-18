// Configure only the dedicated Lab tunnel/service; preserve all other networks.
import { createCipheriv, createPublicKey, publicEncrypt, randomBytes, constants } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const account = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) throw new Error("Existing Cloudflare deployment secrets are missing");
const recipient = createPublicKey(process.env.LAB_RECIPIENT_PUBLIC_KEY || "");
if (recipient.asymmetricKeyType !== "rsa" || recipient.asymmetricKeyDetails.modulusLength < 3072) throw new Error("An RSA public key of at least 3072 bits is required");
const accountPath = `/accounts/${encodeURIComponent(account)}`;
async function request(path, label, method = "GET", body) {
  const response = await fetch("https://api.cloudflare.com/client/v4" + path, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(25000),
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`${label} failed (HTTP ${response.status}; Cloudflare codes ${(data.errors || []).map(error => error.code).join(",")})`);
  return data.result;
}
// Permission preflight before creating anything.
const services = await request(`${accountPath}/connectivity/directory/services`, "Read private connectivity services");
const tunnels = await request(`${accountPath}/cfd_tunnel?is_deleted=false&name=yukino-lab-20261018`, "Read Lab tunnel");
const matching = tunnels.filter(item => item.name === "yukino-lab-20261018" && !item.deleted_at);
if (matching.length > 1) throw new Error("Ambiguous Lab tunnel; existing tunnels were preserved");
let tunnel = matching[0];
if (!tunnel) tunnel = await request(`${accountPath}/cfd_tunnel`, "Create isolated Lab tunnel", "POST", { name: "yukino-lab-20261018", config_src: "cloudflare" });
if (tunnel.config_src !== "cloudflare") throw new Error("An unrelated locally managed tunnel was preserved");
await request(`${accountPath}/cfd_tunnel/${tunnel.id}/configurations`, "Configure private-only connector", "PUT", { config: { ingress: [{ service: "http_status:404" }] } });
const list = Array.isArray(services) ? services : services.services;
if (!Array.isArray(list)) throw new Error("Unexpected private service list");
const existing = list.filter(item => item.name === "yukino-lab-edge");
if (existing.length > 1) throw new Error("Ambiguous private Lab service");
let service = existing[0];
if (service && service.network?.tunnel_id !== tunnel.id) throw new Error("An unrelated private service was preserved");
if (!service) service = await request(`${accountPath}/connectivity/directory/services`, "Create private Lab service", "POST", {
  name: "yukino-lab-edge", type: "http", host: { hostname: "edge" }, http_port: 8080, network: { tunnel_id: tunnel.id },
});
const connectorToken = await request(`${accountPath}/cfd_tunnel/${tunnel.id}/token`, "Read connector token");
if (typeof connectorToken !== "string" || connectorToken.length < 40) throw new Error("Unexpected connector token response");
console.log(`::add-mask::${connectorToken}`);
const key = randomBytes(32), iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
const ciphertext = Buffer.concat([cipher.update(connectorToken, "utf8"), cipher.final()]);
const wrappedKey = publicEncrypt({ key: recipient, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, key);
await mkdir(".lab-connector", { recursive: true });
await writeFile(".lab-connector/service.json", JSON.stringify({ serviceId: service.service_id || service.id }));
await writeFile(".lab-connector/connector.enc.json", JSON.stringify({
  version: 1, algorithm: "RSA-OAEP-SHA256+A256GCM", tunnelId: tunnel.id,
  wrappedKey: wrappedKey.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64"),
}, null, 2), { mode: 0o600 });
console.log("Dedicated Lab connectivity configured; connector token exported only in encrypted form.");
