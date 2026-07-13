import { useState, useEffect, useCallback, useRef } from "react";

const COLORS = [
  { bg: "bg-red-400/70", active: "bg-red-300/90", sound: 261.63 },
  { bg: "bg-blue-400/70", active: "bg-blue-300/90", sound: 329.63 },
  { bg: "bg-green-400/70", active: "bg-green-300/90", sound: 392.00 },
  { bg: "bg-yellow-400/70", active: "bg-yellow-300/90", sound: 523.25 },
];

type Phase = "idle" | "showing" | "input" | "gameover";

export default function GameSimon() {
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerSeq, setPlayerSeq] = useState<number[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("bestSimon") || 0));
  const audioRef = useRef<AudioContext | null>(null);

  const playTone = useCallback((freq: number, duration: number) => {
    if (!audioRef.current) audioRef.current = new AudioContext();
    const ctx = audioRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  }, []);

  const showSequence = useCallback(async (seq: number[]) => {
    setPhase("showing");
    for (let i = 0; i < seq.length; i++) {
      await new Promise((r) => setTimeout(r, 500));
      setActiveIdx(seq[i]);
      playTone(COLORS[seq[i]].sound, 400);
      await new Promise((r) => setTimeout(r, 400));
      setActiveIdx(-1);
    }
    await new Promise((r) => setTimeout(r, 300));
    setPhase("input");
    setPlayerSeq([]);
  }, [playTone]);

  const start = useCallback(() => {
    const first = Math.floor(Math.random() * 4);
    const seq = [first];
    setSequence(seq);
    setLevel(1);
    showSequence(seq);
  }, [showSequence]);

  const handlePress = useCallback((idx: number) => {
    if (phase !== "input") return;
    playTone(COLORS[idx].sound, 200);
    setActiveIdx(idx);
    setTimeout(() => setActiveIdx(-1), 200);

    const newPlayerSeq = [...playerSeq, idx];
    setPlayerSeq(newPlayerSeq);

    const currentStep = newPlayerSeq.length - 1;
    if (newPlayerSeq[currentStep] !== sequence[currentStep]) {
      setPhase("gameover");
      setBest((b) => { const nb = Math.max(b, level - 1); localStorage.setItem("bestSimon", String(nb)); return nb; });
      return;
    }

    if (newPlayerSeq.length === sequence.length) {
      const next = Math.floor(Math.random() * 4);
      const newSeq = [...sequence, next];
      setSequence(newSeq);
      setLevel((l) => l + 1);
      setTimeout(() => showSequence(newSeq), 800);
    }
  }, [phase, playerSeq, sequence, level, playTone, showSequence]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between">
        <div className="flex gap-4">
          <div className="glass-panel rounded-xl px-4 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-stone-500">关卡</p>
            <p className="font-display text-xl text-stone-900">{level}</p>
          </div>
          <div className="glass-panel rounded-xl px-4 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-stone-500">最佳</p>
            <p className="font-display text-xl text-stone-900">{best}</p>
          </div>
        </div>
        <button onClick={start} className="glass-panel rounded-xl px-4 py-2 text-sm text-stone-700">
          {phase === "gameover" ? "重新开始" : phase === "idle" ? "开始" : "重置"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3" style={{ width: "min(80vw, 300px)" }}>
        {COLORS.map((color, i) => (
          <button
            key={i}
            className={`aspect-square rounded-2xl transition-all duration-150 ${activeIdx === i ? color.active + " scale-95" : color.bg} ${phase === "input" ? "cursor-pointer hover:scale-[1.02]" : ""}`}
            onClick={() => handlePress(i)}
          />
        ))}
      </div>

      {phase === "showing" && <p className="text-sm text-stone-600">观察序列...</p>}
      {phase === "input" && <p className="text-sm text-stone-600">你的回合！重复序列</p>}
      {phase === "gameover" && (
        <div className="glass-panel fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
          <p className="font-display text-3xl text-stone-900">游戏结束</p>
          <p className="mt-2 text-sm text-stone-600">到达第 {level} 关</p>
          <button onClick={start} className="mt-4 glass-panel rounded-xl px-6 py-2 text-sm text-stone-700">再来一局</button>
        </div>
      )}
      {phase === "idle" && (
        <div className="glass-panel fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
          <p className="font-display text-3xl text-stone-900">Simon Says</p>
          <p className="mt-2 text-sm text-stone-600">记住颜色序列并重复</p>
          <button onClick={start} className="mt-4 glass-panel rounded-xl px-6 py-2 text-sm text-stone-700">开始游戏</button>
        </div>
      )}
    </div>
  );
}
