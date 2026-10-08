import { useEffect, useState } from "react";
import { dailyGameKey } from "@/lib/daily-game";
import { useSearchParams } from "react-router-dom";
import { makeSudoku, seededRandom, sudokuCandidates } from "@/lib/game-engines";
import { GameNotice, GameStats, gameButton } from "./GameKit";

export default function GameSudoku() {
  const [params] = useSearchParams(); const daily = dailyGameKey(params.get("daily"));
  const [difficulty, setDifficulty] = useState(42);
  const generate = (blanks = difficulty) => makeSudoku(blanks, daily ? seededRandom(`sudoku:${daily}:${blanks}`) : Math.random);
  const [puzzle, setPuzzle] = useState(generate); const [board, setBoard] = useState(puzzle.board);
  const [selected, setSelected] = useState<number | null>(null); const [notes, setNotes] = useState<Record<number, number[]>>({});
  const [noteMode, setNoteMode] = useState(false); const [message, setMessage] = useState(""); const [hints, setHints] = useState(0);
  const [seconds, setSeconds] = useState(0); const [start, setStart] = useState(0);
  const won = board.every((n, i) => n === puzzle.solution[i]);
  useEffect(() => { if (!start || won) return; const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 250); return () => clearInterval(timer); }, [start, won]);
  const reset = (blanks = difficulty) => { const next = generate(blanks); setPuzzle(next); setBoard(next.board); setNotes({}); setSelected(null); setMessage(""); setHints(0); setSeconds(0); setStart(0); };
  const enter = (number: number) => {
    if (selected === null || puzzle.board[selected] || won) return;
    if (!start) setStart(Date.now()); setMessage("");
    if (noteMode && number) {
      setNotes((previous) => { const values = previous[selected] || []; return { ...previous, [selected]: values.includes(number) ? values.filter((n) => n !== number) : [...values, number].sort() }; });
    } else { setBoard((previous) => previous.map((n, i) => i === selected ? number : n)); setNotes((previous) => ({ ...previous, [selected]: [] })); }
  };
  const conflict = (index: number) => { if (!board[index] || puzzle.board[index]) return false; const cleared = [...board]; cleared[index] = 0; return !sudokuCandidates(cleared, index).includes(board[index]); };
  return <div className="game-space">
    <div className="game-actions"><label>难度 <select aria-label="数独难度" value={difficulty} onChange={(event) => { const blanks = Number(event.target.value); setDifficulty(blanks); reset(blanks); }}><option value={34}>简单</option><option value={42}>普通</option><option value={50}>困难</option></select></label><button className={gameButton} onClick={() => reset()}>{daily ? "重置题目" : "新题目"}</button></div>
    <GameStats values={[["已填", `${board.filter(Boolean).length} / 81`], ["用时", `${seconds}s`], ["提示次数", hints]]} />
    <div className="sudoku-grid" role="group" aria-label="数独棋盘" onKeyDown={(event) => {
      if (/^[1-9]$/.test(event.key)) { event.preventDefault(); enter(Number(event.key)); }
      else if (["Backspace", "Delete", "0"].includes(event.key)) { event.preventDefault(); enter(0); }
      else if (selected !== null && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault(); const delta: Record<string, number> = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }; const next = Math.max(0, Math.min(80, selected + delta[event.key])); setSelected(next);
        event.currentTarget.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
      }
    }}>
      {board.map((number, index) => <button key={index} aria-label={`第 ${Math.floor(index / 9) + 1} 行第 ${index % 9 + 1} 列，${number || "空白"}${puzzle.board[index] ? "，题目数字" : ""}`} aria-pressed={selected === index} className={`sudoku-cell ${puzzle.board[index] ? "given" : ""} ${selected === index ? "selected" : ""} ${conflict(index) ? "conflict" : ""} ${index % 9 === 2 || index % 9 === 5 ? "box-right" : ""} ${Math.floor(index / 9) === 2 || Math.floor(index / 9) === 5 ? "box-bottom" : ""}`} onClick={() => setSelected(index)}>{number || <span className="sudoku-notes">{Array.from({ length: 9 }, (_, i) => <small key={i}>{notes[index]?.includes(i + 1) ? i + 1 : ""}</small>)}</span>}</button>)}
    </div>
    <div className="sudoku-keypad">{Array.from({ length: 9 }, (_, i) => <button key={i} className={gameButton} disabled={won || selected === null || !!puzzle.board[selected]} onClick={() => enter(i + 1)}>{i + 1}</button>)}</div>
    <div className="game-actions"><button className={gameButton} aria-pressed={noteMode} onClick={() => setNoteMode((value) => !value)}>笔记 {noteMode ? "开" : "关"}</button><button className={gameButton} onClick={() => enter(0)}>擦除</button><button className={gameButton} disabled={won} onClick={() => setMessage(board.some((n, i) => n && n !== puzzle.solution[i]) ? "有数字与答案不符，请再检查一下。" : "目前填写正确，继续加油。")}>检查</button><button className={gameButton} disabled={won} onClick={() => {
      const index = selected !== null && !puzzle.board[selected] && board[selected] !== puzzle.solution[selected] ? selected : board.findIndex((n, i) => n !== puzzle.solution[i]);
      if (index >= 0) { if (!start) setStart(Date.now()); setBoard((previous) => previous.map((n, i) => i === index ? puzzle.solution[index] : n)); setSelected(index); setHints((n) => n + 1); setNotes((previous) => ({ ...previous, [index]: [] })); }
    }}>提示一格</button></div>
    {(won || message) && <GameNotice>{won ? `数独完成！用时 ${seconds} 秒，使用 ${hints} 次提示。` : message}</GameNotice>}
    <p className="game-help">点击空格后使用数字按钮或键盘输入，方向键移动，Delete 擦除。每行、每列和每个九宫格需填入不重复的 1–9。题目经过唯一解检查。{daily && `每日题目：${daily}。`}</p>
  </div>;
}
