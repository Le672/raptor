export function seededRandom(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => { state += 0x6d2b79f5; let n = Math.imul(state ^ state >>> 15, 1 | state); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
export function shuffle<T>(values: T[], random = Math.random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function todayKey(date = new Date()) { const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date); return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)!.value).join("-"); }

export const solvedPuzzle = () => Array.from({ length: 16 }, (_, i) => (i + 1) % 16);
export function puzzleNeighbors(blank: number) {
  return [blank - 4, blank + 4, blank % 4 ? blank - 1 : -1, blank % 4 < 3 ? blank + 1 : -1].filter((n) => n >= 0 && n < 16);
}
export function makePuzzle(random = Math.random, steps = 100): number[] {
  const board = solvedPuzzle(); let blank = 15; let previous = -1;
  for (let i = 0; i < steps; i++) {
    const options = puzzleNeighbors(blank).filter((n) => n !== previous);
    const next = options[Math.floor(random() * options.length)];
    [board[blank], board[next]] = [board[next], board[blank]];
    previous = blank; blank = next;
  }
  return board.every((n, i) => n === (i + 1) % 16) ? makePuzzle(random, steps + 1) : board;
}
export function isPuzzleSolved(board: number[]) { return board.every((n, i) => n === (i + 1) % 16); }

export function hasLine(board: number[], index: number, size: number, needed: number, columns = size) {
  const color = board[index]; if (!color) return false;
  const row = Math.floor(index / columns); const col = index % columns;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    let total = 1;
    for (const direction of [-1, 1]) {
      let r = row + dr * direction; let c = col + dc * direction;
      while (r >= 0 && r < size && c >= 0 && c < columns && board[r * columns + c] === color) { total++; r += dr * direction; c += dc * direction; }
    }
    if (total >= needed) return true;
  }
  return false;
}
export function dropDisc(board: number[], column: number, color: number) {
  if (column < 0 || column > 6) return null;
  for (let row = 5; row >= 0; row--) {
    const index = row * 7 + column;
    if (board[index] === 0) { const next = [...board]; next[index] = color; return { board: next, index }; }
  }
  return null;
}
export function chooseConnectMove(board: number[], color = 2, depth = 4): number {
  const order = [3, 2, 4, 1, 5, 0, 6];
  function evaluate(position: number[], player: number) {
    let value = 0;
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
      if (position[r * 7 + c] === player) value += 3 - Math.abs(3 - c);
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const cells = Array.from({ length: 4 }, (_, k) => [r + k * dr, c + k * dc]);
        if (cells.some(([y, x]) => y < 0 || y >= 6 || x < 0 || x >= 7)) continue;
        const values = cells.map(([y, x]) => position[y * 7 + x]);
        if (values.includes(3 - player)) continue;
        value += [0, 1, 8, 45, 10000][values.filter((n) => n === player).length];
      }
    }
    return value;
  }
  function search(position: number[], player: number, remaining: number, alpha: number, beta: number): number {
    if (!remaining) return evaluate(position, player) - evaluate(position, 3 - player);
    let best = -Infinity;
    for (const column of order) {
      const move = dropDisc(position, column, player); if (!move) continue;
      const score = hasLine(move.board, move.index, 6, 4, 7) ? 100000 + remaining : -search(move.board, 3 - player, remaining - 1, -beta, -alpha);
      best = Math.max(best, score); alpha = Math.max(alpha, score); if (alpha >= beta) break;
    }
    return best === -Infinity ? 0 : best;
  }
  let bestColumn = -1; let best = -Infinity;
  for (const column of order) {
    const move = dropDisc(board, column, color); if (!move) continue;
    const score = hasLine(move.board, move.index, 6, 4, 7) ? 100000 + depth : -search(move.board, 3 - color, depth - 1, -Infinity, Infinity);
    if (score > best) { best = score; bestColumn = column; }
  }
  return bestColumn;
}
export function chooseGomokuMove(board: number[], color = 2, size = 15): number {
  if (board.every((n) => !n)) return Math.floor(size * size / 2);
  const candidates = board.map((n, i) => n === 0 ? i : -1).filter((i) => i >= 0 && board.some((n, j) => n && Math.abs(Math.floor(j / size) - Math.floor(i / size)) <= 2 && Math.abs(j % size - i % size) <= 2));
  const patternScore = (index: number, player: number) => {
    const next = [...board]; next[index] = player;
    if (hasLine(next, index, size, 5)) return 1_000_000;
    let score = 0;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      let length = 1; let open = 0;
      for (const direction of [-1, 1]) {
        let r = Math.floor(index / size) + dr * direction; let c = index % size + dc * direction;
        while (r >= 0 && r < size && c >= 0 && c < size && next[r * size + c] === player) { length++; r += dr * direction; c += dc * direction; }
        if (r >= 0 && r < size && c >= 0 && c < size && next[r * size + c] === 0) open++;
      }
      if (open) score += [0, 2, 15, 180, 5000][Math.min(4, length)] * open;
    }
    return score;
  };
  let best = -Infinity; let choice = -1;
  for (const index of candidates) {
    const attack = patternScore(index, color); const defend = patternScore(index, 3 - color);
    const score = attack >= 1_000_000 ? 10_000_000 : defend >= 1_000_000 ? 5_000_000 : attack + defend * 1.15 - Math.abs(index % size - (size - 1) / 2) * .1;
    if (score > best) { best = score; choice = index; }
  }
  return choice;
}

