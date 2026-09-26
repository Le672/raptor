import { ArrowLeft, GitCommit, Plus, Wrench, Zap } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

type ChangelogEntry = {
  date: string;
  version?: string;
  type: "feature" | "improvement" | "fix";
  title: string;
  changes: string[];
};

const changelog: ChangelogEntry[] = [
  {
    date: "2026-09-25",
    type: "feature",
    title: "姬漫图书馆与桌面端上线",
    changes: [
      "上线 JM 网页图书馆与 Cloudflare 子域部署，提供漫画浏览、阅读、搜索、收藏和批量下载",
      "新增 Windows 桌面漫画工作台及独立构建流程",
      "重做 JM 图书馆界面，更新站点标题和应用图标",
      "优化 Yukino 品牌标识：首页插画改为「记录」，导航徽标改为 Y",
    ],
  },
  {
    date: "2026-09-23",
    type: "feature",
    title: "首页改版与全站搜索",
    changes: [
      "重做首页、关于、笔记与博客页面，围绕个人数字花园重新整理内容",
      "笔记卡片可直达对应文章，修复本地预览环境的站内路由",
      "新增 Ctrl/⌘ K 全站搜索，覆盖文章、常用页面和站点入口",
      "笔记页新增即时关键词筛选，文章页支持复制当前链接",
    ],
  },
  {
    date: "2026-09-22",
    type: "improvement",
    title: "个人站视觉与导航重整",
    changes: [
      "建立统一的 Yukino 配色、排版和页面视觉样式",
      "简化桌面导航，统一页头、页脚和页面入口",
      "改善移动菜单与键盘操作，并加入跳转到正文的无障碍入口",
    ],
  },
  {
    date: "2026-07-31",
    type: "feature",
    title: "新增桌面端与 Android 应用支持",
    changes: [
      "加入 Electron 桌面应用和 Capacitor Android 项目配置",
      "新增 Windows 桌面安装包构建流程；移除无法在 Windows 构建的 iOS 平台目标",
      "修复 Electron 使用 file:// 加载时的静态资源路径",
    ],
  },
  {
    date: "2026-09-26",
    version: "v0.8.0",
    type: "improvement",
    title: "JM 漫画书房独立重写",
    changes: [
      "重写 jm.yukino.bond 的搜索、作品详情和阅读界面，网页视觉与主站统一",
      "新增本机书架、阅读进度、纵向与横向阅读、缩放、缓存和 PWA 安装",
      "支持章节批量导出为 CBZ、ZIP、PDF，并提供可配置的 OCR 翻译入口",
      "Windows 便携版采用独立深色工作台界面，不再沿用网页版布局",
    ],
  },
  {
    date: "2026-07-29",
    version: "v0.7.0",
    type: "feature",
    title: "新闻聚合页、自动部署与文案润色",
    changes: [
      "新增 news.yukino.bond 新闻聚合页，聚合 IT之家、36氪、Hacker News、The Verge 四个源，支持按源筛选、刷新、部分失败提示",
      "新增 Pages Function /api/news，服务端抓取并解析 RSS 转 JSON，解决跨域，10 分钟缓存",
      "配置 GitHub Actions：push 到 master 自动构建并部署到 Cloudflare Pages，免手动 wrangler",
      "README 新增简体中文版 README.zh-CN.md，顶部加语言切换链接，保留英文版不替换",
      "润色主页文案：去掉 AI 元叙述，tagline、intro、三个 section 标题与段落改为博客作者口吻",
      "本地仓库与 GitHub 同步：以远程为准 reset，安装 Git 与 Node.js 环境",
    ],
  },
  {
    date: "2026-07-16",
    type: "fix",
    title: "修复 TypeScript 5.8 构建配置",
    changes: [
      "移除已弃用的 tsconfig baseUrl 配置，保持生产构建兼容并重新部署",
    ],
  },
  {
    date: "2026-07-13",
    version: "v0.6.0",
    type: "fix",
    title: "子域逻辑修复与顶栏排版",
    changes: [
      "修复顶栏在中等屏幕宽度下导航文字竖排：断点从 md 提到 lg，加 whitespace-nowrap，< 1024px 改用汉堡菜单",
      "统一 about 语义：删除 /about 站点地图页，TopNav「关于」与 about.yukino.bond 均指向 /about-me",
      "TopNav 一致性：「开发」「资源」从外链改为站内 SPA 路由 /dev /box，仅「邮箱」保留外链",
      "统一联系邮箱为 Raptor@yukino.bond（关于我、友链页），关于我页网站链接修正为 www.yukino.bond",
      "安全修复：JWT_SECRET 从硬编码改为读取 Cloudflare 环境变量，wrangler.toml 移除明文 [vars] 死配置",
      "清理死代码：删除未引用的 src/components/SubdomainRouter.tsx 与 functions_backup/ 备份目录",
      "修复开发工具的 Base64 编解码，改用 UTF-8 并与标准工具保持一致",
    ],
  },
  {
    date: "2026-06-21",
    version: "v0.5.0",
    type: "feature",
    title: "新增所有子域独立页面",
    changes: [
      "新增 dev.yukino.bond 开发工具页面（Base64、JSON、URL编码、时间戳、哈希、大小写转换、颜色转换）",
      "新增 box.yukino.bond 资源站页面",
      "新增 blog.yukino.bond 博客正文页面",
      "新增 links.yukino.bond 快速导航页面",
      "新增 about.yukino.bond 关于我页面",
      "新增 uses.yukino.bond 设备与环境页面",
      "新增 changelog.yukino.bond 更新日志页面",
      "新增 friends.yukino.bond 友情链接页面",
      "新增 rss.yukino.bond 订阅源页面",
      "新增 lab.yukino.bond 实验室页面",
      "新增 status.yukino.bond 状态页",
    ],
  },
  {
    date: "2026-06-18",
    version: "v0.4.0",
    type: "feature",
    title: "博客首页内容完善",
    changes: [
      "完善首页文章预览卡片",
      "添加站点概览统计区域",
      "优化首页整体布局和信息结构",
    ],
  },
  {
    date: "2026-06-15",
    version: "v0.3.0",
    type: "feature",
    title: "笔记页面与筛选功能",
    changes: [
      "新增笔记页面，支持按标签筛选",
      "添加文章预览卡片组件",
      "引入 zustand 状态管理",
    ],
  },
  {
    date: "2026-06-10",
    version: "v0.2.0",
    type: "improvement",
    title: "关于页面与站点地图",
    changes: [
      "新增关于页面，展示完整子域地图",
      "添加站点设计原则说明",
      "完善联系方式区域",
    ],
  },
  {
    date: "2026-06-05",
    version: "v0.1.0",
    type: "feature",
    title: "项目初始化",
    changes: [
      "使用 Vite + React + TypeScript 初始化项目",
      "配置 Tailwind CSS 样式系统",
      "搭建基础页面结构与路由",
      "设计 glass-panel 视觉风格",
      "部署到 Cloudflare Pages",
    ],
  },
];

