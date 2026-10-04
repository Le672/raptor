import { useEffect, useRef, useState } from "react";
import { GameStats, gameButton, useGameBest } from "./GameKit";

export default function GameReaction() {
  const [phase, setPhase] = useState<"idle" | "waiting" | "ready" | "early" | "result">("idle");
  const [times, setTimes] = useState<number[]>([]); const started = useRef(0); const timer = useRef<ReturnType<typeof setTimeout>>(); const { best, record } = useGameBest("reaction", true);
  useEffect(() => () => clearTimeout(timer.current), []);
  const activate = () => {
    if (phase === "waiting") { clearTimeout(timer.current); setPhase("early"); }
    else if (phase === "ready") { const ms = Math.round(performance.now() - started.current); setTimes((previous) => [...previous.slice(-4), ms]); record(ms); setPhase("result"); }
    else { setPhase("waiting"); timer.current = setTimeout(() => { started.current = performance.now(); setPhase("ready"); }, 1500 + Math.random() * 3000); }
  };
  const labels = { idle: "点击开始", waiting: "等待变绿…", ready: "现在点击！", early: "太早了！点击重新开始", result: `${times[times.length - 1]} ms · 点击再试` };
  return <div className="game-space">
    <GameStats values={[["最近五次平均", times.length ? `${Math.round(times.reduce((a, b) => a + b, 0) / times.length)} ms` : "—"], ["最快", best ? `${best} ms` : "—"]]} />
    <button className={`reaction-pad phase-${phase}`} onClick={activate} onKeyDown={(event) => { if (event.repeat) event.preventDefault(); }} aria-live="polite">{labels[phase]}</button>
    {!!times.length && <p className="game-help">最近记录：{times.map((n) => `${n} ms`).join(" / ")}</p>}
    <button className={gameButton} onClick={() => { clearTimeout(timer.current); setPhase("idle"); setTimes([]); }}>重置本轮</button>
    <p className="game-help">红色时等待，变绿后尽快点击。也可聚焦按钮后使用空格或 Enter。结果包含设备和浏览器延迟，仅作娱乐参考。</p>
  </div>;
}
