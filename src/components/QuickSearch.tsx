import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { domainLinks, postPreviews } from "@/data/site";
import { siteNavigation } from "@/data/navigation";
import { gameCatalog } from "@/data/games";

type QuickSearchProps = { open: boolean; onClose: () => void };

const pages = siteNavigation.map((page) => ({ title: page.label, description: page.description, href: page.to }));

export function QuickSearch({ open, onClose }: QuickSearchProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const matches = (value: string) => value.toLowerCase().includes(normalized);
    return [
      ...postPreviews
        .filter((post) => matches(`${post.title} ${post.summary} ${post.tag}`))
        .map((post) => ({ title: post.title, description: `${post.tag} · ${post.date}`, href: post.href })),
      ...pages.filter((page) => matches(`${page.title} ${page.description}`)),
      ...gameCatalog.filter((game) => matches(`${game.name} ${game.nameEn} ${game.description}`))
        .map((game) => ({ title: game.name, description: `小游戏 · ${game.description}`, href: `/games?game=${game.id}` })),
      ...domainLinks
        .filter((item) => matches(`${item.title} ${item.hostname} ${item.description}`))
        .map((item) => ({ title: item.title, description: item.hostname, href: item.href, external: true })),
    ].slice(0, 8);
  }, [query]);

  if (!open) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (results[0]) openResult(results[0]);
  };
  const openResult = (result: (typeof results)[number]) => {
    onClose();
    if ("external" in result && result.external) window.open(result.href, "_blank", "noopener,noreferrer");
    else navigate(result.href);
  };

  return (
    <div className="quick-search-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="quick-search"
        role="dialog"
        aria-modal="true"
        aria-label="全站搜索"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form onSubmit={submit}>
          <Search aria-hidden="true" size={19} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索笔记、页面和站点入口"
            aria-label="搜索内容"
          />
          <kbd>Esc</kbd>
          <button type="button" onClick={onClose} aria-label="关闭搜索">
            <X size={18} />
          </button>
        </form>
        {query ? (
          <div className="quick-search-results">
            {results.length ? results.map((result) => (
              <button key={`${result.href}-${result.title}`} type="button" onClick={() => openResult(result)}>
                <span>{result.title}</span>
                <small>{result.description}</small>
              </button>
            )) : <p>没有找到相关内容，换个关键词试试。</p>}
          </div>
        ) : <p className="quick-search-hint">输入关键词，按 Enter 打开第一个结果。</p>}
      </section>
    </div>
  );
}
