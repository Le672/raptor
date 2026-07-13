import { ArrowLeft, Github, Mail, MapPin, Globe } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const skills = [
  "TypeScript / JavaScript",
  "React / Next.js",
  "Vue.js / Nuxt",
  "Node.js",
  "Python",
  "Tailwind CSS",
  "PostgreSQL / MySQL",
  "Docker",
  "Git / GitHub",
  "Cloudflare",
];

const timeline = [
  {
    year: "2026",
    title: "搭建 yukino.bond 个人站",
    desc: "从零开始规划域名结构，搭建博客、工具箱、资源站等子域体系。",
  },
  {
    year: "2025",
    title: "全栈开发",
    desc: "深入全栈开发，掌握前后端完整技术栈，参与多个商业项目。",
  },
  {
    year: "2024",
    title: "前端开发起步",
    desc: "开始系统学习前端开发，从 HTML/CSS 到 React 框架。",
  },
  {
    year: "2023",
    title: "编程入门",
    desc: "开始接触编程，学习基础算法和数据结构。",
  },
];

export default function AboutMe() {
  useDocumentMeta(
    "关于我",
    "个人介绍、技术栈、经历与联系方式。",
  );

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
            about.yukino.bond
          </span>
        </div>
        <h1 className="mt-4 font-display text-4xl text-stone-900 sm:text-5xl">
          关于我
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">
          长期稳定的个人介绍页面，包含技术栈、经历和联系方式。
        </p>
      </div>

      {/* Avatar & Basic Info */}
      <div className="glass-panel rounded-[32px] p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="inline-flex size-24 shrink-0 items-center justify-center rounded-3xl bg-stone-200 text-stone-500">
            <span className="font-display text-3xl">YK</span>
          </div>
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-3xl text-stone-900">Yukino</h2>
              <p className="mt-2 text-sm leading-7 text-stone-600">
                全栈开发者，喜欢折腾各种技术工具，热衷于将想法变成可用的产品。这个站点是我在互联网上的一小块自留地，记录学习、思考和创作。
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-stone-600">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 text-stone-400" />
                中国
              </span>
              <a
                className="inline-flex items-center gap-1.5 transition hover:text-stone-900"
                href="mailto:Raptor@yukino.bond"
              >
                <Mail className="size-3.5 text-stone-400" />
                Raptor@yukino.bond
              </a>
              <a
                className="inline-flex items-center gap-1.5 transition hover:text-stone-900"
                href="https://github.com"
                rel="noreferrer"
                target="_blank"
              >
                <Github className="size-3.5 text-stone-400" />
                GitHub
              </a>
              <a
                className="inline-flex items-center gap-1.5 transition hover:text-stone-900"
                href="https://www.yukino.bond"
              >
                <Globe className="size-3.5 text-stone-400" />
                www.yukino.bond
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Skills */}
      <div className="glass-panel rounded-[32px] p-6 sm:p-8">
        <h2 className="font-display text-2xl text-stone-900">技术栈</h2>
        <div className="mt-5 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-white/40 bg-white/30 px-4 py-2 text-sm text-stone-700 backdrop-blur-xl"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="glass-panel rounded-[32px] p-6 sm:p-8">
        <h2 className="font-display text-2xl text-stone-900">经历</h2>
        <div className="mt-6 space-y-1">
          {timeline.map((item, index) => (
            <div key={item.year} className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="size-3 rounded-full border-2 border-white/40 bg-white/30 backdrop-blur-xl" />
                {index < timeline.length - 1 && (
                  <div className="mt-1 w-px flex-1 bg-stone-200" />
                )}
              </div>
              <div className="pb-8">
                <span className="text-xs font-medium uppercase tracking-[0.24em] text-stone-500">
                  {item.year}
                </span>
                <h3 className="mt-1 text-lg text-stone-900">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}