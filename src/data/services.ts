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
} as const;

export type YukinoService = (typeof yukinoServices)[keyof typeof yukinoServices];
export const serviceDomainLinks = Object.values(yukinoServices).map(service => ({ ...service, status: "online" as const }));
