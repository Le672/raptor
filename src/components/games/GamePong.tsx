import { useState, useEffect, useRef, useCallback } from "react";

const W = 400, H = 300;
const PADDLE_H = 60, PADDLE_W = 8;
const BALL_R = 6;
const WIN_SCORE = 5;

export default function GamePong() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState("");
  const [running, setRunning] = useState(false);
  const stateRef = useRef({
    playerY: H / 2 - PADDLE_H / 2,
    aiY: H / 2 - PADDLE_H / 2,
    ballX: W / 2, ballY: H / 2,
    ballDX: 3, ballDY: 2,
    playerScore: 0, aiScore: 0,
  });

  const reset = useCallback(() => {
    stateRef.current = { playerY: H / 2 - PADDLE_H / 2, aiY: H / 2 - PADDLE_H / 2, ballX: W / 2, ballY: H / 2, ballDX: 3, ballDY: 2, playerScore: 0, aiScore: 0 };
    setScore({ player: 0, ai: 0 });
    setGameOver(false);
    setWinner("");
    setRunning(true);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleY = H / rect.height;
      stateRef.current.playerY = Math.max(0, Math.min(H - PADDLE_H, (e.clientY - rect.top) * scaleY - PADDLE_H / 2));
    };
    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleY = H / rect.height;
      stateRef.current.playerY = Math.max(0, Math.min(H - PADDLE_H, (e.touches[0].clientY - rect.top) * scaleY - PADDLE_H / 2));
    };
    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("touchmove", handleTouch, { passive: false });
    return () => { canvas.removeEventListener("mousemove", handleMove); canvas.removeEventListener("touchmove", handleTouch); };
  }, []);

  useEffect(() => {
    if (!running || gameOver) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const loop = () => {
      const s = stateRef.current;
      s.ballX += s.ballDX;
      s.ballY += s.ballDY;

      if (s.ballY < BALL_R || s.ballY > H - BALL_R) s.ballDY = -s.ballDY;

      // AI
      const aiCenter = s.aiY + PADDLE_H / 2;
      if (aiCenter < s.ballY - 10) s.aiY = Math.min(H - PADDLE_H, s.aiY + 2.5);
      if (aiCenter > s.ballY + 10) s.aiY = Math.max(0, s.aiY - 2.5);

      // Paddle collision
      if (s.ballX - BALL_R < 20 + PADDLE_W && s.ballY > s.playerY && s.ballY < s.playerY + PADDLE_H && s.ballDX < 0) {
        s.ballDX = Math.abs(s.ballDX) * 1.05;
        s.ballDY += (s.ballY - s.playerY - PADDLE_H / 2) * 0.1;
      }
      if (s.ballX + BALL_R > W - 20 - PADDLE_W && s.ballY > s.aiY && s.ballY < s.aiY + PADDLE_H && s.ballDX > 0) {
        s.ballDX = -Math.abs(s.ballDX) * 1.05;
      }

      // Score
      if (s.ballX < 0) { s.aiScore++; setScore({ player: s.playerScore, ai: s.aiScore }); s.ballX = W / 2; s.ballY = H / 2; s.ballDX = 3; s.ballDY = 2; }
      if (s.ballX > W) { s.playerScore++; setScore({ player: s.playerScore, ai: s.aiScore }); s.ballX = W / 2; s.ballY = H / 2; s.ballDX = -3; s.ballDY = 2; }

      if (s.playerScore >= WIN_SCORE) { setWinner("你赢了！"); setGameOver(true); setRunning(false); return; }
      if (s.aiScore >= WIN_SCORE) { setWinner("AI 赢了"); setGameOver(true); setRunning(false); return; }

      ctx.clearRect(0, 0, W, H);
      // Center line
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);
      // Paddles
      ctx.fillStyle = "rgba(100,180,255,0.7)";
      ctx.fillRect(20, s.playerY, PADDLE_W, PADDLE_H);
      ctx.fillStyle = "rgba(255,100,100,0.7)";
      ctx.fillRect(W - 20 - PADDLE_W, s.aiY, PADDLE_W, PADDLE_H);
      // Ball
      ctx.beginPath();
      ctx.arc(s.ballX, s.ballY, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();

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
            <p className="text-[10px] uppercase tracking-wider text-stone-500">你</p>
            <p className="font-display text-xl text-blue-600">{score.player}</p>
          </div>
          <div className="glass-panel rounded-xl px-4 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-stone-500">AI</p>
            <p className="font-display text-xl text-red-600">{score.ai}</p>
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
        style={{ width: "min(90vw, 400px)", height: "auto", aspectRatio: `${W}/${H}` }}
      />

      {(gameOver || (!running && !gameOver && score.player === 0 && score.ai === 0)) && (
        <div className="glass-panel fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
          <p className="font-display text-3xl text-stone-900">{gameOver ? winner : "Pong"}</p>
          <p className="mt-2 text-sm text-stone-600">先得到 {WIN_SCORE} 分获胜</p>
          <button onClick={reset} className="mt-4 glass-panel rounded-xl px-6 py-2 text-sm text-stone-700">{gameOver ? "再来一局" : "开始游戏"}</button>
        </div>
      )}
      <p className="text-xs text-stone-500">鼠标/触摸上下移动挡板</p>
    </div>
  );
}
