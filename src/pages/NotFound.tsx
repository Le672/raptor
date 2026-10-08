import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { Link, useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  useDocumentMeta("页面不存在", "访问的页面不存在，返回 Yukino 主页继续浏览。");

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-6xl items-center px-6 py-12 lg:px-8">
      <div className="glass-panel max-w-2xl rounded-[36px] p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.34em] text-slate-400">404</p>
        <h1 className="mt-4 font-display text-4xl text-stone-900 sm:text-5xl">
          没有找到这个页面。
        </h1>
        <p className="mt-5 text-sm leading-8 text-stone-500">
          地址可能已变更，或链接中有拼写错误。可以返回首页，也可以从下面的入口继续浏览。
        </p>
        <HomeLink
          className="mt-8 inline-flex rounded-full bg-white px-5 py-3 text-sm text-slate-900 transition hover:-translate-y-0.5"
        >
          返回首页
        </HomeLink>
        <button type="button" className="pill-button ml-3" onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/")}>返回上一页</button>
        <div className="mt-6 flex flex-wrap gap-3"><Link className="text-link" to="/notes">全部笔记 ↗</Link><Link className="text-link" to="/dev">开发工具 ↗</Link><Link className="text-link" to="/status">服务状态 ↗</Link></div>
      </div>
    </div>
  );
}
