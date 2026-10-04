import { describe, expect, it } from "vitest";
import { chooseConnectMove, chooseGomokuMove, countSudokuSolutions, dropDisc, guessFeedback, hasLine, makeLights, makePuzzle, makeSudoku, seededRandom, todayKey, toggleLights } from "../lib/game-engines";

describe("generated puzzles", () => {
  it("creates reproducible daily challenges with a date fixed to Singapore time", () => {
    expect(todayKey(new Date("2026-10-03T16:01:00Z"))).toBe("2026-10-04");
    expect(makePuzzle(seededRandom("puzzle:2026-10-04"))).toEqual(makePuzzle(seededRandom("puzzle:2026-10-04")));
    expect(makePuzzle(seededRandom("puzzle:2026-10-04"))).not.toEqual(makePuzzle(seededRandom("puzzle:2026-10-05")));
  });
  it("only generates reachable 15-puzzle permutations", () => {
    for (let seed = 0; seed < 20; seed++) {
      const board = makePuzzle(seededRandom(String(seed))); const digits = board.filter(Boolean);
      let inversions = 0; for (let i = 0; i < digits.length; i++) for (let j = i + 1; j < digits.length; j++) if (digits[i] > digits[j]) inversions++;
      expect([...board].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i));
      expect((inversions + 4 - Math.floor(board.indexOf(0) / 4)) % 2).toBe(1);
    }
  });
  it.each([34, 42, 50])("generates valid Sudoku rows, columns, boxes and a unique solution (%i blanks requested)", (blanks) => {
    const puzzle = makeSudoku(blanks, seededRandom(`sudoku:${blanks}`)); const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 0; i < 9; i++) {
      expect(puzzle.solution.slice(i * 9, i * 9 + 9).sort()).toEqual(numbers);
      expect(Array.from({ length: 9 }, (_, row) => puzzle.solution[row * 9 + i]).sort()).toEqual(numbers);
      const row = Math.floor(i / 3) * 3; const col = i % 3 * 3;
      expect(Array.from({ length: 9 }, (_, n) => puzzle.solution[(row + Math.floor(n / 3)) * 9 + col + n % 3]).sort()).toEqual(numbers);
    }
    expect(puzzle.board.filter((n) => !n).length).toBeGreaterThanOrEqual(30);
    expect(countSudokuSolutions(puzzle.board)).toBe(1);
  });
  it.each([3, 5])("generates solvable lights and preserves a valid hint path after arbitrary moves (%i)", (size) => {
    const puzzle = makeLights(size, seededRandom(`lights:${size}`)); let board = [...puzzle.board];
    const clicks = [0, size - 1, size * size - 1];
    for (const index of clicks) board = toggleLights(board, index, size);
    const remaining = [...new Set([...puzzle.solution, ...clicks])].filter((index) => puzzle.solution.includes(index) !== clicks.includes(index));
    for (const index of remaining) board = toggleLights(board, index, size);
    expect(board.every((n) => !n)).toBe(true);
  });
});
describe("board game rules and computer moves", () => {
  it("drops discs to the bottom and rejects a full column", () => {
    let board = Array(42).fill(0); for (let i = 0; i < 6; i++) { const move = dropDisc(board, 2, i % 2 + 1)!; expect(move.index).toBe((5 - i) * 7 + 2); board = move.board; }
    expect(dropDisc(board, 2, 1)).toBeNull();
  });
  it("finds vertical and diagonal wins without wrapping rows", () => {
    const board = Array(42).fill(0); for (const index of [5, 6, 7, 8]) board[index] = 1; expect(hasLine(board, 8, 6, 4, 7)).toBe(false);
    const diagonal = Array(42).fill(0); for (const index of [35, 29, 23, 17]) diagonal[index] = 2; expect(hasLine(diagonal, 17, 6, 4, 7)).toBe(true);
  });
  it("the four-in-a-row computer takes a win and blocks an immediate loss", () => {
    for (const color of [1, 2]) { const board = Array(42).fill(0); board[35] = color; board[36] = color; board[37] = color; expect(chooseConnectMove(board, 2)).toBe(3); }
    expect(chooseConnectMove(Array(42).fill(1))).toBe(-1);
  });
  it("the Gomoku computer takes a win and blocks four opponents in a row", () => {
    for (const color of [1, 2]) { const board = Array(225).fill(0); for (const col of [3, 4, 5, 6]) board[7 * 15 + col] = color; const choice = chooseGomokuMove(board, 2); board[choice] = color; expect(hasLine(board, choice, 15, 5)).toBe(true); }
  });
  it("scores code-breaking feedback with correct positions and misplaced digits", () => {
    expect(guessFeedback("0123", "0132")).toEqual({ exact: 2, present: 2 });
    expect(guessFeedback("0123", "3210")).toEqual({ exact: 0, present: 4 });
    expect(guessFeedback("0123", "4567")).toEqual({ exact: 0, present: 0 });
  });
});
