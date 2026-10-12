import type { IpSource } from "../lib/ip";

export type IpSourceDefinition = Pick<IpSource, "id" | "name" | "href" | "kind"> & { purpose: string; optional?: boolean };
export const IP_SOURCE_DEFINITIONS: IpSourceDefinition[] = [
  { id: "ipquery", name: "IPQuery", href: "https://ipquery.io/", kind: "reputation", purpose: "风险分数、VPN、代理与机房标记" },
  { id: "proxycheck", name: "proxycheck.io", href: "https://proxycheck.io/api/", kind: "reputation", purpose: "风险分数与匿名网络检测" },
  { id: "ipwhois", name: "IPWHOIS.io", href: "https://ipwhois.io/documentation", kind: "geolocation", purpose: "位置、运营商与 ASN 交叉核对" },
  { id: "ipapiis", name: "ipapi.is", href: "https://ipapi.is/developers.html", kind: "geolocation", purpose: "免费匿名接口核对网络归属；授权接口可补充安全标记" },
  { id: "ipguide", name: "IP Guide", href: "https://ip.guide/", kind: "geolocation", purpose: "网络范围、ASN 与位置；ASN 注册国不当作 IP 位置" },
  { id: "ipapico", name: "ipapi.co", href: "https://ipapi.co/api/", kind: "geolocation", purpose: "国家、城市和网络组织核对" },
  { id: "tor", name: "Tor Project", href: "https://check.torproject.org/torbulkexitlist", kind: "exit-list", purpose: "Tor 官方 IPv4 出口名单" },
  { id: "spamhaus", name: "Spamhaus DROP", href: "https://www.spamhaus.org/blocklists/do-not-route-or-peer/", kind: "threat-list", purpose: "恶意 IPv4 / IPv6 网段" },
  { id: "feodo", name: "abuse.ch · Feodo Tracker", href: "https://feodotracker.abuse.ch/blocklist/", kind: "threat-list", purpose: "最近 30 天的恶意 C2 记录" },
  { id: "dshield", name: "SANS ISC · DShield", href: "https://www.dshield.org/feeds_doc.html", kind: "threat-list", purpose: "近期扫描活跃的 /24 网段；不是单个用户行为证明" },
  { id: "cins", name: "CINS Army", href: "https://cinsscore.com/", kind: "threat-list", purpose: "Sentinel IPS 公开威胁地址名单" },
  { id: "ipsum", name: "IPsum", href: "https://github.com/stamparm/ipsum", kind: "threat-list", purpose: "至少 3 个公开名单共同收录；聚合来源可能重叠" },
  { id: "ipqs", name: "IPQualityScore", href: "https://www.ipqualityscore.com/documentation/proxy-detection-api/overview", kind: "reputation", purpose: "授权 API 的欺诈风险、代理与近期滥用标记", optional: true },
  { id: "abuseipdb", name: "AbuseIPDB", href: "https://docs.abuseipdb.com/", kind: "threat-list", purpose: "授权 API 的 30 天滥用置信分与报告数；不参与风险平均", optional: true },
  { id: "ipinfo", name: "IPinfo Lite", href: "https://ipinfo.io/developers", kind: "geolocation", purpose: "授权 API 的国家和 ASN；不提供风险评分", optional: true },
];
export const PUBLIC_IP_SOURCE_COUNT = IP_SOURCE_DEFINITIONS.filter(source => !source.optional).length;

// These are user-opened review pages, never scraped and never included in the score.
export const IP_REVIEW_SITES = [
  { name: "Scamalytics", href: "https://scamalytics.com/ip", focus: "欺诈风险与代理检测", target: (ip: string) => `https://scamalytics.com/ip/${encodeURIComponent(ip)}` },
  { name: "IPQualityScore", href: "https://www.ipqualityscore.com/free-ip-lookup-proxy-vpn-test", focus: "VPN、代理与欺诈评分" },
  { name: "AbuseIPDB", href: "https://www.abuseipdb.com/", focus: "近期滥用报告", target: (ip: string) => `https://www.abuseipdb.com/check/${encodeURIComponent(ip)}` },
  { name: "IPinfo", href: "https://ipinfo.io/", focus: "ASN、运营商和网络属性", target: (ip: string) => `https://ipinfo.io/${encodeURIComponent(ip)}` },
  { name: "IP2Location", href: "https://www.ip2location.com/", focus: "地理位置与使用类型" },
  { name: "IP2Proxy", href: "https://www.ip2proxy.com/", focus: "代理类别与匿名网络" },
  { name: "IPHub", href: "https://iphub.info/", focus: "机房、代理和出口类别" },
  { name: "VirusTotal", href: "https://www.virustotal.com/", focus: "多引擎 IP 检测与历史关联", target: (ip: string) => `https://www.virustotal.com/gui/ip-address/${encodeURIComponent(ip)}` },
  { name: "Cisco Talos", href: "https://talosintelligence.com/reputation_center", focus: "威胁与邮件信誉" },
  { name: "MXToolbox", href: "https://mxtoolbox.com/blacklists.aspx", focus: "邮件黑名单；不等于 AI 访问封禁" },
];
