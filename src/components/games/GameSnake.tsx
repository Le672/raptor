import { useState, useEffect, useCallback, useRef } from "react";

type Point = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";

const COLS = 20;
const ROWS = 20;
const SPEED_INIT = 150;
const SPEED_MIN = 60;

function randomFood(snake: Point[]): Point {
  let p: Point;
  do { p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
  while (snake.some((s) => s.x === p.x && s.y === p.y));
  return p;
}

export default function GameSnake() {
  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [dir, setDir] = useState<Dir>("right");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("bestSnake") || 0));
  const [gameOver, setGameOver] = useState(false);
  const [running, setRunning] = useState(false);
  const dirRef = useRef(dir);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  dirRef.current = dir;

  const reset = useCallback(() => {
    const s = [{ x: 10, y: 10 }];
    setSnake(s);
    setFood(randomFood(s));
    setDir("right");
    setScore(0);
    setGameOver(false);
    setRunning(true);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
      const d = map[e.key];
      if (!d) return;
      e.preventDefault();
      const opp: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
      if (opp[d] !== dirRef.current) setDir(d);
      if (!running && !gameOver) setRunning(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [running, gameOver]);

  useEffect(() => {
    if (!running || gameOver) return;
    const speed = Math.max(SPEED_MIN, SPEED_INIT - score * 3);
    const timer = setInterval(() => {
      setSnake((prev) => {
        const head = { ...prev[0] };
        const d = dirRef.current;
        if (d === "up") head.y--;
        if (d === "down") head.y++;
        if (d === "left") head.x--;
        if (d === "right") head.x++;
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || prev.some((s) => s.x === head.x && s.y === head.y)) {
          setGameOver(true);
          setRunning(false);
          return prev;
        }
        const next = [head, ...prev];
        if (head.x === food.x && head.y === food.y) {
          setScore((s) => { const ns = s + 10; setBest((b) => { const nb = Math.max(b, ns); localStorage.setItem("bestSnake", String(nb)); return nb; }); return ns; });
          setFood(randomFood(next));
        } else { next.pop(); }
        return next;
      });
    }, speed);
    return () => clearInterval(timer);
  }, [running, gameOver, food, score]);

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

      <div
        className="glass-panel relative grid rounded-2xl p-2"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, aspectRatio: "1", width: "min(80vw, 400px)" }}
        onTouchStart={(e) => { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          if (!touchRef.current) return;
          const dx = e.changedTouches[0].clientX - touchRef.current.x;
          const dy = e.changedTouches[0].clientY - touchRef.current.y;
          const opp: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
          let d: Dir;
          if (Math.abs(dx) > Math.abs(dy)) d = dx > 0 ? "right" : "left";
          else d = dy > 0 ? "down" : "up";
          if (opp[d] !== dirRef.current) setDir(d);
          if (!running && !gameOver) setRunning(true);
          touchRef.current = null;
        }}
      >
        {Array.from({ length: ROWS * COLS }).map((_, i) => {
          const x = i % COLS;
          const y = Math.floor(i / COLS);
          const isSnake = snake.some((s) => s.x === x && s.y === y);
          const isHead = snake[0]?.x === x && snake[0]?.y === y;
          const isFood = food.x === x && food.y === y;
          return (
            <div
              key={i}
              className={`aspect-square rounded-[2px] ${
                isHead ? "bg-emerald-500/80" : isSnake ? "bg-emerald-400/60" : isFood ? "bg-red-400/80 rounded-full" : "bg-white/5"
              }`}
            />
          );
        })}
        {(gameOver || (!running && !gameOver && snake.length === 1 && score === 0)) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/60 backdrop-blur-sm">
            <p className="font-display text-2xl text-stone-900">{gameOver ? "游戏结束" : "贪吃蛇"}</p>
            {gameOver && <p className="mt-1 text-sm text-stone-600">得分：{score}</p>}
            <button onClick={reset} className="mt-3 glass-panel rounded-xl px-6 py-2 text-sm text-stone-700">
              {gameOver ? "再来一局" : "开始游戏"}
            </button>
          </div>
        )}
      </div>
      <p className="text-xs text-stone-500">方向键 / 滑动屏幕操作</p>
    </div>
  );
}
