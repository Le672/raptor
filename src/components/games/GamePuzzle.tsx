import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { isPuzzleSolved, makePuzzle, puzzleNeighbors, seededRandom } from "@/lib/game-engines";
import { GameNotice, GameStats, gameButton, useGameBest } from "./GameKit";

export default function GamePuzzle() {
  const [params] = useSearchParams(); const daily = params.get("daily");
  const make = () => makePuzzle(daily ? seededRandom(`puzzle:${daily}`) : Math.random, 80);
  const [board, setBoard] = useState(make); const [history, setHistory] = useState<number[][]>([]);
  const [moves, setMoves] = useState(0); const [seconds, setSeconds] = useState(0); const [start, setStart] = useState(0);
  const won = isPuzzleSolved(board); const { best, record } = useGameBest("puzzle", true);
  useEffect(() => { if (!start || won) return; const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 250); return () => clearInterval(timer); }, [start, won]);
  useEffect(() => { if (won) record(moves); }, [won, moves, record]);
  const reset = () => { setBoard(make()); setHistory([]); setMoves(0); setSeconds(0); setStart(0); };
  const move = (index: number) => {
    if (won || !puzzleNeighbors(board.indexOf(0)).includes(index)) return;
    if (!start) setStart(Date.now());
    const next = [...board]; const blank = next.indexOf(0); [next[blank], next[index]] = [next[index], next[blank]];
    setHistory((previous) => [...previous, board]); setBoard(next); setMoves((n) => n + 1);
  };
  return <div className="game-space">
    <GameStats values={[["步数", moves], ["用时", `${seconds}s`], ["最少步数", best || "—"]]} />
    <div className="game-grid puzzle-grid" role="group" aria-label="数字华容道棋盘" tabIndex={0} onKeyDown={(event) => {
      const blank = board.indexOf(0); const targets: Record<string, number> = { ArrowUp: blank + 4, ArrowDown: blank - 4, ArrowLeft: blank % 4 < 3 ? blank + 1 : -1, ArrowRight: blank % 4 ? blank - 1 : -1 };
      if (event.key in targets) { event.preventDefault(); move(targets[event.key]); }
    }}>
      {board.map((value, index) => <button key={index} disabled={!value || won} className={value ? `puzzle-tile ${value === index + 1 ? "in-place" : ""}` : "puzzle-blank"} aria-label={value ? `移动数字 ${value}` : "空格"} onClick={() => move(index)}>{value || ""}</button>)}
    </div>
    {won && <GameNotice>归位成功！你用了 {moves} 步、{seconds} 秒。</GameNotice>}
    <div className="game-actions"><button className={gameButton} onClick={reset}>{daily ? "重新挑战" : "新游戏"}</button><button className={gameButton} disabled={!history.length || won} onClick={() => { setBoard(history[history.length - 1]); setHistory((previous) => previous.slice(0, -1)); setMoves((n) => n + 1); }}>撤销一步</button></div>
    <p className="game-help">点击空格旁的数字，或聚焦棋盘后用方向键移动数字。每次移动（含撤销）计一步。{daily && `每日题目：${daily}。`}</p>
  </div>;
}
