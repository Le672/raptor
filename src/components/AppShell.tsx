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
  }, [closeMobileMenu, location.pathname]);

  return (
    <div className="min-h-screen bg-transparent text-stone-800" style={{ backgroundImage: "url('https://t.alcy.cc/pc')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
      <div className="page-glow" />
      <TopNav />
      <main key={location.pathname} className="relative">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
