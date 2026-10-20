import {
  ArrowUpRight,
  ArrowRight,
  Code2,
  FolderOpen,
  Gamepad2,
  Mail,
  Github,
  Sparkles,
  Newspaper,
  Timer,
  Monitor,
  FlagTriangleRight,
  Gauge,
  ShieldCheck,
  BookOpen,
  Coffee,
  NotebookPen,
  Clapperboard,
  Play,
  FlaskConical,
} from "lucide-react";
import { SiteLink as Link } from "@/components/SiteLink";
import { siteProfile } from "@/data/site";
import { usePublicPosts } from "@/hooks/usePublicContent";
import { ContentNotice } from "@/components/ContentNotice";
import { contentDate, postHref } from "@/lib/content";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { VisitorNetwork } from "@/components/VisitorNetwork";
import { SiteVisits } from "@/components/SiteVisits";
import { WeatherCard } from "@/components/WeatherCard";
import { DomainCard } from "@/components/DomainCard";
import { serviceDomainLinks } from "@/data/services";
import "@/styles/home-refresh.css";
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
  { icon: Newspaper, title: "新闻阅读室", en: "READING ROOM", text: "从不同的视角，看看今天的世界。", to: "/news" },
  { icon: BookOpen, title: "姬漫图书馆", en: "JM COMIC", text: "漫画搜索、阅读、收藏与章节导出，在这里直接进入。", to: "/jm" },
  { icon: BookOpen, title: "轻小说书房", en: "YUKINO NOVEL", text: "找一本喜欢的轻小说，关注更新，把故事慢慢读下去。", to: "/novel" },
  { icon: Play, title: "番剧放映室", en: "YUKINO COMIC", text: "找一部喜欢的番剧，收藏片单，接着上次的进度看下去。", to: "/comic" },
  { icon: Clapperboard, title: "影视馆", en: "YUKINO CINEMA", text: "搜索电影、电视剧与纪录片，收藏想看的故事。", to: "/cinema" },
  { icon: Timer, title: "专注角落", en: "FOCUS", text: "选一件事，留一段安静的时间。", to: "/focus" },
  { icon: Monitor, title: "设备与环境", en: "EVERYDAY SETUP", text: "那些陪着我写代码、过日子的工具。", to: "/uses" },
  { icon: FlagTriangleRight, title: "Formula 1 围场", en: "YUKINO MOTORSPORT", text: "每一圈，都值得期待。赛历、计时与观赛入口。", to: "/f1" },
  { icon: Gauge, title: "网络测速", en: "YUKINO SPEED", text: "让速度看得见。自选服务器、线程与流量配额。", to: "/speed" },
  { icon: ShieldCheck, title: "IP 纯净度", en: "YUKINO IP", text: "查看网络归属，对照多个来源了解 IP 的公开记录。", to: "/ip" },
  { icon: FlaskConical, title: "实验室", en: "YUKINO LAB", text: "视觉实验、前端玩具，和一些正在慢慢成形的想法。", to: "/lab" },
];
export default function Home() {
  const published = usePublicPosts();
  useDocumentMeta(
    "首页",
    "Yukino 的个人空间，记录开发日常、折腾笔记和一些值得留下来的东西。",
  );
  return (
    <div className="home-page home-refresh">
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="hero-edition">YUKINO / PERSONAL JOURNAL</span> 欢迎来坐坐
          </p>
          <h1 id="hero-title">{siteProfile.tagline}</h1>
          <p className="hero-description">
            你好，我是 Yukino。{siteProfile.intro}
            <br />
            把好奇变成作品，把日常写成故事。
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
        <div className="hero-aside">
          <div className="desk-art" aria-hidden="true">
            <div className="desk-art-heading"><span>A CORNER FOR IDEAS</span><Sparkles size={18} /></div>
            <svg className="desk-art-orbit" viewBox="0 0 520 410" fill="none"><path d="M48 290C-1 154 167-24 356 66c156 75 139 257-53 301C106 412 50 239 205 173c142-61 274 42 236 125" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 8" /><path d="m424 287 17 12 12-17" stroke="currentColor" strokeWidth="1.5" /></svg>
            <div className="desk-code-window">
              <div className="desk-window-bar"><span><i /><i /><i /></span><small>little-things.ts</small><Code2 size={13} /></div>
              <div className="desk-code-content"><span className="desk-code-comment">// make room for curiosity</span><p><span>const</span> life = &#123;</p><p className="desk-code-indent">create: <em>"something useful"</em>,</p><p className="desk-code-indent">keep: <em>"a little wonder"</em></p><p>&#125;;</p><div className="desk-code-footer"><span>hello, world<span className="desk-code-cursor">_</span></span><span>↗</span></div></div>
            </div>
            <div className="desk-journal"><span className="desk-journal-tape" /><div className="desk-journal-header"><NotebookPen size={19} /><span>NOTES TO KEEP</span></div><h2>拾起一个想法，<br />慢慢把它做出来。</h2><div className="desk-journal-lines"><i /><i /></div><span className="desk-journal-signature">Yukino.</span></div>
            <div className="desk-coffee"><Coffee size={24} strokeWidth={1.5} /><span>慢一点，也没关系。</span></div>
            <span className="desk-art-label">CODE, NOTES & LITTLE JOYS</span>
            <span className="desk-art-spark">✳</span>
          </div>
        </div>
      </section>
      <div className="home-divider">
        <span><Sparkles size={15} aria-hidden="true" /> 保持好奇，持续折腾。</span>
        <span><b>CODE</b><i />一些记录<i /><b>LIFE</b><i />很多可能</span>
      </div>
      <section className="home-writing" aria-labelledby="writing-title">
        <div className="section-top">
          <div>
            <p className="eyebrow"><span className="section-index">01</span> THE JOURNAL</p>
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
            <ContentNotice {...published} hasData={published.data.length > 0} />
            {!published.loading && !published.error && !published.data.length && <p className="empty-notes">还没有公开笔记，之后再来看看。</p>}
            {published.data.slice(0, 4).map((post, index) => (
              <Link className="writing-row" to={postHref(post.slug)} key={post.id}>
                <span className="writing-number">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <div className="writing-meta">
                    <span>{post.tag}</span>
                    <time dateTime={post.created_at}>
                      {contentDate(post.created_at)}
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
            <div className="margin-note-top"><span className="eyebrow">A NOTE TO SELF</span><NotebookPen size={20} aria-hidden="true" /></div>
            <h3>
              好的故事，
              <br />
              从一个小念头开始。
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
            <p className="eyebrow"><span className="section-index">02</span> BEYOND THE WORDS</p>
            <h2 id="corners-title">
              其他小角落<span> / Explore</span>
            </h2>
          </div>
          <Link className="text-link" to="/links">
            更多入口 <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="corner-grid">
          {corners.map((item, index) => (
            <Link to={item.to} key={item.to} className={`corner-card corner-tone-${index % 4}`} target={["/jm", "/novel"].includes(item.to) ? "_blank" : undefined} rel={["/jm", "/novel"].includes(item.to) ? "noreferrer" : undefined}>
              <div className="corner-top">
                <span className="corner-icon"><item.icon size={23} strokeWidth={1.5} /></span>
                <ArrowUpRight size={18} />
              </div>
              <span className="eyebrow">{item.en}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <span className="corner-bottom"><span>去看看</span><span>{String(index + 1).padStart(2, "0")}</span></span>
            </Link>
          ))}
        </div>
      </section>
      <section className="home-corners home-services" aria-labelledby="services-title">
        <div className="section-top"><div><p className="eyebrow"><span className="section-index">03</span> WITHIN REACH</p><h2 id="services-title">顺手的在线工具<span> / Services</span></h2></div><Link className="text-link" to="/links">全部入口 <ArrowUpRight size={17} /></Link></div>
        <div className="home-service-grid">{serviceDomainLinks.map(service => <DomainCard key={service.hostname} domain={service} />)}</div>
      </section>
      <section className="home-daily" aria-labelledby="daily-title">
        <div className="section-top"><div><p className="eyebrow"><span className="section-index">04</span> A LITTLE EVERYDAY</p><h2 id="daily-title">日常，一角<span> / Everyday</span></h2></div><span className="daily-heading-note">看看天气，再开始今天。</span></div>
        <div className="home-daily-grid"><WeatherCard /><div className="daily-side"><div className="daily-connection"><span className="eyebrow">YOUR CONNECTION</span><h3>从世界的某一处，来到这里。</h3><VisitorNetwork /><SiteVisits /></div><Link className="daily-focus" to="/focus"><span className="daily-focus-icon"><Timer size={23} strokeWidth={1.5} /></span><div><span className="eyebrow">A MOMENT OF FOCUS</span><h3>给自己一段专注的时间。</h3></div><ArrowUpRight size={20} /></Link></div></div>
      </section>
      <section className="hello-strip">
        <div>
          <span className="eyebrow"><span className="hello-star" aria-hidden="true">✳</span> NICE TO MEET YOU</span>
          <h2>很高兴，在这里遇见你。</h2>
          <p>如果有想交流的事，欢迎给我写封邮件。</p>
        </div>
        <a className="text-link" href={`mailto:${siteProfile.email}`}>
          给我写信 <ArrowUpRight size={22} />
        </a>
      </section>
    </div>
  );
}
