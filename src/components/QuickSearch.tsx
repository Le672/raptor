import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { domainLinks } from "@/data/site";
import { siteNavigation } from "@/data/navigation";
import { gameCatalog } from "@/data/games";
import { DEV_TOOLS } from "@/lib/dev-tools";
import { usePublicPosts } from "@/hooks/usePublicContent";
import { contentDate, postHref } from "@/lib/content";

type QuickSearchProps = { open: boolean; onClose: () => void };
type Result = { title: string; description: string; href: string; external?: boolean };
const pages = siteNavigation.map(page => ({ title: page.label, description: page.description, href: page.to }));
export function QuickSearch({ open, onClose }: QuickSearchProps) {
  const [query, setQuery] = useState(""), [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null), dialog = useRef<HTMLElement>(null), close = useRef(onClose);
  close.current = onClose;
  const navigate = useNavigate(), published = usePublicPosts(open);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; setQuery(""); setSelected(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, [open]);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase(), matches = (value: string) => value.toLowerCase().includes(normalized);
    if (!normalized) return [];
    const all: Result[] = [
      ...published.data.filter(post => matches(post.title + " " + post.summary + " " + post.tag)).map(post => ({ title: post.title, description: post.tag + " · " + contentDate(post.created_at), href: postHref(post.slug) })),
      ...DEV_TOOLS.filter(tool => matches(tool.label + " " + tool.description)).map(tool => ({ title: tool.label + " 工具", description: tool.description, href: "/dev?tool=" + tool.id })),
      ...pages.filter(page => matches(page.title + " " + page.description)),
      ...gameCatalog.filter(game => matches(game.name + " " + game.nameEn + " " + game.description)).map(game => ({ title: game.name, description: "小游戏 · " + game.description, href: "/games?game=" + game.id })),
      ...domainLinks.filter(item => matches(item.title + " " + item.hostname + " " + item.description)).map(item => ({ title: item.title, description: item.hostname, href: item.href, external: true })),
    ];
    return all.slice(0, 10);
  }, [query, published.data]);
  const index = Math.max(0, Math.min(selected, results.length - 1));
  const openResult = (result: Result) => { close.current(); if (result.external) window.open(result.href, "_blank", "noopener,noreferrer"); else navigate(result.href); };
  const submit = (event: FormEvent) => { event.preventDefault(); if (results[index]) openResult(results[index]); };
  if (!open) return null;
  return <div className="quick-search-backdrop" role="presentation" onMouseDown={() => close.current()}><section ref={dialog} className="quick-search" role="dialog" aria-modal="true" aria-label="全站搜索" onMouseDown={event => event.stopPropagation()} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); close.current(); }
    if (["ArrowDown", "ArrowUp"].includes(event.key) && results.length) { event.preventDefault(); setSelected(value => (value + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length); inputRef.current?.focus(); }
    if (event.key === "Tab") {
      const fields = [...(dialog.current?.querySelectorAll<HTMLElement>('input,button,a[href]') ?? [])].filter(element => !element.hasAttribute("disabled"));
      const first = fields[0], last = fields[fields.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}><form onSubmit={submit}><Search aria-hidden="true" size={19} /><input ref={inputRef} value={query} onChange={event => { setQuery(event.target.value); setSelected(0); }} placeholder="搜索笔记、工具、小游戏与页面" aria-label="搜索内容" role="combobox" aria-autocomplete="list" aria-controls="search-results" aria-expanded={!!results.length} aria-activedescendant={results[index] ? "search-result-" + index : undefined} /><kbd>Esc</kbd><button type="button" onClick={() => close.current()} aria-label="关闭搜索"><X size={18} /></button></form>{query.trim() ? <div id="search-results" role="listbox" className="quick-search-results">{results.length ? results.map((result, position) => <button key={result.href + result.title} id={"search-result-" + position} type="button" role="option" aria-selected={index === position} style={index === position ? { backgroundColor: "#edf1e5" } : undefined} onClick={() => openResult(result)}><span>{result.title}</span><small>{result.description}</small></button>) : <p>{published.loading ? "正在加载文章，页面和工具可直接搜索。" : "没有找到相关内容，换个关键词试试。"}</p>}</div> : <p className="quick-search-hint">↑ ↓ 选择结果，Enter 打开，Esc 关闭。</p>}{published.error && <p className="quick-search-hint">文章暂时无法加载，页面和工具仍可搜索。<button className="ml-2 underline" type="button" onClick={published.refresh}>重试</button></p>}</section></div>;
}
