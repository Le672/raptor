import { useCallback, useEffect, useRef, useState } from "react";
import { readScore, writeScore } from "@/lib/game-storage";
const colors = [{ name: "红色", background: "#e87876", tone: 261.63 }, { name: "蓝色", background: "#78a9df", tone: 329.63 }, { name: "绿色", background: "#7cb68e", tone: 392 }, { name: "黄色", background: "#e7c666", tone: 523.25 }];
type Phase = "idle" | "showing" | "input" | "gameover";
export default function GameSimon() {
  const [sequence, setSequence] = useState<number[]>([]), [pressed, setPressed] = useState<number[]>([]), [active, setActive] = useState(-1), [phase, setPhase] = useState<Phase>("idle"), [best, setBest] = useState(() => readScore("bestSimon")), [sound, setSound] = useState(true);
  const audio = useRef<AudioContext | null>(null), run = useRef(0);
  const tone = useCallback((index: number) => {
    if (!sound) return;
    try {
      audio.current ??= new AudioContext();
      const context = audio.current; if (context.state === "suspended") void context.resume().catch(() => {});
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.connect(gain); gain.connect(context.destination); oscillator.frequency.value = colors[index].tone; gain.gain.value = .12;
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); }; oscillator.start(); oscillator.stop(context.currentTime + .22);
    } catch { setSound(false); }
  }, [sound]);
  useEffect(() => () => { run.current++; void audio.current?.close().catch(() => {}); audio.current = null; }, []);
  useEffect(() => {
    if (phase !== "showing") return;
    const identity = ++run.current, timers: ReturnType<typeof setTimeout>[] = [];
    setPressed([]); setActive(-1);
    sequence.forEach((value, index) => {
      timers.push(setTimeout(() => { if (identity === run.current) { setActive(value); tone(value); } }, 500 + index * 800));
      timers.push(setTimeout(() => { if (identity === run.current) setActive(-1); }, 850 + index * 800));
    });
    timers.push(setTimeout(() => { if (identity === run.current) setPhase("input"); }, 500 + sequence.length * 800));
    return () => { run.current++; timers.forEach(clearTimeout); };
  }, [phase, sequence, tone]);
  useEffect(() => { if (phase !== "input" || active < 0) return; const timer = setTimeout(() => setActive(-1), 180); return () => clearTimeout(timer); }, [active, phase, pressed]);
  const start = () => { run.current++; setSequence([Math.floor(Math.random() * 4)]); setPressed([]); setPhase("showing"); };
  const press = (value: number) => {
    if (phase !== "input") return;
    tone(value); setActive(value);
    const next = [...pressed, value]; setPressed(next);
    if (sequence[next.length - 1] !== value) { const score = sequence.length - 1; setBest(current => Math.max(current, score)); writeScore("bestSimon", Math.max(best, score)); setPhase("gameover"); return; }
    if (next.length === sequence.length) { setBest(current => Math.max(current, sequence.length)); writeScore("bestSimon", Math.max(best, sequence.length)); setSequence(current => [...current, Math.floor(Math.random() * 4)]); setPhase("showing"); }
  };
  return <div className="game-space"><div className="game-stats"><div><span>关卡</span><strong>{sequence.length}</strong></div><div><span>最佳完成关卡</span><strong>{best}</strong></div></div><div className="game-actions"><button type="button" className="game-button" onClick={start}>{phase === "idle" ? "开始游戏" : "重置游戏"}</button><button type="button" className="game-button" aria-pressed={sound} onClick={() => setSound(value => !value)}>{sound ? "声音开" : "声音关"}</button></div><div className="mx-auto grid w-full max-w-[300px] grid-cols-2 gap-3" role="group" aria-label="Simon 颜色按钮">{colors.map((color, index) => <button key={color.name} type="button" disabled={phase !== "input"} aria-label={color.name} className="aspect-square rounded-2xl text-sm font-medium text-stone-800 transition-transform" style={{ background: color.background, opacity: active === index ? 1 : .62, transform: active === index ? "scale(.94)" : undefined, boxShadow: active === index ? "0 0 0 4px #fff" : undefined }} onClick={() => press(index)}>{color.name}</button>)}</div><p className="game-notice" role="status">{phase === "idle" ? "先开始游戏，观察颜色顺序，再依次重复。" : phase === "showing" ? "观察序列…" : phase === "input" ? "你的回合：" + pressed.length + " / " + sequence.length : "顺序不对，本轮结束。完成 " + Math.max(0, sequence.length - 1) + " 关，重新开始试试。"}{phase === "showing" && active >= 0 && <span className="sr-only">当前 {colors[active].name}</span>}</p><p className="game-help">支持点击、触屏或用 Tab 聚焦颜色后按 Enter。重置游戏会取消旧序列和定时器。</p></div>;
}
