import { ArrowLeft, Bookmark, Download, ExternalLink, Loader2, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useStoredState } from "@/hooks/useStoredState";
import { getApiBase } from "@/lib/runtime";
import { isNewsItem, isNewsList, NEWS_FEEDS, NewsCategory, NewsResponse } from "@/lib/news";
import { downloadText } from "@/lib/browser-actions";

function isSnapshot(value: unknown): value is NewsResponse | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const data = value as NewsResponse;
  return typeof data.fetchedAt === "string" && Number.isFinite(Date.parse(data.fetchedAt)) && Array.isArray(data.items) && data.items.length <= 350 && data.items.every(isNewsItem) && Array.isArray(data.sources) && data.sources.length <= NEWS_FEEDS.length && data.sources.every((s) => s && NEWS_FEEDS.some((feed) => feed.key === s.key) && typeof s.label === "string" && Number.isInteger(s.count) && s.count >= 0 && s.count <= 25 && typeof s.available === "boolean") && Array.isArray(data.errors) && data.errors.length <= NEWS_FEEDS.length && data.errors.every((e) => e && typeof e.source === "string" && typeof e.label === "string" && typeof e.error === "string");
}
function time(value: string) { const date = Date.parse(value); return Number.isFinite(date) ? new Date(date).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "时间未提供"; }

