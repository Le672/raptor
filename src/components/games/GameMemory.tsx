import { useEffect, useState } from "react";
import { shuffle } from "@/lib/game-engines";
import { GameNotice, GameStats, gameButton, useGameBest } from "./GameKit";

const emojis = ["🐱", "🐶", "🐰", "🦊", "🐨", "🐼", "🐸", "🦁"];
const makeCards = () => shuffle([...emojis, ...emojis]).map((emoji, id) => ({ id, emoji, matched: false }));
export default function GameMemory() {
  const [cards, setCards] = useState(makeCards); const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0); const [seconds, setSeconds] = useState(0); const [start, setStart] = useState(0);
  const { best, record } = useGameBest("memory", true); const won = cards.every((c) => c.matched);
  useEffect(() => { if (!start || won) return; const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 250); return () => clearInterval(timer); }, [start, won]);
  useEffect(() => {
    if (selected.length !== 2) return;
    setMoves((n) => n + 1);
    const [a, b] = selected; const match = cards[a].emoji === cards[b].emoji;
    const timer = setTimeout(() => { if (match) setCards((previous) => previous.map((c) => c.id === a || c.id === b ? { ...c, matched: true } : c)); setSelected([]); }, match ? 400 : 750);
    return () => clearTimeout(timer);
  }, [selected, cards]);
  useEffect(() => { if (won) record(moves); }, [won, moves, record]);
  return <div className="game-space">
    <GameStats values={[["步数", moves], ["用时", `${seconds}s`], ["最少步数", best || "—"]]} />
    <div className="game-grid memory-grid" role="group" aria-label="记忆翻牌区域">{cards.map((card) => {
      const open = selected.includes(card.id) || card.matched;
      return <button key={card.id} aria-label={`卡片 ${card.id + 1}，${open ? card.emoji : "未翻开"}${card.matched ? "，已配对" : ""}`} disabled={card.matched || selected.includes(card.id) || selected.length === 2} className={`memory-card ${open ? "is-open" : ""} ${card.matched ? "is-matched" : ""}`} onClick={() => { if (!start) setStart(Date.now()); setSelected((previous) => [...previous, card.id]); }}>{open ? card.emoji : "?"}</button>;
    })}</div>
    {won && <GameNotice>恭喜通关！步数：{moves}，用时：{seconds} 秒。</GameNotice>}
    <button className={gameButton} onClick={() => { setCards(makeCards()); setSelected([]); setMoves(0); setSeconds(0); setStart(0); }}>新游戏</button>
    <p className="game-help">每次翻开两张卡片，找到所有八组配对。最低步数为最佳成绩。</p>
  </div>;
}
