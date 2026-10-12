import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, CircleHelp, Globe2, Network, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { CopyButton } from "@/components/CopyButton";
import { IpAiRisk } from "@/components/IpAiRisk";
import { IpSources, ipDateText as dateText } from "@/components/IpSources";
import { PUBLIC_IP_SOURCE_COUNT } from "@/data/ip-sources";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useVisitorNetwork } from "@/hooks/useVisitorNetwork";
import { isPublicIp, normalizeIp, IP_SIGNAL_LABELS, type IpReport } from "@/lib/ip";
import { queryIp } from "@/lib/ip-client";
import "@/ip.css";

const confidenceText = { good: "资料较完整", limited: "结果需交叉核对", insufficient: "资料不足" };
export default function Ip() {
  useDocumentMeta("IP 纯净度", "查看公网 IP 与 ASN，交叉核对 IP 纯净度、原始资料和评分依据，并结合网络标记与官方地区规则提示常见 AI 网站的访问风险。");
  const visitor = useVisitorNetwork();
  const [input, setInput] = useState(""), [loading, setLoading] = useState(false), [error, setError] = useState<string | null>(null), [report, setReport] = useState<IpReport | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { if (visitor.data?.ip) setInput(value => value || visitor.data!.ip!); }, [visitor.data]);
  useEffect(() => () => controller.current?.abort(), []);
  async function inspect(event: React.FormEvent) {
    event.preventDefault(); const target = normalizeIp(input);
    if (!target || !isPublicIp(target.ip)) { setError("请输入公网 IPv4 或 IPv6 地址，不支持内网地址、域名或 URL。"); return; }
    controller.current?.abort(); const active = new AbortController(); controller.current = active;
    setLoading(true); setError(null); setReport(null);
    try { const result = await queryIp(target.ip, active.signal); if (!active.signal.aborted) setReport(result); }
    catch (failure) { if (!active.signal.aborted) setError(failure instanceof Error ? failure.message : "查询失败，请稍后重试。"); }
    finally { if (!active.signal.aborted) setLoading(false); }
  }
  const assessment = report?.assessment, sources = report?.sources || [];
  const network = sources.find(source => source.status === "ok" && source.asn);
  const identities = [...new Set(sources.filter(s => s.status === "ok" && s.asn).map(s => s.asn))];
  return <div className="ip-page">
    <div className="ip-page-top"><HomeLink className="text-link">返回主站 <ArrowUpRight size={15} /></HomeLink><a href="https://speed.yukino.bond/" className="text-link" target="_blank" rel="noreferrer">网络测速 <ArrowUpRight size={15} /></a></div>
    <header className="ip-hero"><div><p className="eyebrow"><span className="status-dot" /> YUKINO / IP INTELLIGENCE</p><h1>看清 IP 的<span>来处。</span></h1><p>从网络归属到公开记录，给每个分数一份依据。</p></div><div className="ip-hero-note"><ShieldCheck size={21} /><span>{PUBLIC_IP_SOURCE_COUNT} 个公开数据来源<br /><small>IPv4 / IPv6 · 只需浏览器</small></span></div></header>
    <nav className="ip-section-nav" aria-label="IP 页面章节"><a href="#ip-ai-title">AI 服务分析</a><a href="#ip-sources-title">各来源证据</a><a href="#ip-review-title">外部网站复核</a></nav>
    <div className="ip-workspace">
      <aside className="ip-panel ip-query-panel"><div className="ip-panel-heading"><span><Search size={17} /> 查询地址</span><small>01 / LOOKUP</small></div>
        <div className="ip-current" aria-label="当前访问者连接"><span className="ip-small-label">当前连接 · Cloudflare</span>{visitor.loading ? <p role="status">正在读取你的公网 IP…</p> : visitor.data?.ip ? <><strong className="ip-current-address">{visitor.data.ip}</strong><p><Network size={14} /> {visitor.data.asn || "ASN 未提供"}</p><p>{visitor.data.organization || "网络组织未提供"}</p><CopyButton text={visitor.data.ip} label="复制当前 IP" /></> : <><p>{visitor.error || "当前环境未提供公网 IP，可手动查询。"}</p><button className="ip-text-button" onClick={visitor.refresh}><RefreshCw size={13} /> 重新读取</button></>}</div>
        <form onSubmit={inspect} className="ip-query-form"><label htmlFor="ip-address">要查询的公网 IP</label><input id="ip-address" autoComplete="off" spellCheck={false} placeholder="8.8.8.8 或 2606:4700:4700::1111" value={input} onChange={event => setInput(event.target.value)} disabled={loading} aria-describedby="ip-query-hint" />
          <div className="ip-input-tools"><button className="ip-text-button" type="button" disabled={!visitor.data?.ip || loading} onClick={() => setInput(visitor.data!.ip!)}>使用我的 IP</button><button className="ip-text-button" type="button" disabled={loading} onClick={() => setInput("1.1.1.1")}>IPv4 示例</button><button className="ip-text-button" type="button" disabled={loading} onClick={() => setInput("2606:4700:4700::1111")}>IPv6 示例</button></div>
          <p id="ip-query-hint" className="ip-query-hint">查询会将目标 IP 发送至风险与网络资料提供方；公开名单在本站核对。仅支持单个公网地址。</p>
          <button type="submit" className="ip-primary-button" disabled={loading}><Search size={16} /> {loading ? "正在交叉核对…" : "查询纯净度"}</button>
          {error && <p className="ip-error" role="alert">{error}</p>}
        </form>
        <div className="ip-query-foot"><Globe2 size={16} /><p>显示的是访问本站的公网出口，使用代理时可能是代理地址；位置来自网络数据库。</p></div>
      </aside>
      <section className={`ip-panel ip-result-panel ip-tone-${assessment?.tone || "unknown"}`} aria-label="IP 综合评分"><div className="ip-panel-heading"><span><ShieldCheck size={17} /> 综合纯净度</span><small>02 / ASSESSMENT</small></div>
        <div className="ip-result-main"><div className="ip-gauge" role="img" aria-label={assessment?.purity == null ? "尚无可用的纯净度评分" : `综合纯净度 ${assessment.purity} 分`}><svg viewBox="0 0 180 180" aria-hidden="true"><circle className="ip-gauge-track" cx="90" cy="90" r="77" /><circle className="ip-gauge-value" cx="90" cy="90" r="77" pathLength="100" strokeDasharray={`${assessment?.purity ?? 0} 100`} /></svg><div><span>IP PURITY</span><strong>{assessment?.purity ?? "—"}</strong><small>综合分 / 100 · 越高越好</small></div></div>
          <div className="ip-score-copy"><span className="ip-small-label">{loading ? "CROSS-CHECKING" : report ? "CURRENT ASSESSMENT" : "WAITING FOR AN ADDRESS"}</span><h2>{loading ? "正在比对公开资料" : assessment?.label || "从一个地址开始"}</h2><p>{loading ? "各来源独立查询，个别来源失败时仍保留其他结果。" : report ? assessment?.purity === null ? "风险数据库未返回有效分数，暂不生成纯净度评分；仍可查看各来源结果。" : "综合分来自有效的原始风险分数及已检出的网络标记。" : "查询后显示纯净度、网络归属与每个来源的原始结果。"}</p>{report && <div className="ip-result-address"><strong>{report.ip}</strong><span>{report.version} · {network?.asn || "ASN 未提供"}</span><span>{network?.organization}</span></div>}</div></div>
        <div className="ip-summary-grid"><div><span>数据来源</span><strong>{assessment ? `${assessment.availableSources} / ${assessment.totalSources}` : "—"}</strong><small>有效 / 已启用</small></div><div><span>原始风险</span><strong>{assessment?.baselineRisk ?? "—"}<small> / 100</small></strong><small>{assessment ? `${assessment.scoredSources} 家风险数据库` : "有效风险分数的平均值"}</small></div><div><span>资料完整度</span><strong className="ip-confidence">{assessment ? confidenceText[assessment.confidence] : "待查询"}</strong><small>{assessment?.riskRange ? `原始风险范围 ${assessment.riskRange.join("–")}` : "缺失值不按零风险计算"}</small></div></div>
        {report && <>
          <div className="ip-signals" aria-label="网络标记">{assessment!.signals.map(signal => <div key={signal.signal} className={signal.detected ? "ip-signal-positive" : ""}><span>{IP_SIGNAL_LABELS[signal.signal]}</span><strong>{signal.detected === null ? "未提供" : signal.detected ? "有来源检出" : "未检出"}</strong><small>{signal.disagreement ? "来源判断有分歧" : signal.detected ? `${signal.positive.length} 个来源` : signal.negative.length ? `${signal.negative.length} 个来源核对` : "暂无覆盖"}</small></div>)}</div>
          {assessment!.disagreement && <p className="ip-notice"><CircleHelp size={16} /> 来源评分或标记存在分歧，请结合下方原始结果判断。</p>}
          {identities.length > 1 && <p className="ip-notice">网络归属有分歧：{identities.join(" / ")}，位置差异不直接扣分。</p>}
          {!!assessment!.reasons.length && <div className="ip-score-reasons"><span className="ip-small-label">影响综合分的标记</span>{assessment!.reasons.map(reason => <p key={reason.signal}><span>{reason.label}<small>{reason.sources.join("、")}</small></span><strong>风险下限 {reason.floor}</strong></p>)}</div>}
          <p className="ip-result-date">查询时间 {dateText(report.checkedAt)} · 模型 {report.model === "yukino-ip-v2" ? "v2" : "v1"}</p>
        </>}
        <p className="ip-result-foot">此分数反映地址属性和公开记录，不代表个人信誉，也不保证任何网站放行。VPN、代理和机房属性本身不等于恶意行为。</p>
      </section>
    </div>
    <IpAiRisk report={report} loading={loading} />
    <IpSources report={report} />
    <details className="ip-method"><summary><CircleHelp size={17} /> 综合评分是怎样计算的？</summary><div>
      <p><strong>综合纯净度 = 100 − 综合风险。</strong>对成功返回的广义风险数据库分数取等权平均，再应用已检出标记的风险下限。默认评分来自 IPQuery 与 proxycheck，启用授权 IPQualityScore 后可增加该评分。没有有效原始风险分数时不生成纯净度；失败、缺失、未启用或不支持的结果不会算作零风险。</p>
      <p>风险下限：机房 20、VPN / 匿名网络 35、公开代理 50、Tor 或滥用 / 扫描标记 70、被入侵记录 80、近期恶意 C2 或 DROP 95。同类标记只算一次，下限之间取最大值，不按名单数量重复扣分。此分数是本站的可解释启发式模型，不表示统计概率。</p>
      <p>位置与 ASN 资料不参与风险平均；ASN 注册地不作为出口位置。AbuseIPDB 的滥用置信分单独展示，在分数 ≥50 且有报告时提示标记，不能与广义欺诈评分混算。IPsum 仅核对至少 3 份名单收录的地址，聚合记录可能与其他来源重叠；DShield 检测的是扫描活跃网段，不能证明每个用户的行为。</p>
      <p>Tor、Feodo、DShield、CINS 与 IPsum 公共名单仅核对 IPv4，未覆盖 IPv6 时明确显示不支持。Spamhaus DROP 核对 IPv4 / IPv6 网段。Feodo 超过 30 天的记录不参与判断；新增名单缺少日期、格式异常或超过 3 天不会当作干净结果。</p>
      <p>风险与网络接口缓存最多 10 分钟；Tor 10 分钟、Feodo 5 分钟；DROP、DShield、CINS、IPsum 全站共享且最多每小时刷新一次。来源卡保留数据日期、缓存与限制状态。遇到限额时遵守提供方重试时间，个别失败仍保留其他来源。</p>
      <p>© The Spamhaus Project SLU，版权与日期保留在来源卡。<a href="https://www.spamhaus.org/drop/terms/" target="_blank" rel="noreferrer">DROP 使用说明 <ArrowUpRight size={12} /></a> · DShield 数据来源 SANS Technology Institute / Internet Storm Center，遵循其 CC BY-NC-SA 2.5 使用条件。</p>
    </div></details>
  </div>;
}
