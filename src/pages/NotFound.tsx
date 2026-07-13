import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

export default function NotFound() {
  useDocumentMeta("页面不存在", "访问的页面不存在，返回 Yukino 主页继续浏览。");

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-6xl items-center px-6 py-12 lg:px-8">
      <div className="glass-panel max-w-2xl rounded-[36px] p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.34em] text-slate-400">404</p>
        <h1 className="mt-4 font-display text-5xl text-white">
          这个入口还没有准备好。
        </h1>
        <p className="mt-5 text-sm leading-8 text-slate-300">
          你访问的页面可能还在规划中，或者对应的子域服务尚未上线。先回到首页继续浏览现有入口吧。
        </p>
        <HomeLink
          className="mt-8 inline-flex rounded-full bg-white px-5 py-3 text-sm text-slate-900 transition hover:-translate-y-0.5"
        >
          返回首页
        </HomeLink>
      </div>
    </div>
  );
}
