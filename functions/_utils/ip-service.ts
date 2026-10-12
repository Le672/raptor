import { assessIp, ipInCidr, isPublicIp, normalizeIp, type IpReport, type IpSource, type VisitorNetwork } from "../../src/lib/ip";
import { IP_SOURCE_DEFINITIONS, type IpSourceDefinition } from "../../src/data/ip-sources";
import { compactIpsum, parseCins, parseDshield, parseIpsum } from "./ip-feeds";

type EdgeRequest = Request & { cf?: { asn?: number; asOrganization?: string; country?: string; city?: string } };
export type IpEnv = { DB?: any; PROXYCHECK_API_KEY?: string; IPAPI_IS_API_KEY?: string; IPQS_API_KEY?: string; ABUSEIPDB_API_KEY?: string; IPINFO_TOKEN?: string };
export type IpContext = { request: EdgeRequest; env?: IpEnv; waitUntil?: (promise: Promise<unknown>) => void };
type Raw = { text: string; fetchedAt: string; updatedAt?: string; cached: boolean };
const local = new Map<string, { expires: number; raw: Raw }>();
const pending = new Map<string, Promise<Raw>>();
const initializing = new WeakMap<object, Promise<void>>();
const callers = new Map<string, { until: number; count: number }>();
const cooldowns = new Map<string, number>();
class UpstreamError extends Error { constructor(message: string, public retryAt?: string) { super(message); } }
type FetchOptions = { provider: string; DB?: any; headers?: Record<string, string>; largeFeed?: boolean; compact?: (body: string) => string };
const text = (value: unknown) => typeof value === "string" ? value.slice(0, 300) : undefined;
const countryCode = (value: unknown) => { const code = text(value)?.trim().toUpperCase(); return code && /^[A-Z]{2}$/.test(code) ? code : undefined; };
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
  if (!body) throw new UpstreamError("数据源返回空响应");
  const reader = body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > maximum) throw new UpstreamError("响应超过读取上限"); chunks.push(value); }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