export default function News() {
  useDocumentMeta("新闻阅读室", "聚合 14 个科技、开发、科学和国际新闻源，支持搜索、来源筛选、稍后阅读和 RSS 订阅。");
  const [snapshot, setSnapshot] = useStoredState<NewsResponse | null>("yukino.news.snapshot.v2", null, isSnapshot);
  const [saved, setSaved, persistent] = useStoredState("yukino.news.saved.v2", [], isNewsList);
  const [data, setData] = useState<NewsResponse | null>(snapshot); const [cachedView, setCachedView] = useState(!!snapshot);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [cooldown, setCooldown] = useState(false);
  const [source, setSource] = useState("all"); const [category, setCategory] = useState<NewsCategory | "全部">("全部");
  const [view, setView] = useState("all"); const [query, setQuery] = useState(""); const [language, setLanguage] = useState("all"); const [limit, setLimit] = useState(30);
  const [saveMessage, setSaveMessage] = useState(""); const pending = useRef<AbortController | null>(null);
  const load = useCallback(async (refresh = false) => {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
    setLoading(true); setError(""); if (refresh) setCooldown(true);
    try {
      const response = await fetch(`${getApiBase()}/news?version=2${refresh ? "&refresh=1" : ""}`, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error("新闻源暂时未能读取，请稍后重试。");
      const result: unknown = await response.json(); if (!isSnapshot(result) || !result) throw new Error("新闻内容暂时不可用，请稍后重试。");
      if (pending.current !== controller) return;
      setData(result); setSnapshot(result); setCachedView(false);
    } catch { if (pending.current === controller && (!controller.signal.aborted || timedOut)) { setError(timedOut ? "新闻更新超时，可稍后重试；已有内容和稍后阅读仍可查看。" : "暂时无法更新新闻。已有内容和稍后阅读仍可查看。"); setCachedView(true); } }
    finally { clearTimeout(timeout); if (pending.current === controller) setLoading(false); }
  }, [setSnapshot]);
  useEffect(() => {
    void load();
    const refresh = setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine !== false) void load(); }, 300000);
    return () => { pending.current?.abort(); clearInterval(refresh); };
  }, [load]);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(false), 30000); return () => clearTimeout(timer); }, [cooldown]);
  useEffect(() => { setLimit(30); }, [query, source, category, language, view]);
  const items = useMemo(() => (view === "saved" ? saved : data?.items ?? []).filter((item) => (source === "all" || item.source === source) && (category === "全部" || item.category === category) && (language === "all" || item.language === language) && `${item.title} ${item.sourceLabel}`.toLowerCase().includes(query.trim().toLowerCase())), [data, saved, source, category, language, query, view]);
  const toggleSave = (item: (typeof saved)[number]) => {
    if (saved.some((n) => n.link === item.link)) { setSaved((previous) => previous.filter((n) => n.link !== item.link)); setSaveMessage("已移出稍后阅读。"); }
    else if (saved.length >= 200) setSaveMessage("稍后阅读已达到 200 条，请先移除已读内容。");
    else { setSaved((previous) => [item, ...previous]); setSaveMessage("已加入稍后阅读，保存在当前浏览器。"); }
  };
  return <div className="feature-page news-page">
    <div><div className="feature-heading"><HomeLink className="pill-button"><ArrowLeft size={15} />返回首页</HomeLink><span className="feature-eyebrow">A WINDOW TO THE WORLD</span></div><h1 className="feature-title">新闻阅读室<span>{NEWS_FEEDS.length} 个不同视角</span></h1><p className="feature-description">科技、开发、科学与世界动态，在这里一起读。标题来自各来源的公开订阅，完整内容请前往原站。</p></div>
    <div className="news-overview"><span><strong>{data?.sources.filter((s) => s.available).length ?? "—"}</strong> / {NEWS_FEEDS.length} 个源可用</span><span><strong>{data?.items.length ?? "—"}</strong> 条资讯</span><span>{data ? `${cachedView ? "本地快照" : "最近抓取"} ${time(data.fetchedAt)}` : "正在获取资讯"}</span><button className="pill-button" disabled={loading || cooldown} onClick={() => void load(true)}><RefreshCw size={15} className={loading ? "animate-spin" : ""} />{loading ? "更新中" : cooldown ? "稍后可刷新" : "刷新"}</button></div>
    <div className="feature-toolbar"><label className="feature-search"><Search size={17} /><input aria-label="搜索新闻" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或新闻源…" /></label><label className="feature-select">来源<select aria-label="新闻来源" value={source} onChange={(event) => setSource(event.target.value)}><option value="all">全部来源</option>{NEWS_FEEDS.map((feed) => <option key={feed.key} value={feed.key}>{feed.label}</option>)}</select></label><label className="feature-select">语言<select aria-label="新闻语言" value={language} onChange={(event) => setLanguage(event.target.value)}><option value="all">全部语言</option><option value="zh">中文</option><option value="en">English</option></select></label></div>
    <div className="news-filter-row"><div className="filter-chips" aria-label="新闻类别">{(["全部", "科技", "开发", "科学", "国际"] as const).map((cat) => <button key={cat} aria-pressed={cat === category} onClick={() => setCategory(cat)}>{cat}</button>)}</div><div className="filter-chips" aria-label="新闻列表"><button aria-pressed={view === "all"} onClick={() => setView("all")}>全部新闻</button><button aria-pressed={view === "saved"} onClick={() => setView("saved")}><Bookmark size={13} />稍后阅读 {saved.length}</button></div></div>
    {error && <p className="feature-warning" role="alert">{error}{!data && <button className="pill-button" disabled={loading} onClick={() => void load()}>重试</button>}</p>}
    {cachedView && data && <p className="local-note">当前展示的是上次保存的资讯快照，抓取时间为 {time(data.fetchedAt)}，不代表实时更新。</p>}
    <div className="game-actions">{(query || source !== "all" || category !== "全部" || language !== "all") && <button className="pill-button" type="button" onClick={() => { setQuery(""); setSource("all"); setCategory("全部"); setLanguage("all"); }}>重置新闻筛选</button>}<button className="pill-button" type="button" disabled={!saved.length} onClick={() => downloadText("yukino-saved-news.json", JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items: saved }, null, 2), "application/json")}><Download size={14} />导出稍后阅读</button></div>
    {!persistent && <p className="feature-warning" role="status">当前浏览器无法保存稍后阅读，关闭页面后可能丢失。</p>}
    {data?.errors.length ? <p className="local-note">暂时不可用：{data.errors.map((e) => e.label).join("、")}。其他来源仍可正常阅读，下次更新会重新尝试。</p> : null}
    <p className="news-result-count" role="status">{view === "saved" ? "稍后阅读" : "筛选结果"} · {items.length} 条<span className="sr-only">{saveMessage}</span></p>
    {loading && !data && view === "all" ? <div className="game-notice" role="status"><Loader2 size={18} className="animate-spin" />正在整理各个来源的最新资讯…</div> : <div className="news-list">{items.slice(0, limit).map((item) => {
      const bookmarked = saved.some((n) => n.link === item.link); const feed = NEWS_FEEDS.find((f) => f.key === item.source);
      return <article className="news-article" key={item.link}><div><a className="news-title" href={item.link} target="_blank" rel="noreferrer"><h2>{item.title}</h2><ExternalLink size={15} /></a><div className="news-meta"><a className="news-source" href={feed?.website} target="_blank" rel="noreferrer">{item.sourceLabel}</a><span>{item.category}</span><time dateTime={item.pubDate || undefined}>{time(item.pubDate)}</time></div></div><button className="news-save" aria-label={`${bookmarked ? "移出稍后阅读" : "稍后阅读"}：${item.title}`} aria-pressed={bookmarked} onClick={() => toggleSave(item)}><Bookmark size={18} fill={bookmarked ? "currentColor" : "none"} /></button></article>;
    })}{!items.length && <p className="game-notice">{view === "saved" ? "当前筛选下没有稍后阅读。点击新闻旁的书签即可保存。" : "当前筛选下没有新闻，试试清空搜索或切换来源。"}</p>}</div>}
    {items.length > limit && <button className="pill-button load-more" onClick={() => setLimit((n) => n + 30)}>再读 30 条 · 剩余 {items.length - limit} 条</button>}
    <section className="news-sources-section" aria-label="新闻源与订阅"><div className="feature-toolbar"><div><h2>来源与订阅</h2><p>每个来源独立抓取，一个源失败不会影响其他源。</p></div><a className="pill-button" href={`${getApiBase()}/news?format=opml`} download="yukino-news.opml"><Download size={15} />导出 OPML</a></div><div className="news-sources-grid">{NEWS_FEEDS.map((feed) => {
      const status = data?.sources.find((s) => s.key === feed.key);
      return <div className="news-source-card" key={feed.key}><a href={feed.website} target="_blank" rel="noreferrer">{feed.label}<ExternalLink size={12} /></a><div><span className={`source-dot ${status?.available ? "available" : ""}`} />{status ? status.available ? `${status.count} 条` : "暂不可用" : "等待更新"}<span>{feed.category} · {feed.language === "zh" ? "中文" : "English"}</span></div><a className="source-rss" href={feed.url} target="_blank" rel="noreferrer">RSS ↗</a></div>;
    })}</div></section>
    <p className="local-note">阅读列表和快照保存在当前浏览器；每五分钟在前台自动检查更新。部分原站文章可能需要订阅。</p>
  </div>;
}
