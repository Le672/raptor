export type DomainCategory = "core" | "content" | "experimental";
export type DomainStatus = "online" | "planned";

export type DomainLink = {
  title: string;
  hostname: string;
  href: string;
  description: string;
  status: DomainStatus;
  category: DomainCategory;
};

export type PostPreview = {
  title: string;
  summary: string;
  date: string;
  tag: "开发" | "随笔" | "收藏";
  href: string;
};

export const siteProfile = {
  name: "Yukino",
  domain: "yukino.bond",
  tagline: "写代码，也写字。",
  intro: "记录开发日常、折腾笔记，和一些值得留下来的东西。",
  email: "Raptor@yukino.bond",
};

export const domainLinks: DomainLink[] = [
  {
    title: "邮箱",
    hostname: "mail.yukino.bond",
    href: "https://mail.yukino.bond",
    description: "统一的邮件入口，适合作为联系与通知中心。",
    status: "online",
    category: "core",
  },
  {
    title: "开发工具",
    hostname: "dev.yukino.bond",
    href: "https://dev.yukino.bond",
    description: "常用开发小工具、脚本页和在线效率功能集合。",
    status: "online",
    category: "core",
  },
  {
    title: "资源站",
    hostname: "box.yukino.bond",
    href: "https://box.yukino.bond",
    description: "资源索引、文件下载说明和常用中转页面。",
    status: "online",
    category: "core",
  },
  {
    title: "漫画阅读",
    hostname: "jm.yukino.bond",
    href: "https://jm.yukino.bond",
    description: "搜索、阅读、收藏和导出漫画章节。",
    status: "online",
    category: "content",
  },
  {
    title: "博客正文",
    hostname: "blog.yukino.bond",
    href: "https://blog.yukino.bond",
    description: "完整文章站点，适合放开发记录、长文和折腾日志。",
    status: "online",
    category: "content",
  },
  {
    title: "快速导航",
    hostname: "links.yukino.bond",
    href: "https://links.yukino.bond",
    description: "移动端友好的极简入口页，适合作为轻量书签首页。",
    status: "online",
    category: "content",
  },
  {
    title: "关于我",
    hostname: "about.yukino.bond",
    href: "https://about.yukino.bond",
    description: "长期稳定的个人介绍、履历、联系信息和常用链接。",
    status: "online",
    category: "content",
  },
  {
    title: "设备与环境",
    hostname: "uses.yukino.bond",
    href: "https://uses.yukino.bond",
    description: "记录常用设备、编辑器、开发环境和个人工作流。",
    status: "online",
    category: "content",
  },
  {
    title: "更新日志",
    hostname: "changelog.yukino.bond",
    href: "https://changelog.yukino.bond",
    description: "汇总站点、工具和页面的持续更新记录。",
    status: "online",
    category: "content",
  },
  {
    title: "友情链接",
    hostname: "friends.yukino.bond",
    href: "https://friends.yukino.bond",
    description: "放朋友站点、收藏链接和长期想保留的推荐页面。",
    status: "online",
    category: "content",
  },
  {
    title: "订阅源",
    hostname: "rss.yukino.bond",
    href: "https://rss.yukino.bond",
    description: "给长期关注的人一个稳定、清爽的订阅入口。",
    status: "online",
    category: "content",
  },
  {
    title: "实验室",
    hostname: "lab.yukino.bond",
    href: "https://lab.yukino.bond",
    description: "视觉实验、前端玩具和各种还不成熟的小项目。",
    status: "online",
    category: "experimental",
  },
  {
    title: "状态页",
    hostname: "status.yukino.bond",
    href: "https://status.yukino.bond",
    description: "静态展示各个服务状态，便于将来持续扩展。",
    status: "online",
    category: "experimental",
  },
  {
    title: "小游戏",
    hostname: "games.yukino.bond",
    href: "https://games.yukino.bond",
    description: "内置经典小游戏，2048、贪吃蛇、俄罗斯方块等，打开即玩。",
    status: "online",
    category: "experimental",
  },
  {
    title: "新闻",
    hostname: "news.yukino.bond",
    href: "https://news.yukino.bond",
    description: "聚合科技资讯与开发圈动态，随手刷刷。",
    status: "online",
    category: "experimental",
  },
];

export const postPreviews: PostPreview[] = [
  {
    title: "把个人域名整理成可持续维护的入口站",
    summary: "从根域名定位、子域分工到 Cloudflare 托管，整理一套不依赖服务器的轻量方案。",
    date: "2026-06-18",
    tag: "开发",
    href: "/blog?post=personal-domain",
  },
  {
    title: "常用开发工具应该怎样拆到 dev.yukino.bond",
    summary: "把 JSON、时间戳、编码和文本处理拆成清晰的小页面，避免一个工具页过于拥挤。",
    date: "2026-06-12",
    tag: "开发",
    href: "/blog?post=developer-tools",
  },
  {
    title: "为什么资源站更适合叫 box 而不是 download",
    summary: "更中性，也更适合后续从资源下载扩展到索引、清单、镜像和文档入口。",
    date: "2026-06-06",
    tag: "随笔",
    href: "/blog?post=resource-box",
  },
  {
    title: "个人站里那些值得长期保留的页面",
    summary: "从 about、uses、links、changelog 到 rss，哪些页面最能形成完整感。",
    date: "2026-05-29",
    tag: "收藏",
    href: "/blog?post=personal-pages",
  },
];

export const principlePoints = [
  "最近在写什么",
  "顺手做了什么",
  "哪里能找到我",
];

export const contactLinks = [
  {
    label: "邮箱",
    href: "mailto:Raptor@yukino.bond",
    value: "Raptor@yukino.bond",
  },
  {
    label: "主页",
    href: "https://www.yukino.bond",
    value: "www.yukino.bond",
  },
  {
    label: "导航页",
    href: "https://links.yukino.bond",
    value: "links.yukino.bond",
  },
];
