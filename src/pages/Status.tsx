import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const services = [
  {
    name: "yukino.bond",
    description: "博客主页",
    status: "operational" as const,
    uptime: "99.9%",
    url: "https://yukino.bond",
  },
  {
    name: "mail.yukino.bond",
    description: "邮件入口",
    status: "operational" as const,
    uptime: "99.9%",
    url: "https://mail.yukino.bond",
  },
  {
    name: "dev.yukino.bond",
    description: "开发工具箱",
    status: "operational" as const,
    uptime: "99.9%",
    url: "https://dev.yukino.bond",
  },
  {
    name: "box.yukino.bond",
    description: "资源归档站",
    status: "operational" as const,
    uptime: "99.9%",
    url: "https://box.yukino.bond",
  },
  {
    name: "blog.yukino.bond",
    description: "博客正文",
    status: "operational" as const,
    uptime: "99.9%",
    url: "https://blog.yukino.bond",
  },
  {
    name: "links.yukino.bond",
    description: "快速导航",
    status: "operational" as const,
    uptime: "99.9%",
    url: "https://links.yukino.bond",
  },
  {
    name: "about.yukino.bond",
    description: "关于我",
    status: "operational" as const,
    uptime: "99.9%",
    url: "https://about.yukino.bond",
  },
  {
    name: "uses.yukino.bond",
    description: "设备与环境",
    status: "operational" as const,
    uptime: "99.9%",
    url: "https://uses.yukino.bond",
  },
  {
    name: "changelog.yukino.bond",
    description: "更新日志",
    status: "operational" as const,
    uptime: "99.9%",
    url: "https://changelog.yukino.bond",
  },
  {
    name: "friends.yukino.bond",
    description: "友情链接",
    status: "operational" as const,
    uptime: "99.9%",
    url: "https://friends.yukino.bond",
  },
  {
    name: "rss.yukino.bond",
    description: "订阅源",
    status: "operational" as const,
    uptime: "99.9%",
    url: "https://rss.yukino.bond",
  },
  {
    name: "lab.yukino.bond",
    description: "实验室",
    status: "operational" as const,
    uptime: "99.9%",
    url: "https://lab.yukino.bond",
  },
  {
    name: "status.yukino.bond",
    description: "状态页",
    status: "operational" as const,
    uptime: "99.9%",
    url: "https://status.yukino.bond",
  },
];

const statusConfig = {
  operational: {
    icon: CheckCircle2,
    label: "正常运行",
    className: "text-emerald-600",
    bgClass: "bg-emerald-50",
  },
  degraded: {
    icon: AlertTriangle,
    label: "性能下降",
    className: "text-amber-600",
    bgClass: "bg-amber-50",
  },
  outage: {
    icon: AlertTriangle,
    label: "服务中断",
    className: "text-red-600",
    bgClass: "bg-red-50",
  },
};

const incidents = [
  {
    date: "2026-06-18",
    title: "博客首页部署更新",
    status: "resolved" as const,
    description: "更新了首页布局和文章预览卡片，部署期间无服务中断。",
  },
  {
    date: "2026-06-05",
    title: "项目初始化部署",
    status: "resolved" as const,
    description: "首次将项目部署到 Cloudflare Pages，所有服务正常运行。",
  },
];

export default function Status() {
  useDocumentMeta("状态页", "静态展示各个服务状态，便于将来持续扩展。");

  const allOperational = services.every((s) => s.status === "operational");

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
            status.yukino.bond
          </span>
        </div>
        <h1 className="mt-4 font-display text-4xl text-stone-900 sm:text-5xl">
          服务状态
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">
          静态展示各个子域服务的运行状态，所有服务托管在 Cloudflare Pages。
        </p>
      </div>

      {/* Overall Status */}
      <div
        className={`glass-panel rounded-[32px] p-6 sm:p-8 ${
          allOperational ? "ring-2 ring-emerald-200" : ""
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`inline-flex size-14 items-center justify-center rounded-full ${
              allOperational ? "bg-emerald-50" : "bg-amber-50"
            }`}
          >
            <Activity
              className={`size-6 ${
                allOperational ? "text-emerald-600" : "text-amber-600"
              }`}
            />
          </div>
          <div>
            <h2 className="font-display text-2xl text-stone-900">
              {allOperational ? "所有系统正常运行" : "部分服务异常"}
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              最后更新: {new Date().toLocaleString("zh-CN")}
            </p>
          </div>
        </div>
      </div>

      {/* Service List */}
      <div className="glass-panel rounded-[32px] overflow-hidden">
        <div className="border-b border-white/20 px-6 py-4 sm:px-8">
          <h2 className="text-sm uppercase tracking-[0.24em] text-stone-500">
            服务列表
          </h2>
        </div>
        <div className="divide-y divide-stone-100">
          {services.map((service) => {
            const config = statusConfig[service.status];
            const Icon = config.icon;
            return (
              <div
                key={service.name}
                className="flex items-center justify-between gap-4 px-6 py-4 sm:px-8"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`rounded-full p-1.5 ${config.bgClass}`}>
                    <Icon className={`size-3.5 ${config.className}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-stone-900">{service.name}</p>
                    <p className="text-xs text-stone-500">
                      {service.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-stone-400">
                    {service.uptime}
                  </span>
                  <span className={`text-xs ${config.className}`}>
                    {config.label}
                  </span>
                  <a
                    className="text-stone-400 transition hover:text-stone-600"
                    href={service.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Incidents */}
      <div className="glass-panel rounded-[32px] p-6 sm:p-8">
        <h2 className="text-sm uppercase tracking-[0.24em] text-stone-500">
          历史事件
        </h2>
        <div className="mt-5 space-y-4">
          {incidents.map((incident) => (
            <div
              key={incident.title}
              className="rounded-2xl border border-white/30 bg-white/20 p-4 backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <Clock className="size-3.5 text-stone-400" />
                <span className="text-xs text-stone-500">{incident.date}</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-700">
                  已解决
                </span>
              </div>
              <h3 className="mt-2 text-sm text-stone-900">{incident.title}</h3>
              <p className="mt-1 text-xs leading-5 text-stone-600">
                {incident.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}