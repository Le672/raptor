import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, RefreshCw, ExternalLink } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { api } from "@/lib/api";
import type { StatusReport } from "@/lib/status";

export default function Status() {
  useDocumentMeta("服务状态", "根据最近一次 HTTPS 检测查看站点可访问性。");
  const [report, setReport] = useState<StatusReport | null>(() => {
    try { const saved = JSON.parse(localStorage.getItem('yukino-status:last-report') || 'null'); return Array.isArray(saved?.services) && Number.isFinite(Date.parse(saved.checkedAt)) ? saved : null; } catch { return null; }
  }), [loading, setLoading] = useState(false), [error, setError] = useState(""), [now, setNow] = useState(Date.now());
  const mounted = useRef(true), pending = useRef(false);
  const [history, setHistory] = useState<{ end: number; hours: ({ hour: number; states: Record<string, string> } | null)[] } | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [selectedHour, setSelectedHour] = useState("");
  const refresh = useCallback(async () => {
    if (pending.current) return;
    pending.current = true; setLoading(true); setError("");
    try {
      const data = await api.getStatus();
      if (!Array.isArray(data.services) || !Number.isFinite(Date.parse(data.checkedAt))) throw new Error("检测结果格式错误");
      if (mounted.current) { setReport(data); setNow(Date.now()); try { localStorage.setItem('yukino-status:last-report', JSON.stringify(data)); } catch { /* Unavailable storage must not hide live checks. */ } }
    } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : "检测失败"); }
    finally { pending.current = false; if (mounted.current) setLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true; void refresh();
    const readHistory = () => { void fetch('https://status.yukino.bond/api/history', { credentials: 'omit', signal: AbortSignal.timeout(15000) }).then(response => response.ok ? response.json() : Promise.reject()).then(value => { if (mounted.current && Array.isArray(value.hours) && value.hours.length === 72 && Number.isFinite(value.end)) { setHistory(value); setHistoryError(''); } }).catch(() => { if (mounted.current) setHistoryError('历史记录暂时无法读取，请稍后刷新。'); }); };
    readHistory();
    const historyTimer = setInterval(readHistory, 180000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const timer = setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine) void refresh(); }, 180000);
    return () => { mounted.current = false; clearInterval(clock); clearInterval(timer); clearInterval(historyTimer); };
  }, [refresh]);
  const age = report ? Math.max(0, Math.floor((now - Date.parse(report.checkedAt)) / 1000)) : null;
  const count = (state: string) => report?.services.filter(service => service.state === state).length ?? 0;
  const labels = { reachable: "可访问", error: "返回错误", unknown: "暂未确认" };
  const colors = { reachable: "bg-emerald-50 text-emerald-800", error: "bg-red-50 text-red-800", unknown: "bg-amber-50 text-amber-800" };
  return <div className="portal-page mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
    <div className="portal-heading"><HomeLink className="text-link">← 返回主页</HomeLink><p className="eyebrow mt-6">SERVICE STATUS</p><h1 className="mt-3 font-display text-4xl text-stone-900">服务状态</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">状态页独立运行在 VPS，不使用主站的计算和数据库额度。分别检查页面与关键接口，展示真实状态、响应码与耗时；每三分钟自动检测并保存，检测结果最多缓存一分钟。下方每格对应一小时，展示最近 72 小时的真实记录。</p></div>
    <section className="portal-card glass-panel rounded-3xl p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div className="inline-flex items-center gap-3 text-stone-800"><Activity size={22} /><h2 className="text-xl">{report ? `${count("reachable")} 项可访问 · ${count("error")} 项返回错误 · ${count("unknown")} 项暂未确认` : "等待首次检测"}</h2></div><button type="button" className="pill-button" disabled={loading || (age !== null && age < 60)} onClick={refresh}><RefreshCw size={15} className={loading ? "animate-spin" : ""} />{loading ? "检测中…" : age !== null && age < 60 ? `${60 - age} 秒后可刷新` : "重新检测"}</button></div><p className="mt-4 text-xs leading-6 text-stone-500" aria-live="polite">{report ? `实际检测时间：${new Date(report.checkedAt).toLocaleString("zh-CN")}（${age} 秒前）` : "首次检测可能需要几秒。"}{age !== null && age > 300 ? " · 检测结果已过期，请重新检测。" : ""}</p>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}{report ? "，以下保留上次检测结果。" : ""}</p>}</section>
    {loading && !report && <p role="status" className="text-sm text-stone-500">正在检测各服务，请稍候…</p>}
    {historyError && <p role="alert">{historyError}</p>}
    {selectedHour && <p role="status" className="rounded-xl border p-3 text-sm">{selectedHour}</p>}
    <div className="status-timeline">{report?.services.map(service => <section key={service.url} className="portal-card glass-panel rounded-2xl p-5"><div className="flex flex-wrap items-center justify-between gap-2"><a href={service.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 break-all text-sm font-medium text-stone-800">{service.name}<ExternalLink size={13} /></a><span className={`rounded-full px-3 py-1 text-xs ${colors[service.state]}`}>{labels[service.state]}</span></div><p className="mt-4 text-xs text-stone-500">{service.detail}</p><p className="mt-2 font-mono text-xs text-stone-500">{service.code === null ? "无 HTTP 响应" : `HTTP ${service.code}`} · {service.latency} ms</p><div className="status-hours" aria-label={`${service.name}最近72小时检测记录`}>{Array.from({ length: 72 }, (_, index) => {
      const entry = history?.hours[index];
      const state = entry?.states[service.url] || 'missing';
      const end = history?.end ?? Math.floor(now / 3600000) * 3600000;
      const time = new Date(end - (71 - index) * 3600000).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const label = state === 'missing' ? '无记录' : labels[state as keyof typeof labels] || '无记录';
      const detail = `${service.name} · ${time}–下一小时：${label}`;
      return <button type="button" key={index} className={`status-hour status-hour-${state}`} title={detail} aria-label={detail} onClick={() => setSelectedHour(detail)} />;
    })}</div><div className="status-timeline-axis"><span>71 小时前</span><span>每格 1 小时 · 点击查看</span><span>当前小时</span></div></section>)}</div>
    <p className="rounded-2xl border border-stone-200 p-5 text-xs leading-7 text-stone-500">每格表示一小时内实际检测的最严重结果：绿色可访问，红色返回错误，黄色暂未确认，灰色没有记录。业务检测通过公开样本检查搜索、详情和目录；正文、播放或原图等登录后操作及其他作品不能由单次样本保证，具体范围见各项说明。</p>
  </div>;
}
