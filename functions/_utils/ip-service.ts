import { assessIp, ipInCidr, isPublicIp, normalizeIp, type IpReport, type IpSource, type VisitorNetwork } from "../../src/lib/ip";

type EdgeRequest = Request & { cf?: { asn?: number; asOrganization?: string; country?: string; city?: string } };
export type IpEnv = { DB?: any; PROXYCHECK_API_KEY?: string };
export type IpContext = { request: EdgeRequest; env?: IpEnv; waitUntil?: (promise: Promise<unknown>) => void };
type Raw = { text: string; fetchedAt: string; updatedAt?: string; cached: boolean };
const local = new Map<string, { expires: number; raw: Raw }>();
const pending = new Map<string, Promise<Raw>>();
const initializing = new WeakMap<object, Promise<void>>();
const callers = new Map<string, { until: number; count: number }>();
const text = (value: unknown) => typeof value === "string" ? value.slice(0, 300) : undefined;
export const asnLabel = (value: unknown): string | undefined => /^(?:AS)?\d{1,10}$/.test(String(value)) && Number(String(value).replace(/^AS/, "")) > 0 ? `AS${String(value).replace(/^AS/, "")}` : undefined;

export function ipJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Cloudflare-CDN-Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });
}
export function visitorNetwork(request: EdgeRequest): VisitorNetwork {
  const candidate = normalizeIp(request.headers.get("CF-Connecting-IP"));
  const parsed = candidate && isPublicIp(candidate.ip) ? candidate : null;
  const cf = request.cf;
  return { ip: parsed?.ip ?? null, version: parsed?.version ?? null, asn: parsed ? asnLabel(cf?.asn) ?? null : null, organization: parsed ? text(cf?.asOrganization) ?? null : null, country: parsed ? text(cf?.country) ?? null : null, city: parsed ? text(cf?.city) ?? null : null, source: "Cloudflare", checkedAt: new Date().toISOString() };
}
export function allowIpQuery(request: EdgeRequest): boolean {
  const key = request.headers.get("CF-Connecting-IP") || "local-development", now = Date.now();
  for (const [caller, bucket] of callers) if (bucket.until <= now) callers.delete(caller);
  if (callers.size >= 2000 && !callers.has(key)) return false;
  const bucket = callers.get(key) || { until: now + 60000, count: 0 };
  bucket.count++; callers.set(key, bucket);
  return bucket.count <= 12;
}
async function boundedText(body: ReadableStream<Uint8Array> | null, maximum: number) {
  if (!body) throw new Error("数据源返回空响应");
  const reader = body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > maximum) throw new Error("响应超过读取上限"); chunks.push(value); }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
