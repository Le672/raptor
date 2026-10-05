import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { TopNav } from "@/components/TopNav";
import { PageUtilities } from "@/components/PageUtilities";
import { useSiteStore } from "@/hooks/useSiteStore";
import { isRailPath } from "@/lib/rail-navigation";

export function AppShell() {
  const location = useLocation();
  const isRailPage = isRailPath(location.pathname);
  const isF1Page = location.pathname.replace(/\/+$/, "").toLowerCase() === "/f1";
  const closeMobileMenu = useSiteStore((state) => state.closeMobileMenu);

  useEffect(() => {
    closeMobileMenu();
    window.scrollTo(0, 0);
  }, [closeMobileMenu, location.pathname]);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        跳转到正文
      </a>
      <TopNav />
      <main
        id="main-content"
        key={isRailPage ? "rail" : location.pathname}
        className="relative"
        tabIndex={-1}
      >
        <Suspense fallback={<p className="game-notice mx-auto my-10 max-w-md" role="status">正在打开页面…</p>}><Outlet /></Suspense>
      </main>
      {!isRailPage && !isF1Page && <Footer />}
      <PageUtilities />
    </div>
  );
}
