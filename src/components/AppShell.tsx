import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { TopNav } from "@/components/TopNav";
import { useSiteStore } from "@/hooks/useSiteStore";

export function AppShell() {
  const location = useLocation();
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
        key={location.pathname}
        className="relative"
        tabIndex={-1}
      >
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
