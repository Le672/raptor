import { useEffect, useState } from "react";
import { chooseConnectMove, chooseGomokuMove, dropDisc, hasLine } from "@/lib/game-engines";
import { GameNotice, GameStats, gameButton } from "./GameKit";

function LineGame({ gravity }: { gravity: boolean }) {
  const columns = gravity ? 7 : 15; const rows = gravity ? 6 : 15; const needed = gravity ? 4 : 5;
  const [board, setBoard] = useState(() => Array<number>(rows * columns).fill(0));
  const [turn, setTurn] = useState(1); const [mode, setMode] = useState("computer");
  const [result, setResult] = useState(0); const [last, setLast] = useState(-1);
  const [history, setHistory] = useState<{ board: number[]; turn: number; last: number }[]>([]);
  const play = (position: number, player: number) => {
    let next = [...board]; let index = position;
    if (gravity) { const move = dropDisc(board, position, player); if (!move) return; next = move.board; index = move.index; }
    else { if (next[index] !== 0) return; next[index] = player; }
    setHistory((previous) => [...previous, { board, turn: player, last }]); setBoard(next); setLast(index);
    if (hasLine(next, index, rows, needed, columns)) setResult(player);
    else if (next.every(Boolean)) setResult(3);
    else setTurn(3 - player);
  };
  useEffect(() => {
    if (mode !== "computer" || turn !== 2 || result) return;
    const timer = setTimeout(() => {
      const position = gravity ? chooseConnectMove(board) : chooseGomokuMove(board);
      if (position < 0) setResult(3); else play(position, 2);
    }, 250);
    return () => clearTimeout(timer);
    // play closes over exactly the board of this pending computer turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, turn, result, mode, gravity]);
  const reset = () => { setBoard(Array<number>(rows * columns).fill(0)); setTurn(1); setResult(0); setHistory([]); setLast(-1); };
  const waiting = mode === "computer" && turn === 2;
  return <div className="game-space">
    <div className="game-actions"><label>对弈方式 <select value={mode} onChange={(event) => { setMode(event.target.value); reset(); }}><option value="computer">人机对弈</option><option value="local">本机双人</option></select></label><button className={gameButton} onClick={reset}>新对局</button><button className={gameButton} disabled={!history.length} onClick={() => {
      const amount = mode === "computer" && history[history.length - 1].turn === 2 ? Math.min(2, history.length) : 1;
      const previous = history[history.length - amount]; setBoard(previous.board); setTurn(previous.turn); setLast(previous.last); setResult(0); setHistory((h) => h.slice(0, -amount));
    }}>悔棋</button></div>
    <GameStats values={[["已落子", board.filter(Boolean).length], ["当前回合", result ? "已结束" : waiting ? "电脑思考中" : turn === 1 ? "先手" : "后手"]]} />
    {gravity && <div className="connect-columns" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>{Array.from({ length: 7 }, (_, column) => <button className={gameButton} key={column} disabled={!!result || waiting || board[column] !== 0} aria-label={`落子第 ${column + 1} 列`} onClick={() => play(column, turn)}>↓</button>)}</div>}
    <div className={`game-grid ${gravity ? "connect-grid" : "gomoku-grid"}`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }} aria-label={gravity ? "四子棋棋盘" : "五子棋棋盘"} role="group">
      {board.map((color, index) => <button key={index} disabled={!!result || waiting || (gravity ? !!board[index % columns] : !!color)} aria-label={`第 ${Math.floor(index / columns) + 1} 行第 ${index % columns + 1} 列，${color === 1 ? "先手棋子" : color === 2 ? "后手棋子" : "空位"}`} className={`line-cell color-${color} ${index === last ? "last-move" : ""}`} onClick={() => play(gravity ? index % columns : index, turn)}><span /></button>)}
    </div>
    {result > 0 && <GameNotice>{result === 3 ? "棋盘已满，平局。" : mode === "computer" ? result === 1 ? "你获胜了！再来一局？" : "电脑获胜了，再试试。" : `${result === 1 ? "先手" : "后手"}获胜！`}</GameNotice>}
    <p className="game-help">{gravity ? "点击列上方的箭头落子，棋子会落到该列底部。" : "点击空位落子，黑子先行；采用无禁手规则。"}横向、纵向或斜向连成 {needed} 子即可获胜。</p>
  </div>;
}
export function GameConnectFour() { return <LineGame gravity />; }
export function GameGomoku() { return <LineGame gravity={false} />; }
