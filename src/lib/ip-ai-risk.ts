import { AI_REGION_COUNTRIES, AI_SITE_POLICIES, KNOWN_COUNTRY_CODES, type AiSitePolicy } from "@/data/ai-access-policies";
import { IP_SIGNAL_LABELS, type IpReport, type IpSignal, type IpSource } from "@/lib/ip";

export type AiRiskLevel = "low" | "caution" | "high" | "unknown";
export type AiNetworkRisk = { level: AiRiskLevel; label: string; reasons: string[] };
export type IpCountryEvidence = { code: string; label: string; sources: string[] };
export type AiRegionAssessment = { status: "listed" | "restricted" | "unknown" | "conflict"; label: string; detail: string };
export type AiSiteAssessment = { policy: AiSitePolicy; level: AiRiskLevel; label: string; network: AiNetworkRisk; region: AiRegionAssessment };

const knownCodes = new Set(KNOWN_COUNTRY_CODES);
const normalizeName = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const countryNames = new Map<string, string>();
const englishNames = new Intl.DisplayNames(["en"], { type: "region" });
const chineseNames = new Intl.DisplayNames(["zh-CN"], { type: "region" });
for (const code of KNOWN_COUNTRY_CODES) countryNames.set(normalizeName(englishNames.of(code) || code), code);
for (const [name, code] of Object.entries({
  "United States of America": "US", "United Kingdom": "GB", "Czech Republic": "CZ", "Republic of Cyprus": "CY",
  "Cabo Verde": "CV", "Congo (Brazzaville)": "CG", "Congo (DRC)": "CD", "Republic of the Congo": "CG",
  "Democratic Republic of the Congo": "CD", "Palestine": "PS", "Turkey": "TR", "Macau": "MO",
  "Antigua and Barbuda": "AG", "Bosnia and Herzegovina": "BA", "Trinidad and Tobago": "TT",
  "Saint Kitts and Nevis": "KN", "Saint Lucia": "LC", "Saint Vincent and the Grenadines": "VC",
  "Saint Pierre and Miquelon": "PM", "Sao Tome and Principe": "ST", "Wallis and Futuna": "WF",
  "Svalbard and Jan Mayen": "SJ", "Saint Helena": "SH", "Saint Barthelemy": "BL", "UK": "GB",
})) countryNames.set(normalizeName(name), code);

function countryCode(value?: string): string | null {
  if (!value?.trim()) return null;
  const code = value.trim().toUpperCase();
  return knownCodes.has(code) ? code : countryNames.get(normalizeName(value)) || null;
}

export function getIpCountries(sources: IpSource[]): IpCountryEvidence[] {
  const results = new Map<string, Set<string>>();
  for (const source of sources.filter(item => item.status === "ok")) {
    // Preserve conflicts within one provider as well as disagreements across providers.
    const codes = new Set([countryCode(source.countryCode), countryCode(source.country)].filter((code): code is string => !!code));
    for (const code of codes) {
      if (!results.has(code)) results.set(code, new Set());
      results.get(code)!.add(source.name);
    }
  }
  return [...results].map(([code, sources]) => ({ code, label: chineseNames.of(code) || code, sources: [...sources] }));
}

