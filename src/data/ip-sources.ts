import type { IpSource } from "../lib/ip";

export type IpSourceDefinition = Pick<IpSource, "id" | "name" | "href" | "kind"> & { purpose: string; optional?: boolean };
export const IP_SOURCE_DEFINITIONS: IpSourceDefinition[] = [
  { id: "ipquery", name: "IPQuery", href: "https://ipquery.io/", kind: "reputation", purpose: "风险分数、VPN、代理与机房标记" },
  { id: "proxycheck", name: "proxycheck.io", href: "https://proxycheck.io/api/", kind: "reputation", purpose: "风险分数与匿名网络检测" },
  { id: "layer3", name: "Layer3 Intel", href: "https://docs.layer3intel.com/docs/intel-api/open-api", kind: "reputation", purpose: "IPv4 风险分数、ISP / 机房代理、VPN 与隐私中继；公开版不覆盖实时住宅代理" },
  { id: "blackbox", name: "Blackbox · ipinfo.app", href: "https://blackbox.ipinfo.app/", kind: "reputation", purpose: "v3beta 网络分类、机房与匿名网络标记；与 IPinfo.io 是不同提供方" },
  { id: "iplogs", name: "IPlogs", href: "https://iplogs.com/docs", kind: "reputation", purpose: "VPN / 代理 / Tor / 中继检测；检出分单独展示，不混入欺诈风险平均" },
  { id: "stopforumspam", name: "Stop Forum Spam", href: "https://www.stopforumspam.com/usage", kind: "threat-list", purpose: "论坛垃圾信息记录、次数、置信度及最后出现时间" },
  { id: "blocklistde", name: "blocklist.de", href: "https://www.blocklist.de/en/export.html", kind: "threat-list", purpose: "公开攻击报告地址名单，支持 IPv4 / IPv6，保留名单日期" },
  { id: "emergingthreats", name: "Emerging Threats", href: "https://rules.emergingthreats.net/blockrules/", kind: "threat-list", purpose: "被入侵 IPv4 地址名单，过期资料不参与判断" },
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
  { name: "IPure", href: "https://ipure.dev/", focus: "聚合纯净度及各项扣分依据；可能与本站来源重叠", target: (ip: string) => `https://ipure.dev/ip/${encodeURIComponent(ip)}` },
  { name: "IPlogs", href: "https://iplogs.com/", focus: "匿名网络与 VPN 检出依据", target: (ip: string) => `https://iplogs.com/ip/${encodeURIComponent(ip)}` },
  { name: "Layer3 Intel", href: "https://layer3intel.com/", focus: "ISP / 机房代理、网络与路由资料" },
  { name: "Stop Forum Spam", href: "https://www.stopforumspam.com/", focus: "论坛垃圾信息报告", target: (ip: string) => `https://www.stopforumspam.com/ipcheck/${encodeURIComponent(ip)}` },
  { name: "GreyNoise", href: "https://viz.greynoise.io/", focus: "互联网扫描与已知正常服务", target: (ip: string) => `https://viz.greynoise.io/ip/${encodeURIComponent(ip)}` },
  { name: "Shodan InternetDB", href: "https://internetdb.shodan.io/", focus: "已观察到的端口与漏洞标签；开放端口本身不代表恶意", target: (ip: string) => `https://internetdb.shodan.io/${encodeURIComponent(ip)}` },
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
