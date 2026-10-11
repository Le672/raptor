import { ArrowUpRight, CircleHelp, ShieldCheck } from "lucide-react";
import { AI_POLICY_VERIFIED_ON, AI_SITE_POLICIES } from "@/data/ai-access-policies";
import { assessAiSites } from "@/lib/ip-ai-risk";
import type { IpReport } from "@/lib/ip";

export function IpAiRisk({ report, loading }: { report: IpReport | null; loading: boolean }) {
  const result = report ? assessAiSites(report) : null;
  return <section className="ip-ai" aria-labelledby="ip-ai-title" data-testid="ip-ai-risk">
    <div className="ip-section-heading"><div><p className="eyebrow">AI ACCESS / PUBLIC RULES</p><h2 id="ip-ai-title">AI 网站访问风险</h2></div><span>规则核对 {AI_POLICY_VERIFIED_ON} · 网页入口</span></div>
    <p className="ip-ai-intro">结合本次 IP 纯净度、网络标记与官方地区规则推断。平台的实际风控还取决于账号、设备、会话和使用行为，以下提示不表示封禁概率或已被限制。</p>
    {result && report ? <>
      <div className={`ip-ai-context ip-ai-${result.network.level}`}><ShieldCheck size={20} /><div><strong>{result.network.label}</strong><span>核对地址 {report.ip} · {result.countries.length ? `IP 地区：${result.countries.map(item => `${item.label} (${item.code}) · ${item.sources.join("、")}`).join(" / ")}` : "IP 地区未提供"}</span><ul>{result.network.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div></div>
      <div className="ip-ai-grid">{result.sites.map(({ policy, level, label, network, region }) => <article className={`ip-ai-card ip-ai-${level}`} key={policy.id} aria-label={`${policy.name} 访问风险`} data-testid={`ai-risk-${policy.id}`}>
        <header><div><a href={policy.href} target="_blank" rel="noreferrer"><h3>{policy.name}</h3><ArrowUpRight size={14} /></a><small>{policy.scope}</small></div><span className={`ip-ai-badge ip-ai-badge-${level}`}>{label}</span></header>
        <dl><div><dt>网络侧 · 本站推断</dt><dd>{network.label}</dd></div><div><dt>地区规则 · 官方资料</dt><dd className={`ip-ai-region-${region.status}`}>{region.label}</dd></div></dl>
        <p className="ip-ai-region-detail">{region.detail}</p>
        <p className="ip-ai-rule"><strong>官方说明</strong>{policy.summary}</p><p className="ip-ai-advice">{policy.advice}</p>
        <nav aria-label={`${policy.name} 官方依据`}>{policy.links.map(link => <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label}<ArrowUpRight size={11} /></a>)}</nav>
      </article>)}</div>
    </> : <div className="ip-source-empty">{loading ? "查询完成后，将按这次 IP 的结果更新风险提示。" : "查询纯净度后，展示各网站的访问风险和地区资格提示。"}<div className="ip-ai-platforms">{AI_SITE_POLICIES.map(site => <span key={site.id}>{site.name}</span>)}</div></div>}
    <details className="ip-method ip-ai-method"><summary><CircleHelp size={17} /> 这些风险提示如何判断？</summary><div>
      <p>网络风险使用本次查询结果：综合风险达到 60，或检出 Tor、被入侵、近期恶意 C2、DROP 标记时提示较高风险；综合风险达到 25，或检出 VPN、公开代理、匿名网络、机房属性时提示存在验证风险。风险评分不足两家、有来源分歧或缺少关键网络标记时，不给出低风险结论。阈值是本站的启发式规则，并非任何平台公开的风控阈值。</p>
      <p>各网站共用网络侧判断，地区支持情况分别核对。ChatGPT、Claude、Gemini 使用上述日期核对的公开网页名单；Gemini 按个人账号判断，Workspace 例外单独注明。Copilot 仅标注官网明确的地区例外，Perplexity 和 Grok 未核实完整名单时保持待核对。位置分歧不会选择一家作为准入结论，国家级名单也不能判断所有子地区限制。</p>
      <p>判断对象始终是上方“核对地址”，不是当前访问者 IP。仅复用已查询的风险与位置资料，不会向这些 AI 网站发送目标 IP 或测试登录。公开规则是日期快照，链接可查看官网最新要求；IP 位置不能证明实际居住地，名单内也不保证账号或功能可用。</p>
      <p>机房或 VPN 属性本身不表示恶意，验证码也不等于账号封禁。此处评估的是网络和地区带来的访问风险，无法检查账号信誉、浏览器特征、支付资格、请求频率或平台内部名单。</p>
    </div></details>
  </section>;
}
