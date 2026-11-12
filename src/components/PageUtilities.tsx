import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useLocation } from "react-router-dom";

export function PageUtilities() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const distance = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(distance > 0 ? Math.min(1, window.scrollY / distance) : 0);
        setVisible(window.scrollY > 400);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [pathname]);
  return <>
    <div className="page-progress" aria-hidden="true" style={{ transform: `scaleX(${progress})` }} />
    {visible && <button className="back-to-top" aria-label="返回顶部" onClick={() => {
      window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      document.getElementById("main-content")?.focus({ preventScroll: true });
    }}><ArrowUp size={19} /></button>}
  </>;
}
