import { useState, useEffect, useRef, useCallback } from "react";

const W = 400, H = 500;
const PADDLE_W = 80, PADDLE_H = 12;
const BALL_R = 6;
const BRICK_ROWS = 6, BRICK_COLS = 8;
const BRICK_W = (W - 40) / BRICK_COLS, BRICK_H = 20;
const BRICK_COLORS = ["bg-red-400/70", "bg-orange-400/70", "bg-yellow-400/70", "bg-green-400/70", "bg-blue-400/70", "bg-purple-400/70"];

type Brick = { x: number; y: number; alive: boolean; color: string };
type Ball = { x: number; y: number; dx: number; dy: number };

export default function GameBreakout() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("bestBreakout") || 0));
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [running, setRunning] = useState(false);
  const stateRef = useRef({ paddleX: W / 2 - PADDLE_W / 2, ball: { x: W / 2, y: H - 60, dx: 3, dy: -3 } as Ball, bricks: [] as Brick[], score: 0 });

  const initBricks = useCallback(() => {
    const bricks: Brick[] = [];
    for (let r = 0; r < BRICK_ROWS; r++)
      for (let c = 0; c < BRICK_COLS; c++)
        bricks.push({ x: 20 + c * BRICK_W, y: 40 + r * (BRICK_H + 4), alive: true, color: BRICK_COLORS[r] });
    return bricks;
  }, []);

  const reset = useCallback(() => {
    stateRef.current = { paddleX: W / 2 - PADDLE_W / 2, ball: { x: W / 2, y: H - 60, dx: 3, dy: -3 }, bricks: initBricks(), score: 0 };
    setScore(0);
    setGameOver(false);
    setWon(false);
    setRunning(true);
  }, [initBricks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      stateRef.current.paddleX = Math.max(0, Math.min(W - PADDLE_W, (e.clientX - rect.left) * scaleX - PADDLE_W / 2));
    };
    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      stateRef.current.paddleX = Math.max(0, Math.min(W - PADDLE_W, (e.touches[0].clientX - rect.left) * scaleX - PADDLE_W / 2));
    };
    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("touchmove", handleTouch, { passive: false });
    return () => { canvas.removeEventListener("mousemove", handleMove); canvas.removeEventListener("touchmove", handleTouch); };
  }, []);

  useEffect(() => {
    if (!running || gameOver || won) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const loop = () => {
      const s = stateRef.current;
      const b = s.ball;
      b.x += b.dx;
      b.y += b.dy;

      if (b.x < BALL_R || b.x > W - BALL_R) b.dx = -b.dx;
      if (b.y < BALL_R) b.dy = -b.dy;
      if (b.y > H) { setGameOver(true); setRunning(false); setBest((best) => { const nb = Math.max(best, s.score); localStorage.setItem("bestBreakout", String(nb)); return nb; }); return; }

      if (b.y + BALL_R > H - 30 && b.y - BALL_R < H - 30 + PADDLE_H && b.x > s.paddleX && b.x < s.paddleX + PADDLE_W) {
        b.dy = -Math.abs(b.dy);
        b.dx = ((b.x - s.paddleX) / PADDLE_W - 0.5) * 6;
      }

      for (const brick of s.bricks) {
        if (!brick.alive) continue;
        if (b.x > brick.x && b.x < brick.x + BRICK_W && b.y > brick.y && b.y < brick.y + BRICK_H) {
          brick.alive = false;
          b.dy = -b.dy;
          s.score += 10;
          setScore(s.score);
          break;
        }
      }

      if (s.bricks.every((br) => !br.alive)) { setWon(true); setRunning(false); return; }

      ctx.clearRect(0, 0, W, H);
      s.bricks.forEach((brick) => {
        if (!brick.alive) return;
        ctx.fillStyle = "rgba(150,150,150,0.4)";
        ctx.fillRect(brick.x + 1, brick.y + 1, BRICK_W - 2, BRICK_H - 2);
      });
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(s.paddleX, H - 30, PADDLE_W, PADDLE_H);
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,200,50,0.9)";
      ctx.fill();

      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [running, gameOver, won]);

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
          {gameOver || won ? "重新开始" : running ? "重置" : "开始"}
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="glass-panel rounded-2xl"
        style={{ width: "min(85vw, 400px)", height: "auto", aspectRatio: `${W}/${H}` }}
      />

      {(gameOver || won) && (
        <div className="glass-panel fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
          <p className="font-display text-3xl text-stone-900">{won ? "你赢了！" : "游戏结束"}</p>
          <p className="mt-2 text-sm text-stone-600">得分：{score}</p>
          <button onClick={reset} className="mt-4 glass-panel rounded-xl px-6 py-2 text-sm text-stone-700">再来一局</button>
        </div>
      )}
      {!running && !gameOver && !won && (
        <div className="glass-panel fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
          <p className="font-display text-3xl text-stone-900">打砖块</p>
          <p className="mt-2 text-sm text-stone-600">移动鼠标/触摸控制挡板</p>
          <button onClick={reset} className="mt-4 glass-panel rounded-xl px-6 py-2 text-sm text-stone-700">开始游戏</button>
        </div>
      )}
      <p className="text-xs text-stone-500">鼠标/触摸移动挡板</p>
    </div>
  );
}
