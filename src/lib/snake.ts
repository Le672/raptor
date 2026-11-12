export type SnakePoint = { x: number; y: number };
export type SnakeDirection = "up" | "down" | "left" | "right";
export const oppositeDirection: Record<SnakeDirection, SnakeDirection> = { up: "down", down: "up", left: "right", right: "left" };
export function randomSnakeFood(snake: SnakePoint[], random = Math.random): SnakePoint | null {
  const occupied = new Set(snake.map(point => point.y * 20 + point.x)), available: SnakePoint[] = [];
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) if (!occupied.has(y * 20 + x)) available.push({ x, y });
  return available.length ? available[Math.min(available.length - 1, Math.floor(random() * available.length))] : null;
}
export function stepSnake(snake: SnakePoint[], direction: SnakeDirection, food: SnakePoint | null) {
  const head = { ...snake[0] };
  if (direction === "up") head.y--; if (direction === "down") head.y++; if (direction === "left") head.x--; if (direction === "right") head.x++;
  const ate = !!food && head.x === food.x && head.y === food.y;
  const occupied = ate ? snake : snake.slice(0, -1);
  const over = head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20 || occupied.some(point => point.x === head.x && point.y === head.y);
  return { snake: over ? snake : [head, ...(ate ? snake : snake.slice(0, -1))], ate: !over && ate, over };
}
