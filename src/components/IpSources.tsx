import { useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { IP_REVIEW_SITES, IP_SOURCE_DEFINITIONS } from "@/data/ip-sources";
import { IP_SIGNAL_LABELS, type IpReport, type IpSource } from "@/lib/ip";

const statusText = { ok: "已返回", error: "暂不可用", unsupported: "不支持此地址类型", "not-configured": "授权来源未启用" };
const kindText = { reputation: "风险数据库", geolocation: "网络资料", "exit-list": "出口名单", "threat-list": "威胁名单" };
export const ipDateText = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "未提供";

function SourceCard({ source }: { source: IpSource }) {
  const flags = Object.values(source.signals).filter(value => typeof value === "boolean");
  const result = source.status !== "ok" ? "未参与本次评分" : source.kind === "geolocation" ? "提供网络资料" : source.kind === "reputation" ? "提供检测标记" : flags.some(Boolean) ? "命中公开名单" : flags.length ? "未命中此名单" : "检测资料未提供";
  return <article className={`ip-source-card ip-source-${source.status}`} data-testid={`ip-source-${source.id}`}>
    <div className="ip-source-heading"><div><span className="ip-small-label">{kindText[source.kind]}</span><a href={source.href} target="_blank" rel="noreferrer">{source.name} <ArrowUpRight size={14} /></a></div><span className={`ip-status ip-status-${source.status}`}>{statusText[source.status]}</span></div>
    <div className="ip-source-score">{source.risk !== null ? <><strong>{source.risk}</strong><span>{source.riskLabel || "原始风险"} / 100 · 越低越好</span></> : <span>{result}</span>}</div>
    <p>{source.detail}</p>
    {source.status === "ok" && <>
      {(source.asn || source.organization) && <div className="ip-source-network"><strong>{source.asn || "ASN 未提供"}</strong><span>{source.organization}</span></div>}
      {(source.country || source.countryCode || source.city) && <div className="ip-source-location">{[source.country || source.countryCode, source.city].filter(Boolean).join(" · ")}</div>}
      {source.network && <div className="ip-source-location">网络范围 {source.network}</div>}
      {!!flags.length && <div className="ip-source-flags">{Object.entries(source.signals).filter(([, value]) => value === true).map(([key]) => <span key={key}>{IP_SIGNAL_LABELS[key]}</span>)}{!flags.some(Boolean) && <span className="ip-flag-clear"><Check size={12} /> 此来源未检出标记</span>}</div>}
      {!!source.metrics?.length && <dl className="ip-source-metrics">{source.metrics.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>}
    </>}
    {source.status !== "not-configured" && <div className="ip-source-time">{source.cached ? "缓存核对" : "查询"} {ipDateText(source.checkedAt)}{source.updatedAt && <span>数据日期 {ipDateText(source.updatedAt)}</span>}{source.retryAt && <span>允许重试 {ipDateText(source.retryAt)}</span>}</div>}
    {source.attribution && <small className="ip-attribution">{source.attribution}</small>}
  </article>;
}
const filters = [{ id: "all", label: "全部来源" }, { id: "reputation", label: "风险评分与标记" }, { id: "geolocation", label: "网络与位置" }, { id: "lists", label: "公开名单" }, { id: "unavailable", label: "缺失与限制" }];
const matches = (source: IpSource, filter: string) => filter === "all" || filter === "lists" && ["exit-list", "threat-list"].includes(source.kind) || filter === "unavailable" && source.status !== "ok" || source.kind === filter;

export function IpSources({ report }: { report: IpReport | null }) {
  const [filter, setFilter] = useState("all");
  const sources = report?.sources || [];
  const optional = sources.filter(source => source.status === "not-configured").length;
  return <>
    <section className="ip-sources" aria-labelledby="ip-sources-title"><div className="ip-section-heading"><div><p className="eyebrow">THE EVIDENCE</p><h2 id="ip-sources-title">让结果，有据可查。</h2></div><span>{report ? `${report.assessment.totalSources} 个参与来源 · ${report.assessment.scoredSources} 个原始评分${optional ? ` · ${optional} 个授权来源未启用` : ""}` : "风险、网络资料与公开名单分别核对"}</span></div>
      {report ? <>
        <div className="ip-filter-bar" role="group" aria-label="筛选数据来源">{filters.map(item => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<small>{sources.filter(source => matches(source, item.id)).length}</small></button>)}</div>
        <div className="ip-source-grid">{sources.filter(source => matches(source, filter)).map(source => <SourceCard key={source.id} source={source} />)}</div>
        {!sources.some(source => matches(source, filter)) && <p className="ip-source-empty">本次没有符合筛选条件的来源。</p>}
      </> : <div className="ip-source-catalog">{IP_SOURCE_DEFINITIONS.map(source => <article key={source.id}><a href={source.href} target="_blank" rel="noreferrer">{source.name}<ArrowUpRight size={12} /></a><span>{source.optional ? "可选授权来源" : kindText[source.kind]}</span><p>{source.purpose}</p></article>)}</div>}
    </section>
    <section className="ip-review" aria-labelledby="ip-review-title"><div className="ip-section-heading"><div><p className="eyebrow">SECOND OPINION</p><h2 id="ip-review-title">再多看一份，原始记录。</h2></div><span>{IP_REVIEW_SITES.length} 个外部复核入口</span></div>
      <p className="ip-review-intro">点击后由你在对应网站复核，结果不参与本站评分。不同网站的覆盖范围、更新时间和分数定义不同，邮件黑名单也不等于 AI 访问限制。</p>
      {report && <div className="ip-review-target"><span>本次核对 <strong>{report.ip}</strong></span><CopyButton text={report.ip} label="复制待查 IP" /><small>部分网站可直接带入地址，其余可粘贴查询。</small></div>}
      <div className="ip-review-grid">{IP_REVIEW_SITES.map(site => <a key={site.name} href={report && site.target ? site.target(report.ip) : site.href} target="_blank" rel="noreferrer"><span><strong>{site.name}</strong><small>{site.focus}</small></span><ArrowUpRight size={15} /></a>)}</div>
    </section>
  </>;
}
