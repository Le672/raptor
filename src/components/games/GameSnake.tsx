import { useCallback, useEffect, useRef, useState } from "react";
import { ignoreGameKey } from "@/lib/game-keyboard";
import { readScore, writeScore } from "@/lib/game-storage";
import { oppositeDirection, randomSnakeFood, stepSnake, type SnakePoint, type SnakeDirection } from "@/lib/snake";

export default function GameSnake() {
  const [snake, setSnake] = useState<SnakePoint[]>([{ x: 10, y: 10 }]), [food, setFood] = useState<SnakePoint | null>({ x: 5, y: 5 }), [score, setScore] = useState(0), [best, setBest] = useState(() => readScore("bestSnake"));
  const [running, setRunning] = useState(false), [over, setOver] = useState(false), [won, setWon] = useState(false);
  const body = useRef(snake), target = useRef(food), direction = useRef<SnakeDirection>("right"), queued = useRef<SnakeDirection | null>(null), touch = useRef<SnakePoint | null>(null);
  const reset = useCallback(() => {
    const bodyValue = [{ x: 10, y: 10 }], foodValue = randomSnakeFood(bodyValue);
    body.current = bodyValue; target.current = foodValue; direction.current = "right"; queued.current = null;
    setSnake(bodyValue); setFood(foodValue); setScore(0); setOver(false); setWon(false); setRunning(true);
  }, []);
  const turn = useCallback((next: SnakeDirection) => {
    if (over || won || queued.current || next === direction.current || oppositeDirection[next] === direction.current) return;
    queued.current = next;
    if (!running) setRunning(true);
  }, [over, won, running]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (ignoreGameKey(event)) return;
      const keys: Record<string, SnakeDirection> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }, next = keys[event.key];
      if (next) { event.preventDefault(); turn(next); if (!over && !won && !running) setRunning(true); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [turn, over, won, running]);
  useEffect(() => {
    if (!running || over || won) return;
    const timer = setInterval(() => {
      direction.current = queued.current ?? direction.current; queued.current = null;
      const next = stepSnake(body.current, direction.current, target.current);
      if (next.over) { setOver(true); setRunning(false); return; }
      body.current = next.snake; setSnake(next.snake);
      if (next.ate) {
        setScore(value => value + 10);
        const food = randomSnakeFood(next.snake); target.current = food; setFood(food);
        if (!food) { setWon(true); setRunning(false); }
      }
    }, Math.max(60, 150 - score * 3));
    return () => clearInterval(timer);
  }, [running, over, won, score]);
  useEffect(() => { setBest(value => Math.max(value, score)); if (score > best) writeScore("bestSnake", score); }, [score, best]);
  return <div className="game-space"><div className="game-stats"><div><span>分数</span><strong>{score}</strong></div><div><span>最佳</span><strong>{best}</strong></div><div><span>蛇长</span><strong>{snake.length}</strong></div></div><div className="game-actions"><button className="game-button" type="button" onClick={reset}>{over || won ? "重新开始" : "新游戏"}</button><button className="game-button" type="button" disabled={over || won} onClick={() => setRunning(value => !value)}>{running ? "暂停" : "开始 / 继续"}</button></div><div className="relative grid rounded-2xl border border-stone-200 bg-white/50 p-2" role="img" aria-label={"贪吃蛇棋盘，蛇长 " + snake.length} style={{ gridTemplateColumns: "repeat(20, 1fr)", aspectRatio: "1", width: "min(80vw, 400px)", margin: "0 auto", touchAction: "none" }} onTouchStart={event => { const point = event.touches[0]; if (point) touch.current = { x: point.clientX, y: point.clientY }; }} onTouchEnd={event => {
    const point = event.changedTouches[0]; if (!point || !touch.current) return;
    const dx = point.clientX - touch.current.x, dy = point.clientY - touch.current.y; touch.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
    turn(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? "right" : "left" : dy > 0 ? "down" : "up");
  }}>{Array.from({ length: 400 }, (_, index) => { const x = index % 20, y = Math.floor(index / 20), head = snake[0].x === x && snake[0].y === y, occupied = snake.some(point => point.x === x && point.y === y), edible = food?.x === x && food?.y === y; return <div key={index} className={"aspect-square rounded-[2px] " + (head ? "bg-emerald-700" : occupied ? "bg-emerald-400" : edible ? "rounded-full bg-red-500" : "bg-stone-100/30")} />; })}{(over || won) && <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-white/80" role="status"><h2 className="font-display text-2xl text-stone-900">{won ? "填满棋盘，恭喜通关！" : "游戏结束"}</h2><p className="my-3 text-sm text-stone-600">得分 {score}</p><button className="game-button" type="button" onClick={reset}>再来一局</button></div>}</div><div className="game-actions">{(["up", "left", "down", "right"] as const).map((value, index) => <button className="game-button" type="button" key={value} aria-label={["向上", "向左", "向下", "向右"][index]} onClick={() => turn(value)}>{["↑", "←", "↓", "→"][index]}</button>)}</div><p className="game-help">方向键、方向按钮或滑动棋盘操作。每次移动接受一次转向，避免快速连续按键造成反向碰撞。</p></div>;
}
