import { ArrowLeft, Rss, Globe, ExternalLink } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const feeds = [
  {
    title: "阮一峰的网络日志",
    url: "https://www.ruanyifeng.com/blog/",
    feedUrl: "https://feeds.feedburner.com/ruanyifeng",
    category: "技术",
    desc: "科技爱好者周刊，涵盖技术、科技与人文。",
  },
  {
    title: "Hacker News",
    url: "https://news.ycombinator.com",
    feedUrl: "https://hnrss.org/frontpage",
    category: "资讯",
    desc: "科技资讯与深度讨论。",
  },
  {
    title: "GitHub Trending",
    url: "https://github.com/trending",
    feedUrl: "https://mshibanami.github.io/GitHubTrendingRSS/daily/all.xml",
    category: "开发",
    desc: "GitHub 每日热门开源项目。",
  },
  {
    title: "Dev.to",
    url: "https://dev.to",
    feedUrl: "https://dev.to/feed",
    category: "开发",
    desc: "开发者社区精选文章。",
  },
  {
    title: "CSS-Tricks",
    url: "https://css-tricks.com",
    feedUrl: "https://css-tricks.com/feed/",
    category: "前端",
    desc: "CSS 技巧与前端开发文章。",
  },
  {
    title: "Smashing Magazine",
    url: "https://www.smashingmagazine.com",
    feedUrl: "https://www.smashingmagazine.com/feed/",
    category: "设计",
    desc: "Web 设计与前端开发权威杂志。",
  },
  {
    title: "Cloudflare Blog",
    url: "https://blog.cloudflare.com",
    feedUrl: "https://blog.cloudflare.com/rss/",
    category: "运维",
    desc: "Cloudflare 官方博客，网络与安全技术。",
  },
  {
    title: "The Verge",
    url: "https://www.theverge.com",
    feedUrl: "https://www.theverge.com/rss/index.xml",
    category: "科技",
    desc: "科技新闻与产品评测。",
  },
];

const categories = [...new Set(feeds.map((f) => f.category))];

export default function RSS() {
  useDocumentMeta("订阅源", "给长期关注的人一个稳定、清爽的订阅入口。");

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
            rss.yukino.bond
          </span>
        </div>
        <h1 className="mt-4 font-display text-4xl text-stone-900 sm:text-5xl">
          订阅源
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">
          给长期关注的人一个稳定、清爽的订阅入口，汇总值得订阅的 RSS 源。
        </p>
      </div>

      {categories.map((cat) => (
        <div key={cat}>
          <h2 className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-4 py-1.5 text-xs uppercase tracking-[0.24em] text-stone-600 backdrop-blur-xl">
            <Globe className="size-3.5" />
            {cat}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {feeds
              .filter((f) => f.category === cat)
              .map((feed) => (
                <div
                  key={feed.title}
                  className="glass-panel flex flex-col gap-4 rounded-[24px] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg text-stone-900">
                        {feed.title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-stone-600">
                        {feed.desc}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-xs text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
                      href={feed.feedUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <Rss className="size-3.5" />
                      RSS
                    </a>
                    <a
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-xs text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
                      href={feed.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="size-3.5" />
                      网站
                    </a>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}