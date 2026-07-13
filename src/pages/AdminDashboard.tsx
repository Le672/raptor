import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Boxes, LogOut, User } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useAuthStore } from "@/hooks/useAuthStore";
import { api } from "@/lib/api";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  if (user?.role !== "admin") {
    navigate("/");
    return null;
  }

  const handleLogout = () => {
    api.logout().catch(() => {});
    logout();
    navigate("/");
  };

  const menuItems = [
    {
      title: "文章管理",
      description: "创建、编辑和发布博客文章",
      icon: FileText,
      to: "/admin/posts",
    },
    {
      title: "资源管理",
      description: "管理 box.yukino.bond 资源列表",
      icon: Boxes,
      to: "/admin/box",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10 lg:px-8">
      <div>
        <div className="flex items-center gap-3">
          <HomeLink
            className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-xs text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
          >
            <ArrowLeft className="size-3.5" />
            返回首页
          </HomeLink>
          <span className="rounded-full bg-stone-900/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white backdrop-blur-xl">
            Admin
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl text-stone-900">管理控制台</h1>
            <p className="mt-2 text-sm text-stone-500">
              欢迎回来，{user.name}
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/30 px-4 py-2.5 text-sm text-stone-700 backdrop-blur-xl transition hover:border-red-300 hover:text-red-600"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
            退出登录
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-[32px] p-6">
        <div className="flex items-center gap-4">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl border border-white/40 bg-white/30 text-stone-700 backdrop-blur-xl">
            <User className="size-5" />
          </div>
          <div>
            <p className="font-display text-xl text-stone-900">{user.name}</p>
            <p className="text-sm text-stone-500">{user.email}</p>
          </div>
          <span className="ml-auto rounded-full border border-amber-200/60 bg-amber-50/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-amber-700 backdrop-blur-xl">
            超级管理员
          </span>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {menuItems.map((item) => (
          <Link
            key={item.to}
            className="glass-panel group flex flex-col gap-4 rounded-[28px] p-6 transition hover:-translate-y-1"
            to={item.to}
          >
            <div className="inline-flex size-12 items-center justify-center rounded-2xl border border-white/40 bg-white/30 text-stone-700 backdrop-blur-xl transition group-hover:bg-stone-900/80 group-hover:text-white">
              <item.icon className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-xl text-stone-900">{item.title}</h3>
              <p className="mt-1 text-sm text-stone-500">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
