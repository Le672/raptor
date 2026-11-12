export const USES_ICONS = ["monitor", "keyboard", "code", "globe", "drive"] as const;
export type UsesIcon = (typeof USES_ICONS)[number];
export type UsesItem = { id: string; label: string; value: string; detail: string };
export type UsesCategory = { id: string; title: string; icon: UsesIcon; items: UsesItem[] };
export type UsesDocument = { description: string; categories: UsesCategory[] };
export type UsesResponse = {
  content: UsesDocument;
  revision: number;
  updatedAt: string | null;
  canEdit: boolean;
};

export const DEFAULT_USES: UsesDocument = {
  description: "记录我日常使用的设备、软件和开发环境配置，持续更新。",
  categories: [
    { id: "devices", title: "主力设备", icon: "monitor", items: [
      { id: "desktop", label: "台式机", value: "自组装 PC", detail: "AMD Ryzen 7 + 32GB RAM" },
      { id: "laptop", label: "笔记本", value: 'MacBook Pro 14"', detail: "M3 Pro / 18GB" },
      { id: "display", label: "显示器", value: "Dell U2723QE", detail: '27" 4K IPS' },
    ] },
    { id: "peripherals", title: "外设", icon: "keyboard", items: [
      { id: "keyboard", label: "键盘", value: "Keychron K8 Pro", detail: "茶轴 / 无线" },
      { id: "mouse", label: "鼠标", value: "Logitech MX Master 3S", detail: "无线" },
      { id: "headphones", label: "耳机", value: "Sony WH-1000XM5", detail: "降噪" },
    ] },
    { id: "development", title: "开发环境", icon: "code", items: [
      { id: "editor", label: "编辑器", value: "VS Code / Trae IDE", detail: "主力开发工具" },
      { id: "terminal", label: "终端", value: "Windows Terminal / Warp", detail: "日常使用" },
      { id: "git", label: "版本控制", value: "Git + GitHub", detail: "代码托管" },
      { id: "packages", label: "包管理", value: "pnpm / npm", detail: "Node.js 生态" },
    ] },
    { id: "services", title: "在线服务", icon: "globe", items: [
      { id: "domain", label: "域名", value: "Cloudflare Registrar", detail: "yukino.bond" },
      { id: "hosting", label: "托管", value: "Cloudflare Pages", detail: "静态站点部署" },
      { id: "dns", label: "DNS", value: "Cloudflare DNS", detail: "域名解析" },
      { id: "email", label: "邮箱", value: "Cloudflare Email Routing", detail: "邮件转发" },
    ] },
    { id: "software", title: "日常软件", icon: "drive", items: [
      { id: "browser", label: "浏览器", value: "Arc / Chrome", detail: "开发者工具" },
      { id: "notes", label: "笔记", value: "Obsidian", detail: "Markdown 笔记" },
      { id: "design", label: "设计", value: "Figma", detail: "UI 设计" },
      { id: "api", label: "API 测试", value: "Postman / Bruno", detail: "接口调试" },
    ] },
  ],
};

// The same limits apply in the editor and the Pages Function.
export function validateUsesDocument(input: unknown): UsesDocument {
  const ids = new Set<string>();
  const record = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("清单格式不正确");
    return value as Record<string, unknown>;
  };
  const text = (value: unknown, label: string, limit: number, required = true): string => {
    if (typeof value !== "string") throw new Error(`${label}格式不正确`);
    const result = value.trim();
    if (required && !result) throw new Error(`请填写${label}`);
    if (result.length > limit) throw new Error(`${label}最多 ${limit} 个字符`);
    return result;
  };
  const id = (value: unknown): string => {
    if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(value) || ids.has(value)) {
      throw new Error("清单条目标识不正确或重复");
    }
    ids.add(value);
    return value;
  };
  const doc = record(input);
  if (!Array.isArray(doc.categories) || doc.categories.length > 20) throw new Error("最多添加 20 个分类");
  return {
    description: text(doc.description, "页面介绍", 1200, false),
    categories: doc.categories.map((value) => {
      const category = record(value);
      if (!USES_ICONS.includes(category.icon as UsesIcon)) throw new Error("请选择有效的分类图标");
      if (!Array.isArray(category.items) || category.items.length > 50) throw new Error("每个分类最多添加 50 个条目");
      return {
        id: id(category.id),
        title: text(category.title, "分类名称", 80),
        icon: category.icon as UsesIcon,
        items: category.items.map((value) => {
          const item = record(value);
          return {
            id: id(item.id),
            label: text(item.label, "条目名称", 80),
            value: text(item.value, "设备或软件名称", 240),
            detail: text(item.detail, "补充说明", 500, false),
          };
        }),
      };
    }),
  };
}
