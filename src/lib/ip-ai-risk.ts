import { AI_REGION_COUNTRIES, AI_SITE_POLICIES, KNOWN_COUNTRY_CODES, type AiSitePolicy } from "@/data/ai-access-policies";
import { IP_SIGNAL_LABELS, type IpReport, type IpSignal, type IpSource } from "@/lib/ip";

export type AiRiskLevel = "low" | "caution" | "high" | "unknown";
export type AiNetworkRisk = { level: AiRiskLevel; label: string; reasons: string[] };
export type IpCountryEvidence = { code: string; label: string; sources: string[] };
export type AiRegionAssessment = { status: "listed" | "restricted" | "unknown" | "conflict"; label: string; detail: string };
export type AiSiteAssessment = { policy: AiSitePolicy; level: AiRiskLevel; label: string; network: AiNetworkRisk; region: AiRegionAssessment; conclusion: string; nextSteps: string[] };
export type AiEvidenceDimension = { id: string; title: string; level: AiRiskLevel; label: string; detail: string; sources: string[] };

const knownCodes = new Set(KNOWN_COUNTRY_CODES);
const normalizeName = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const countryNames = new Map<string, string>();
const englishNames = new Intl.DisplayNames(["en"], { type: "region" });
const chineseNames = new Intl.DisplayNames(["zh-CN"], { type: "region" });
for (const code of KNOWN_COUNTRY_CODES) { countryNames.set(normalizeName(englishNames.of(code) || code), code); countryNames.set(normalizeName(chineseNames.of(code) || code), code); }
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
  const unavailable = report.sources.filter(source => source.status === "error" || source.status === "unsupported");
  if (unavailable.length) reasons.push(`${unavailable.length} 个来源未完成或不覆盖此地址类型，未把缺失项按安全处理。`);
  const strong: IpSignal[] = ["tor", "compromised", "malware", "drop", "abuse"];
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

export function assessAiEvidence(report: IpReport, countries = getIpCountries(report.sources)): AiEvidenceDimension[] {
  const scores = report.sources.filter(source => source.status === "ok" && source.kind === "reputation" && typeof source.risk === "number" && Number.isFinite(source.risk) && source.risk >= 0 && source.risk <= 100);
  const dimension = (id: string, title: string, keys: IpSignal[], positiveLevel: AiRiskLevel, clearLabel: string): AiEvidenceDimension => {
    const signals = report.assessment.signals.filter(signal => keys.includes(signal.signal));
    const detected = signals.filter(signal => signal.detected === true), covered = signals.filter(signal => signal.detected !== null);
    const sourceNames = [...new Set(signals.flatMap(signal => [...signal.positive, ...signal.negative]))];
    const conflict = signals.some(signal => signal.disagreement), missing = keys.filter(key => !covered.some(signal => signal.signal === key));
    return { id, title, level: detected.length ? positiveLevel : missing.length || conflict ? "unknown" : "low", label: detected.length ? "有公开风险线索" : missing.length || conflict ? "覆盖不完整" : clearLabel,
      detail: detected.length ? `${detected.map(signal => IP_SIGNAL_LABELS[signal.signal]).join("、")}被检出${conflict ? "，来源有分歧" : ""}；名单命中不等于平台已经封禁。` : missing.length ? `尚未覆盖 ${missing.map(key => IP_SIGNAL_LABELS[key]).join("、")}；已核对的非命中仅说明这些项目。` : "已覆盖的公开检查未检出标记；未查询的平台内部记录仍然未知。", sources: sourceNames };
  };
  const reputation: AiEvidenceDimension = { id: "reputation", title: "原始风险评分", level: scores.length < 2 || report.assessment.disagreement ? "unknown" : report.assessment.baselineRisk! >= 60 ? "high" : report.assessment.baselineRisk! >= 25 ? "caution" : "low", label: scores.length < 2 ? "评分来源不足" : report.assessment.disagreement ? "来源有分歧" : `${scores.length} 家有效评分`, detail: scores.length ? scores.map(source => `${source.name} ${source.risk}/100`).join(" · ") + "；不是 AI 封禁概率。" : "没有有效的广义风险分数，不能生成安全承诺。", sources: scores.map(source => source.name) };
  const geography: AiEvidenceDimension = { id: "geography", title: "出口位置一致性", level: countries.length === 1 ? "low" : "unknown", label: !countries.length ? "位置未提供" : countries.length > 1 ? "位置有分歧" : "地区资料一致", detail: countries.length ? countries.map(country => `${country.label} (${country.code})`).join(" / ") + "；数据库位置不证明实际居住地。" : "没有可识别的 IP 位置资料，ASN 注册国家不用于替代。", sources: [...new Set(countries.flatMap(country => country.sources))] };
  return [reputation, dimension("anonymity", "匿名网络与出口类型", ["vpn", "proxy", "tor", "hosting"], "caution", "未检出匿名属性"), dimension("threats", "公开威胁与滥用记录", ["malware", "drop", "abuse", "compromised"], "high", "已覆盖项未命中"), geography];
}

export function assessAiSites(report: IpReport): { countries: IpCountryEvidence[]; network: AiNetworkRisk; evidence: AiEvidenceDimension[]; sites: AiSiteAssessment[] } {
  const countries = getIpCountries(report.sources), network = assessAiNetwork(report);
  const sites = AI_SITE_POLICIES.map(policy => {
    const region = assessAiRegion(policy, countries);
    const level = region.status === "restricted" ? "high" : network.level === "low" && region.status !== "listed" ? "unknown" : network.level;
    const label = region.status === "restricted" ? "地区访问风险较高" : level === "unknown" && network.level === "low" ? "地区仍需核对" : network.label;
    const conclusion = region.status === "restricted" ? `${policy.name} 首先存在地区资格风险；即使网络纯净度较高，也不能据此判断允许访问。`
      : region.status === "conflict" ? `位置来源有分歧，暂不判断 ${policy.name} 的地区资格。${network.level === "high" || network.level === "caution" ? "同时保留已检出的网络风险提示。" : ""}`
      : network.level === "high" ? `公开记录提示较高网络风险，使用 ${policy.name} 时需留意验证或访问限制；平台是否已限制此 IP 未检测。`
      : network.level === "caution" ? `匿名网络、出口属性或原始评分带来验证风险；${policy.name} 的账号与功能资格仍需单独核对。`
      : network.level === "unknown" ? `当前网络资料不足，不能为 ${policy.name} 给出低风险结论。`
      : region.status !== "listed" ? `网络侧线索较低，但 ${policy.name} 地区范围尚未核实，不能保证可用。`
      : `当前网络线索较低，且 IP 地区位于 ${policy.name} 公开网页名单内；实际账号、设备及功能资格未检测。`;
    const nextSteps = [...policy.checks];
    if (region.status === "conflict") nextSteps.unshift("先核对位置分歧，提供方对同一出口的地区判断可能不同。");
    if (report.assessment.signals.some(signal => signal.detected && ["abuse", "drop", "malware", "compromised"].includes(signal.signal))) nextSteps.unshift("核对名单日期、地址或网段范围；若记录与实际情况不符，可向名单维护方或网络服务商申请复核。");
    return { policy, region, network, level, label, conclusion, nextSteps };
  });
  return { countries, network, evidence: assessAiEvidence(report, countries), sites };
}
