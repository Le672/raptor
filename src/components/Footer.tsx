import { Link } from "react-router-dom";
export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <Link to="/" className="footer-brand">
          Yukino.
        </Link>
        <span>慢慢写，慢慢长。</span>
      </div>
      <nav aria-label="页脚导航">
        <a href="https://github.com/Le672" target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
        <a href="mailto:Raptor@yukino.bond">邮件 ↗</a>
        <Link to="/changelog">更新日志</Link>
        <Link to="/rss">订阅</Link>
      </nav>
      <span className="footer-credit">© {new Date().getFullYear()} Yukino</span>
    </footer>
  );
}
