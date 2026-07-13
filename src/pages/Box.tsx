import { useState } from "react";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Image,
  Music,
  Search,
  Server,
} from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { cn } from "@/lib/utils";

type Category = "all" | "software" | "document" | "media" | "other";

const categories: { id: Category; label: string; icon: typeof FolderOpen }[] = [
  { id: "all", label: "全部", icon: FolderOpen },
  { id: "software", label: "软件", icon: Download },
  { id: "document", label: "文档", icon: FileText },
  { id: "media", label: "媒体", icon: Image },
  { id: "other", label: "其他", icon: Server },
];

const resources = [
  {
    title: "Visual Studio Code",
    description: "轻量级代码编辑器，支持丰富的插件生态。",
    url: "https://code.visualstudio.com/",
    category: "software" as Category,
    size: "~80 MB",
  },
  {
    title: "7-Zip",
    description: "开源压缩解压工具，支持多种格式。",
    url: "https://7-zip.org/",
    category: "software" as Category,
    size: "~1.5 MB",
  },
  {
    title: "Docker Desktop",
    description: "容器化开发环境，简化部署与协作。",
    url: "https://www.docker.com/products/docker-desktop/",
    category: "software" as Category,
    size: "~500 MB",
  },
  {
    title: "Node.js LTS",
    description: "JavaScript 运行时，长期支持版本。",
    url: "https://nodejs.org/",
    category: "software" as Category,
    size: "~30 MB",
  },
  {
    title: "Git for Windows",
    description: "版本控制工具，开发必备。",
    url: "https://git-scm.com/download/win",
    category: "software" as Category,
    size: "~50 MB",
  },
  {
    title: "Cloudflare 文档",
    description: "Cloudflare 各项服务的官方文档与指南。",
    url: "https://developers.cloudflare.com/",
    category: "document" as Category,
    size: "在线",
  },
  {
    title: "React 官方文档",
    description: "React 框架的完整文档与教程。",
    url: "https://react.dev/",
    category: "document" as Category,
    size: "在线",
  },
  {
    title: "Tailwind CSS 文档",
    description: "实用优先的 CSS 框架参考文档。",
    url: "https://tailwindcss.com/docs",
    category: "document" as Category,
    size: "在线",
  },
  {
    title: "MDN Web Docs",
    description: "Mozilla 维护的 Web 技术权威参考。",
    url: "https://developer.mozilla.org/",
    category: "document" as Category,
    size: "在线",
  },
  {
    title: "Unsplash",
    description: "高质量免费图片资源库。",
    url: "https://unsplash.com/",
    category: "media" as Category,
    size: "在线",
  },
  {
    title: "Font Awesome",
    description: "图标字体与 SVG 图标库。",
    url: "https://fontawesome.com/",
    category: "media" as Category,
    size: "在线",
  },
  {
    title: "Google Fonts",
    description: "开源 Web 字体集合。",
    url: "https://fonts.google.com/",
    category: "media" as Category,
    size: "在线",
  },
  {
    title: "Music For Programming",
    description: "适合编程时听的背景音乐合集。",
    url: "https://musicforprogramming.net/",
    category: "media" as Category,
    size: "在线",
  },
  {
    title: "Can I Use",
    description: "浏览器兼容性查询工具。",
    url: "https://caniuse.com/",
    category: "other" as Category,
    size: "在线",
  },
  {
    title: "Regex101",
    description: "正则表达式在线测试与调试工具。",
    url: "https://regex101.com/",
    category: "other" as Category,
    size: "在线",
  },
  {
    title: "cURL Converter",
    description: "将 cURL 命令转换为各种语言代码。",
    url: "https://curlconverter.com/",
    category: "other" as Category,
    size: "在线",
  },
];

export default function Box() {
  useDocumentMeta("资源站", "资源索引、软件下载说明和常用中转页面合集。");

  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");

  const filtered = resources.filter((r) => {
    const matchCat = activeCategory === "all" || r.category === activeCategory;
    const matchSearch =
      !search.trim() ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10 lg:px-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <HomeLink
            className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-xs text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
          >
            <ArrowLeft className="size-3.5" />
            返回主页
          </HomeLink>
          <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-stone-600 backdrop-blur-xl">
            box.yukino.bond
          </span>
        </div>
        <h1 className="mt-4 font-display text-4xl text-stone-900 sm:text-5xl">
          资源归档站
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">
          常用软件、文档、媒体资源的索引与下载中转，方便快速找到需要的工具和资料。
        </p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition",
                activeCategory === cat.id
                  ? "bg-stone-900 text-white"
                  : "border border-white/40 bg-white/30 text-stone-600 backdrop-blur-xl hover:border-white/60 hover:text-stone-900",
              )}
              onClick={() => setActiveCategory(cat.id)}
              type="button"
            >
              <cat.icon className="size-3.5" />
              {cat.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input
            className="w-full rounded-full border border-white/40 bg-white/30 py-2.5 pl-10 pr-4 text-sm text-stone-800 placeholder:text-stone-400 backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 sm:w-64"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索资源..."
            type="text"
            value={search}
          />
        </div>
      </div>

      {/* Resource Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <a
            key={item.title}
            className="glass-panel group flex flex-col justify-between gap-4 rounded-[24px] p-5 transition hover:-translate-y-1"
            href={item.url}
            rel="noreferrer"
            target="_blank"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-xl text-stone-900">
                  {item.title}
                </h3>
                <ExternalLink className="size-4 shrink-0 text-stone-400 transition group-hover:text-stone-600" />
              </div>
              <p className="text-sm leading-6 text-stone-600">
                {item.description}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-white/30 bg-white/20 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-stone-500 backdrop-blur-xl">
                {item.category}
              </span>
              <span className="text-xs text-stone-400">{item.size}</span>
            </div>
          </a>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Music className="size-10 text-stone-300" />
          <p className="text-sm text-stone-500">没有找到匹配的资源</p>
        </div>
      )}
    </div>
  );
}