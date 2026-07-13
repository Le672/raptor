import { useState, useEffect, useRef, useCallback } from "react";

const W = 320, H = 480;
const BIRD_SIZE = 20;
const PIPE_W = 50;
const GAP = 140;
const GRAVITY = 0.4;
const JUMP = -6.5;
const PIPE_SPEED = 2.5;

type Pipe = { x: number; gapY: number; scored: boolean };

export default function GameFlappy() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("bestFlappy") || 0));
  const [gameOver, setGameOver] = useState(false);
  const [running, setRunning] = useState(false);
  const stateRef = useRef({ birdY: H / 2, birdV: 0, pipes: [] as Pipe[], frame: 0, score: 0 });

  const reset = useCallback(() => {
    stateRef.current = { birdY: H / 2, birdV: 0, pipes: [], frame: 0, score: 0 };
    setScore(0);
    setGameOver(false);
    setRunning(true);
  }, []);

  const jump = useCallback(() => {
    if (gameOver) { reset(); return; }
    if (!running) { setRunning(true); return; }
    stateRef.current.birdV = JUMP;
  }, [gameOver, running, reset]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === " " || e.key === "ArrowUp") { e.preventDefault(); jump(); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [jump]);

  useEffect(() => {
    if (!running || gameOver) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const loop = () => {
      const s = stateRef.current;
      s.frame++;
      s.birdV += GRAVITY;
      s.birdY += s.birdV;

      if (s.frame % 90 === 0) {
        const gapY = 80 + Math.random() * (H - GAP - 160);
        s.pipes.push({ x: W, gapY, scored: false });
      }

      s.pipes.forEach((p) => { p.x -= PIPE_SPEED; if (!p.scored && p.x + PIPE_W < W / 2 - BIRD_SIZE) { p.scored = true; s.score++; setScore(s.score); } });
      s.pipes = s.pipes.filter((p) => p.x > -PIPE_W);

      const bx = W / 2 - BIRD_SIZE, by = s.birdY - BIRD_SIZE;
      let dead = s.birdY < 0 || s.birdY > H;
      for (const p of s.pipes) {
        if (bx + BIRD_SIZE * 2 > p.x && bx < p.x + PIPE_W) {
          if (by < p.gapY || by + BIRD_SIZE * 2 > p.gapY + GAP) dead = true;
        }
      }

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(100,200,255,0.3)";
      ctx.fillRect(0, 0, W, H);

      s.pipes.forEach((p) => {
        ctx.fillStyle = "rgba(80,180,80,0.6)";
        ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
        ctx.fillRect(p.x, p.gapY + GAP, PIPE_W, H - p.gapY - GAP);
      });

      ctx.fillStyle = "rgba(255,200,50,0.8)";
      ctx.beginPath();
      ctx.arc(W / 2, s.birdY, BIRD_SIZE, 0, Math.PI * 2);
      ctx.fill();

      if (dead) {
        setGameOver(true);
        setRunning(false);
        setBest((b) => { const nb = Math.max(b, s.score); localStorage.setItem("bestFlappy", String(nb)); return nb; });
        return;
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [running, gameOver]);

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

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="glass-panel rounded-2xl"
        style={{ width: "min(80vw, 320px)", height: "auto", aspectRatio: `${W}/${H}` }}
        onClick={jump}
        onTouchStart={(e) => { e.preventDefault(); jump(); }}
      />

      {(!running && !gameOver) && (
        <div className="glass-panel fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
          <p className="font-display text-3xl text-stone-900">Flappy Bird</p>
          <p className="mt-2 text-sm text-stone-600">点击或按空格跳跃</p>
          <button onClick={reset} className="mt-4 glass-panel rounded-xl px-6 py-2 text-sm text-stone-700">开始游戏</button>
        </div>
      )}
      {gameOver && (
        <div className="glass-panel fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
          <p className="font-display text-3xl text-stone-900">游戏结束</p>
          <p className="mt-2 text-sm text-stone-600">得分：{score}</p>
          <button onClick={reset} className="mt-4 glass-panel rounded-xl px-6 py-2 text-sm text-stone-700">再来一局</button>
        </div>
      )}
      <p className="text-xs text-stone-500">空格 / 点击屏幕跳跃</p>
    </div>
  );
}
