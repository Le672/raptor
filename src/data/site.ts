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
  tagline: "一个持续更新的个人博客，写日常、记折腾，也顺手安放邮件、工具与收藏。",
  intro:
    "这里更像一页长期维护的博客首页：有最近写下的东西，也有一些慢慢生长出来的子站与角落，适合安静地阅读和随手逛逛。",
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
];

export const postPreviews: PostPreview[] = [
  {
    title: "把个人域名整理成可持续维护的入口站",
    summary: "从根域名定位、子域分工到 Cloudflare 托管，整理一套不依赖服务器的轻量方案。",
    date: "2026-06-18",
    tag: "开发",
    href: "/notes",
  },
  {
    title: "常用开发工具应该怎样拆到 `dev.yukino.bond`",
    summary: "把 JSON、时间戳、编码和文本处理拆成清晰的小页面，避免一个工具页过于拥挤。",
    date: "2026-06-12",
    tag: "开发",
    href: "/notes",
  },
  {
    title: "为什么资源站更适合叫 `box` 而不是 `download`",
    summary: "更中性，也更适合后续从资源下载扩展到索引、清单、镜像和文档入口。",
    date: "2026-06-06",
    tag: "随笔",
    href: "/notes",
  },
  {
    title: "个人站里那些值得长期保留的页面",
    summary: "从 `about`、`uses`、`links`、`changelog` 到 `rss`，哪些页面最能形成完整感。",
    date: "2026-05-29",
    tag: "收藏",
    href: "/notes",
  },
];

export const principlePoints = [
  "首页先展示文章、近况与氛围，再自然地带出其他子域入口。",
  "站点保持轻量静态结构，方便长期写作、更新与归档。",
  "子域名不是主角，而是博客之外延伸出来的实用角落。",
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
