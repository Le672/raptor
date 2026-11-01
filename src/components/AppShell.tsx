import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { TopNav } from "@/components/TopNav";
import { PageUtilities } from "@/components/PageUtilities";
import { useSiteStore } from "@/hooks/useSiteStore";
import { isRailHost, isRailPath } from "@/lib/rail-navigation";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useAuthStore } from "@/hooks/useAuthStore";
import { api, ApiError } from "@/lib/api";
import { SiteVisitsProvider } from "@/components/SiteVisits";
import { LegacySpeedRecovery } from "@/components/LegacySpeedRecovery";
import { SUBDOMAIN_ROUTES } from "@/lib/site-routing";

export function AppShell() {
  const location = useLocation();
  const independentStatus = window.location.hostname === 'status.yukino.bond';
  const isRailPage = isRailPath(location.pathname);
  const isF1Page = location.pathname.replace(/\/+$/, "").toLowerCase() === "/f1";
  const visualPath = location.pathname === "/" ? SUBDOMAIN_ROUTES[window.location.hostname.split(".")[0]] || "/" : location.pathname;
  const visualPage = isRailPage || isRailHost() ? "rail" : visualPath.split("/").filter(Boolean)[0] || "home";
  const closeMobileMenu = useSiteStore((state) => state.closeMobileMenu);
  const token = useAuthStore(state => state.token);
  const authLoading = useAuthStore(state => state.isLoading);
  useEffect(() => {
    if (independentStatus) { useAuthStore.getState().setLoading(false); return; }
    let active = true, revision = 0;
    useAuthStore.getState().setLoading(true);
    const check = () => { if (document.hidden) return; const current = ++revision; void api.getMe().then(result => { if (active && current === revision && useAuthStore.getState().token === token) useAuthStore.getState().setUser(result.user); })
      .catch(error => {
        if (!active || current !== revision || useAuthStore.getState().token !== token || !(error instanceof ApiError) || error.status !== 401) return;
        if (token) {
          // An older origin-local Bearer token must not hide a newer shared
          // cookie session. Keep protected routes waiting for the cookie retry.
          useAuthStore.getState().setToken(null);
          useAuthStore.getState().setUser(null);
        } else useAuthStore.getState().logout();
      })
      .finally(() => { if (active && current === revision && useAuthStore.getState().token === token) useAuthStore.getState().setLoading(false); }); };
    const sessionChanged = (event: Event) => {
      const action = (event as CustomEvent<{ action: string }>).detail?.action;
      if (action === 'logout') useAuthStore.getState().logout();
      else if (useAuthStore.getState().token) useAuthStore.getState().setToken(null);
      check();
    };
    const storageChanged = (event: StorageEvent) => { if (event.key === 'yukino-app-session-event') check(); };
    check(); window.addEventListener('focus', check); document.addEventListener('visibilitychange', check);
    window.addEventListener('yukino-app-session', sessionChanged); window.addEventListener('storage', storageChanged);
    return () => { active = false; window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); window.removeEventListener('yukino-app-session', sessionChanged); window.removeEventListener('storage', storageChanged); };
  }, [token, independentStatus]);

  useEffect(() => {
    closeMobileMenu();
    window.scrollTo(0, 0);
  }, [closeMobileMenu, location.pathname]);

  const content = (
    <div className="site-shell site-refresh" data-page={visualPage}>
      <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); const main = document.getElementById("main-content"); main?.focus(); main?.scrollIntoView(); }}>
        跳转到正文
      </a>
      <TopNav />
      {!independentStatus && <LegacySpeedRecovery />}
      <main
        id="main-content"
        key={isRailPage ? "rail" : location.pathname}
        className="relative"
        tabIndex={-1}
      >
        <PageErrorBoundary resetKey={location.pathname + location.search}><Suspense fallback={<p className="game-notice mx-auto my-10 max-w-md" role="status">正在打开页面…</p>}>{authLoading && location.pathname.startsWith("/admin") ? <p className="game-notice mx-auto my-10 max-w-md" role="status">正在确认登录状态…</p> : <Outlet />}</Suspense></PageErrorBoundary>
      </main>
      {!isRailPage && !isF1Page && <Footer liveInfo={!independentStatus} />}
      <PageUtilities />
    </div>
  );
  return independentStatus ? content : <SiteVisitsProvider>{content}</SiteVisitsProvider>;
}
