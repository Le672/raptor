import { useEffect, useRef, useState } from "react";
import { ArrowLeft, FlaskConical, Sparkles } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { ServiceEntry } from "@/components/ServiceEntry";
import { yukinoServices } from "@/data/services";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { CopyButton } from "@/components/CopyButton";

/* A small interactive experiment: particle text effect */

function ParticleText() {
  const [text, setText] = useState("Yukino Lab");
  const [sparkles, setSparkles] = useState<
    { id: number; x: number; y: number; color: string; createdAt: number }[]
  >([]);

  const sequence = useRef(0);
  useEffect(() => { const timer = setInterval(() => setSparkles(previous => previous.filter(point => Date.now() - point.createdAt < 650)), 150); return () => clearInterval(timer); }, []);
  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const colors = [
      "#EF4444",
      "#F97316",
      "#F59E0B",
      "#22C55E",
      "#3B82F6",
      "#8B5CF6",
      "#EC4899",
    ];
    const newSparkle = {
      id: ++sequence.current,
      createdAt: Date.now(),
      x,
      y,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
    setSparkles((prev) => [...prev.slice(-30), newSparkle]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          className="flex-1 rounded-2xl border border-white/40 bg-white/30 px-4 py-3 text-sm text-stone-800 backdrop-blur-xl focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
          onChange={(e) => setText(e.target.value)}
          maxLength={60}
          aria-label="粒子文字"
          placeholder="输入文字..."
          type="text"
          value={text}
        />
      </div>
      <div
        className="relative flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-white/40 bg-white/20 backdrop-blur-xl"
        onPointerMove={event => { if (event.pointerType !== "touch") handlePointer(event); }}
        onPointerDown={handlePointer}
      >
        <span className="relative z-10 break-all p-5 text-center font-display text-4xl text-stone-800 select-none">
          {text}
        </span>
        {sparkles.map((s) => (
          <span
            key={s.id}
            className="pointer-events-none absolute animate-ping rounded-full"
            style={{
              left: s.x,
              top: s.y,
              width: 8,
              height: 8,
              backgroundColor: s.color,
              opacity: 0.7,
            }}
          />
        ))}
      </div>
    </div>
  );
}

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

export default function Lab() {
  useDocumentMeta("实验室", "网页变化雷达、Webhook 回调信箱、短链工坊与视觉实验。");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-10 lg:px-8">
      <div>
        <div className="flex items-center gap-3">
          <HomeLink
            className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-xs text-stone-600 backdrop-blur-xl transition hover:border-white/60 hover:text-stone-900"
          >
            <ArrowLeft className="size-3.5" />
            返回主页
          </HomeLink>
          <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-stone-600 backdrop-blur-xl">
            lab.yukino.bond
          </span>
        </div>
        <h1 className="mt-4 font-display text-4xl text-stone-900 sm:text-5xl">
          实验室
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">
          让好奇有个落点。关注网页变化、接住服务回调，或把常用链接收好；也保留一些轻巧的前端实验。
        </p>
      </div>

      <ServiceEntry service={yukinoServices.draw} />

      <section className="grid gap-4" aria-label="日常实验项目">
        <div><p className="eyebrow text-xs tracking-[0.22em] text-stone-500">MADE FOR EVERYDAY</p><h2 className="mt-2 font-display text-2xl text-stone-900">可以反复用到的新项目</h2><p className="mt-2 text-sm leading-7 text-stone-600">使用实验室专用管理口令跨设备访问，数据保存在自己的服务器。</p></div>
        <ServiceEntry service={yukinoServices.radar} />
        <ServiceEntry service={yukinoServices.hooks} />
        <ServiceEntry service={yukinoServices.shortlinks} />
      </section>

      <div className="grid gap-6">
        <div className="glass-panel rounded-[32px] p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-2">
            <FlaskConical className="size-4 text-stone-500" />
            <h2 className="text-sm uppercase tracking-[0.24em] text-stone-500">
              实验 #1: 粒子文字
            </h2>
          </div>
          <p className="mb-5 text-sm text-stone-600">
            移动鼠标或轻触文字区域，留下短暂的彩色粒子。
          </p>
          <ParticleText />
        </div>

        <div className="glass-panel rounded-[32px] p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-2">
            <FlaskConical className="size-4 text-stone-500" />
            <h2 className="text-sm uppercase tracking-[0.24em] text-stone-500">
              实验 #2: 点击计数器
            </h2>
          </div>
          <p className="mb-5 text-sm text-stone-600">
            一个会实时计算点击速度的计数器，看看你能点多快。
          </p>
          <Counter />
        </div>

        <div className="glass-panel rounded-[32px] p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-2">
            <FlaskConical className="size-4 text-stone-500" />
            <h2 className="text-sm uppercase tracking-[0.24em] text-stone-500">
              实验 #3: 随机渐变生成器
            </h2>
          </div>
          <p className="mb-5 text-sm text-stone-600">
            每次点击随机生成一个 CSS 渐变背景，可以直接复制代码使用。
          </p>
          <RandomGradient />
        </div>
      </div>
    </div>
  );
}
