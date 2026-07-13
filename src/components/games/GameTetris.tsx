import { useState, useEffect, useCallback, useRef } from "react";

const COLS = 10;
const ROWS = 20;
const SHAPES: number[][][] = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
  [[1, 1, 0], [0, 1, 1]],
];
const COLORS = ["bg-cyan-400/70", "bg-yellow-400/70", "bg-purple-400/70", "bg-blue-400/70", "bg-orange-400/70", "bg-green-400/70", "bg-red-400/70"];

type Board = (number | null)[][];

function createBoard(): Board { return Array.from({ length: ROWS }, () => Array(COLS).fill(null)); }

function randomPiece() {
  const i = Math.floor(Math.random() * SHAPES.length);
  return { shape: SHAPES[i], color: COLORS[i], x: Math.floor(COLS / 2) - 1, y: 0 };
}

function rotate(shape: number[][]): number[][] {
  const rows = shape.length, cols = shape[0].length;
  return Array.from({ length: cols }, (_, c) => Array.from({ length: rows }, (_, r) => shape[rows - 1 - r][c]));
}

function collides(board: Board, shape: number[][], px: number, py: number): boolean {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        const nx = px + c, ny = py + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx] !== null) return true;
      }
  return false;
}

export default function GameTetris() {
  const [board, setBoard] = useState<Board>(createBoard);
  const [piece, setPiece] = useState(randomPiece);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("bestTetris") || 0));
  const [gameOver, setGameOver] = useState(false);
  const [running, setRunning] = useState(false);
  const boardRef = useRef(board);
  const pieceRef = useRef(piece);
  boardRef.current = board;
  pieceRef.current = piece;

  const lock = useCallback(() => {
    const b = boardRef.current.map((r) => [...r]);
    const p = pieceRef.current;
    for (let r = 0; r < p.shape.length; r++)
      for (let c = 0; c < p.shape[r].length; c++)
        if (p.shape[r][c]) { const ny = p.y + r; if (ny >= 0 && ny < ROWS) b[ny][p.x + c] = SHAPES.indexOf(p.shape); }
    const cleared: number[] = [];
    b.forEach((row, i) => { if (row.every((c) => c !== null)) cleared.push(i); });
    cleared.forEach((i) => b.splice(i, 1));
    while (b.length < ROWS) b.unshift(Array(COLS).fill(null));
    const lines = cleared.length;
    const pts = [0, 100, 300, 500, 800][lines] || 0;
    setScore((s) => { const ns = s + pts; setBest((b2) => { const nb = Math.max(b2, ns); localStorage.setItem("bestTetris", String(nb)); return nb; }); return ns; });
    setBoard(b);
    const next = randomPiece();
    if (collides(b, next.shape, next.x, next.y)) { setGameOver(true); setRunning(false); }
    else setPiece(next);
  }, []);

  const moveDown = useCallback(() => {
    const p = pieceRef.current;
    if (!collides(boardRef.current, p.shape, p.x, p.y + 1)) setPiece({ ...p, y: p.y + 1 });
    else lock();
  }, [lock]);

  const moveLeft = useCallback(() => { const p = pieceRef.current; if (!collides(boardRef.current, p.shape, p.x - 1, p.y)) setPiece({ ...p, x: p.x - 1 }); }, []);
  const moveRight = useCallback(() => { const p = pieceRef.current; if (!collides(boardRef.current, p.shape, p.x + 1, p.y)) setPiece({ ...p, x: p.x + 1 }); }, []);
  const rotatePiece = useCallback(() => {
    const p = pieceRef.current;
    const rotated = rotate(p.shape);
    if (!collides(boardRef.current, rotated, p.x, p.y)) setPiece({ ...p, shape: rotated });
  }, []);
  const hardDrop = useCallback(() => {
    const p = pieceRef.current;
    let dy = 0;
    while (!collides(boardRef.current, p.shape, p.x, p.y + dy + 1)) dy++;
    setPiece({ ...p, y: p.y + dy });
    setTimeout(lock, 0);
  }, [lock]);

  const reset = useCallback(() => { setBoard(createBoard()); setPiece(randomPiece()); setScore(0); setGameOver(false); setRunning(true); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!running) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); moveLeft(); }
      if (e.key === "ArrowRight") { e.preventDefault(); moveRight(); }
      if (e.key === "ArrowDown") { e.preventDefault(); moveDown(); }
      if (e.key === "ArrowUp") { e.preventDefault(); rotatePiece(); }
      if (e.key === " ") { e.preventDefault(); hardDrop(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [running, moveLeft, moveRight, moveDown, rotatePiece, hardDrop]);

  useEffect(() => {
    if (!running || gameOver) return;
    const timer = setInterval(moveDown, Math.max(100, 500 - score));
    return () => clearInterval(timer);
  }, [running, gameOver, moveDown, score]);

  const display = board.map((r) => [...r]);
  piece.shape.forEach((row, r) => row.forEach((v, c) => { if (v) { const y = piece.y + r; if (y >= 0 && y < ROWS) display[y][piece.x + c] = SHAPES.indexOf(piece.shape); } }));

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between">
        <div className="flex gap-4">
          <div className="glass-panel rounded-xl px-4 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-stone-500">分数</p>
            <p className="font-display text-xl text-stone-900">{score}</p>
          </div>
          <div className="glass-panel rounded-xl px-4 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-stone-500">最佳</p>
            <p className="font-display text-xl text-stone-900">{best}</p>
          </div>
        </div>
        <button onClick={reset} className="glass-panel rounded-xl px-4 py-2 text-sm text-stone-700">
          {gameOver ? "重新开始" : running ? "重置" : "开始"}
        </button>
      </div>

      <div className="glass-panel relative grid rounded-2xl p-1" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, width: "min(60vw, 250px)" }}>
        {display.flat().map((cell, i) => (
          <div key={i} className={`aspect-square rounded-[2px] ${cell !== null ? COLORS[cell] : "bg-white/5"}`} />
        ))}
        {(gameOver || (!running && !gameOver && score === 0)) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/60 backdrop-blur-sm">
            <p className="font-display text-2xl text-stone-900">{gameOver ? "游戏结束" : "俄罗斯方块"}</p>
            {gameOver && <p className="mt-1 text-sm text-stone-600">得分：{score}</p>}
            <button onClick={reset} className="mt-3 glass-panel rounded-xl px-6 py-2 text-sm text-stone-700">
              {gameOver ? "再来一局" : "开始游戏"}
            </button>
          </div>
        )}
      </div>
      <p className="text-xs text-stone-500">方向键移动/旋转，空格硬降</p>
    </div>
  );
}
