import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, RefreshCw, ExternalLink } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { api } from "@/lib/api";
import type { StatusReport } from "@/lib/status";

export default function Status() {
  useDocumentMeta("服务状态", "根据最近一次 HTTPS 检测查看站点可访问性。");
  const [report, setReport] = useState<StatusReport | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState(""), [now, setNow] = useState(Date.now());
  const mounted = useRef(true), pending = useRef(false);
  const refresh = useCallback(async () => {
    if (pending.current) return;
    pending.current = true; setLoading(true); setError("");
    try {
      const data = await api.getStatus();
      if (!Array.isArray(data.services) || !Number.isFinite(Date.parse(data.checkedAt))) throw new Error("检测结果格式错误");
      if (mounted.current) { setReport(data); setNow(Date.now()); }
    } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : "检测失败"); }
    finally { pending.current = false; if (mounted.current) setLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true; void refresh();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const timer = setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine) void refresh(); }, 180000);
    return () => { mounted.current = false; clearInterval(clock); clearInterval(timer); };
  }, [refresh]);
  const age = report ? Math.max(0, Math.floor((now - Date.parse(report.checkedAt)) / 1000)) : null;
  const count = (state: string) => report?.services.filter(service => service.state === state).length ?? 0;
  const labels = { reachable: "可访问", error: "返回错误", unknown: "暂未确认" };
  const colors = { reachable: "bg-emerald-50 text-emerald-800", error: "bg-red-50 text-red-800", unknown: "bg-amber-50 text-amber-800" };
  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
    <div><HomeLink className="text-link">← 返回主页</HomeLink><p className="eyebrow mt-6">SERVICE STATUS</p><h1 className="mt-3 font-display text-4xl text-stone-900">服务状态</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">从服务器检测各站点的 HTTPS 响应，展示真实状态、响应码与耗时。每三分钟自动更新，检测结果最多缓存一分钟。</p></div>
    <section className="glass-panel rounded-3xl p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div className="inline-flex items-center gap-3 text-stone-800"><Activity size={22} /><h2 className="text-xl">{report ? `${count("reachable")} 项可访问 · ${count("error")} 项返回错误 · ${count("unknown")} 项暂未确认` : "等待首次检测"}</h2></div><button type="button" className="pill-button" disabled={loading || (age !== null && age < 60)} onClick={refresh}><RefreshCw size={15} className={loading ? "animate-spin" : ""} />{loading ? "检测中…" : age !== null && age < 60 ? `${60 - age} 秒后可刷新` : "重新检测"}</button></div><p className="mt-4 text-xs leading-6 text-stone-500" aria-live="polite">{report ? `实际检测时间：${new Date(report.checkedAt).toLocaleString("zh-CN")}（${age} 秒前）` : "首次检测可能需要几秒。"}{age !== null && age > 300 ? " · 检测结果已过期，请重新检测。" : ""}</p>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}{report ? "，以下保留上次检测结果。" : ""}</p>}</section>
    {loading && !report && <p role="status" className="text-sm text-stone-500">正在检测各服务，请稍候…</p>}
    <div className="grid gap-4 sm:grid-cols-2">{report?.services.map(service => <section key={service.url} className="glass-panel rounded-2xl p-5"><div className="flex flex-wrap items-center justify-between gap-2"><a href={service.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 break-all text-sm font-medium text-stone-800">{service.name}<ExternalLink size={13} /></a><span className={`rounded-full px-3 py-1 text-xs ${colors[service.state]}`}>{labels[service.state]}</span></div><p className="mt-4 text-xs text-stone-500">{service.detail}</p><p className="mt-2 font-mono text-xs text-stone-500">{service.code === null ? "无 HTTP 响应" : `HTTP ${service.code}`} · {service.latency} ms</p></section>)}</div>
    <p className="rounded-2xl border border-stone-200 p-5 text-xs leading-7 text-stone-500">本页表示检测时的页面可访问性。登录、发信、新闻源和铁路数据等业务功能有独立的状态；受访问限制或超时影响时会显示“暂未确认”。本站没有连续监测数据，因此不展示未经统计的可用率或历史故障记录。</p>
  </div>;
}
