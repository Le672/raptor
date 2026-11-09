import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { ServiceEntry } from "@/components/ServiceEntry";
import { yukinoServices } from "@/data/services";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { CopyButton } from "@/components/CopyButton";
import { ParticleText } from "@/components/ParticleText";

/* A small counter with animation */

function Counter() {
  const [count, setCount] = useState(0);
  const [clicks, setClicks] = useState<number[]>([]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(timer); }, []);

  const handleClick = () => {
    const time = Date.now(); setNow(time);
    setClicks((prev) => [...prev.filter(value => time - value < 1000).slice(-99), time]);
    setCount((c) => c + 1);
  };

  const cps = clicks.filter(time => now - time < 1000).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          className="inline-flex size-20 items-center justify-center rounded-full bg-stone-900 text-2xl text-white transition active:scale-95"
          onClick={handleClick}
          aria-label="增加点击计数"
          type="button"
        >
          {count}
        </button>
        <div className="space-y-1 text-sm text-stone-600">
          <p>
            点击次数: <span className="text-stone-900">{count}</span>
          </p>
          <p>
            最近一秒: <span className="text-stone-900">{cps} 次/秒</span>
          </p>
        </div>
      </div>
      <button type="button" className="pill-button" onClick={() => { setCount(0); setClicks([]); }}>重置计数</button>
    </div>
  );
}

/* A simple random color gradient generator */

function RandomGradient() {
  const [gradient, setGradient] = useState(
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  );

  const randomColor = () =>
    `#${Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0")}`;

  const generate = () => {
    const angle = Math.floor(Math.random() * 360);
    const c1 = randomColor();
    const c2 = randomColor();
    setGradient(`linear-gradient(${angle}deg, ${c1} 0%, ${c2} 100%)`);
  };

  return (
    <div className="space-y-4">
      <div
        className="h-32 rounded-2xl border border-stone-300 transition-all duration-500"
        style={{ background: gradient }}
      />
      <div className="flex items-center gap-3">
        <code className="min-w-0 flex-1 break-all rounded-2xl border border-white/30 bg-white/20 px-4 py-3 backdrop-blur-xl text-xs text-stone-600">
          {gradient}
        </code>
        <button
          className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2.5 text-sm text-white transition hover:-translate-y-0.5"
          onClick={generate}
          type="button"
        >
          <Sparkles className="size-4" />
          随机生成
        </button>
      </div>
      <CopyButton text={`background: ${gradient};`} label="复制渐变 CSS" />
    </div>
  );
}

function TextWorkbench() {
  const [value, setValue] = useState("");
  const characters = Array.from(value).length;
  const words = value.trim() ? value.trim().split(/\s+/u).length : 0;
  const lines = value ? value.split(/\r\n|\r|\n/).length : 0;
  return <div className="space-y-4">
    <textarea aria-label="待统计文字" value={value} onChange={event => setValue(event.target.value)} placeholder="在这里输入或粘贴文字…" className="min-h-36 w-full resize-y rounded-2xl border border-stone-200 bg-white/60 p-4 text-sm text-stone-800 outline-none focus:ring-2 focus:ring-blue-200" />
    <div className="grid grid-cols-3 gap-2 text-center">{[["字符", characters], ["词组", words], ["行数", lines]].map(([label, count]) => <div key={label} className="rounded-2xl bg-white/50 p-3"><strong className="block text-xl text-stone-900">{count}</strong><span className="text-xs text-stone-500">{label}</span></div>)}</div>
    <div className="flex flex-wrap gap-2"><CopyButton text={value} label="复制文字" /><button type="button" className="pill-button" onClick={() => setValue("")} disabled={!value}>清空</button></div>
    <p className="text-xs leading-5 text-stone-500">字符包含空格和换行；词组按空白分隔。文字只在当前页面处理。</p>
  </div>;
}

function Experiment({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="glass-panel min-w-0 rounded-[28px] p-6 sm:p-7"><div className="mb-5 flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/60 text-xs font-semibold text-stone-500">{number}</span><div><h3 className="font-display text-xl text-stone-900">{title}</h3><p className="mt-1 text-sm leading-6 text-stone-600">{description}</p></div></div>{children}</section>;
}

export default function Lab() {
  useDocumentMeta("实验室", "网页变化雷达、Webhook 回调信箱、短链工坊与视觉实验。");
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-10 sm:px-8">
    <header className="relative overflow-hidden rounded-[32px] border border-white/60 bg-gradient-to-br from-blue-100/80 via-white/70 to-pink-100/80 p-7 sm:p-10">
      <div className="flex flex-wrap items-center gap-3"><HomeLink className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/50 px-3 py-1.5 text-xs text-stone-600"><ArrowLeft className="size-3.5" />返回主页</HomeLink><span className="text-xs tracking-[0.2em] text-stone-500">YUKINO LAB / 实验室</span></div>
      <div className="mt-10 max-w-2xl"><p className="text-xs font-medium tracking-[0.22em] text-blue-700">A LITTLE SPACE FOR IDEAS</p><h1 className="mt-3 font-display text-4xl text-stone-900 sm:text-5xl">让好奇有个落点。</h1><p className="mt-4 text-sm leading-7 text-stone-600">实用工具、随手实验和一点点灵感，都放在这里。挑一个感兴趣的开始吧。</p></div>
      <nav aria-label="实验室页面导航" className="mt-7 flex flex-wrap gap-2"><a className="pill-button" href="#tools">探索工具</a><a className="pill-button" href="#experiments">试玩实验</a></nav>
    </header>
    <section id="tools" className="scroll-mt-24 space-y-5"><div><p className="text-xs tracking-[0.2em] text-stone-500">THE TOOLBOX</p><h2 className="mt-2 font-display text-3xl text-stone-900">日常工具</h2><p className="mt-2 text-sm leading-7 text-stone-600">记录变化、接收回调、管理短链，或打开画布随手画画。前三项使用实验室专用管理口令，数据保存在服务器。</p></div><div className="grid gap-4 md:grid-cols-2"><ServiceEntry service={yukinoServices.radar}/><ServiceEntry service={yukinoServices.hooks}/><ServiceEntry service={yukinoServices.shortlinks}/><ServiceEntry service={yukinoServices.draw}/></div></section>
    <section id="experiments" className="scroll-mt-24 space-y-5"><div><p className="text-xs tracking-[0.2em] text-stone-500">PLAY & CREATE</p><h2 className="mt-2 font-display text-3xl text-stone-900">动手试试看</h2><p className="mt-2 text-sm leading-7 text-stone-600">无需登录，在页面里直接玩、直接用。</p></div><div className="grid items-start gap-4 lg:grid-cols-2">
      <Experiment number="01" title="粒子文字" description="让文字由彩色粒子组成，移动鼠标或轻触画面将它打散。"><ParticleText/></Experiment>
      <Experiment number="02" title="随机渐变" description="发现一组新配色，并复制 CSS 到自己的项目。"><RandomGradient/></Experiment>
      <Experiment number="03" title="文字统计" description="快速查看文字长度、词组和行数。"><TextWorkbench/></Experiment>
      <Experiment number="04" title="点击计数器" description="看看你一秒钟能点击多少次。"><Counter/></Experiment>
    </div></section>
  </div>;
}
