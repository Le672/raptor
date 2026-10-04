import { useState } from "react";
import { makeLights, toggleLights } from "@/lib/game-engines";
import { GameNotice, GameStats, gameButton, useGameBest } from "./GameKit";

export default function GameLights() {
  const [size, setSize] = useState(5); const [puzzle, setPuzzle] = useState(() => makeLights());
  const [board, setBoard] = useState(puzzle.board); const [moves, setMoves] = useState(0); const [toggled, setToggled] = useState<number[]>([]);
  const [hint, setHint] = useState(-1); const smallBest = useGameBest("lights-3", true); const largeBest = useGameBest("lights-5", true); const { best, record } = size === 3 ? smallBest : largeBest;
  const won = board.every((n) => !n);
  const reset = (width = size) => { const next = makeLights(width); setPuzzle(next); setBoard(next.board); setMoves(0); setToggled([]); setHint(-1); };
  const remaining = [...new Set([...puzzle.solution, ...toggled])].filter((i) => puzzle.solution.includes(i) !== toggled.includes(i));
  return <div className="game-space">
    <div className="game-actions"><label>棋盘 <select value={size} onChange={(event) => { const width = Number(event.target.value); setSize(width); reset(width); }}><option value={3}>3 × 3</option><option value={5}>5 × 5</option></select></label><button className={gameButton} onClick={() => reset()}>新游戏</button></div>
    <GameStats values={[["操作次数", moves], ["亮灯", board.filter(Boolean).length], ["最少步数（含提示）", best || "—"]]} />
    <div className="game-grid lights-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }} role="group" aria-label="关灯棋盘">
      {board.map((light, index) => <button key={index} disabled={won} className={`light-cell ${light ? "lit" : ""} ${index === hint ? "hint" : ""}`} aria-label={`第 ${Math.floor(index / size) + 1} 行第 ${index % size + 1} 列，${light ? "亮" : "暗"}`} onClick={() => {
        const next = toggleLights(board, index, size); setBoard(next); setMoves((n) => n + 1); setHint(-1); setToggled((previous) => previous.includes(index) ? previous.filter((n) => n !== index) : [...previous, index]); if (next.every((n) => !n)) record(moves + 1);
      }}>{light ? "✦" : "·"}</button>)}
    </div>
    <div className="game-actions"><button className={gameButton} disabled={won} onClick={() => setHint(remaining[0] ?? -1)}>提示下一步</button></div>
    {won && <GameNotice>全部关灯成功！共操作 {moves} 次。</GameNotice>}
    <p className="game-help">点击一盏灯，会同时切换它和上下左右相邻的灯。所有题目都由可解操作生成；提示给出一种解法，不保证最少步数。</p>
  </div>;
}
