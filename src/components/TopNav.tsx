import { useEffect, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import { SiteLink as Link } from "@/components/SiteLink";
import { useSiteNavigate } from "@/hooks/useSiteNavigate";
import { HomeLink } from "@/components/HomeLink";
import { useAuthStore } from "@/hooks/useAuthStore";
import { api } from "@/lib/api";
import { QuickSearch } from "@/components/QuickSearch";
import { siteNavigation } from "@/data/navigation";
import { isRailHost, isRailPath } from "@/lib/rail-navigation";
import { SUBDOMAIN_ROUTES, isPortalHost } from "@/lib/site-routing";

export function TopNav() {
  const { user, logout } = useAuthStore();
  const navigate = useSiteNavigate();
  const location = useLocation();
  const ownPath = isPortalHost(window.location.hostname) ? SUBDOMAIN_ROUTES[window.location.hostname.split('.')[0]] : null;
  const activePath = location.pathname === '/' && ownPath ? ownPath : location.pathname;
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
            isRailHost() && item.to === "/cr" ? <Link key={item.to} to="/ticket" title={item.description} className={isRailPath(location.pathname) ? "active" : undefined} aria-current={isRailPath(location.pathname) ? "page" : undefined}>{item.label}</Link> :
            <Link key={item.to} to={item.to} title={item.description} className={activePath === item.to && !(item.to === '/' && isRailHost()) ? 'active' : undefined} aria-current={activePath === item.to && !(item.to === '/' && isRailHost()) ? 'page' : undefined}>{item.label}</Link>
          ))}
          <a href="https://mail.yukino.bond/" target="_blank" rel="noreferrer" title="Yukino Mail，打开新标签页">邮箱 <ArrowUpRight size={11} /></a>
        </nav>
      </div>
      <QuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