export async function readIpBody(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("请使用 JSON 请求");
  return JSON.parse(await boundedText(request.body, 1024));
}
async function setupDatabase(db: any) {
  let setup = initializing.get(db);
  if (!setup) {
    setup = Promise.all([
      db.prepare("CREATE TABLE IF NOT EXISTS ip_public_feeds (url TEXT PRIMARY KEY, body TEXT, fetched_at INTEGER NOT NULL DEFAULT 0, next_fetch_at INTEGER NOT NULL DEFAULT 0, updated_at TEXT)").run(),
      db.prepare("CREATE TABLE IF NOT EXISTS ip_source_backoff (provider TEXT PRIMARY KEY, retry_at INTEGER NOT NULL)").run(),
    ]).then(() => {});
    initializing.set(db, setup!); setup!.catch(() => initializing.delete(db));
  }
  await setup;
}
async function providerCooldown(options: FetchOptions) {
  let until = cooldowns.get(options.provider) || 0;
  if (options.DB) {
    try { await setupDatabase(options.DB); const row = await options.DB.prepare("SELECT retry_at FROM ip_source_backoff WHERE provider = ?").bind(options.provider).first(); until = Math.max(until, Number(row?.retry_at) || 0); } catch { /* Local cooldown still applies if shared storage is temporarily unavailable. */ }
  }
  if (until > Date.now()) throw new UpstreamError("数据源额度受限，等待提供方允许后再查询", new Date(until).toISOString());
}
async function recordCooldown(options: FetchOptions, retry: string | null) {
  const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : null;
  const date = retry && seconds === null ? Date.parse(retry) : NaN;
  const until = Math.min(Date.now() + 86400000, Math.max(Date.now() + 60000, seconds !== null ? Date.now() + seconds * 1000 : Number.isFinite(date) ? date : Date.now() + 3600000));
  cooldowns.set(options.provider, until);
  if (options.DB) {
    try { await options.DB.prepare("INSERT INTO ip_source_backoff (provider, retry_at) VALUES (?, ?) ON CONFLICT(provider) DO UPDATE SET retry_at = MAX(ip_source_backoff.retry_at, excluded.retry_at)").bind(options.provider, until).run(); } catch { /* Do not turn a provider quota failure into a whole-report failure. */ }
  }
  return new Date(until).toISOString();
}
async function networkRaw(address: string, options: FetchOptions): Promise<Raw> {
  await providerCooldown(options);
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(address, { headers: { Accept: "application/json, text/plain", "User-Agent": "Yukino-IP/2.0 (+https://ip.yukino.bond)", ...options.headers }, redirect: "manual", signal: controller.signal });
    if (response.status >= 300 && response.status < 400) throw new UpstreamError("数据源发生意外跳转，未纳入判断");
    if (response.status === 429) throw new UpstreamError("数据源今日额度或请求频率受限", await recordCooldown(options, response.headers.get("retry-after")));
    if (!response.ok) throw new UpstreamError(`数据源返回 HTTP ${response.status}`);
    if (response.headers.get("content-type")?.includes("text/html")) throw new UpstreamError("数据源返回网页，未纳入评分");
    const body = await boundedText(response.body, options.largeFeed ? 3000000 : 500000);
    let normalized = body;
    try { if (options.compact) normalized = options.compact(body); } catch { throw new UpstreamError("聚合名单日期或格式异常，未纳入判断"); }
    return { text: normalized, fetchedAt: new Date().toISOString(), updatedAt: response.headers.get("last-modified") || undefined, cached: false };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("数据源连接超时");
    if (error instanceof UpstreamError) throw error;
    throw new Error("暂时无法连接数据源");
  } finally { clearTimeout(timer); }
}
async function sharedFeed(address: string, ttl: number, db: any, options: FetchOptions): Promise<Raw> {
  await setupDatabase(db);
  const now = Date.now(), row = await db.prepare("SELECT body, fetched_at, next_fetch_at, updated_at FROM ip_public_feeds WHERE url = ?").bind(address).first();
  if (row?.body && row.fetched_at + ttl > now) return { text: row.body, fetchedAt: new Date(row.fetched_at).toISOString(), updatedAt: row.updated_at || undefined, cached: true };
  // A shared lease prevents multiple edge locations from repeatedly fetching hourly DROP feeds.
  const lease = await db.prepare("INSERT INTO ip_public_feeds (url, next_fetch_at) VALUES (?, ?) ON CONFLICT(url) DO UPDATE SET next_fetch_at = excluded.next_fetch_at WHERE ip_public_feeds.next_fetch_at <= ?").bind(address, now + ttl, now).run();
  if (!lease.meta?.changes) throw new Error("数据源刷新中或上次连接失败，稍后重试");
  const raw = await networkRaw(address, options);
  await db.prepare("UPDATE ip_public_feeds SET body = ?, fetched_at = ?, updated_at = ? WHERE url = ?").bind(raw.text, Date.parse(raw.fetchedAt), raw.updatedAt || null, address).run();
  return raw;
}
async function upstream(address: string, key: string, ttl: number, options: FetchOptions, shared = false): Promise<Raw> {
  const stored = local.get(key); if (stored && stored.expires > Date.now()) return { ...stored.raw, cached: true };
  if (pending.has(key)) return pending.get(key)!;
  const task = (async () => {
    const raw = shared && options.DB ? await sharedFeed(address, ttl, options.DB, options) : await networkRaw(address, options);
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
async function inspectSource(definition: IpSourceDefinition, ip: string, version: "IPv4" | "IPv6", env: IpEnv): Promise<IpSource> {
  const { purpose: _purpose, optional: _optional, ...identity } = definition;
  const base: IpSource = { ...identity, status: "ok", detail: "", risk: null, signals: {}, checkedAt: new Date().toISOString() };
  try {
    const id = definition.id;
    const credential = id === "proxycheck" ? env.PROXYCHECK_API_KEY : id === "ipapiis" ? env.IPAPI_IS_API_KEY : id === "ipqs" ? env.IPQS_API_KEY : id === "abuseipdb" ? env.ABUSEIPDB_API_KEY : id === "ipinfo" ? env.IPINFO_TOKEN : undefined;
    if (definition.optional && !credential) return { ...base, status: "not-configured", detail: "此授权来源尚未启用，本次未向它发送 IP，也不计入覆盖率或评分。" };
    if (version === "IPv6" && ["tor", "feodo", "dshield", "cins", "ipsum"].includes(id)) return { ...base, status: "unsupported", detail: "此公开名单仅核对 IPv4；IPv6 不会被标记为未命中。" };
    let address = id === "ipquery" ? `https://api.ipquery.io/${encodeURIComponent(ip)}`
      : id === "proxycheck" ? `https://proxycheck.io/v3/${encodeURIComponent(ip)}?tag=0`
      : id === "ipwhois" ? `https://ipwho.is/${encodeURIComponent(ip)}`
      : id === "ipapiis" ? `https://api.ipapi.is/?q=${encodeURIComponent(ip)}`
      : id === "ipguide" ? `https://ip.guide/${encodeURIComponent(ip)}`
      : id === "ipapico" ? `https://ipapi.co/${encodeURIComponent(ip)}/json/`
      : id === "tor" ? "https://check.torproject.org/torbulkexitlist"
      : id === "spamhaus" ? `https://www.spamhaus.org/drop/drop_${version === "IPv4" ? "v4" : "v6"}.json`
      : id === "feodo" ? "https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json"
      : id === "dshield" ? "https://feeds.dshield.org/feeds/block.txt"
      : id === "cins" ? "https://cinsscore.com/list/ci-badguys.txt"
      : id === "ipsum" ? "https://raw.githubusercontent.com/stamparm/ipsum/master/ipsum.txt"
      : id === "ipqs" ? `https://ipqualityscore.com/api/json/ip/${encodeURIComponent(credential!)}/${encodeURIComponent(ip)}`
      : id === "abuseipdb" ? `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=30`
      : `https://api.ipinfo.io/lite/${encodeURIComponent(ip)}`;
    if (id === "proxycheck" && env.PROXYCHECK_API_KEY) address += `&key=${encodeURIComponent(env.PROXYCHECK_API_KEY)}`;
    if (id === "ipapiis" && credential) address += `&key=${encodeURIComponent(credential)}`;
    const feed = ["tor", "spamhaus", "feodo", "dshield", "cins", "ipsum"].includes(id);
    const ttl = ["spamhaus", "dshield", "cins", "ipsum"].includes(id) ? 3600000 : id === "feodo" ? 300000 : 600000;
    const provider = `${id}:${credential ? "authenticated" : "public"}`;
    const headers = id === "abuseipdb" ? { Key: credential! } : id === "ipinfo" ? { Authorization: `Bearer ${credential}` } : undefined;
    const raw = await upstream(address, `${provider}:${feed ? version : ip}`, ttl, { provider, DB: env.DB, headers, largeFeed: id === "ipsum", compact: id === "ipsum" ? compactIpsum : undefined }, feed);
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
    } else if (id === "dshield") {
      const { updatedAt, match } = parseDshield(raw.text, ip);
      base.updatedAt = updatedAt; base.signals.abuse = !!match; base.network = match?.cidr;
      base.attribution = "SANS Technology Institute · Internet Storm Center · https://isc.sans.edu · CC BY-NC-SA 2.5";
      base.detail = match ? `命中近期扫描活跃网段 ${match.cidr}，${match.targets} 个目标报告扫描；网段内其他用户可能无关。` : "未命中推荐扫描网段；不是对全部威胁记录的查询。";
    } else if (id === "cins") {
      const { updatedAt, addresses } = parseCins(raw.text, raw.updatedAt);
      base.updatedAt = updatedAt; base.signals.abuse = addresses.includes(ip); base.attribution = "Sentinel IPS · CINS Army";
      base.detail = base.signals.abuse ? "命中 CINS Army 公开威胁地址名单；不等于已被 AI 平台封禁。" : "未命中 CINS Army 本期名单；仅代表这一项检查。";
    } else if (id === "ipsum") {
      const { updatedAt, rows } = parseIpsum(raw.text), match = rows.find(row => row.ip === ip);
      base.updatedAt = updatedAt; base.signals.abuse = !!match; base.attribution = "stamparm / IPsum · Unlicense";
      base.metrics = [{ label: "公开名单交叉收录", value: match ? `${match.count} 份` : "未达到 3 份门槛" }];
      base.detail = "仅核对至少 3 份名单共同收录的地址；聚合名单可能与其他来源重叠，次数不是风险分数。";
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
        base.risk = score(data.risk.risk_score); base.asn = asnLabel(data.isp?.asn); base.organization = text(data.isp?.org); base.country = text(data.location?.country); base.countryCode = countryCode(data.location?.country_code); base.city = text(data.location?.city);
        base.signals = { vpn: flag(data.risk.is_vpn), proxy: flag(data.risk.is_proxy), tor: flag(data.risk.is_tor), hosting: flag(data.risk.is_datacenter) };
        base.detail = "风险分数 0–100，越高表示提供方判断的风险越高。";
      } else if (id === "proxycheck") {
        if (!["ok", "warning"].includes(data?.status)) throw new Error("查询受限或数据源未返回有效结果");
        const entry = Object.entries(data).find(([key]) => normalizeIp(key)?.ip === ip)?.[1] as any;
        if (!entry || score(entry.detections?.risk) === null) throw new Error("未返回目标 IP 的有效风险分数");
        base.risk = score(entry.detections.risk); base.asn = asnLabel(entry.network?.asn); base.organization = text(entry.network?.provider); base.network = text(entry.network?.range); base.country = text(entry.location?.country_name); base.countryCode = countryCode(entry.location?.country_code ?? entry.location?.country_iso); base.city = text(entry.location?.city_name); base.updatedAt = text(entry.last_updated);
        base.signals = { vpn: flag(entry.detections.vpn), proxy: flag(entry.detections.proxy), tor: flag(entry.detections.tor), hosting: flag(entry.detections.hosting), anonymous: flag(entry.detections.anonymous), compromised: flag(entry.detections.compromised) };
        base.detail = `原始风险分数 ${base.risk} / 100${data.status === "warning" ? "；提供方返回额度或频率警告" : ""}。`;
      } else if (id === "ipwhois") {
        if (data?.success !== true || normalizeIp(data.ip)?.ip !== ip || !data.connection) throw new Error("未返回目标 IP 的有效网络资料");
        base.asn = asnLabel(data.connection.asn); base.organization = text(data.connection.isp); base.country = text(data.country); base.countryCode = countryCode(data.country_code); base.city = text(data.city);
        base.detail = "核对 ASN、运营商与位置；免费接口未提供风险数据，不参与分数平均。";
      } else if (id === "ipapiis") {
        if (normalizeIp(data?.ip)?.ip !== ip || data.error || !Object.prototype.hasOwnProperty.call(data, "country") && !data.location) throw new Error("未返回目标 IP 的有效网络资料");
        base.organization = text(data.company?.name) || text(data.company) || text(data.asn?.org);
        base.asn = asnLabel(data.asn?.asn) || asnLabel(typeof data.asn === "string" ? data.asn.match(/^AS\d+/)?.[0] : undefined);
        base.country = text(data.location?.country) || text(data.country); base.countryCode = countryCode(data.location?.country_code); base.city = text(data.location?.city) || text(data.city); base.network = text(data.company?.network);
        if (credential) { base.kind = "reputation"; base.signals = { hosting: flag(data.is_datacenter), vpn: flag(data.is_vpn), proxy: flag(data.is_proxy), tor: flag(data.is_tor), abuse: flag(data.is_abuser) }; }
        base.detail = credential ? "提供网络属性与安全标记；网段滥用密度不是目标 IP 的风险分数，不参与分数平均。" : "匿名免费接口仅提供位置和网络归属，未提供 VPN、代理或风险分数。";
      } else if (id === "ipguide") {
        if (normalizeIp(data?.ip)?.ip !== ip || !data.network?.autonomous_system) throw new Error("未返回目标 IP 的有效网络资料");
        const as = data.network.autonomous_system;
        base.asn = asnLabel(as.asn); base.organization = text(as.organization) || text(as.name); base.network = text(data.network.cidr);
        base.country = text(data.location?.country); base.countryCode = countryCode(data.location?.country); base.city = text(data.location?.city);
        base.detail = "只核对网络与位置；ASN 注册国家不是出口位置，不用于 AI 地区资格判断。";
      } else if (id === "ipapico") {
        if (data?.error || normalizeIp(data?.ip)?.ip !== ip || !data.country_code) throw new Error("未返回目标 IP 的有效位置资料");
        base.asn = asnLabel(data.asn); base.organization = text(data.org); base.network = text(data.network);
        base.country = text(data.country_name); base.countryCode = countryCode(data.country_code); base.city = text(data.city);
        base.detail = "核对国家、城市和网络归属；未提供安全评分，不参与风险平均。";
      } else if (id === "ipqs") {
        if (data?.success !== true || score(data.fraud_score) === null || data.ip && normalizeIp(data.ip)?.ip !== ip) throw new Error("授权来源未返回有效的目标风险资料");
        base.risk = score(data.fraud_score); base.riskLabel = "欺诈风险"; base.asn = asnLabel(data.ASN); base.organization = text(data.organization) || text(data.ISP);
        base.countryCode = countryCode(data.country_code); base.city = text(data.city);
        base.signals = { vpn: flag(data.vpn), proxy: flag(data.proxy), tor: flag(data.tor), abuse: flag(data.recent_abuse) };
        base.detail = "授权 API 的 fraud_score 参与原始风险平均；此分数不是 AI 封禁概率。";
      } else if (id === "abuseipdb") {
        const entry = data?.data;
        if (normalizeIp(entry?.ipAddress)?.ip !== ip || score(entry.abuseConfidenceScore) === null || !Number.isInteger(entry.totalReports) || entry.totalReports < 0) throw new Error("未返回目标 IP 的有效滥用资料");
        base.risk = score(entry.abuseConfidenceScore); base.riskLabel = "滥用置信分";
        base.signals = { abuse: entry.abuseConfidenceScore >= 50 && entry.totalReports > 0, tor: flag(entry.isTor) };
        base.countryCode = countryCode(entry.countryCode); base.organization = text(entry.isp);
        base.metrics = [{ label: "近 30 天报告", value: String(entry.totalReports) }, { label: "最后报告", value: text(entry.lastReportedAt) || "未提供" }];
        base.detail = "30 天滥用置信分单独展示，不参与综合风险平均；本站在分数 ≥50 且有报告时提示滥用标记。";
      } else if (id === "ipinfo") {
        if (normalizeIp(data?.ip)?.ip !== ip || !data.country_code) throw new Error("未返回目标 IP 的有效网络资料");
        base.asn = asnLabel(data.asn); base.organization = text(data.as_name); base.country = text(data.country); base.countryCode = countryCode(data.country_code);
        base.detail = "IPinfo Lite 授权接口提供国家与 ASN，不提供匿名网络或风险评分。";
      }
    }
    return base;
  } catch (error) { return { ...base, status: "error", risk: null, signals: {}, retryAt: error instanceof UpstreamError ? error.retryAt : undefined, detail: error instanceof Error ? error.message : "数据源暂时不可用" }; }
}
function ipv4Line(line: string) { const value = normalizeIp(line.trim()); return value?.version === "IPv4"; }
export async function inspectIp(value: unknown, env: IpEnv = {}): Promise<IpReport> {
  const target = normalizeIp(value);
  if (!target || !isPublicIp(target.ip)) throw new Error("请输入一个公网 IPv4 或 IPv6 地址，不支持内网、保留地址、域名或 URL。");
  const sources = await Promise.all(IP_SOURCE_DEFINITIONS.map(source => inspectSource(source, target.ip, target.version, env)));
  return { ...target, checkedAt: new Date().toISOString(), model: "yukino-ip-v2", sources, assessment: assessIp(sources) };
}
