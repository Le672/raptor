import { useCallback, useEffect, useRef, useState } from "react";
import { GameNotice, GameStats, gameButton, useGameBest } from "./GameKit";
import { ignoreGameKey } from "@/lib/game-keyboard";

export default function GameMole() {
  const [running, setRunning] = useState(false); const [score, setScore] = useState(0); const [target, setTarget] = useState(-1); const [remaining, setRemaining] = useState(30);
  const [finished, setFinished] = useState(false); const targetRef = useRef(-1); const scoreRef = useRef(0); const deadline = useRef(0);
  const { best, record } = useGameBest("mole");
  useEffect(() => {
    if (!running) return;
    const show = () => { const options = Array.from({ length: 9 }, (_, i) => i).filter((i) => i !== targetRef.current); const next = options[Math.floor(Math.random() * options.length)]; targetRef.current = next; setTarget(next); };
    show(); const spawn = setInterval(show, 680);
    const clock = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)); setRemaining(left);
      if (!left) { setRunning(false); targetRef.current = -1; setTarget(-1); setFinished(true); record(scoreRef.current); }
    }, 100);
    return () => { clearInterval(spawn); clearInterval(clock); };
  }, [running, record]);
  const hit = useCallback((index: number) => {
    if (!running || Date.now() >= deadline.current || targetRef.current !== index) return;
    targetRef.current = -1; setTarget(-1); scoreRef.current++; setScore(scoreRef.current);
  }, [running]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (/^[1-9]$/.test(event.key) && !event.repeat && !ignoreGameKey(event)) { event.preventDefault(); hit(Number(event.key) - 1); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [hit]);
  return <div className="game-space">
    <GameStats values={[["得分", score], ["剩余", `${remaining}s`], ["最高", best || "—"]]} />
    <div className="game-grid mole-grid" role="group" aria-label="打地鼠区域">{Array.from({ length: 9 }, (_, i) => <button key={i} disabled={!running} className={`mole-hole ${target === i ? "is-up" : ""}`} aria-label={`洞 ${i + 1}${target === i ? "，地鼠出现" : "，空"}`} onClick={() => hit(i)}><span>{target === i ? "🐹" : ""}</span><small>{i + 1}</small></button>)}</div>
    {finished && <GameNotice>挑战结束！你击中了 {score} 只地鼠。</GameNotice>}
    <button className={gameButton} disabled={running} onClick={() => { scoreRef.current = 0; setScore(0); setRemaining(30); setFinished(false); deadline.current = Date.now() + 30000; setRunning(true); }}>开始 30 秒挑战</button>
    <p className="game-help">点击冒出的地鼠，或按对应洞口的数字键 1–9。每只地鼠只计一次分。</p>
  </div>;
}
