import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { TopNav } from "@/components/TopNav";
import { PageUtilities } from "@/components/PageUtilities";
import { useSiteStore } from "@/hooks/useSiteStore";
import { isRailPath } from "@/lib/rail-navigation";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useAuthStore } from "@/hooks/useAuthStore";
import { api, ApiError } from "@/lib/api";

export function AppShell() {
  const location = useLocation();
  const isRailPage = isRailPath(location.pathname);
  const isF1Page = location.pathname.replace(/\/+$/, "").toLowerCase() === "/f1";
  const closeMobileMenu = useSiteStore((state) => state.closeMobileMenu);
  const token = useAuthStore(state => state.token);
  useEffect(() => {
    if (!token) return;
    let active = true;
    useAuthStore.getState().setLoading(true);
    api.getMe().then(result => { if (active && useAuthStore.getState().token === token) useAuthStore.getState().setUser(result.user); })
      .catch(error => { if (active && useAuthStore.getState().token === token && error instanceof ApiError && error.status === 401) useAuthStore.getState().logout(); })
      .finally(() => { if (active) useAuthStore.getState().setLoading(false); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    closeMobileMenu();
    window.scrollTo(0, 0);
  }, [closeMobileMenu, location.pathname]);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); const main = document.getElementById("main-content"); main?.focus(); main?.scrollIntoView(); }}>
        跳转到正文
      </a>
      <TopNav />
      <main
        id="main-content"
        key={isRailPage ? "rail" : location.pathname}
        className="relative"
        tabIndex={-1}
      >
        <PageErrorBoundary resetKey={location.pathname + location.search}><Suspense fallback={<p className="game-notice mx-auto my-10 max-w-md" role="status">正在打开页面…</p>}><Outlet /></Suspense></PageErrorBoundary>
      </main>
      {!isRailPage && !isF1Page && <Footer />}
      <PageUtilities />
    </div>
  );
}
