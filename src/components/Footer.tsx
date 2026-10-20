import { SiteLink as Link } from "@/components/SiteLink";
import { VisitorNetwork } from "@/components/VisitorNetwork";
import { SiteVisits } from "@/components/SiteVisits";
import { ArrowUpRight } from "lucide-react";
export function Footer() {
  return (
    <footer className="site-footer collection-footer">
      <div className="footer-intro">
        <div className="footer-identity">
          <Link to="/" className="footer-brand" aria-label="Yukino.">Yukino<span>.</span></Link>
          <span className="footer-credit">© {new Date().getFullYear()} Yukino <span>· 保持好奇，慢慢记录。</span></span>
        </div>
      </div>
      <nav aria-label="页脚导航">
        <a href="https://github.com/Le672" target="_blank" rel="noreferrer">
          GitHub <ArrowUpRight size={13} aria-hidden="true" />
        </a>
        <a href="mailto:Raptor@yukino.bond">邮件 <ArrowUpRight size={13} aria-hidden="true" /></a>
        <Link to="/changelog">更新日志</Link>
        <Link to="/rss">订阅</Link>
      </nav>
      <div className="footer-bottom">
        <div className="footer-network"><VisitorNetwork compact /><SiteVisits compact /></div>
      </div>
    </footer>
  );
}