export function assessAiNetwork(report: IpReport): AiNetworkRisk {
  const { assessment } = report;
  const positive = assessment.signals.filter(signal => signal.detected === true);
  const reasons = positive.map(signal => `${IP_SIGNAL_LABELS[signal.signal]}：${signal.positive.join("、")}${signal.disagreement ? "（来源有分歧）" : ""}`);
  if (assessment.purity !== null) reasons.unshift(`综合纯净度 ${assessment.purity} / 100，综合风险 ${assessment.risk} / 100。`);
  if (assessment.scoredSources < 2) reasons.push("有效风险评分不足两家，不能据此给出低风险结论。");
  if (assessment.disagreement) reasons.push("来源评分或网络标记有分歧，需要核对原始结果。");
  const strong: IpSignal[] = ["tor", "compromised", "malware", "drop"];
  if (positive.some(signal => strong.includes(signal.signal)) || (assessment.risk !== null && assessment.risk >= 60)) {
    if (assessment.purity === null) reasons.push("风险数据库未给出完整分数，已命中的名单或网络标记仍保留提示。");
    return { level: "high", label: "网络风险较高", reasons };
  }
  if (positive.length || (assessment.risk !== null && assessment.risk >= 25)) return { level: "caution", label: "存在验证风险", reasons };
  const essential: IpSignal[] = ["vpn", "proxy", "tor", "hosting"];
  const missing = essential.filter(key => assessment.signals.find(signal => signal.signal === key)?.detected == null);
  if (assessment.scoredSources < 2 || assessment.purity === null || assessment.disagreement || missing.length) {
    if (missing.length) reasons.push(`尚未覆盖：${missing.map(key => IP_SIGNAL_LABELS[key]).join("、")}。`);
    return { level: "unknown", label: "网络资料不足", reasons };
  }
  reasons.push("两家风险评分及已覆盖的网络标记未显示较高风险，仍可能遇到验证码或账号核验。");
  return { level: "low", label: "网络风险较低", reasons };
}

export function assessAiRegion(policy: AiSitePolicy, countries: IpCountryEvidence[]): AiRegionAssessment {
  if (!countries.length) return { status: "unknown", label: "位置未提供", detail: "本次有效来源未提供可识别的国家或地区，无法核对地区资格。" };
  if (countries.length > 1) return { status: "conflict", label: "位置有分歧", detail: `来源给出 ${countries.map(item => `${item.label} (${item.code})`).join(" / ")}，不选取其中一家作为准入结论。` };
  const { code, label } = countries[0];
  if (policy.regionPolicy === "allowlist") {
    if (policy.id === "claude" && ["GU", "MP"].includes(code)) return { status: "unknown", label: "需确认具体领地", detail: "Claude 官方名单写作 Mariana Islands，具体领地范围需向官方核对。" };
    if (["chatgpt", "claude"].includes(policy.id) && code === "UA") return { status: "unknown", label: "部分地区需核对", detail: "国家级位置不足以判断地区例外；请以官方支持范围为准。" };
    const listed = AI_REGION_COUNTRIES[policy.id as keyof typeof AI_REGION_COUNTRIES].includes(code);
    if (policy.id === "gemini" && code === "CN") return { status: "restricted", label: "个人版名单外", detail: "中国大陆在 Gemini 官方网页名单中仅列为 Workspace 可用；本项按个人账号判断。" };
    return listed
      ? { status: "listed", label: "公开地区名单内", detail: `${label} (${code}) 位于本次核对的网页地区名单内；账号和具体功能资格仍需另外确认。` }
      : { status: "restricted", label: "公开地区名单外", detail: `${label} (${code}) 未列入本次核对的网页支持名单，存在地区访问限制风险。` };
  }
  if (policy.regionPolicy === "copilot" && code === "CN") return { status: "restricted", label: "官方地区例外", detail: "Microsoft 官方说明中国大陆属于不可用或不支持的地区例外，香港不在该项排除范围内。" };
  return { status: "unknown", label: "地区仍需核对", detail: policy.regionPolicy === "copilot" ? "官方说明覆盖多个市场，但没有在该页提供逐国完整名单，需核对具体入口与功能。" : "本次未核实到此网页入口的完整地区名单，不能把未查到限制视为全球可用。" };
}

export function assessAiSites(report: IpReport): { countries: IpCountryEvidence[]; network: AiNetworkRisk; sites: AiSiteAssessment[] } {
  const countries = getIpCountries(report.sources), network = assessAiNetwork(report);
  const sites = AI_SITE_POLICIES.map(policy => {
    const region = assessAiRegion(policy, countries);
    const level = region.status === "restricted" ? "high" : network.level === "low" && region.status !== "listed" ? "unknown" : network.level;
    const label = region.status === "restricted" ? "地区访问风险较高" : level === "unknown" && network.level === "low" ? "地区仍需核对" : network.label;
    return { policy, region, network, level, label };
  });
  return { countries, network, sites };
}
