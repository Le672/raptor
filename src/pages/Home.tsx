import {
  ArrowUpRight,
  ArrowRight,
  Code2,
  FolderOpen,
  Gamepad2,
  Mail,
  Github,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { postPreviews, siteProfile } from "@/data/site";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
const corners = [
  {
    icon: Code2,
    title: "开发工具",
    en: "TOOLBOX",
    text: "让重复的事情，简单一点。",
    to: "/dev",
  },
  {
    icon: FolderOpen,
    title: "资源收藏",
    en: "COLLECTION",
    text: "收好那些下次还会用到的东西。",
    to: "/box",
  },
  {
    icon: Gamepad2,
    title: "摸鱼片刻",
    en: "PLAYGROUND",
    text: "偶尔停下来，玩一局也不错。",
    to: "/games",
  },
];
export default function Home() {
  useDocumentMeta(
    "首页",
    "Yukino 的个人空间，记录开发日常、折腾笔记和一些值得留下来的东西。",
  );
  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> A LITTLE SPACE ON THE INTERNET
          </p>
          <h1 id="hero-title">
            你好，我是{" "}
            <span>
              Yukino<span className="hero-period">.</span>
            </span>
          </h1>
          <p className="hero-tagline">{siteProfile.tagline}</p>
          <p className="hero-description">
            {siteProfile.intro}
            <br />
            这里是我的数字花园，也是慢慢生长的生活切片。
          </p>
          <div className="hero-actions">
            <Link className="primary-link" to="/notes">
              读读我的笔记 <ArrowRight size={17} />
            </Link>
            <Link className="text-link" to="/about-me">
              认识一下 <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="hero-social">
            <a href="https://github.com/Le672" target="_blank" rel="noreferrer">
              <Github size={16} /> GitHub <ArrowUpRight size={12} />
            </a>
            <a href={`mailto:${siteProfile.email}`}>
              <Mail size={16} /> 打个招呼 <ArrowUpRight size={12} />
            </a>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-top">
            <span>YUKINO / PERSONAL JOURNAL</span>
            <Sparkles size={18} />
          </div>
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-sun" />
          <span className="art-kanji">雪</span>
          <div className="art-hill hill-back" />
          <div className="art-hill hill-front" />
          <div className="art-caption">
            <span>日々のかけら</span>
            <span>
              把平凡的日子，
              <br />
              慢慢写成故事。
            </span>
          </div>
          <div className="art-bottom">
            <span>CODE · NOTES · LIFE</span>
            <span>01 — ∞</span>
          </div>
        </div>
      </section>
      <div className="home-divider">
        <span>保持好奇，持续折腾。</span>
        <span>一点代码 / 一些记录 / 很多可能</span>
      </div>
      <section className="home-writing" aria-labelledby="writing-title">
        <div className="section-top">
          <div>
            <p className="eyebrow">THE JOURNAL</p>
            <h2 id="writing-title">
              最近写下的<span> / Notes</span>
            </h2>
          </div>
          <Link className="text-link" to="/notes">
            全部笔记 <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="writing-layout">
          <div className="writing-list">
            {postPreviews.map((post, index) => (
              <Link className="writing-row" to={post.href} key={post.title}>
                <span className="writing-number">0{index + 1}</span>
                <div>
                  <div className="writing-meta">
                    <span>{post.tag}</span>
                    <time dateTime={post.date}>
                      {post.date.replace(/-/g, ".")}
                    </time>
                  </div>
                  <h3>{post.title}</h3>
                  <p>{post.summary}</p>
                </div>
                <ArrowUpRight className="writing-arrow" size={21} />
              </Link>
            ))}
          </div>
          <aside className="margin-note">
            <span className="eyebrow">A NOTE TO SELF</span>
            <span className="note-asterisk" aria-hidden="true">
              ✳
            </span>
            <h3>
              不必等到完美，
              <br />
              才开始记录。
            </h3>
            <p>
              有些是解决问题的过程，
              <br />
              有些只是突然冒出的想法。
              <br />
              先留下来，以后再慢慢回看。
            </p>
            <div className="note-signature">Yukino</div>
            <Link className="text-link" to="/changelog">
              看看小站的变化 <ArrowUpRight size={16} />
            </Link>
          </aside>
        </div>
      </section>
      <section className="home-corners" aria-labelledby="corners-title">
        <div className="section-top">
          <div>
            <p className="eyebrow">BEYOND THE WORDS</p>
            <h2 id="corners-title">
              其他小角落<span> / Explore</span>
            </h2>
          </div>
          <Link className="text-link" to="/links">
            更多入口 <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="corner-grid">
          {corners.map((item) => (
            <Link to={item.to} key={item.to} className="corner-card">
              <div className="corner-top">
                <item.icon size={23} strokeWidth={1.5} />
                <ArrowUpRight size={18} />
              </div>
              <span className="eyebrow">{item.en}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="hello-strip">
        <div>
          <span className="eyebrow">NICE TO MEET YOU</span>
          <h2>很高兴，在这里遇见你。</h2>
          <p>如果有想交流的事，欢迎给我写封邮件。</p>
        </div>
        <a className="text-link" href={`mailto:${siteProfile.email}`}>
          聊一聊 <ArrowUpRight size={22} />
        </a>
      </section>
    </div>
  );
}
