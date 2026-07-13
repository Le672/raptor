import { useState, useCallback } from "react";

const EMOJIS = ["", "🐶", "", "🦊", "", "🐼", "", "🦁"];
const PAIRS = 8;
const TOTAL = PAIRS * 2;

type Card = { id: number; emoji: string; flipped: boolean; matched: boolean };

function shuffle(): Card[] {
  const cards = [...EMOJIS, ...EMOJIS].map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }));
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}

export default function GameMemory() {
  const [cards, setCards] = useState<Card[]>(shuffle);
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("bestMemory") || 0));
  const [won, setWon] = useState(false);
  const [timer, setTimer] = useState(0);
  const [started, setStarted] = useState(false);

  const reset = useCallback(() => { setCards(shuffle()); setSelected([]); setMoves(0); setWon(false); setTimer(0); setStarted(false); }, []);

  useState(() => {
    if (started && !won) { const t = setInterval(() => setTimer((s) => s + 1), 1000); return () => clearInterval(t); }
  });

  const handleClick = useCallback((id: number) => {
    if (!started) setStarted(true);
    if (selected.length >= 2) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.flipped || card.matched) return;

    const newCards = cards.map((c) => c.id === id ? { ...c, flipped: true } : c);
    setCards(newCards);
    const newSelected = [...selected, id];
    setSelected(newSelected);

    if (newSelected.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = newSelected;
      const ca = newCards.find((c) => c.id === a)!;
      const cb = newCards.find((c) => c.id === b)!;
      if (ca.emoji === cb.emoji) {
        setTimeout(() => {
          setCards((prev) => prev.map((c) => c.id === a || c.id === b ? { ...c, matched: true } : c));
          setSelected([]);
          const allMatched = newCards.every((c) => c.matched || c.id === a || c.id === b);
          if (allMatched) { setWon(true); setBest((b2) => { const nb = Math.max(b2, moves + 1); localStorage.setItem("bestMemory", String(nb)); return nb; }); }
        }, 500);
      } else {
        setTimeout(() => {
          setCards((prev) => prev.map((c) => c.id === a || c.id === b ? { ...c, flipped: false } : c));
          setSelected([]);
        }, 800);
      }
    }
  }, [cards, selected, started, moves]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between">
        <div className="flex gap-4">
          <div className="glass-panel rounded-xl px-4 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-stone-500">步数</p>
            <p className="font-display text-xl text-stone-900">{moves}</p>
          </div>
          <div className="glass-panel rounded-xl px-4 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-stone-500">时间</p>
            <p className="font-display text-xl text-stone-900">{timer}s</p>
          </div>
        </div>
        <button onClick={reset} className="glass-panel rounded-xl px-4 py-2 text-sm text-stone-700">
          新游戏
        </button>
      </div>

      <div className="glass-panel grid grid-cols-4 gap-2 rounded-2xl p-3" style={{ width: "min(85vw, 360px)" }}>
        {cards.map((card) => (
          <button
            key={card.id}
            className={`aspect-square rounded-xl text-2xl font-bold transition-all duration-300 ${
              card.flipped || card.matched ? "bg-white/40 scale-95" : "bg-white/20 hover:bg-white/30"
            } ${card.matched ? "opacity-60" : ""}`}
            onClick={() => handleClick(card.id)}
          >
            {card.flipped || card.matched ? card.emoji : "?"}
          </button>
        ))}
      </div>

      {won && (
        <div className="glass-panel fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
          <p className="font-display text-3xl text-stone-900">恭喜通关！</p>
          <p className="mt-2 text-sm text-stone-600">步数：{moves} | 用时：{timer}秒</p>
          <button onClick={reset} className="mt-4 glass-panel rounded-xl px-6 py-2 text-sm text-stone-700">再来一局</button>
        </div>
      )}
      <p className="text-xs text-stone-500">点击卡片翻转，找到所有配对</p>
    </div>
  );
}
