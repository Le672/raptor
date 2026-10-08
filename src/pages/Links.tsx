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
import { useState } from "react";
import { Star, Download } from "lucide-react";
import { SearchField } from "@/components/SearchField";
import { useStoredState } from "@/hooks/useStoredState";
import { downloadText } from "@/lib/browser-actions";
import { xmlEscape } from "@/lib/rss-catalog";
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
        label: "f1.yukino.bond",
        url: "https://f1.yukino.bond",
        desc: "Formula 1 赛历、成绩、积分、计时与观赛入口",
      },
      {
        label: "jm.yukino.bond",
        url: "https://jm.yukino.bond",
        desc: "漫画搜索、阅读、收藏与章节导出",
      },
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

  const [query, setQuery] = useState(""), [category, setCategory] = useState("全部"), [favoritesOnly, setFavoritesOnly] = useState(false);
  const urls = linkGroups.flatMap(group => group.links.map(link => link.url));
  const [favorites, setFavorites, persistent] = useStoredState<string[]>("yukino.links.favorites", [], (value): value is string[] => Array.isArray(value) && value.length <= urls.length && value.every(url => typeof url === "string" && urls.includes(url)));
  const groups = linkGroups.filter(group => category === "全部" || group.title === category).map(group => ({ ...group, links: group.links.filter(link => (!favoritesOnly || favorites.includes(link.url)) && (link.label + " " + link.desc + " " + group.title).toLowerCase().includes(query.trim().toLowerCase())) })).filter(group => group.links.length);
  const count = groups.reduce((total, group) => total + group.links.length, 0);
  const exportLinks = () => downloadText("yukino-bookmarks.html", '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Yukino 导航书签</TITLE><H1>Yukino 导航书签</H1><DL><p>' + groups.map(group => '<DT><H3>' + xmlEscape(group.title) + '</H3><DL><p>' + group.links.map(link => '<DT><A HREF="' + xmlEscape(link.url) + '">' + xmlEscape(link.label) + '</A>').join("\n") + '</DL><p>').join("\n") + '</DL><p>', "text/html;charset=utf-8");

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

      <SearchField value={query} onChange={setQuery} label="搜索导航名称或说明" />
      <div className="flex flex-wrap gap-2">{["全部", ...linkGroups.map(group => group.title)].map(value => <button type="button" key={value} aria-pressed={category === value} className="pill-button" onClick={() => setCategory(value)}>{value}</button>)}<button type="button" className="pill-button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(value => !value)}><Star size={14} />我的收藏 {favorites.length}</button><button type="button" className="pill-button" disabled={!count} onClick={exportLinks}><Download size={14} />导出当前书签</button></div>
      <p className="text-xs text-stone-500" aria-live="polite">{count} 个链接 · 收藏保存在当前浏览器</p>
      {!persistent && <p role="alert" className="text-xs text-amber-800">收藏暂时无法写入浏览器存储，请导出书签保存。</p>}
      {!count && <p className="empty-notes">没有匹配的链接。<button type="button" className="ml-3 underline" onClick={() => { setQuery(""); setCategory("全部"); setFavoritesOnly(false); }}>重置筛选</button></p>}
      <div className="grid gap-6 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.title} className="glass-panel rounded-[28px] p-6">
            <div className="mb-4 flex items-center gap-2">
              <group.icon className="size-4 text-stone-500" />
              <h2 className="text-sm uppercase tracking-[0.24em] text-stone-500">
                {group.title}
              </h2>
            </div>
            <div className="space-y-2">
              {group.links.map((link) => (
                <div key={link.url} className="flex items-center gap-2"><a
                  className="min-w-0 flex-1 flex items-center justify-between gap-4 rounded-2xl border border-white/30 bg-white/20 px-4 py-3 backdrop-blur-xl transition hover:border-white/50 hover:bg-white/30"
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
                </a><button type="button" className="rounded-xl p-2 text-stone-500" aria-label={(favorites.includes(link.url) ? "取消收藏 " : "收藏 ") + link.label} aria-pressed={favorites.includes(link.url)} onClick={() => setFavorites(current => current.includes(link.url) ? current.filter(url => url !== link.url) : [...current, link.url])}><Star size={17} fill={favorites.includes(link.url) ? "currentColor" : "none"} /></button></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
