import { ArrowLeft, Calendar, Clock, Tag } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const blogPosts = [
  {
    title: "把个人域名整理成可持续维护的入口站",
    date: "2026-06-18",
    readTime: "8 分钟",
    tag: "开发",
    summary:
      "从根域名定位、子域分工到 Cloudflare 托管，整理一套不依赖服务器的轻量方案。这篇文章记录了从零开始规划 yukino.bond 全站的思考过程。",
    content: `## 为什么需要一个清晰的域名结构

当个人站点开始积累多个子域时，如果没有提前规划，后期维护会变得非常混乱。我从一开始就决定把 yukino.bond 做成一个"根域名 + 多个子域"的结构。

## 根域名的定位

根域名 yukino.bond 首先是博客首页，展示最新的文章、近况和子域入口。它不会是一个简单的跳转页，而是一个有内容、有温度的个人主页。

## 子域的分工

- **mail.yukino.bond** - 邮件入口，统一联系渠道
- **dev.yukino.bond** - 开发小工具，如 Base64、JSON 格式化等
- **box.yukino.bond** - 资源整理，软件和文档的下载索引
- **blog.yukino.bond** - 完整的文章站点（你正在看的）

## Cloudflare Pages 托管

整个站点托管在 Cloudflare Pages 上，纯静态构建，不需要服务器。每次提交代码后自动部署，省心省力。

## 后续计划

持续完善各个子域的功能，让每个子域都有独立的价值。`,
  },
  {
    title: "常用开发工具应该怎样拆到 dev.yukino.bond",
    date: "2026-06-12",
    readTime: "6 分钟",
    tag: "开发",
    summary:
      "把 JSON、时间戳、编码和文本处理拆成清晰的小页面，避免一个工具页过于拥挤。",
    content: `## 工具页的设计原则

一个好的工具页应该做到：
1. 功能明确，一眼就知道能做什么
2. 操作简单，不需要学习成本
3. 响应迅速，所有计算在本地完成

## 工具分类

我把开发工具分成了几个大类：

- **编码转换**：Base64、URL 编码解码
- **格式化**：JSON 格式化和校验
- **时间处理**：时间戳转换
- **文本处理**：大小写转换、哈希计算
- **颜色工具**：HEX/RGB/HSL 互转

## 技术实现

所有工具都是纯前端实现，使用 React 的 useMemo 和 useCallback 优化性能。不需要后端服务，数据不会离开浏览器。`,
  },
  {
    title: "为什么资源站更适合叫 box 而不是 download",
    date: "2026-06-06",
    readTime: "4 分钟",
    tag: "随笔",
    summary:
      "更中性，也更适合后续从资源下载扩展到索引、清单、镜像和文档入口。",
    content: `## 命名的考量

"download" 这个子域名字太具体了，它暗示这个站点只能用来下载文件。但实际上，我希望这个子域能承载更多类型的内容。

## box 的灵活性

"box" 这个词更中性，可以包含：
- 软件下载链接
- 文档和教程索引
- 媒体资源推荐
- 常用工具书签

## 未来的扩展

随着内容的积累，box 可以继续细分为更多子页面，但子域名称不需要改变。这就是选择抽象命名的好处。`,
  },
  {
    title: "个人站里那些值得长期保留的页面",
    date: "2026-05-29",
    readTime: "5 分钟",
    tag: "收藏",
    summary:
      "从 about、uses、links、changelog 到 rss，哪些页面最能形成完整感。",
    content: `## 个人站的基本页面

一个完整的个人站点至少需要这些页面：

- **首页** - 展示最新内容和入口
- **关于** - 个人介绍和联系方式
- **文章** - 博客内容主体
- **工具** - 实用小工具

## 加分项

- **uses** - 设备和工具清单
- **changelog** - 更新记录
- **friends** - 友情链接
- **rss** - 订阅源

## 我的选择

我选择一次性把这些页面都规划好，然后逐步完善内容。这样网站的结构从一开始就是完整的，后续只需要填充内容。`,
  },
];

export default function Blog() {
  useDocumentMeta("博客", "完整文章站点，记录开发心得、随笔和折腾日志。");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-10 lg:px-8">
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
            blog.yukino.bond
          </span>
        </div>
        <h1 className="mt-4 font-display text-4xl text-stone-900 sm:text-5xl">
          博客正文
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">
          完整文章站点，适合放开发记录、长文和折腾日志。
        </p>
      </div>

      {/* Blog Posts */}
      <div className="grid gap-8">
        {blogPosts.map((post, index) => (
          <article
            key={`${post.title}-${post.date}`}
            className="glass-panel rounded-[32px] p-6 sm:p-8"
          >
            <div className="mb-6 flex flex-wrap items-center gap-3 text-xs text-stone-500">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1 backdrop-blur-xl">
                <Calendar className="size-3" />
                {post.date}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1 backdrop-blur-xl">
                <Clock className="size-3" />
                {post.readTime}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1 backdrop-blur-xl">
                <Tag className="size-3" />
                {post.tag}
              </span>
              <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[11px] uppercase tracking-[0.2em] backdrop-blur-xl">
                #{String(index + 1).padStart(2, "0")}
              </span>
            </div>

            <h2 className="font-display text-3xl text-stone-900">
              {post.title}
            </h2>
            <p className="mt-4 text-sm leading-7 text-stone-600">
              {post.summary}
            </p>

            <div className="mt-6 border-t border-white/20 pt-6">
              <div className="prose-sm prose-stone max-w-none">
                {post.content.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) {
                    return (
                      <h3
                        key={i}
                        className="mt-6 mb-3 font-display text-xl text-stone-900"
                      >
                        {line.replace("## ", "")}
                      </h3>
                    );
                  }
                  if (line.startsWith("- ")) {
                    return (
                      <li
                        key={i}
                        className="ml-4 text-sm leading-7 text-stone-600"
                      >
                        {line.replace("- ", "")}
                      </li>
                    );
                  }
                  if (line.trim() === "") return <br key={i} />;
                  if (/^\d+\./.test(line)) {
                    return (
                      <li
                        key={i}
                        className="ml-4 text-sm leading-7 text-stone-600"
                      >
                        {line.replace(/^\d+\.\s*/, "")}
                      </li>
                    );
                  }
                  return (
                    <p key={i} className="text-sm leading-7 text-stone-600">
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}