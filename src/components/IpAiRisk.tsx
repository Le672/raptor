import { useState } from "react";
import { ArrowUpRight, CircleHelp, ShieldCheck } from "lucide-react";
import { AI_DETAILS_VERIFIED_ON, AI_POLICY_VERIFIED_ON, AI_SITE_POLICIES } from "@/data/ai-access-policies";
import { assessAiSites, type AiRiskLevel } from "@/lib/ip-ai-risk";
import type { IpReport } from "@/lib/ip";

const filters: { id: "all" | AiRiskLevel; label: string }[] = [
  { id: "all", label: "全部服务" }, { id: "high", label: "较高风险" }, { id: "caution", label: "验证风险" }, { id: "unknown", label: "需要核对" }, { id: "low", label: "网络线索较低" },
];

export function IpAiRisk({ report, loading }: { report: IpReport | null; loading: boolean }) {
  const [filter, setFilter] = useState<"all" | AiRiskLevel>("all");
  const result = report ? assessAiSites(report) : null;
  const sites = result?.sites.filter(site => filter === "all" || site.level === filter) || [];
  return <section className="ip-ai" aria-labelledby="ip-ai-title" data-testid="ip-ai-risk">
    <div className="ip-section-heading"><div><p className="eyebrow">AI ACCESS / PUBLIC RULES</p><h2 id="ip-ai-title">AI 网站访问风险</h2></div><span>{AI_SITE_POLICIES.length} 个服务 · 说明核对 {AI_DETAILS_VERIFIED_ON}</span></div>
    <p className="ip-ai-intro">按网络证据、地区规则、账号资格和功能限制分别分析。这里没有测试登录或读取账号；风险提示是本站推断，不表示平台已封禁这个 IP 或封禁概率。</p>
    {result && report ? <>
      <div className={`ip-ai-context ip-ai-${result.network.level}`}><ShieldCheck size={20} /><div><strong>{result.network.label}</strong><span>核对地址 {report.ip} · {result.countries.length ? `IP 地区：${result.countries.map(item => `${item.label} (${item.code})`).join(" / ")}` : "IP 地区未提供"}</span><ul>{result.network.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div></div>
      <div className="ip-ai-evidence" aria-label="AI 分析的网络依据">{result.evidence.map(item => <article key={item.id} className={`ip-evidence-${item.level}`}>
        <span className="ip-small-label">{item.title}</span><strong>{item.label}</strong><p>{item.detail}</p><small>{item.sources.length ? `依据：${item.sources.join("、")}` : "尚无有效来源"}</small>
      </article>)}</div>
      <div className="ip-filter-bar" role="group" aria-label="筛选 AI 风险">{filters.map(item => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<small>{item.id === "all" ? result.sites.length : result.sites.filter(site => site.level === item.id).length}</small></button>)}</div>
      <div className="ip-ai-grid">{sites.map(({ policy, level, label, network, region, conclusion, nextSteps }) => <article className={`ip-ai-card ip-ai-${level}`} key={policy.id} aria-label={`${policy.name} 访问风险`} data-testid={`ai-risk-${policy.id}`}>
        <header><div><a href={policy.href} target="_blank" rel="noreferrer"><h3>{policy.name}</h3><ArrowUpRight size={14} /></a><small>{policy.scope}</small></div><span className={`ip-ai-badge ip-ai-badge-${level}`}>{label}</span></header>
        <p className="ip-ai-conclusion">{conclusion}</p>
        <dl><div><dt>网络侧 · 本站推断</dt><dd>{network.label}</dd></div><div><dt>地区规则 · 官方资料</dt><dd className={`ip-ai-region-${region.status}`}>{region.label}</dd></div><div><dt>账号资格</dt><dd className="ip-ai-unchecked">未检测</dd></div><div><dt>功能与额度</dt><dd className="ip-ai-unchecked">未检测</dd></div></dl>
        <p className="ip-ai-region-detail">{region.detail}</p>
        <details className="ip-ai-details"><summary>查看账号、功能与排查建议</summary><div>
          <p><strong>官方说明</strong>{policy.summary}</p>
          <p><strong>账号与会话</strong>{policy.account}</p>
          <p><strong>功能与额度</strong>{policy.features}</p>
          <div className="ip-ai-symptoms"><strong>遇到这些提示时</strong>{policy.symptoms.map(symptom => <p key={symptom.title}><b>{symptom.title}</b>{symptom.detail}</p>)}</div>
          <div className="ip-ai-steps"><strong>按顺序核对</strong><ol>{nextSteps.map(step => <li key={step}>{step}</li>)}</ol></div>
          <p className="ip-ai-advice">{policy.advice}</p>
        </div></details>
        <nav aria-label={`${policy.name} 官方依据`}>{policy.links.map(link => <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label}<ArrowUpRight size={11} /></a>)}</nav>
      </article>)}</div>
      {!sites.length && <p className="ip-source-empty">本次没有属于这一类别的服务，可以切换筛选查看其余结果。</p>}
    </> : <div className="ip-source-empty">{loading ? "查询完成后，将按这次 IP 的结果更新详细分析。" : "查询纯净度后，展示各服务的网络线索、地区资格、账号要求和排查建议。"}<div className="ip-ai-platforms">{AI_SITE_POLICIES.map(site => <span key={site.id}>{site.name}</span>)}</div></div>}
    <details className="ip-method ip-ai-method"><summary><CircleHelp size={17} /> 这些风险提示如何判断？</summary><div>
      <p>综合风险达到 60，或检出 Tor、被入侵、恶意 C2、DROP、滥用 / 扫描标记时提示较高网络风险；综合风险达到 25，或检出 VPN、公开代理、匿名网络、机房属性时提示验证风险。风险评分不足两家、存在分歧或缺少关键网络标记时，不给出低风险结论。这些阈值是本站的启发式规则，并非任何平台公开的风控阈值。</p>
      <p>各服务共用网络证据，分别核对公开网页地区规则及账号、功能说明。ChatGPT、Claude、Gemini 地区名单快照核对于 {AI_POLICY_VERIFIED_ON}；Gemini 按个人账号判断，Workspace 例外单独注明。其余服务没有核实到完整名单时保留未知，不能据此判定全球可用。位置有分歧时不会选取一家作为准入结论。</p>
      <p>公开威胁记录存在检测范围和更新延迟，网段记录不能证明单个用户曾进行恶意活动，聚合名单也不是多份独立风险评分。缺失、限额或不支持的结果不会当作安全；ASN 注册地不代替 IP 位置。</p>
      <p>本页仅复用目标 IP 已查询的资料，不向 AI 服务发送目标 IP 或测试登录。未检测账号信誉、设备、会话、支付资格、用量与内部名单。验证码不等于账号封禁，额度不足也不等于 IP 风控；名单内、高纯净度均不保证账号或功能可用。</p>
    </div></details>
  </section>;
}
