import { useState } from "react";
import { ArrowLeft, FlaskConical, Sparkles } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

/* A small interactive experiment: particle text effect */

function ParticleText() {
  const [text, setText] = useState("Yukino Lab");
  const [sparkles, setSparkles] = useState<
    { id: number; x: number; y: number; color: string }[]
  >([]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
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
      id: Date.now(),
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
          onChange={(e) => setText(e.target.value || "Yukino Lab")}
          placeholder="输入文字..."
          type="text"
          value={text}
        />
      </div>
      <div
        className="relative flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-white/40 bg-white/20 backdrop-blur-xl"
        onMouseMove={handleMouseMove}
      >
        <span className="relative z-10 font-display text-4xl text-stone-800 select-none">
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

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setClicks((prev) => [...prev.slice(-10), Date.now()]);
    setCount((c) => c + 1);
  };

  const cps =
    clicks.length >= 2
      ? (
          clicks.length /
          ((clicks[clicks.length - 1] - clicks[0]) / 1000)
        ).toFixed(1)
      : "0";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          className="inline-flex size-20 items-center justify-center rounded-full bg-stone-900 text-2xl text-white transition active:scale-95"
          onClick={handleClick}
          type="button"
        >
          {count}
        </button>
        <div className="space-y-1 text-sm text-stone-600">
          <p>
            点击次数: <span className="text-stone-900">{count}</span>
          </p>
          <p>
            点击速度: <span className="text-stone-900">{cps} 次/秒</span>
          </p>
        </div>
      </div>
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
        <code className="flex-1 truncate rounded-2xl border border-white/30 bg-white/20 px-4 py-3 backdrop-blur-xl text-xs text-stone-600">
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
    </div>
  );
}

export default function Lab() {
  useDocumentMeta("实验室", "视觉实验、前端玩具和各种还不成熟的小项目。");

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
          视觉实验、前端玩具和各种还不成熟的小项目。这里的东西可能随时变化。
        </p>
      </div>

      <div className="grid gap-6">
        <div className="glass-panel rounded-[32px] p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-2">
            <FlaskConical className="size-4 text-stone-500" />
            <h2 className="text-sm uppercase tracking-[0.24em] text-stone-500">
              实验 #1: 粒子文字
            </h2>
          </div>
          <p className="mb-5 text-sm text-stone-600">
            鼠标在文字上移动时会产生彩色粒子效果。
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