export function toggleLights(board: boolean[], index: number, size = 5) {
  const result = [...board];
  for (const cell of [index, index - size, index + size, index % size ? index - 1 : -1, index % size < size - 1 ? index + 1 : -1]) if (cell >= 0 && cell < result.length) result[cell] = !result[cell];
  return result;
}
export function makeLights(size = 5, random = Math.random) {
  let board = Array<boolean>(size * size).fill(false);
  const solution = shuffle(Array.from({ length: size * size }, (_, i) => i), random).slice(0, size * 2);
  for (const index of solution) board = toggleLights(board, index, size);
  return { board, solution };
}
export function guessFeedback(secret: string, guess: string) {
  let exact = 0; let present = 0;
  for (let i = 0; i < guess.length; i++) { if (guess[i] === secret[i]) exact++; else if (secret.includes(guess[i])) present++; }
  return { exact, present };
}

export function sudokuCandidates(board: number[], index: number): number[] {
  if (board[index]) return [];
  const row = Math.floor(index / 9); const column = index % 9; const used = new Set<number>();
  for (let i = 0; i < 9; i++) { used.add(board[row * 9 + i]); used.add(board[i * 9 + column]); used.add(board[(Math.floor(row / 3) * 3 + Math.floor(i / 3)) * 9 + Math.floor(column / 3) * 3 + i % 3]); }
  return Array.from({ length: 9 }, (_, i) => i + 1).filter((n) => !used.has(n));
}
export function countSudokuSolutions(input: number[], limit = 2): number {
  const board = [...input]; let count = 0;
  function visit() {
    let index = -1; let options: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (board[i]) continue;
      const possible = sudokuCandidates(board, i); if (!possible.length) return;
      if (index < 0 || possible.length < options.length) { index = i; options = possible; if (possible.length === 1) break; }
    }
    if (index < 0) { count++; return; }
    for (const n of options) { board[index] = n; visit(); if (count >= limit) break; }
    board[index] = 0;
  }
  visit(); return count;
}
export function makeSudoku(blanks = 42, random = Math.random) {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  const order = () => shuffle([0, 1, 2], random).flatMap((group) => shuffle([0, 1, 2], random).map((n) => group * 3 + n));
  const rows = order(); const cols = order();
  const solution = rows.flatMap((r) => cols.map((c) => digits[(r * 3 + Math.floor(r / 3) + c) % 9]));
  const board = [...solution]; let removed = 0;
  for (const index of shuffle(Array.from({ length: 81 }, (_, i) => i), random)) {
    const previous = board[index]; board[index] = 0;
    if (countSudokuSolutions(board) !== 1) board[index] = previous; else removed++;
    if (removed >= blanks) break;
  }
  return { board, solution };
}
