import { Link } from "react-router-dom";
import { SectionHeading } from "@/components/SectionHeading";
import { postPreviews } from "@/data/site";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useSiteStore } from "@/hooks/useSiteStore";
import { cn } from "@/lib/utils";

const filters = ["全部", "开发", "随笔", "收藏"] as const;

export default function Notes() {
  useDocumentMeta("笔记", "开发记录、随笔与收藏内容的静态预览页。");

  const noteFilter = useSiteStore((state) => state.noteFilter);
  const setNoteFilter = useSiteStore((state) => state.setNoteFilter);

  const filteredPosts =
    noteFilter === "全部"
      ? postPreviews
      : postPreviews.filter((post) => post.tag === noteFilter);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-12 lg:px-8 lg:py-20">
      <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <SectionHeading
          eyebrow="Journal"
          title="短文、折腾记录与内容预览"
          description="这个页面现在先放静态示例内容，后续可以很平滑地接入 Markdown 驱动的文章系统，继续保持目前的视觉风格和信息结构。"
        />

        <div className="glass-panel rounded-[32px] p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
            阅读方式
          </p>
          <p className="mt-4 text-sm leading-7 text-stone-600">
            如果你后续把完整正文拆到 `blog.yukino.bond`，根域名这里依然适合继续保留摘要预览，形成“首页看更新，正文去独立博客”的结构。
          </p>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        {filters.map((filter) => (
          <button
            key={filter}
            className={cn(
              "rounded-full px-5 py-2 text-sm transition",
              noteFilter === filter
                ? "bg-stone-900 text-white"
                : "border border-white/40 bg-white/30 text-stone-600 backdrop-blur-xl hover:border-white/60 hover:text-stone-900",
            )}
            onClick={() => setNoteFilter(filter)}
            type="button"
          >
            {filter}
          </button>
        ))}
      </section>

      <section className="grid gap-5">
        {filteredPosts.map((post, index) => (
          <article
            key={`${post.title}-${post.date}`}
            className="glass-panel grid gap-6 rounded-[30px] p-6 lg:grid-cols-[160px_1fr_auto] lg:items-center"
          >
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.28em] text-stone-500">
                Entry {String(index + 1).padStart(2, "0")}
              </p>
              <p className="text-sm text-stone-500">{post.date}</p>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-3xl text-stone-900">{post.title}</h2>
                <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-stone-600 backdrop-blur-xl">
                  {post.tag}
                </span>
              </div>
              <p className="text-sm leading-7 text-stone-600">{post.summary}</p>
            </div>

            <Link
              className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/30 px-5 py-3 text-sm text-stone-700 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
              to="/about-me"
            >
              关于我
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
