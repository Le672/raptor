import { ArrowRight, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import type { PostPreview } from "@/data/site";

type PostCardProps = {
  post: PostPreview;
};

export function PostCard({ post }: PostCardProps) {
  return (
    <article className="glass-panel group rounded-[24px] p-6 transition hover:-translate-y-0.5">
      <div className="mb-5 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.22em] text-stone-500">
        <span className="rounded-full border border-white/40 bg-white/30 px-3 py-1 backdrop-blur-xl">
          {post.tag}
        </span>
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="size-3.5" />
          {post.date}
        </span>
      </div>

      <div className="space-y-4">
        <h3 className="font-display text-3xl text-stone-900">{post.title}</h3>
        <p className="text-sm leading-7 text-stone-600">{post.summary}</p>
      </div>

      <Link
        className="mt-6 inline-flex items-center gap-2 text-sm text-stone-700 transition group-hover:text-stone-900"
        to={post.href}
      >
        继续阅读
        <ArrowRight className="size-4 transition group-hover:translate-x-1" />
      </Link>
    </article>
  );
}
