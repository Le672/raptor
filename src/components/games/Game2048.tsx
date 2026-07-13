import { useState, useEffect, useCallback, useRef } from "react";

type Cell = { value: number; isNew: boolean; isMerged: boolean };
type Grid = Cell[][];
type Dir = "up" | "down" | "left" | "right";

const SIZE = 4;

function createEmpty(): Grid {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => ({ value: 0, isNew: false, isMerged: false })),
  );
}

function addRandom(grid: Grid): Grid {
  const empty: [number, number][] = [];
  grid.forEach((row, r) => row.forEach((c, col) => { if (c.value === 0) empty.push([r, col]); }));
  if (empty.length === 0) return grid;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  return grid.map((row, ri) => row.map((cell, ci) =>
    ri === r && ci === c ? { value: Math.random() < 0.9 ? 2 : 4, isNew: true, isMerged: false } : { ...cell, isNew: false, isMerged: false },
  ));
}

function rotateGrid(grid: Grid, times: number): Grid {
  let g = grid;
  for (let t = 0; t < times; t++) {
    const n = createEmpty();
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        n[c][SIZE - 1 - r] = g[r][c];
    g = n;
  }
  return g;
}

function slideLeft(grid: Grid): { grid: Grid; score: number; moved: boolean } {
  let score = 0;
  let moved = false;
  const result = grid.map((row) => {
    const vals = row.map((c) => c.value).filter((v) => v !== 0);
    const merged: number[] = [];
    let i = 0;
    while (i < vals.length) {
      if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
        merged.push(vals[i] * 2);
        score += vals[i] * 2;
        i += 2;
      } else {
        merged.push(vals[i]);
        i++;
      }
    }
    while (merged.length < SIZE) merged.push(0);
    return merged.map((v, idx) => ({
      value: v,
      isNew: false,
      isMerged: v !== 0 && v !== row[idx]?.value,
    }));
  });
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (result[r][c].value !== grid[r][c].value) moved = true;
  return { grid: result, score, moved };
}

function move(grid: Grid, dir: Dir): { grid: Grid; score: number; moved: boolean } {
  const rotations: Record<Dir, number> = { left: 0, down: 1, right: 2, up: 3 };
  const rot = rotations[dir];
  const rotated = rotateGrid(grid, rot);
  const { grid: slid, score, moved } = slideLeft(rotated);
  return { grid: rotateGrid(slid, (4 - rot) % 4), score, moved };
}

function isGameOver(grid: Grid): boolean {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c].value === 0) return false;
      if (c + 1 < SIZE && grid[r][c].value === grid[r][c + 1].value) return false;
      if (r + 1 < SIZE && grid[r][c].value === grid[r + 1][c].value) return false;
    }
  return true;
}

function hasWon(grid: Grid): boolean {
  return grid.some((row) => row.some((c) => c.value >= 2048));
}

const TILE_COLORS: Record<number, string> = {
  0: "bg-white/10",
  2: "bg-white/40 text-stone-700",
  4: "bg-white/50 text-stone-700",
  8: "bg-amber-200/60 text-white",
  16: "bg-amber-300/60 text-white",
  32: "bg-orange-300/60 text-white",
  64: "bg-orange-400/60 text-white",
  128: "bg-yellow-300/60 text-stone-800",
  256: "bg-yellow-400/60 text-stone-800",
  512: "bg-yellow-500/60 text-white",
  1024: "bg-amber-500/60 text-white",
  2048: "bg-amber-600/60 text-white",
};

export default function Game2048() {
  const [grid, setGrid] = useState<Grid>(() => addRandom(addRandom(createEmpty())));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("best2048") || 0));
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const handleMove = useCallback(
    (dir: Dir) => {
      if (gameOver) return;
      const { grid: newGrid, score: gained, moved } = move(grid, dir);
      if (!moved) return;
      const withNew = addRandom(newGrid);
      setGrid(withNew);
      const newScore = score + gained;
      setScore(newScore);
      if (newScore > best) { setBest(newScore); localStorage.setItem("best2048", String(newScore)); }
      if (hasWon(withNew) && !won) setWon(true);
      if (isGameOver(withNew)) setGameOver(true);
    },
    [grid, score, best, gameOver, won],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
      if (map[e.key]) { e.preventDefault(); handleMove(map[e.key]); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleMove]);

  const reset = () => { setGrid(addRandom(addRandom(createEmpty()))); setScore(0); setGameOver(false); setWon(false); };

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
        <button onClick={reset} className="glass-panel rounded-xl px-4 py-2 text-sm text-stone-700 transition hover:text-stone-900">
          新游戏
        </button>
      </div>

      <div
        className="glass-panel relative grid grid-cols-4 gap-2 rounded-2xl p-3"
        onTouchStart={(e) => { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          if (!touchRef.current) return;
          const dx = e.changedTouches[0].clientX - touchRef.current.x;
          const dy = e.changedTouches[0].clientY - touchRef.current.y;
          if (Math.abs(dx) > Math.abs(dy)) handleMove(dx > 0 ? "right" : "left");
          else handleMove(dy > 0 ? "down" : "up");
          touchRef.current = null;
        }}
      >
        {grid.flat().map((cell, i) => (
          <div
            key={i}
            className={`flex aspect-square items-center justify-center rounded-xl font-display text-lg font-bold transition-all duration-100 ${
              TILE_COLORS[cell.value] || "bg-amber-700/60 text-white"
            } ${cell.isNew ? "animate-[pop_0.2s_ease-out]" : ""}`}
          >
            {cell.value > 0 ? cell.value : ""}
          </div>
        ))}
        {(gameOver || won) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/60 backdrop-blur-sm">
            <p className="font-display text-3xl text-stone-900">{won ? "你赢了！" : "游戏结束"}</p>
            <p className="mt-2 text-sm text-stone-600">最终得分：{score}</p>
            <button onClick={reset} className="mt-4 glass-panel rounded-xl px-6 py-2 text-sm text-stone-700">
              再来一局
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-stone-500">方向键 / 滑动屏幕操作</p>
    </div>
  );
}