const typeConfig = {
  feature: {
    icon: Plus,
    label: "新功能",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
  improvement: {
    icon: Wrench,
    label: "改进",
    className: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  },
  fix: {
    icon: Zap,
    label: "修复",
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  },
};

export default function Changelog() {
  useDocumentMeta("更新日志", "汇总站点、工具和页面的持续更新记录。");

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
            changelog.yukino.bond
          </span>
        </div>
        <h1 className="mt-4 font-display text-4xl text-stone-900 sm:text-5xl">
          更新日志
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">
          汇总站点、工具和页面的持续更新记录，方便追踪每次变化。
        </p>
      </div>

      <div className="space-y-1">
        {changelog.map((entry, index) => {
          const config = typeConfig[entry.type];
          const Icon = config.icon;
          return (
            <div key={`${entry.date}-${entry.title}`} className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="flex size-10 items-center justify-center rounded-full border-2 border-white/40 bg-white/30 backdrop-blur-xl">
                  <GitCommit className="size-4 text-stone-500" />
                </div>
                {index < changelog.length - 1 && (
                  <div className="mt-1 w-px flex-1 bg-stone-200" />
                )}
              </div>
              <div className="pb-8">
                <div className="flex flex-wrap items-center gap-3">
                  {entry.version && (
                    <span className="font-display text-xl text-stone-900">
                      {entry.version}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-[0.2em] ${config.className}`}
                  >
                    <Icon className="size-3" />
                    {config.label}
                  </span>
                  <span className="text-xs text-stone-500">{entry.date}</span>
                </div>
                <h3 className="mt-2 text-lg text-stone-900">{entry.title}</h3>
                <ul className="mt-3 space-y-1.5">
                  {entry.changes.map((change) => (
                    <li
                      key={change}
                      className="flex items-start gap-2 text-sm leading-6 text-stone-600"
                    >
                      <span className="mt-2 block size-1 shrink-0 rounded-full bg-stone-400" />
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
