import { Link } from "react-router-dom";
import { ArrowUpRight, Search, X } from "lucide-react";
import { useState } from "react";
import { postPreviews } from "@/data/site";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useSiteStore } from "@/hooks/useSiteStore";
const filters = ["全部", "开发", "随笔", "收藏"] as const;
export default function Notes() {
  useDocumentMeta("笔记", "开发记录、随笔与收藏，记录那些值得留下来的事情。");
  const { noteFilter, setNoteFilter } = useSiteStore();
  const [query, setQuery] = useState("");
  const posts = (
    noteFilter === "全部"
      ? postPreviews
      : postPreviews.filter((post) => post.tag === noteFilter)
  ).filter((post) => `${post.title} ${post.summary} ${post.tag}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12 lg:py-20">
      <p className="eyebrow">THE JOURNAL</p>
      <h1 className="mt-4 font-display text-4xl text-stone-800">
        一些笔记，一些日常。
      </h1>
      <p className="mt-5 text-sm leading-7 text-stone-500">
        关于开发、折腾和生活。把走过的路、遇见的想法，留在这里。
      </p>
      <div className="my-9 flex flex-wrap gap-3" aria-label="笔记分类">
        {filters.map((filter) => (
          <button
            key={filter}
            aria-pressed={noteFilter === filter}
            className={`rounded-full px-5 py-2 text-sm transition ${noteFilter === filter ? "bg-stone-800 text-white" : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-100"}`}
            onClick={() => setNoteFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>
      <label className="notes-search">
        <Search size={17} aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="筛选笔记标题或内容" />
        {query && <button type="button" onClick={() => setQuery("")} aria-label="清除筛选"><X size={16} /></button>}
      </label>
      <p className="mb-4 text-xs text-stone-500" aria-live="polite">
        {posts.length} 篇笔记
      </p>
      {posts.map((post, index) => (
        <Link className="writing-row" key={post.href} to={post.href}>
          <span className="writing-number">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <div className="writing-meta">
              <span>{post.tag}</span>
              <time dateTime={post.date}>{post.date}</time>
            </div>
            <h2 className="mt-2 text-lg text-stone-800">{post.title}</h2>
            <p>{post.summary}</p>
          </div>
          <ArrowUpRight className="writing-arrow" size={20} />
        </Link>
      ))}
      {!posts.length && <p className="empty-notes">没有匹配的笔记，试试换个关键词。</p>}
    </div>
  );
}
