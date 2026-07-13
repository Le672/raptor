import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Code2,
  Globe,
  Music,
  Newspaper,
  Palette,
  PenTool,
  Smartphone,
  Wrench,
} from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const linkGroups = [
  {
    title: "常用工具",
    icon: Wrench,
    links: [
      {
        label: "dev.yukino.bond",
        url: "https://dev.yukino.bond",
        desc: "Base64、JSON、时间戳等开发工具",
      },
      {
        label: "Regex101",
        url: "https://regex101.com",
        desc: "正则表达式在线测试",
      },
      {
        label: "Carbon",
        url: "https://carbon.now.sh",
        desc: "代码截图美化工具",
      },
      {
        label: "Excalidraw",
        url: "https://excalidraw.com",
        desc: "手绘风格白板绘图",
      },
    ],
  },
  {
    title: "开发资源",
    icon: Code2,
    links: [
      {
        label: "MDN Web Docs",
        url: "https://developer.mozilla.org",
        desc: "Web 技术权威参考",
      },
      {
        label: "Can I Use",
        url: "https://caniuse.com",
        desc: "浏览器兼容性查询",
      },
      {
        label: "Stack Overflow",
        url: "https://stackoverflow.com",
        desc: "技术问答社区",
      },
      {
        label: "GitHub",
        url: "https://github.com",
        desc: "代码托管与协作平台",
      },
    ],
  },
  {
    title: "设计与灵感",
    icon: Palette,
    links: [
      {
        label: "Dribbble",
        url: "https://dribbble.com",
        desc: "设计作品展示社区",
      },
      {
        label: "Behance",
        url: "https://www.behance.net",
        desc: "创意作品集平台",
      },
      {
        label: "Awwwards",
        url: "https://www.awwwards.com",
        desc: "优秀网站设计评选",
      },
      {
        label: "Tailwind CSS",
        url: "https://tailwindcss.com",
        desc: "实用优先的 CSS 框架",
      },
    ],
  },
  {
    title: "阅读与资讯",
    icon: BookOpen,
    links: [
      {
        label: "Hacker News",
        url: "https://news.ycombinator.com",
        desc: "科技资讯与讨论",
      },
      {
        label: "Dev.to",
        url: "https://dev.to",
        desc: "开发者社区文章",
      },
      {
        label: "Medium",
        url: "https://medium.com",
        desc: "长文阅读平台",
      },
      {
        label: "阮一峰的网络日志",
        url: "https://www.ruanyifeng.com/blog/",
        desc: "科技与人文博客",
      },
    ],
  },
  {
    title: "休闲娱乐",
    icon: Music,
    links: [
      {
        label: "Music For Programming",
        url: "https://musicforprogramming.net",
        desc: "编程背景音乐合集",
      },
      {
        label: "Lofi.cafe",
        url: "https://www.lofi.cafe",
        desc: "Lo-fi 音乐电台",
      },
      {
        label: "Rainy Mood",
        url: "https://rainymood.com",
        desc: "雨声白噪音",
      },
    ],
  },
];

export default function Links() {
  useDocumentMeta("快速导航", "移动端友好的极简入口页，适合作为轻量书签首页。");

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
            links.yukino.bond
          </span>
        </div>
        <h1 className="mt-4 font-display text-4xl text-stone-900 sm:text-5xl">
          快速导航
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">
          移动端友好的轻量书签首页，分类整理常用链接，适合设为浏览器主页。
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {linkGroups.map((group) => (
          <div key={group.title} className="glass-panel rounded-[28px] p-6">
            <div className="mb-4 flex items-center gap-2">
              <group.icon className="size-4 text-stone-500" />
              <h2 className="text-sm uppercase tracking-[0.24em] text-stone-500">
                {group.title}
              </h2>
            </div>
            <div className="space-y-2">
              {group.links.map((link) => (
                <a
                  key={link.label}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/30 bg-white/20 px-4 py-3 backdrop-blur-xl transition hover:border-white/50 hover:bg-white/30"
                  href={link.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-stone-900">{link.label}</p>
                    <p className="truncate text-xs text-stone-500">
                      {link.desc}
                    </p>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-stone-400" />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}