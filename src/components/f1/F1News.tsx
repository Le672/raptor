import { Search, Newspaper } from "lucide-react";
import { useState } from "react";
import { useF1Data } from "@/hooks/useF1Data";
import { formatF1Date } from "@/lib/f1";
import type { F1NewsData } from "@/lib/f1";
import { DataStatus, Empty, External } from "./F1Common";

export function F1News({ compact = false, timezone }: { compact?: boolean; timezone: string }) {
  const result = useF1Data<F1NewsData>("action=news", 300);
  const [search, setSearch] = useState(""), [source, setSource] = useState("all");
  const items = (result.data?.items || []).filter((item) => (source === "all" || source === item.source) && item.title.toLowerCase().includes(search.toLowerCase())).slice(0, compact ? 5 : 60);
  return <section className="f1-section"><div className="f1-section-heading"><div><p className="f1-eyebrow">FROM THE PADDOCK</p><h2>围场正在发生</h2></div><External href="https://www.formula1.com/en/latest">F1 官方资讯</External></div>{!compact && <div className="f1-controls"><label className="f1-search"><Search size={15}/><input aria-label="搜索 F1 新闻" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索新闻标题…"/></label><label>来源<select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">全部来源</option><option value="skyf1">Sky Sports F1</option><option value="autosportf1">Autosport F1</option><option value="bbcf1">BBC F1</option></select></label></div>}<DataStatus {...result} timezone={timezone}/><div className="f1-news-list">{items.map((item, index) => <article key={item.link}><span className="f1-news-index">{String(index + 1).padStart(2, "0")}</span><div><p>{item.sourceLabel} <span>· {item.pubDate ? formatF1Date(item.pubDate, timezone) : "发布时间未知"}</span></p><h3><External href={item.link}>{item.title}</External></h3></div></article>)}</div>{!items.length && !result.loading && <Empty><Newspaper size={22}/>{search || source !== "all" ? "没有符合筛选的新闻。" : "订阅源暂不可用，请稍后重试，或打开 F1 官方资讯。"}</Empty>}<p className="f1-footnote">每 5 分钟检查一次订阅源。新闻保留来源标题，打开后可阅读原文。</p></section>;
}
