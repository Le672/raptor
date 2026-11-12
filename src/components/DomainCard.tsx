import { ArrowUpRight, BadgeCheck, Clock3 } from "lucide-react";
import type { DomainLink } from "@/data/site";

const categoryLabelMap = {
  core: "核心入口",
  content: "内容扩展",
  experimental: "实验计划",
} satisfies Record<DomainLink["category"], string>;

type DomainCardProps = {
  domain: DomainLink;
};

export function DomainCard({ domain }: DomainCardProps) {
  const isOnline = domain.status === "online";

  return (
    <article className="glass-panel flex h-full flex-col justify-between gap-5 rounded-[22px] p-5">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.28em] text-stone-500">
              {categoryLabelMap[domain.category]}
            </p>
            <h3 className="font-display text-2xl text-stone-900">{domain.title}</h3>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${
              isOnline
                ? "border border-emerald-300/40 bg-emerald-50/40 text-emerald-700 backdrop-blur-xl"
                : "border border-white/30 bg-white/20 text-stone-600 backdrop-blur-xl"
            }`}
          >
            {isOnline ? <BadgeCheck className="size-3.5" /> : <Clock3 className="size-3.5" />}
            {isOnline ? "已上线" : "规划中"}
          </span>
        </div>

        <p className="text-base text-stone-700">{domain.hostname}</p>
        <p className="text-sm leading-7 text-stone-600">{domain.description}</p>
      </div>

      <a
        className="inline-flex w-fit items-center gap-2 rounded-full border border-white/40 bg-white/30 px-4 py-2 text-sm text-stone-700 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-white/60 hover:text-stone-900"
        href={domain.href}
        target="_blank"
        rel="noreferrer"
      >
        打开入口
        <ArrowUpRight className="size-4" />
      </a>
    </article>
  );
}
