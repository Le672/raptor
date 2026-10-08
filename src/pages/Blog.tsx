import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { usePublicPosts } from "@/hooks/usePublicContent";
import { ContentNotice } from "@/components/ContentNotice";
import { CopyButton } from "@/components/CopyButton";
import { Markdown, markdownHeadings, markdownText } from "@/components/Markdown";
import { api, ApiError } from "@/lib/api";
import { canonicalSlug, contentDate, postHref, type Post } from "@/lib/content";

export default function Blog() {
  const [params] = useSearchParams(), selected = params.get("post");
  const slug = selected ? canonicalSlug(selected) : null;
  const list = usePublicPosts();
  const [article, setArticle] = useState<Post | null>(null), [error, setError] = useState(""), [notFound, setNotFound] = useState(false), [loading, setLoading] = useState(false), [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true; setArticle(null); setError(""); setNotFound(false);
    if (!slug) { setLoading(false); return; }
    setLoading(true);
    api.getPost(slug).then(result => { if (active) setArticle(result.post); }).catch(error => { if (active) { setNotFound(error instanceof ApiError && error.status === 404); setError(error.message || "文章读取失败"); } }).finally(() => { if (active) setLoading(false); });
    window.scrollTo(0, 0);
    return () => { active = false; };
  }, [slug, version]);
  useDocumentMeta(article?.title ?? "博客", article?.summary ?? "开发心得、随笔和折腾日志。");
  const headings = article ? markdownHeadings(article.content) : [];
  const position = list.data.findIndex(post => post.slug === slug), previous = list.data[position - 1], next = position < 0 ? null : list.data[position + 1];
  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10 lg:px-8">
    <div><HomeLink className="text-link inline-flex items-center gap-2"><ArrowLeft size={15} />返回主页</HomeLink><p className="eyebrow mt-6">THE JOURNAL / BLOG</p><h1 className="mt-3 font-display text-4xl text-stone-900">{selected ? "阅读笔记" : "博客"}</h1><p className="mt-3 text-sm leading-7 text-stone-600">开发记录、长文和生活切片，从管理台发布后自动呈现在这里。</p></div>
    <Link to="/notes" className="text-link">← 全部笔记与筛选</Link>
    {!selected && <><ContentNotice {...list} hasData={list.data.length > 0} />{list.data.map(post => <Link key={post.id} to={postHref(post.slug)} className="glass-panel rounded-3xl p-6 transition hover:-translate-y-0.5"><div className="writing-meta"><span>{post.tag}</span><time dateTime={post.created_at}>{contentDate(post.created_at)}</time></div><h2 className="my-3 font-display text-2xl text-stone-900">{post.title}</h2><p className="text-sm leading-7 text-stone-600">{post.summary}</p><span className="text-link mt-4 inline-flex">继续阅读 →</span></Link>)}{!list.loading && !list.error && !list.data.length && <p className="empty-notes">暂时没有已发布文章。</p>}</>}
    {selected && loading && <p role="status">正在读取文章…</p>}
    {selected && error && <div role="alert" className="glass-panel rounded-3xl p-6"><h2 className="text-xl text-stone-900">{notFound ? "这篇文章不存在或尚未发布" : "文章暂时无法读取"}</h2><p className="my-4 text-sm text-stone-600">{error}</p>{!notFound && <button type="button" className="text-link" onClick={() => setVersion(value => value + 1)}>重新加载</button>}<Link to="/notes" className="text-link ml-4">查看其他笔记</Link></div>}
    {article && <article className="glass-panel rounded-[32px] p-6 sm:p-8"><div className="flex flex-wrap items-center gap-4 text-xs text-stone-500"><span>{article.tag}</span><span className="inline-flex items-center gap-1"><Calendar size={13} />{contentDate(article.created_at)}</span><span className="inline-flex items-center gap-1"><Clock size={13} />约 {Math.max(1, Math.ceil(markdownText(article.content).length / 500))} 分钟</span><span>{article.author_name}</span></div><h2 className="my-5 font-display text-3xl leading-snug text-stone-900">{article.title}</h2><p className="mb-5 text-sm leading-7 text-stone-500">{article.summary}</p><div className="mb-6 flex flex-wrap items-center gap-4"><CopyButton text={`https://www.yukino.bond${postHref(article.slug)}`} label="复制文章链接" /><span className="text-xs text-stone-500">最近更新：{contentDate(article.updated_at)}</span></div>{headings.length > 1 && <details className="mb-6 rounded-2xl border border-stone-200 bg-white/50 p-4" open><summary className="cursor-pointer text-sm text-stone-700">文章目录</summary><nav aria-label="文章目录" className="mt-3 flex flex-col gap-2">{headings.map(heading => <a key={heading.id} href={`#${heading.id}`} className="text-sm text-stone-500 hover:text-stone-900">{heading.title}</a>)}</nav></details>}<Markdown content={article.content} /><div className="mt-10 grid gap-3 border-t border-stone-200 pt-5 sm:grid-cols-2">{previous && <Link className="text-link text-sm" to={postHref(previous.slug)}>← {previous.title}</Link>}{next && <Link className="text-link text-sm sm:text-right" to={postHref(next.slug)}>{next.title} →</Link>}</div></article>}
  </div>;
}
