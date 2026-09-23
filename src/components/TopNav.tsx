import { useEffect, useState } from "react";
import { Menu, X, ArrowUpRight, Search } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { HomeLink } from "@/components/HomeLink";
import { useSiteStore } from "@/hooks/useSiteStore";
import { useAuthStore } from "@/hooks/useAuthStore";
import { api } from "@/lib/api";
import { QuickSearch } from "@/components/QuickSearch";
const mainNav = [
  { label: "首页", to: "/" },
  { label: "笔记", to: "/notes" },
  { label: "工具", to: "/dev" },
  { label: "导航", to: "/links" },
  { label: "关于", to: "/about-me" },
];
const extraNav = [
  { label: "游戏", to: "/games" },
  { label: "新闻", to: "/news" },
  { label: "资源", to: "/box" },
  { label: "博客", to: "/blog" },
  { label: "设备", to: "/uses" },
  { label: "日志", to: "/changelog" },
];
export function TopNav() {
  const { mobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useSiteStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileMenu();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeMobileMenu]);
  const handleLogout = () => {
    api.logout().catch(() => {});
    logout();
    closeMobileMenu();
    navigate("/");
  };
  return (
    <header className="site-header">
      <div className="nav-inner">
        <HomeLink className="brand" onClick={closeMobileMenu}>
          <span className="brand-mark">雪</span>
          <span>
            Yukino<span className="brand-dot">.</span>
          </span>
        </HomeLink>
        <nav className="desktop-nav" aria-label="主导航">
          {mainNav.map((item) => (
            <NavLink key={item.to} end={item.to === "/"} to={item.to}>
              {item.label}
            </NavLink>
          ))}
          <details className="more-nav">
            <summary>更多</summary>
            <div>
              {extraNav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={(event) =>
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open")
                  }
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
        </nav>
        <button className="search-toggle" onClick={() => setSearchOpen(true)} aria-label="搜索站内内容">
          <Search size={17} />
          <span>搜索</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="nav-account">
          {user ? (
            <>
              {user.role === "admin" && <Link to="/admin">管理台</Link>}
              <span className="account-name">{user.name}</span>
              <button onClick={handleLogout}>退出</button>
            </>
          ) : (
            <Link to="/login">
              登录 <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
        <button
          className="menu-toggle"
          aria-label={mobileMenuOpen ? "关闭菜单" : "打开菜单"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          onClick={toggleMobileMenu}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {mobileMenuOpen && (
        <nav
          id="mobile-navigation"
          className="mobile-navigation"
          aria-label="移动导航"
        >
          {[...mainNav, ...extraNav].map((item) => (
            <NavLink
              key={item.to}
              end={item.to === "/"}
              to={item.to}
              onClick={closeMobileMenu}
            >
              {item.label}
            </NavLink>
          ))}
          <a href="https://mail.yukino.bond" onClick={closeMobileMenu}>
            邮箱 ↗
          </a>
          {user ? (
            <>
              {user.role === "admin" && (
                <Link to="/admin" onClick={closeMobileMenu}>
                  管理台
                </Link>
              )}
              <button onClick={handleLogout}>退出登录</button>
            </>
          ) : (
            <Link to="/login" onClick={closeMobileMenu}>
              登录 ↗
            </Link>
          )}
        </nav>
      )}
      <QuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
