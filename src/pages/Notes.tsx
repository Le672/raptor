import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { usePublicPosts } from "@/hooks/usePublicContent";
import { ContentNotice } from "@/components/ContentNotice";
import { SearchField } from "@/components/SearchField";
import { contentDate, postHref } from "@/lib/content";

export default function Notes() {
  useDocumentMeta("笔记", "开发记录、随笔与收藏，记录那些值得留下来的事情。");
  const content = usePublicPosts();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "", tag = params.get("tag") ?? "全部", sort = params.get("sort") ?? "newest";
  const update = (key: string, value: string) => setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(key, value); else next.delete(key); return next; }, { replace: true });
  const tags = ["全部", ...new Set(content.data.map(post => post.tag))];
  const posts = content.data.filter(post => (tag === "全部" || post.tag === tag) && `${post.title} ${post.summary} ${post.tag}`.toLowerCase().includes(query.trim().toLowerCase()));
  if (sort === "oldest") posts.reverse();
  return <div className="mx-auto w-full max-w-4xl px-6 py-12 lg:py-20">
    <p className="eyebrow">THE JOURNAL</p><h1 className="mt-4 font-display text-4xl text-stone-800">一些笔记，一些日常。</h1>
    <p className="mt-5 text-sm leading-7 text-stone-500">关于开发、折腾和生活。把走过的路、遇见的想法，留在这里。</p>
    <div className="my-8 flex flex-wrap gap-2" aria-label="笔记分类">{tags.map(value => <button type="button" key={value} aria-pressed={tag === value} onClick={() => update("tag", value === "全部" ? "" : value)} className={`rounded-full px-5 py-2 text-sm ${tag === value ? "bg-stone-800 text-white" : "border border-stone-200 bg-white text-stone-600"}`}>{value}</button>)}</div>
    <SearchField value={query} onChange={value => update("q", value)} label="搜索笔记标题或摘要" />
    <div className="mb-5 flex items-center justify-between gap-3 text-xs text-stone-500"><span aria-live="polite">{posts.length} 篇笔记</span><label>排序 <select aria-label="笔记排序" value={sort} onChange={event => update("sort", event.target.value)} className="rounded-lg border border-stone-200 bg-white p-2"><option value="newest">最新发布</option><option value="oldest">最早发布</option></select></label></div>
    <ContentNotice {...content} hasData={content.data.length > 0} />
    {posts.map((post, index) => <Link className="writing-row" key={post.id} to={postHref(post.slug)}><span className="writing-number">{String(index + 1).padStart(2, "0")}</span><div><div className="writing-meta"><span>{post.tag}</span><time dateTime={post.created_at}>{contentDate(post.created_at)}</time></div><h2 className="mt-2 text-lg text-stone-800">{post.title}</h2><p>{post.summary}</p></div><ArrowUpRight className="writing-arrow" size={20} /></Link>)}
    {!posts.length && !content.loading && !content.error && <div className="empty-notes"><p>{content.data.length ? "没有匹配的笔记。" : "暂时没有公开笔记。"}</p>{content.data.length > 0 && <button type="button" className="mt-3 underline" onClick={() => setParams({})}>重置筛选</button>}</div>}
    <a className="text-link mt-8 inline-flex" href="/api/feed">订阅本站 RSS ↗</a>
  </div>;
}
