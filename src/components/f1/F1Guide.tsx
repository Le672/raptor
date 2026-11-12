import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Link2, Search, X } from "lucide-react";
import { F1_GUIDE_CHAPTERS, F1_GUIDE_CHECKED, F1_GUIDE_ENTRIES, F1_GUIDE_SOURCES, f1GuideSearch, type F1GuideEntry } from "@/data/f1-guide";
import { Empty, External } from "./F1Common";

const entryFromHash = () => F1_GUIDE_ENTRIES.find(entry => entry.id === window.location.hash.replace(/^#f1-guide-/, ""));
const matches = (entry: F1GuideEntry, query: string) => query.trim().toLowerCase().split(/\s+/).every(word => f1GuideSearch(entry).includes(word));

export function F1Guide() {
  const [query, setQuery] = useState(""), [chapter, setChapter] = useState("all");
  const [expanded, setExpanded] = useState(() => new Set(["watch-first-race"]));
  const [linked, setLinked] = useState<{ id: string } | null>(null);
  const shown = useMemo(() => F1_GUIDE_ENTRIES.filter(entry => (chapter === "all" || entry.chapterId === chapter) && matches(entry, query)), [chapter, query]);
  const allExpanded = shown.length > 0 && shown.every(entry => expanded.has(entry.id));
  const chapterCounts = useMemo(() => new Map(F1_GUIDE_CHAPTERS.map(group => [group.id, group.entries.filter(entry => matches(entry, query)).length])), [query]);
  const openEntry = (id: string) => {
    const entry = F1_GUIDE_ENTRIES.find(item => item.id === id);
    if (!entry) return;
    setChapter(entry.chapterId); setQuery(""); setLinked({ id });
    setExpanded(previous => new Set([...previous, id]));
  };
  useEffect(() => {
    const followHash = () => { const entry = entryFromHash(); if (entry) openEntry(entry.id); };
    followHash(); window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, []);
  useEffect(() => {
    if (!linked) return;
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(`f1-guide-${linked.id}`);
      if (element) { element.scrollIntoView({ block: "start" }); element.focus({ preventScroll: true }); }
    });
    return () => cancelAnimationFrame(frame);
  }, [linked, chapter]);
  const search = (value: string) => {
    setQuery(value); setLinked(null);
    setExpanded(value.trim() ? new Set(F1_GUIDE_ENTRIES.filter(entry => matches(entry, value)).map(entry => entry.id)) : new Set(["watch-first-race"]));
  };
  const toggle = (id: string) => setExpanded(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const reset = () => { setChapter("all"); search(""); };
  const chooseChapter = (id: string) => {
    setChapter(id); setLinked(null);
    requestAnimationFrame(() => document.getElementById("f1-guide-content")?.scrollIntoView({ block: "start" }));
  };
  const navigate = (id: string) => { openEntry(id); window.location.hash = `f1-guide-${id}`; };

  return <section className="f1-section f1-guide" aria-labelledby="f1-guide-title">
    <div className="f1-section-heading"><div><p className="f1-eyebrow">A SEAT FOR EVERY FAN</p><h2 id="f1-guide-title">第一次看，也能看懂</h2></div><BookOpen size={25} aria-hidden="true"/></div>
    <p className="f1-guide-lead">从五盏红灯熄灭，到看懂轮胎、策略和车队无线电。每条都有详细说明、观赛例子与容易混淆的地方，可以逐条阅读，也可以一次展开。</p>
    <div className="f1-guide-meta"><span><strong>{F1_GUIDE_CHAPTERS.length}</strong> 个主题</span><span><strong>{F1_GUIDE_ENTRIES.length}</strong> 条详解</span><span>规则核对 <time dateTime={F1_GUIDE_CHECKED}>{F1_GUIDE_CHECKED}</time></span></div>
    <p className="f1-guide-edition">百科以 2026 常规规则为主，与页面上方的赛季筛选独立；历史规则单独标注。具体场次的 FIA 文件、赛事说明与正式成绩优先。</p>
    <div className="f1-guide-starts" aria-label="推荐阅读起点">{[ ["points", "先看比赛怎么计分"], ["undercut", "读懂轮胎与进站策略"], ["radio-phrases", "听懂车队无线电"] ].map(([id, text]) => <a key={id} href={`#f1-guide-${id}`} onClick={event => { event.preventDefault(); navigate(id); }}>{text}<span aria-hidden="true">↗</span></a>)}</div>
    <div className="f1-guide-controls"><label className="f1-search"><Search size={15} aria-hidden="true"/><input value={query} onChange={event => search(event.target.value)} aria-label="搜索 F1 术语" placeholder="搜索术语、规则、例子或无线电：box、颗粒化、P4…"/>{query && <button type="button" onClick={() => search("")} aria-label="清除百科搜索"><X size={15}/></button>}</label><button type="button" className="f1-button" disabled={!shown.length} onClick={() => setExpanded(previous => { const next = new Set(previous); for (const entry of shown) { if (allExpanded) next.delete(entry.id); else next.add(entry.id); } return next; })}>{allExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} {allExpanded ? "收起全部详解" : "展开全部详解"}</button></div>
    <div className="f1-guide-layout">
      <aside className="f1-guide-sidebar"><nav aria-label="百科主题"><button type="button" className={chapter === "all" ? "is-selected" : ""} aria-pressed={chapter === "all"} onClick={() => chooseChapter("all")}><span>全部主题</span><small>{F1_GUIDE_ENTRIES.filter(entry => matches(entry, query)).length}</small></button>{F1_GUIDE_CHAPTERS.map(group => <button key={group.id} type="button" className={chapter === group.id ? "is-selected" : ""} aria-pressed={chapter === group.id} onClick={() => chooseChapter(group.id)}><span>{group.name}</span><small>{chapterCounts.get(group.id)}</small></button>)}</nav><p>搜不到时可以清除搜索，或切回全部主题。条目旁的链接图标可用于直接定位。</p></aside>
      <div className="f1-guide-content" id="f1-guide-content"><p className="f1-guide-count" role="status" aria-live="polite">{shown.length} / {F1_GUIDE_ENTRIES.length} 条详细说明{query.trim() ? ` · 搜索“${query.trim()}”` : ""}</p>
        {F1_GUIDE_CHAPTERS.map(group => {
          const entries = shown.filter(entry => entry.chapterId === group.id);
          if (!entries.length) return null;
          return <section className="f1-guide-chapter" key={group.id} aria-labelledby={`f1-guide-chapter-${group.id}`}><header><p className="f1-eyebrow">{group.en}</p><h3 id={`f1-guide-chapter-${group.id}`}>{group.name}<small>{entries.length} 条</small></h3><p>{group.intro}</p></header><div className="f1-guide-articles">{entries.map(entry => {
            const open = expanded.has(entry.id), detailId = `f1-guide-details-${entry.id}`;
            return <article className={`f1-guide-article${open ? " is-expanded" : ""}`} id={`f1-guide-${entry.id}`} key={entry.id} tabIndex={-1} aria-labelledby={`f1-guide-name-${entry.id}`}>
              <header><div className="f1-guide-term-meta"><span>{entry.en}</span>{entry.era && <small className={entry.era === "历史规则" ? "is-history" : ""}>{entry.era}</small>}<a href={`#f1-guide-${entry.id}`} onClick={event => { event.preventDefault(); navigate(entry.id); }} aria-label={`${entry.name}的直达链接`} title="此条目的直达链接"><Link2 size={14}/></a></div><h4 id={`f1-guide-name-${entry.id}`}>{entry.name}</h4><p>{entry.summary}</p><button type="button" className="f1-guide-expand" aria-expanded={open} aria-controls={detailId} onClick={() => toggle(entry.id)}>{open ? "收起详细说明" : "阅读详细说明"}{open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</button></header>
              {open && <div className="f1-guide-details" id={detailId}>{entry.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}<h5>观赛时留意</h5><ul>{entry.points.map(point => <li key={point}>{point}</li>)}</ul>{entry.table && <div className="f1-guide-table-wrap" role="region" aria-label={entry.table.caption} tabIndex={0}><table><caption>{entry.table.caption}</caption><thead><tr>{entry.table.columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead><tbody>{entry.table.rows.map((row, index) => <tr key={index}>{row.map((cell, column) => column === 0 ? <th scope="row" key={column}>{cell}</th> : <td key={column}>{cell}</td>)}</tr>)}</tbody></table></div>}{entry.example && <div className="f1-guide-example"><h5>观赛例子</h5><p>{entry.example}</p></div>}<div className="f1-guide-misconception"><h5>容易混淆</h5><p>{entry.misconception}</p></div><div className="f1-guide-citations"><span>核对与延伸阅读</span>{entry.sourceIds.map(source => <External key={source} href={F1_GUIDE_SOURCES[source].href}>{F1_GUIDE_SOURCES[source].name}</External>)}</div></div>}
            </article>;
          })}</div></section>;
        })}
        {!shown.length && <><Empty>没有符合当前主题与搜索的条目。试试中文名称或英文缩写。</Empty><button type="button" className="f1-button" onClick={reset}>重置百科筛选</button></>}
      </div>
    </div>
    <div className="f1-guide-source-note"><h3>继续探索与规则版本</h3><p>本版核对 FIA 2026 总则 Issue 03、运动规则 Issue 09（2026-10-01）、技术规则 Issue 20，以及 F1 官方入门与术语资料。文中的假设数字用于说明方法，不是某场比赛的真实记录。后续规则变更请查 FIA 最新文件。</p><div className="f1-resources"><External href="https://www.formula1.com/en/page/f1-glossary">F1 官方完整术语表</External><External href="https://www.fia.com/regulation/category/110/technical-regulations?page=2">FIA 规则与版本目录</External><External href="https://www.pirelli.com/tyres/en-gb/motorsport/car/formula-1">Pirelli 轮胎资料</External><External href={F1_GUIDE_SOURCES.jolpica.href}>Jolpica 历史成绩</External><External href={F1_GUIDE_SOURCES.openf1.href}>OpenF1 计时资料</External></div></div>
  </section>;
}
