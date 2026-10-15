import { SiteLink as Link } from "@/components/SiteLink";
import { VisitorNetwork } from "@/components/VisitorNetwork";
import { SiteVisits } from "@/components/SiteVisits";
import { ArrowUpRight } from "lucide-react";
export function Footer() {
  return (
    <footer className="site-footer editorial-footer">
      <div className="footer-intro">
        <div className="footer-identity">
          <Link to="/" className="footer-brand" aria-label="Yukino.">Yukino<span>.</span></Link>
          <p>收集一点灵感，留住一些日常。<br />慢慢写，也慢慢长。</p>
        </div>
        <span className="footer-motto" aria-hidden="true">KEEP CURIOUS.<br /><span>MAKE SOMETHING.</span></span>
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
        <span className="footer-credit">© {new Date().getFullYear()} Yukino <span>· 个人数字花园</span></span>
        <div className="footer-network"><VisitorNetwork compact /><SiteVisits compact /></div>
      </div>
    </footer>
  );
}
