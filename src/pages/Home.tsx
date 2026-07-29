import {
  ArrowRight,
  Boxes,
  Cloud,
  Mail,
  PencilLine,
  ScrollText,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";
import { DomainCard } from "@/components/DomainCard";
import { PostCard } from "@/components/PostCard";
import {
  domainLinks,
  postPreviews,
  principlePoints,
  siteProfile,
} from "@/data/site";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const featuredDomains = domainLinks.slice(0, 8);
const featuredPosts = postPreviews.slice(0, 4);

const quickActions = [
  {
    icon: Mail,
    title: "邮件主入口",
    detail: "mail.yukino.bond",
  },
  {
    icon: Wrench,
    title: "开发工具箱",
    detail: "dev.yukino.bond",
  },
  {
    icon: Boxes,
    title: "资源归档站",
    detail: "box.yukino.bond",
  },
];

const blogStats = [
  {
    icon: ScrollText,
    label: "文章",
    value: `${postPreviews.length.toString().padStart(2, "0")} 篇`,
  },
  {
    icon: Boxes,
    label: "子站",
    value: `${domainLinks.length.toString().padStart(2, "0")} 个`,
  },
  {
    icon: PencilLine,
    label: "状态",
    value: "持续更新",
  },
];

export default function Home() {
  useDocumentMeta(
    "首页",
    "Yukino 的个人博客，记录开发日常、折腾笔记和一些值得留下来的东西。",
  );

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8 lg:py-10">
      <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <section className="glass-panel rounded-[28px] p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-stone-600 backdrop-blur-xl">
            <Cloud className="size-3.5" />
            Cloudflare Pages
          </div>
          <p className="mt-5 text-xs uppercase tracking-[0.3em] text-stone-500">
            {siteProfile.domain}
          </p>
          <h1 className="mt-3 font-display text-5xl leading-none text-stone-900">
            Yukino
          </h1>
          <p className="mt-4 text-sm leading-7 text-stone-700">{siteProfile.tagline}</p>
          <p className="mt-3 text-sm leading-7 text-stone-600">{siteProfile.intro}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm text-white transition hover:-translate-y-0.5"
              to="/notes"
            >
              浏览文章
              <ArrowRight className="size-4" />
            </Link>
            <Link
              className="rounded-full border border-white/40 bg-white/30 px-4 py-2 text-sm text-stone-700 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
              to="/about-me"
            >
              关于我
            </Link>
          </div>
        </section>

        <section className="glass-panel rounded-[28px] p-6">
          <p className="text-xs uppercase tracking-[0.32em] text-stone-500">概览</p>
          <div className="mt-5 grid gap-3">
            {blogStats.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-[20px] bg-stone-50 px-4 py-3"
              >
                <div className="inline-flex items-center gap-3 text-stone-700">
                  <item.icon className="size-4" />
                  <span className="text-sm">{item.label}</span>
                </div>
                <span className="text-sm text-stone-500">{item.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel rounded-[28px] p-6">
          <p className="text-xs uppercase tracking-[0.32em] text-stone-500">常用入口</p>
          <div className="mt-5 space-y-3">
            {quickActions.map((action) => (
              <a
                key={action.title}
                className="flex items-center gap-4 rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3 transition hover:border-stone-300 hover:bg-white"
                href={`https://${action.detail}`}
                rel="noreferrer"
                target="_blank"
              >
                <div className="inline-flex size-10 items-center justify-center rounded-2xl bg-white text-stone-700 shadow-sm">
                  <action.icon className="size-4.5" />
                </div>
                <div>
                  <p className="text-sm text-stone-900">{action.title}</p>
                  <p className="text-xs text-stone-500">{action.detail}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      </aside>

      <div className="space-y-8">
        <section className="glass-panel rounded-[32px] p-7 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.32em] text-stone-500">
                Latest Writing
              </p>
              <h2 className="mt-3 font-display text-4xl text-stone-900 sm:text-5xl">
                近期文章
              </h2>
              <p className="mt-4 text-sm leading-8 text-stone-600 sm:text-base">
                一些随手记下来的开发笔记和日常碎片，想到什么写什么。
              </p>
            </div>

            <div className="grid gap-2 text-sm text-stone-600">
              {principlePoints.map((item) => (
                <div key={item} className="rounded-full bg-stone-100 px-4 py-2">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5">
          {featuredPosts.map((post) => (
            <PostCard key={post.title} post={post} />
          ))}
        </section>

        <section className="grid gap-5">
          <div className="glass-panel rounded-[28px] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                  Blog Structure
                </p>
                <h2 className="mt-3 font-display text-4xl text-stone-900">
                  其他角落
                </h2>
              </div>
              <Link
                className="rounded-full border border-white/40 bg-white/30 px-4 py-2 text-sm text-stone-700 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
                to="/about-me"
              >
                查看全部
              </Link>
            </div>

            <p className="mt-4 max-w-2xl text-sm leading-8 text-stone-600">
              博客之外，顺手维护的几个小站点：工具、资源、收藏，还有一些有的没的。
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {featuredDomains.map((domain) => (
                <DomainCard key={domain.hostname} domain={domain} />
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
              Deployment Note
            </p>
            <h2 className="mt-3 font-display text-4xl text-stone-900">
              关于这个站
            </h2>
            <div className="mt-5 grid gap-3 text-sm leading-7 text-stone-600">
              <div className="rounded-[22px] bg-stone-50 px-4 py-4">
                静态构建，托管在 Cloudflare Pages。
              </div>
              <div className="rounded-[22px] bg-stone-50 px-4 py-4">
                代码和内容都在 GitHub，push 即部署。
              </div>
              <div className="rounded-[22px] bg-stone-50 px-4 py-4">
                慢慢写，慢慢长。
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
