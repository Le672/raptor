import { Menu, X, User, LogOut, Shield } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { HomeLink } from "@/components/HomeLink";
import { useSiteStore } from "@/hooks/useSiteStore";
import { useAuthStore } from "@/hooks/useAuthStore";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "首页", to: "/" },
  { label: "笔记", to: "/notes" },
  { label: "游戏", to: "/games" },
  { label: "邮箱", href: "https://mail.yukino.bond" },
  { label: "开发", to: "/dev" },
  { label: "资源", to: "/box" },
  { label: "博客", to: "/blog" },
  { label: "导航", to: "/links" },
  { label: "关于", to: "/about-me" },
  { label: "设备", to: "/uses" },
  { label: "日志", to: "/changelog" },
];

export function TopNav() {
  const { mobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useSiteStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    api.logout().catch(() => {});
    logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/30 bg-white/30 backdrop-blur-2xl saturate-150">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4 lg:px-8">
        <HomeLink
          className="flex items-center gap-4"
          onClick={closeMobileMenu}
        >
          <span className="inline-flex size-11 items-center justify-center rounded-2xl border border-white/40 bg-white/30 text-sm uppercase tracking-[0.34em] text-stone-700 backdrop-blur-xl">
            YK
          </span>
          <div className="space-y-1">
            <p className="font-display text-2xl text-stone-900">Yukino</p>
            <p className="text-[11px] uppercase tracking-[0.36em] text-stone-500">
              Personal Blog
            </p>
          </div>
        </HomeLink>

        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) =>
            item.href ? (
              <a
                key={item.label}
                className="whitespace-nowrap rounded-full px-3 py-2 text-sm text-stone-600 transition hover:bg-white/30 hover:text-stone-900"
                href={item.href}
                rel="noreferrer"
                target="_blank"
              >
                {item.label}
              </a>
            ) : (
              <NavLink
                key={item.to}
                className={({ isActive }) =>
                  cn(
                    "whitespace-nowrap rounded-full px-3 py-2 text-sm transition",
                    isActive
                      ? "bg-white/40 text-stone-900 backdrop-blur-xl"
                      : "text-stone-600 hover:bg-white/30 hover:text-stone-900",
                  )
                }
                to={item.to}
              >
                {item.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <>
              {user.role === "admin" && (
                <Link
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/80 px-4 py-2 text-sm text-white backdrop-blur-xl transition hover:-translate-y-0.5"
                  to="/admin"
                >
                  <Shield className="size-4" />
                  管理台
                </Link>
              )}
              <div className="flex items-center gap-2 rounded-full border border-white/40 bg-white/30 px-4 py-2 text-sm text-stone-700 backdrop-blur-xl">
                <User className="size-4" />
                <span>{user.name}</span>
              </div>
              <button
                className="rounded-full border border-white/40 bg-white/30 px-4 py-2 text-sm text-stone-700 backdrop-blur-xl transition hover:border-red-300 hover:text-red-600"
                onClick={handleLogout}
              >
                退出
              </button>
            </>
          ) : (
            <>
              <a
                className="rounded-full border border-white/40 bg-white/30 px-4 py-2 text-sm text-stone-700 backdrop-blur-xl transition hover:border-stone-400 hover:text-stone-900"
                href="https://mail.yukino.bond"
                rel="noreferrer"
                target="_blank"
              >
                打开邮箱
              </a>
              <Link
                className="rounded-full bg-stone-900/80 px-4 py-2 text-sm text-white backdrop-blur-xl transition hover:-translate-y-0.5"
                to="/login"
              >
                登录
              </Link>
            </>
          )}
        </div>

        <button
          aria-label={mobileMenuOpen ? "关闭菜单" : "打开菜单"}
          className="inline-flex size-11 items-center justify-center rounded-full border border-white/40 bg-white/30 text-stone-700 backdrop-blur-xl transition hover:border-stone-400 hover:text-stone-900 lg:hidden"
          onClick={toggleMobileMenu}
          type="button"
        >
          {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {mobileMenuOpen ? (
        <div className="border-t border-white/30 bg-white/20 px-6 py-5 backdrop-blur-2xl lg:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            {navItems.map((item) =>
              item.href ? (
                <a
                  key={item.label}
                  className="rounded-2xl px-4 py-3 text-sm text-stone-600 transition hover:bg-white/30 hover:text-stone-900"
                  href={item.href}
                  rel="noreferrer"
                  target="_blank"
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </a>
              ) : (
                <NavLink
                  key={item.to}
                  className={({ isActive }) =>
                    cn(
                      "rounded-2xl px-4 py-3 text-sm transition",
                      isActive
                        ? "bg-white/40 text-stone-900 backdrop-blur-xl"
                        : "text-stone-600 hover:bg-white/30 hover:text-stone-900",
                    )
                  }
                  onClick={closeMobileMenu}
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              ),
            )}
            {user ? (
              <>
                {user.role === "admin" && (
                  <Link
                    className="inline-flex items-center gap-2 rounded-2xl bg-amber-500/80 px-4 py-3 text-sm text-white backdrop-blur-xl"
                    onClick={closeMobileMenu}
                    to="/admin"
                  >
                    <Shield className="size-4" />
                    管理台
                  </Link>
                )}
                <div className="flex items-center gap-2 rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-stone-700 backdrop-blur-xl">
                  <User className="size-4" />
                  <span>{user.name}</span>
                  <span className="ml-auto text-xs text-stone-400">
                    {user.role === "admin" ? "管理员" : "用户"}
                  </span>
                </div>
                <button
                  className="rounded-2xl border border-red-200/60 bg-white/30 px-4 py-3 text-sm text-red-600 backdrop-blur-xl"
                  onClick={() => { closeMobileMenu(); handleLogout(); }}
                >
                  退出登录
                </button>
              </>
            ) : (
              <>
                <a
                  className="rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-stone-700 backdrop-blur-xl"
                  href="https://mail.yukino.bond"
                  rel="noreferrer"
                  target="_blank"
                >
                  打开邮箱
                </a>
                <Link
                  className="rounded-2xl bg-stone-900/80 px-4 py-3 text-center text-sm text-white backdrop-blur-xl"
                  onClick={closeMobileMenu}
                  to="/login"
                >
                  登录
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
