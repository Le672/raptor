import {
  ArrowLeft,
  Cpu,
  Monitor,
  Keyboard,
  MousePointer2,
  Headphones,
  HardDrive,
  Code2,
  Terminal,
  Globe,
} from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const categories = [
  {
    title: "主力设备",
    icon: Monitor,
    items: [
      { label: "台式机", value: "自组装 PC", detail: "AMD Ryzen 7 + 32GB RAM" },
      { label: "笔记本", value: "MacBook Pro 14\"", detail: "M3 Pro / 18GB" },
      { label: "显示器", value: "Dell U2723QE", detail: "27\" 4K IPS" },
    ],
  },
  {
    title: "外设",
    icon: Keyboard,
    items: [
      { label: "键盘", value: "Keychron K8 Pro", detail: "茶轴 / 无线" },
      { label: "鼠标", value: "Logitech MX Master 3S", detail: "无线" },
      { label: "耳机", value: "Sony WH-1000XM5", detail: "降噪" },
    ],
  },
  {
    title: "开发环境",
    icon: Code2,
    items: [
      { label: "编辑器", value: "VS Code / Trae IDE", detail: "主力开发工具" },
      { label: "终端", value: "Windows Terminal / Warp", detail: "日常使用" },
      { label: "版本控制", value: "Git + GitHub", detail: "代码托管" },
      { label: "包管理", value: "pnpm / npm", detail: "Node.js 生态" },
    ],
  },
  {
    title: "在线服务",
    icon: Globe,
    items: [
      { label: "域名", value: "Cloudflare Registrar", detail: "yukino.bond" },
      { label: "托管", value: "Cloudflare Pages", detail: "静态站点部署" },
      { label: "DNS", value: "Cloudflare DNS", detail: "域名解析" },
      { label: "邮箱", value: "Cloudflare Email Routing", detail: "邮件转发" },
    ],
  },
  {
    title: "日常软件",
    icon: HardDrive,
    items: [
      { label: "浏览器", value: "Arc / Chrome", detail: "开发者工具" },
      { label: "笔记", value: "Obsidian", detail: "Markdown 笔记" },
      { label: "设计", value: "Figma", detail: "UI 设计" },
      { label: "API 测试", value: "Postman / Bruno", detail: "接口调试" },
    ],
  },
];

export default function Uses() {
  useDocumentMeta("设备与环境", "记录常用设备、编辑器、开发环境和个人工作流。");

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
            uses.yukino.bond
          </span>
        </div>
        <h1 className="mt-4 font-display text-4xl text-stone-900 sm:text-5xl">
          设备与环境
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">
          记录我日常使用的设备、软件和开发环境配置，持续更新。
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {categories.map((cat) => (
          <div key={cat.title} className="glass-panel rounded-[28px] p-6">
            <div className="mb-5 flex items-center gap-2">
              <cat.icon className="size-4 text-stone-500" />
              <h2 className="text-sm uppercase tracking-[0.24em] text-stone-500">
                {cat.title}
              </h2>
            </div>
            <div className="space-y-3">
              {cat.items.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/30 bg-white/20 px-4 py-3 backdrop-blur-xl"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-stone-500">{item.label}</span>
                    <span className="text-sm text-stone-900">
                      {item.value}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-stone-400">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}