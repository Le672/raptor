/** Shared destinations for the independently hosted Yukino services. */
export const yukinoServices = {
  drop: {
    title: "临时传送门",
    hostname: "drop.yukino.bond",
    href: "https://drop.yukino.bond/",
    description: "中转文字与文件，自选过期时间或按阅读次数销毁。创建内容需要上传口令。",
    category: "core",
    keywords: ["MicroBin", "Yukino Drop", "文件中转", "文字分享", "阅后即焚"],
  },
  draw: {
    title: "在线白板",
    hostname: "draw.yukino.bond",
    href: "https://draw.yukino.bond/",
    description: "随手画下流程、草图与灵感。画稿保存在当前浏览器，也可以导出文件。",
    category: "experimental",
    keywords: ["Excalidraw", "画布", "绘图", "流程图", "草稿"],
  },
  tools: {
    title: "完整工具箱",
    hostname: "tools.yukino.bond",
    href: "https://tools.yukino.bond/",
    description: "更多编码、格式化、转换与生成工具，把常常遇到的小问题顺手解决。",
    category: "core",
    keywords: ["IT-Tools", "IT Tools", "开发工具", "编码转换", "格式化"],
  },
  radar: {
    title: "网页变化雷达",
    hostname: "tools.yukino.bond/lab/radar",
    href: "https://tools.yukino.bond/lab/radar/",
    description: "定时关注公开页面，按关键词筛选文字，保留快照并对比每次变化。使用实验室专用管理口令。",
    category: "experimental",
    keywords: ["Radar", "网页监测", "页面变化", "快照", "更新监控"],
  },
  hooks: {
    title: "Webhook 回调信箱",
    hostname: "tools.yukino.bond/lab/hooks",
    href: "https://tools.yukino.bond/lab/hooks/",
    description: "为脚本和服务创建回调接收地址，查看请求方法、请求头与正文，随时停用。",
    category: "experimental",
    keywords: ["Webhook", "回调", "HTTP", "请求调试", "开发信箱"],
  },
  shortlinks: {
    title: "短链工坊",
    hostname: "tools.yukino.bond/lab/links",
    href: "https://tools.yukino.bond/lab/links/",
    description: "为链接设置短名与有效期，下载二维码，查看真实打开次数。管理记录保存在服务器。",
    category: "core",
    keywords: ["短链接", "短网址", "二维码", "链接管理", "访问统计"],
  },
} as const;

export type YukinoService = (typeof yukinoServices)[keyof typeof yukinoServices];
export const serviceDomainLinks = Object.values(yukinoServices).map(service => ({ ...service, status: "online" as const }));
