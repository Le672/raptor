import { useEffect, useRef, useState } from "react";
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
import "@/styles/chrome-refresh.css";

export function TopNav() {
  const { user, logout } = useAuthStore();
  const navigate = useSiteNavigate();
  const location = useLocation();
  const ownPath = isPortalHost(window.location.hostname) ? SUBDOMAIN_ROUTES[window.location.hostname.split('.')[0]] : null;
  const activePath = location.pathname === '/' && ownPath ? ownPath : location.pathname;
  const [searchOpen, setSearchOpen] = useState(false);
  const [navigationHidden, setNavigationHidden] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    setNavigationHidden(false);
    let previousY = Math.max(0, window.scrollY), direction = 0, distance = 0, frame = 0;
    const measureBrandRow = () => {
      const inner = header.querySelector<HTMLElement>(".nav-inner");
      const brand = header.querySelector<HTMLElement>(".brand");
      const tools = header.querySelector<HTMLElement>(".nav-tools");
      if (!inner || !brand || !tools) return;
      const bottom = Math.max(brand.getBoundingClientRect().bottom, tools.getBoundingClientRect().bottom);
      const padding = parseFloat(getComputedStyle(inner).paddingBottom) || 0;
      header.style.setProperty("--brand-row-height", `${Math.ceil(bottom - header.getBoundingClientRect().top + padding)}px`);
    };
    const updateScroll = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY), delta = y - previousY;
      previousY = y;
      if (y <= 32) { distance = 0; direction = 0; setNavigationHidden(false); return; }
      if (!delta) return;
      const nextDirection = Math.sign(delta);
      distance = nextDirection === direction ? distance + Math.abs(delta) : Math.abs(delta);
      direction = nextDirection;
      if (distance < 12) return;
      distance = 0;
      const focused = document.activeElement;
      const keyboardFocus = focused instanceof HTMLElement && header.contains(focused) && focused.matches(":focus-visible");
      if (searchOpen || keyboardFocus) setNavigationHidden(false);
      else if (y > 96 || direction < 0) setNavigationHidden(direction > 0);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(updateScroll); };
    measureBrandRow();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measureBrandRow);
    observer?.observe(header);
    window.addEventListener("resize", measureBrandRow);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measureBrandRow);
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [location.pathname, searchOpen]);
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
    <>
    <header ref={headerRef} className={`site-header${navigationHidden ? " is-navigation-hidden" : ""}`} onFocusCapture={event => {
      if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) setNavigationHidden(false);
    }}>
      <div className="nav-inner">
        <div className="brand-lockup">
          <HomeLink className="brand" aria-label="Yukino.">
            <img className="brand-mark" src="/favicon.png" alt="" width="40" height="40" decoding="async" />
            <span>Yukino<span className="brand-dot">.</span></span>
          </HomeLink>
          <span className="brand-caption">一处慢慢生长的数字花园<small>CODE, NOTES & EVERYDAY LIFE</small></span>
        </div>
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
        <nav className="site-navigation" aria-label="主导航" aria-hidden={navigationHidden || undefined}>
          {siteNavigation.map((item) => (
            item.href ? <a key={item.to} href={item.href} target="_blank" rel="noreferrer" tabIndex={navigationHidden ? -1 : undefined} title={`${item.description}，打开新标签页`}>{item.label}<ArrowUpRight size={11}/></a> :
            isRailHost() && item.to === "/cr" ? <Link key={item.to} to="/ticket" tabIndex={navigationHidden ? -1 : undefined} title={item.description} className={isRailPath(location.pathname) ? "active" : undefined} aria-current={isRailPath(location.pathname) ? "page" : undefined}>{item.label}</Link> :
            <Link key={item.to} to={item.to} tabIndex={navigationHidden ? -1 : undefined} title={item.description} className={activePath === item.to && !(item.to === '/' && isRailHost()) ? 'active' : undefined} aria-current={activePath === item.to && !(item.to === '/' && isRailHost()) ? 'page' : undefined}>{item.label}</Link>
          ))}
          <a href="https://mail.yukino.bond/" target="_blank" rel="noreferrer" tabIndex={navigationHidden ? -1 : undefined} title="Yukino Mail，打开新标签页">邮箱 <ArrowUpRight size={11} /></a>
        </nav>
      </div>
    </header>
    <QuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
