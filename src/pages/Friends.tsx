import { ArrowLeft, Heart, Star } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const friends = [
  {
    name: "阮一峰",
    url: "https://www.ruanyifeng.com/blog/",
    desc: "科技爱好者周刊，持续更新多年的优质技术博客。",
    note: "长期阅读的技术博客",
  },
  {
    name: "张鑫旭",
    url: "https://www.zhangxinxu.com/",
    desc: "CSS 领域深度文章，前端开发者的必读站点。",
    note: "CSS 学习推荐",
  },
  {
    name: "酷壳 CoolShell",
    url: "https://coolshell.cn",
    desc: "陈皓（左耳朵耗子）的技术博客，充满洞见。",
    note: "永恒的技术经典",
  },
  {
    name: "Hacker News",
    url: "https://news.ycombinator.com",
    desc: "Y Combinator 旗下的科技资讯社区。",
    note: "每日必刷",
  },
  {
    name: "Dev.to",
    url: "https://dev.to",
    desc: "全球开发者社区，文章质量高且氛围友好。",
    note: "英文技术文章",
  },
  {
    name: "V2EX",
    url: "https://www.v2ex.com",
    desc: "创意工作者社区，讨论技术、产品和生活方式。",
    note: "中文技术社区",
  },
  {
    name: "GitHub",
    url: "https://github.com",
    desc: "全球最大的代码托管平台，开源社区的中心。",
    note: "代码与协作",
  },
  {
    name: "Product Hunt",
    url: "https://www.producthunt.com",
    desc: "每日精选新产品，发现有趣的工具和产品。",
    note: "产品发现",
  },
];

export default function Friends() {
  useDocumentMeta("友情链接", "朋友站点、收藏链接和长期想保留的推荐页面。");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-10 lg:px-8">
      <div>
        <div className="flex items-center gap-3">
          <HomeLink
            className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-xs text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
          >
            <ArrowLeft className="size-3.5" />
            返回主页
          </HomeLink>
          <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-stone-600 backdrop-blur-xl">
            friends.yukino.bond
          </span>
        </div>
        <h1 className="mt-4 font-display text-4xl text-stone-900 sm:text-5xl">
          友情链接
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">
          放朋友站点、收藏链接和长期想保留的推荐页面，欢迎交换友链。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {friends.map((friend) => (
          <a
            key={friend.name}
            className="glass-panel group flex flex-col gap-4 rounded-[28px] p-6 transition hover:-translate-y-1"
            href={friend.url}
            rel="noreferrer"
            target="_blank"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="inline-flex size-10 items-center justify-center rounded-2xl border border-white/40 bg-white/30 text-sm text-stone-500 backdrop-blur-xl">
                  {friend.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-display text-lg text-stone-900">
                    {friend.name}
                  </h3>
                  <p className="text-xs text-stone-500">{friend.url}</p>
                </div>
              </div>
              <Heart className="size-4 shrink-0 text-stone-300 transition group-hover:text-red-400" />
            </div>
            <p className="text-sm leading-6 text-stone-600">{friend.desc}</p>
            <div className="flex items-center gap-2">
              <Star className="size-3.5 text-amber-400" />
              <span className="text-xs text-stone-500">{friend.note}</span>
            </div>
          </a>
        ))}
      </div>

      <div className="glass-panel rounded-[28px] p-6 text-center">
        <p className="text-sm text-stone-600">
          想交换友链？发送邮件到{" "}
          <a
            className="text-stone-900 underline underline-offset-2"
            href="mailto:Raptor@yukino.bond"
          >
            Raptor@yukino.bond
          </a>
        </p>
      </div>
    </div>
  );
}