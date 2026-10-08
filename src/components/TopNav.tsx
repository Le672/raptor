import { useEffect, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { HomeLink } from "@/components/HomeLink";
import { useAuthStore } from "@/hooks/useAuthStore";
import { api } from "@/lib/api";
import { QuickSearch } from "@/components/QuickSearch";
import { siteNavigation } from "@/data/navigation";
import { isRailHost, isRailPath } from "@/lib/rail-navigation";

export function TopNav() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const subdomainHome = isRailHost() || (window.location.hostname.endsWith(".yukino.bond") && window.location.hostname !== "www.yukino.bond");
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const handleLogout = () => {
    api.logout().catch(() => {});
    logout();
    navigate("/");
  };
  return (
    <header className="site-header">
      <div className="nav-inner">
        <HomeLink className="brand">
          <img className="brand-mark" src="/favicon.png" alt="" width="40" height="40" decoding="async" />
          <span>Yukino<span className="brand-dot">.</span></span>
        </HomeLink>
        <div className="nav-tools">
          <button className="search-toggle" onClick={() => setSearchOpen(true)} aria-label="搜索站内内容">
            <Search size={17} /><span>搜索</span><kbd>Ctrl K</kbd>
          </button>
          <div className="nav-account">
            {user ? <>
              {user.role === "admin" && <Link to="/admin">管理台</Link>}
              <span className="account-name" title={user.name}>{user.name}</span>
              <button onClick={handleLogout}>退出</button>
            </> : <Link to="/login">登录 <ArrowUpRight size={14} /></Link>}
          </div>
        </div>
        <nav className="site-navigation" aria-label="主导航">
          {siteNavigation.map((item) => (
            subdomainHome && item.to === "/" ? <a key={item.to} href="https://www.yukino.bond/" title={item.description}>{item.label}</a> :
            isRailHost() && item.to === "/cr" ? <Link key={item.to} to="/ticket" title={item.description} className={isRailPath(location.pathname) ? "active" : undefined} aria-current={isRailPath(location.pathname) ? "page" : undefined}>{item.label}</Link> :
            <NavLink key={item.to} end={item.to === "/"} to={item.to} title={item.description}>{item.label}</NavLink>
          ))}
          <a href="https://mail.yukino.bond/" target="_blank" rel="noreferrer" title="Yukino Mail，打开新标签页">邮箱 <ArrowUpRight size={11} /></a>
        </nav>
      </div>
      <QuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
