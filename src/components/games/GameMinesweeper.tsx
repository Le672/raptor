import { useState, useCallback } from "react";

const SIZE = 9;
const MINES = 10;

type Cell = { mine: boolean; revealed: boolean; flagged: boolean; adjacent: number };

function createBoard(firstClick: number): Cell[][] {
  const board: Cell[][] = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 })),
  );
  let placed = 0;
  while (placed < MINES) {
    const i = Math.floor(Math.random() * SIZE * SIZE);
    if (i === firstClick || board[Math.floor(i / SIZE)][i % SIZE].mine) continue;
    board[Math.floor(i / SIZE)][i % SIZE].mine = true;
    placed++;
  }
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!board[r][c].mine) {
        let count = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc].mine) count++;
          }
        board[r][c].adjacent = count;
      }
  return board;
}

function floodFill(board: Cell[][], r: number, c: number): Cell[][] {
  const b = board.map((row) => row.map((cell) => ({ ...cell })));
  const stack: [number, number][] = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop()!;
    if (cr < 0 || cr >= SIZE || cc < 0 || cc >= SIZE) continue;
    if (b[cr][cc].revealed || b[cr][cc].flagged) continue;
    b[cr][cc].revealed = true;
    if (b[cr][cc].adjacent === 0 && !b[cr][cc].mine)
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (dr !== 0 || dc !== 0) stack.push([cr + dr, cc + dc]);
  }
  return b;
}

const NUM_COLORS = ["", "text-blue-600", "text-green-600", "text-red-600", "text-purple-600", "text-amber-700", "text-teal-600", "text-stone-800", "text-stone-500"];

export default function GameMinesweeper() {
  const [board, setBoard] = useState<Cell[][] | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const [timer, setTimer] = useState(0);
  const [started, setStarted] = useState(false);

  const reset = useCallback(() => { setBoard(null); setGameOver(false); setWon(false); setTimer(0); setStarted(false); }, []);

  const handleClick = useCallback((r: number, c: number) => {
    if (gameOver || won) return;
    let b = board;
    if (!b) { b = createBoard(r * SIZE + c); setStarted(true); }
    const cell = b[r][c];
    if (cell.revealed || cell.flagged) return;
    if (flagMode) {
      const nb = b.map((row) => row.map((cell) => ({ ...cell })));
      nb[r][c].flagged = !nb[r][c].flagged;
      setBoard(nb);
      return;
    }
    if (cell.mine) {
      const nb = b.map((row) => row.map((cell) => ({ ...cell, revealed: cell.mine })));
      setBoard(nb);
      setGameOver(true);
      return;
    }
    const nb = floodFill(b, r, c);
    setBoard(nb);
    const unrevealed = nb.flat().filter((c) => !c.revealed && !c.mine).length;
    if (unrevealed === 0) setWon(true);
  }, [board, gameOver, won, flagMode]);

  const handleRightClick = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (gameOver || won || !board) return;
    const nb = board.map((row) => row.map((cell) => ({ ...cell })));
    if (!nb[r][c].revealed) nb[r][c].flagged = !nb[r][c].flagged;
    setBoard(nb);
  }, [board, gameOver, won]);

  useState(() => {
    if (started && !gameOver && !won) {
      const t = setInterval(() => setTimer((s) => s + 1), 1000);
      return () => clearInterval(t);
    }
  });

  const flags = board?.flat().filter((c) => c.flagged).length || 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between">
        <div className="flex gap-4">
          <div className="glass-panel rounded-xl px-4 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-stone-500">时间</p>
            <p className="font-display text-xl text-stone-900">{timer}s</p>
          </div>
          <div className="glass-panel rounded-xl px-4 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-stone-500">旗帜</p>
            <p className="font-display text-xl text-stone-900">{flags}/{MINES}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFlagMode(!flagMode)} className={`glass-panel rounded-xl px-3 py-2 text-sm ${flagMode ? "bg-amber-200/40" : ""}`}>
            {flagMode ? "🚩 标记中" : "🚩 标记"}
          </button>
          <button onClick={reset} className="glass-panel rounded-xl px-4 py-2 text-sm text-stone-700">
            新游戏
          </button>
        </div>
      </div>

      <div className="glass-panel grid gap-[2px] rounded-2xl p-2" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, width: "min(80vw, 360px)" }}>
        {Array.from({ length: SIZE * SIZE }).map((_, i) => {
          const r = Math.floor(i / SIZE), c = i % SIZE;
          const cell = board?.[r]?.[c];
          const isRevealed = cell?.revealed;
          const isFlagged = cell?.flagged;
          const isMine = cell?.mine;
          return (
            <button
              key={i}
              className={`aspect-square rounded-md text-xs font-bold transition ${
                isRevealed
                  ? isMine ? "bg-red-400/60" : "bg-white/20"
                  : "bg-white/30 hover:bg-white/40"
              }`}
              onClick={() => handleClick(r, c)}
              onContextMenu={(e) => handleRightClick(e, r, c)}
            >
              {isFlagged && !isRevealed ? "🚩" : isRevealed && isMine ? "💣" : isRevealed && cell!.adjacent > 0 ? <span className={NUM_COLORS[cell!.adjacent]}>{cell!.adjacent}</span> : ""}
            </button>
          );
        })}
      </div>

      {(gameOver || won) && board && (
        <div className="glass-panel fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
          <p className="font-display text-3xl text-stone-900">{won ? "你赢了！" : "踩到雷了！"}</p>
          {won && <p className="mt-2 text-sm text-stone-600">用时：{timer}秒</p>}
          <button onClick={reset} className="mt-4 glass-panel rounded-xl px-6 py-2 text-sm text-stone-700">再来一局</button>
        </div>
      )}
      <p className="text-xs text-stone-500">左键揭开，右键/标记模式插旗</p>
    </div>
  );
}
