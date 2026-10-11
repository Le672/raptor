export type IpVersion = "IPv4" | "IPv6";
export type VisitorNetwork = { ip: string | null; version: IpVersion | null; asn: string | null; organization: string | null; country: string | null; city: string | null; source: "Cloudflare"; checkedAt: string };
export type IpSignal = "vpn" | "proxy" | "tor" | "hosting" | "anonymous" | "compromised" | "malware" | "drop";
export type IpSource = {
  id: string; name: string; href: string; kind: "reputation" | "geolocation" | "exit-list" | "threat-list";
  status: "ok" | "error" | "unsupported"; detail: string; risk: number | null;
  signals: Partial<Record<IpSignal, boolean>>; checkedAt: string; updatedAt?: string; cached?: boolean;
  asn?: string; organization?: string; country?: string; countryCode?: string; city?: string; network?: string; attribution?: string;
};
export type IpAssessment = {
  purity: number | null; risk: number | null; baselineRisk: number | null;
  label: string; tone: "good" | "medium" | "poor" | "unknown";
  confidence: "good" | "limited" | "insufficient"; scoredSources: number;
  availableSources: number; totalSources: number; riskRange: [number, number] | null;
  disagreement: boolean; reasons: { signal: IpSignal; label: string; floor: number; sources: string[] }[];
  signals: { signal: IpSignal; detected: boolean | null; disagreement: boolean; positive: string[]; negative: string[] }[];
};
export type IpReport = { ip: string; version: IpVersion; checkedAt: string; model: "yukino-ip-v1"; sources: IpSource[]; assessment: IpAssessment };

const ipv4 = (value: string) => /^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value) && value.split(".").every(part => Number(part) <= 255);
export function normalizeIp(value: unknown): { ip: string; version: IpVersion } | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (input.length > 45 || !input) return null;
  if (ipv4(input)) return { ip: input, version: "IPv4" };
  if (!input.includes(":") || !/^[\da-fA-F:.]+$/.test(input)) return null;
  try {
    const ip = new URL(`http://[${input}]/`).hostname.slice(1, -1);
    // Treat IPv4-mapped addresses as the same target as their IPv4 representation.
    if (ip.startsWith("::ffff:")) {
      const tail = ip.slice(7).split(":");
      if (tail.length === 2) {
        const a = parseInt(tail[0], 16), b = parseInt(tail[1], 16);
        return { ip: [a >> 8, a & 255, b >> 8, b & 255].join("."), version: "IPv4" };
      }
    }
    return { ip, version: "IPv6" };
  } catch { return null; }
}

function ipNumber(ip: string, version: IpVersion): bigint {
  if (version === "IPv4") return ip.split(".").reduce((n, part) => (n << 8n) | BigInt(part), 0n);
  const halves = ip.split("::"), left = halves[0] ? halves[0].split(":") : [], right = halves[1] ? halves[1].split(":") : [];
  const words = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
  return words.reduce((n, part) => (n << 16n) | BigInt(parseInt(part, 16)), 0n);
}
export function ipInCidr(ip: string, cidr: string): boolean {
  const target = normalizeIp(ip), [network, bitsText, extra] = cidr.split("/"), base = normalizeIp(network);
  if (!target || !base || target.version !== base.version || extra || !/^\d+$/.test(bitsText || "")) return false;
  const width = target.version === "IPv4" ? 32 : 128, bits = Number(bitsText);
  if (bits < 0 || bits > width) return false;
  const shift = BigInt(width - bits);
  return (ipNumber(target.ip, target.version) >> shift) === (ipNumber(base.ip, base.version) >> shift);
}
export function isPublicIp(value: string): boolean {
  const target = normalizeIp(value); if (!target) return false;
  if (target.version === "IPv4") return ![
    "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12",
    "192.0.0.0/24", "192.0.2.0/24", "192.88.99.0/24", "192.168.0.0/16", "198.18.0.0/15", "198.51.100.0/24",
    "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
  ].some(cidr => ipInCidr(target.ip, cidr));
  return ipInCidr(target.ip, "2000::/3") && !["2001:2::/48", "2001:db8::/32", "3fff::/20"].some(cidr => ipInCidr(target.ip, cidr));
}

export const IP_SIGNAL_LABELS: Record<IpSignal, string> = {
  vpn: "VPN", proxy: "公开代理", tor: "Tor 出口", hosting: "机房 / 托管", anonymous: "匿名网络", compromised: "被入侵记录", malware: "恶意 C2 名单", drop: "Spamhaus DROP",
};
const SIGNAL_FLOORS: Record<IpSignal, number> = { hosting: 20, vpn: 35, anonymous: 35, proxy: 50, tor: 70, compromised: 80, malware: 95, drop: 95 };
export function assessIp(sources: IpSource[]): IpAssessment {
  const available = sources.filter(s => s.status === "ok");
  const scored = available.filter(s => s.kind === "reputation" && typeof s.risk === "number" && Number.isFinite(s.risk) && s.risk >= 0 && s.risk <= 100);
  const baselineRisk = scored.length ? Math.round(scored.reduce((n, s) => n + s.risk!, 0) / scored.length) : null;
  const signals = (Object.keys(IP_SIGNAL_LABELS) as IpSignal[]).map(signal => {
    const positive = available.filter(s => s.signals[signal] === true).map(s => s.name);
    const negative = available.filter(s => s.signals[signal] === false).map(s => s.name);
    return { signal, detected: positive.length ? true : negative.length ? false : null, disagreement: !!positive.length && !!negative.length, positive, negative };
  });
  const reasons = signals.filter(s => s.detected).map(s => ({ signal: s.signal, label: IP_SIGNAL_LABELS[s.signal], floor: SIGNAL_FLOORS[s.signal], sources: s.positive }));
  // Narrow lists never dilute a reputation score. No usable broad source means no purity score.
  const risk = baselineRisk === null ? null : Math.max(baselineRisk, ...reasons.map(r => r.floor));
  const purity = risk === null ? null : 100 - risk;
  const riskRange: [number, number] | null = scored.length ? [Math.min(...scored.map(s => s.risk!)), Math.max(...scored.map(s => s.risk!))] : null;
  const disagreement = !!riskRange && riskRange[1] - riskRange[0] >= 40 || signals.some(s => s.disagreement);
  const confidence = !scored.length ? "insufficient" : scored.length < 2 || disagreement || available.length < sources.length ? "limited" : "good";
  return { purity, risk, baselineRisk, label: purity === null ? "资料不足" : purity >= 80 ? "较高纯净度" : purity >= 60 ? "中等纯净度" : "较低纯净度", tone: purity === null ? "unknown" : purity >= 80 ? "good" : purity >= 60 ? "medium" : "poor", confidence, scoredSources: scored.length, availableSources: available.length, totalSources: sources.length, riskRange, disagreement, reasons, signals };
}
