import { useState } from "react";
import { Rss, ExternalLink, Download } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { CopyButton } from "@/components/CopyButton";
import { SearchField } from "@/components/SearchField";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { SUBSCRIPTIONS, SITE_FEED, subscriptionsOpml } from "@/lib/rss-catalog";
import { downloadText } from "@/lib/browser-actions";

export default function RSS() {
  useDocumentMeta("订阅源", "订阅 Yukino 的笔记，或导出完整的推荐订阅源。");
  const [query, setQuery] = useState(""), [category, setCategory] = useState("全部");
  const categories = ["全部", ...new Set(SUBSCRIPTIONS.map(feed => feed.category))];
  const feeds = SUBSCRIPTIONS.filter(feed => (category === "全部" || feed.category === category) && `${feed.title} ${feed.desc}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
    <div><HomeLink className="text-link">← 返回主页</HomeLink><p className="eyebrow mt-6">READ AT YOUR OWN PACE</p><h1 className="mt-3 font-display text-4xl text-stone-900">订阅源</h1><p className="mt-4 text-sm leading-7 text-stone-600">把喜欢的内容带到自己的阅读器。本站订阅与推荐来源都支持复制，也可以一次性导出。</p></div>
    <section className="glass-panel rounded-3xl p-6"><h2 className="inline-flex items-center gap-2 font-display text-2xl text-stone-900"><Rss size={22} />订阅 Yukino</h2><p className="my-4 text-sm leading-7 text-stone-500">只收录本站已发布的笔记，草稿保持私密。把下面的地址添加到 RSS 阅读器即可持续接收新文章。</p><code className="block break-all rounded-xl bg-white/60 p-3 text-sm text-stone-600">{SITE_FEED}</code><div className="mt-4 flex flex-wrap gap-3"><CopyButton text={SITE_FEED} label="复制本站 RSS" /><a className="pill-button" href={SITE_FEED} target="_blank" rel="noreferrer">打开订阅源 <ExternalLink size={14} /></a></div></section>
    <div className="flex flex-wrap gap-3"><button type="button" className="pill-button" onClick={() => downloadText("yukino-subscriptions.opml", subscriptionsOpml(), "text/x-opml;charset=utf-8")}><Download size={15} />导出全部 {SUBSCRIPTIONS.length} 个源</button>{(query || category !== "全部") && <button type="button" className="pill-button" disabled={!feeds.length} onClick={() => downloadText("yukino-filtered.opml", subscriptionsOpml(feeds), "text/x-opml;charset=utf-8")}><Download size={15} />导出筛选结果</button>}</div>
    <SearchField value={query} onChange={setQuery} label="搜索订阅源" />
    <div className="flex flex-wrap gap-2">{categories.map(value => <button type="button" key={value} aria-pressed={category === value} className={`rounded-full border px-4 py-2 text-sm ${category === value ? "border-stone-800 bg-stone-800 text-white" : "border-stone-200 bg-white/60 text-stone-600"}`} onClick={() => setCategory(value)}>{value}</button>)}</div><p className="text-xs text-stone-500" aria-live="polite">{feeds.length} 个订阅源</p>
    <div className="grid gap-4 sm:grid-cols-2">{feeds.map(feed => <section key={feed.feedUrl} className="glass-panel flex flex-col gap-4 rounded-3xl p-5"><div><span className="text-xs text-stone-400">{feed.category}</span><h2 className="mt-2 font-display text-xl text-stone-900">{feed.title}</h2><p className="mt-2 text-sm leading-6 text-stone-600">{feed.desc}</p></div><div className="mt-auto flex flex-wrap items-center gap-3"><a className="text-link text-xs" href={feed.feedUrl} target="_blank" rel="noreferrer">RSS ↗</a><a className="text-link text-xs" href={feed.url} target="_blank" rel="noreferrer">网站 ↗</a><CopyButton text={feed.feedUrl} label={`复制 ${feed.title} RSS`} /></div></section>)}</div>
    {!feeds.length && <p className="empty-notes">没有匹配的订阅源。<button className="ml-3 underline" type="button" onClick={() => { setQuery(""); setCategory("全部"); }}>重置筛选</button></p>}
  </div>;
}