export async function readIpBody(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("请使用 JSON 请求");
  return JSON.parse(await boundedText(request.body, 1024));
}
async function networkRaw(address: string): Promise<Raw> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(address, { headers: { Accept: "application/json, text/plain", "User-Agent": "Yukino-IP/1.0 (+https://ip.yukino.bond)" }, redirect: "error", signal: controller.signal });
    if (!response.ok) throw new Error(response.status === 429 ? "数据源今日额度或请求频率受限" : `数据源返回 HTTP ${response.status}`);
    if (response.headers.get("content-type")?.includes("text/html")) throw new Error("数据源返回网页，未纳入评分");
    return { text: await boundedText(response.body, 500000), fetchedAt: new Date().toISOString(), updatedAt: response.headers.get("last-modified") || undefined, cached: false };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("数据源连接超时");
    if (error instanceof TypeError) throw new Error("暂时无法连接数据源");
    throw error;
  } finally { clearTimeout(timer); }
}
async function sharedFeed(address: string, ttl: number, db: any): Promise<Raw> {
  let setup = initializing.get(db);
  if (!setup) {
    setup = db.prepare("CREATE TABLE IF NOT EXISTS ip_public_feeds (url TEXT PRIMARY KEY, body TEXT, fetched_at INTEGER NOT NULL DEFAULT 0, next_fetch_at INTEGER NOT NULL DEFAULT 0, updated_at TEXT)").run().then(() => {});
    initializing.set(db, setup);
    setup.catch(() => initializing.delete(db));
  }
  await setup;
  const now = Date.now(), row = await db.prepare("SELECT body, fetched_at, next_fetch_at, updated_at FROM ip_public_feeds WHERE url = ?").bind(address).first();
  if (row?.body && row.fetched_at + ttl > now) return { text: row.body, fetchedAt: new Date(row.fetched_at).toISOString(), updatedAt: row.updated_at || undefined, cached: true };
  // A shared lease prevents multiple edge locations from repeatedly fetching hourly DROP feeds.
  const lease = await db.prepare("INSERT INTO ip_public_feeds (url, next_fetch_at) VALUES (?, ?) ON CONFLICT(url) DO UPDATE SET next_fetch_at = excluded.next_fetch_at WHERE ip_public_feeds.next_fetch_at <= ?").bind(address, now + ttl, now).run();
  if (!lease.meta?.changes) throw new Error("数据源刷新中或上次连接失败，稍后重试");
  const raw = await networkRaw(address);
  await db.prepare("UPDATE ip_public_feeds SET body = ?, fetched_at = ?, updated_at = ? WHERE url = ?").bind(raw.text, Date.parse(raw.fetchedAt), raw.updatedAt || null, address).run();
  return raw;
}
async function upstream(address: string, key: string, ttl: number, db?: any): Promise<Raw> {
  const stored = local.get(key); if (stored && stored.expires > Date.now()) return { ...stored.raw, cached: true };
  if (pending.has(key)) return pending.get(key)!;
  const task = (async () => {
    const raw = db ? await sharedFeed(address, ttl, db) : await networkRaw(address);
    if (local.size >= 100) local.delete(local.keys().next().value!);
    local.set(key, { expires: Date.parse(raw.fetchedAt) + ttl, raw });
    return raw;
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}
const score = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
const flag = (value: unknown) => typeof value === "boolean" ? value : undefined;
function sourceJson(raw: string): any {
  try { return JSON.parse(raw); } catch { throw new Error("数据源返回的数据格式异常，未纳入判断"); }
}
const definitions: Omit<IpSource, "status" | "detail" | "risk" | "signals" | "checkedAt">[] = [
  { id: "ipquery", name: "IPQuery", href: "https://ipquery.io/", kind: "reputation" },
  { id: "proxycheck", name: "proxycheck.io", href: "https://proxycheck.io/api/", kind: "reputation" },
  { id: "ipwhois", name: "IPWHOIS.io", href: "https://ipwhois.io/documentation", kind: "geolocation" },
  { id: "tor", name: "Tor Project", href: "https://check.torproject.org/torbulkexitlist", kind: "exit-list" },
  { id: "spamhaus", name: "Spamhaus DROP", href: "https://www.spamhaus.org/blocklists/do-not-route-or-peer/", kind: "threat-list" },
  { id: "feodo", name: "abuse.ch · Feodo Tracker", href: "https://feodotracker.abuse.ch/blocklist/", kind: "threat-list" },
];

async function inspectSource(definition: typeof definitions[number], ip: string, version: "IPv4" | "IPv6", env: IpEnv): Promise<IpSource> {
  const base: IpSource = { ...definition, status: "ok", detail: "", risk: null, signals: {}, checkedAt: new Date().toISOString() };
  try {
    const id = definition.id;
    if (version === "IPv6" && ["tor", "feodo"].includes(id)) return { ...base, status: "unsupported", detail: "此公开名单仅核对 IPv4；IPv6 判断使用其余来源。" };
    let address = id === "ipquery" ? `https://api.ipquery.io/${encodeURIComponent(ip)}`
      : id === "proxycheck" ? `https://proxycheck.io/v3/${encodeURIComponent(ip)}?tag=0`
      : id === "ipwhois" ? `https://ipwho.is/${encodeURIComponent(ip)}`
      : id === "tor" ? "https://check.torproject.org/torbulkexitlist"
      : id === "spamhaus" ? `https://www.spamhaus.org/drop/drop_${version === "IPv4" ? "v4" : "v6"}.json`
      : "https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json";
    if (id === "proxycheck" && env.PROXYCHECK_API_KEY) address += `&key=${encodeURIComponent(env.PROXYCHECK_API_KEY)}`;
    const feed = ["tor", "spamhaus", "feodo"].includes(id);
    const ttl = id === "spamhaus" ? 3600000 : id === "feodo" ? 300000 : 600000;
    const cacheKey = `${id}:${feed ? version : ip}:${env.PROXYCHECK_API_KEY && id === "proxycheck" ? "authenticated" : "public"}`;
    const raw = await upstream(address, cacheKey, ttl, feed ? env.DB : undefined);
    base.checkedAt = raw.fetchedAt; base.updatedAt = raw.updatedAt; base.cached = raw.cached;
    if (id === "tor") {
      const lines = raw.text.split(/\r?\n/).map(line => line.trim()).filter(line => ipv4Line(line));
      if (!lines.length) throw new Error("出口名单格式异常，未纳入判断");
      base.signals.tor = lines.includes(ip); base.detail = base.signals.tor ? "命中 Tor 官方出口名单。" : "未命中 Tor 出口名单；仅代表这一项检查。";
    } else if (id === "spamhaus") {
      const rows = raw.text.trim().split(/\r?\n/).map(sourceJson), metadata = rows.find(row => row?.type === "metadata"), ranges = rows.filter(row => typeof row?.cidr === "string");
      if (!ranges.length || !metadata || typeof metadata.timestamp !== "number" || typeof metadata.copyright !== "string") throw new Error("DROP 名单格式异常，未纳入判断");
      const match = ranges.find(row => ipInCidr(ip, row.cidr));
      base.updatedAt = new Date(metadata.timestamp * 1000).toISOString(); base.attribution = metadata.copyright;
      base.signals.drop = !!match; base.network = match?.cidr;
      base.detail = match ? `命中 ${match.cidr} · ${text(match.sblid) || "DROP"}。` : "未命中 DROP 恶意网段；不代表未列入其他黑名单。";
    } else {
      const data = sourceJson(raw.text);
      if (id === "feodo") {
        if (!Array.isArray(data) || data.some(row => !normalizeIp(row?.ip_address))) throw new Error("恶意 C2 名单格式异常");
        const recent = data.filter(row => Date.parse(row.last_online) >= Date.now() - 30 * 86400000 && Date.parse(row.last_online) <= Date.now() + 86400000);
        if (data.length && !recent.length) throw new Error("名单全部记录超过 30 天，本次不参与判断");
        const match = recent.find(row => normalizeIp(row.ip_address)?.ip === ip);
        base.signals.malware = !!match; base.detail = match ? `命中近期 ${text(match.malware) || "Botnet"} C2 记录；最后在线 ${text(match.last_online)}。` : "未命中近期恶意 C2 名单；仅代表这一项检查。";
      } else if (id === "ipquery") {
        if (normalizeIp(data?.ip)?.ip !== ip || score(data.risk?.risk_score) === null) throw new Error("未返回目标 IP 的有效风险分数");
        base.risk = score(data.risk.risk_score); base.asn = asnLabel(data.isp?.asn); base.organization = text(data.isp?.org); base.country = text(data.location?.country); base.city = text(data.location?.city);
        base.signals = { vpn: flag(data.risk.is_vpn), proxy: flag(data.risk.is_proxy), tor: flag(data.risk.is_tor), hosting: flag(data.risk.is_datacenter) };
        base.detail = "风险分数 0–100，越高表示提供方判断的风险越高。";
      } else if (id === "proxycheck") {
        if (!["ok", "warning"].includes(data?.status)) throw new Error("查询受限或数据源未返回有效结果");
        const entry = Object.entries(data).find(([key]) => normalizeIp(key)?.ip === ip)?.[1] as any;
        if (!entry || score(entry.detections?.risk) === null) throw new Error("未返回目标 IP 的有效风险分数");
        base.risk = score(entry.detections.risk); base.asn = asnLabel(entry.network?.asn); base.organization = text(entry.network?.provider); base.network = text(entry.network?.range); base.country = text(entry.location?.country_name); base.city = text(entry.location?.city_name); base.updatedAt = text(entry.last_updated);
        base.signals = { vpn: flag(entry.detections.vpn), proxy: flag(entry.detections.proxy), tor: flag(entry.detections.tor), hosting: flag(entry.detections.hosting), anonymous: flag(entry.detections.anonymous), compromised: flag(entry.detections.compromised) };
        base.detail = `原始风险分数 ${base.risk} / 100${data.status === "warning" ? "；提供方返回额度或频率警告" : ""}。`;
      } else {
        if (data?.success !== true || normalizeIp(data.ip)?.ip !== ip || !data.connection) throw new Error("未返回目标 IP 的有效网络资料");
        base.asn = asnLabel(data.connection.asn); base.organization = text(data.connection.isp); base.country = text(data.country); base.city = text(data.city);
        base.detail = "核对 ASN、运营商与位置；免费接口未提供风险数据，不参与分数平均。";
      }
    }
    return base;
  } catch (error) { return { ...base, status: "error", risk: null, signals: {}, detail: error instanceof Error ? error.message : "数据源暂时不可用" }; }
}
function ipv4Line(line: string) { const value = normalizeIp(line.trim()); return value?.version === "IPv4"; }
export async function inspectIp(value: unknown, env: IpEnv = {}): Promise<IpReport> {
  const target = normalizeIp(value);
  if (!target || !isPublicIp(target.ip)) throw new Error("请输入一个公网 IPv4 或 IPv6 地址，不支持内网、保留地址、域名或 URL。");
  const sources = await Promise.all(definitions.map(source => inspectSource(source, target.ip, target.version, env)));
  return { ...target, checkedAt: new Date().toISOString(), model: "yukino-ip-v1", sources, assessment: assessIp(sources) };
}
