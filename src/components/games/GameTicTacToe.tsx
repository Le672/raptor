import { useState, useCallback } from "react";

type Player = "X" | "O" | null;
type Board = Player[];

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board: Board): Player {
  for (const [a, b, c] of WIN_LINES)
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  return null;
}

function minimax(board: Board, isMax: boolean): number {
  const winner = checkWinner(board);
  if (winner === "O") return 10;
  if (winner === "X") return -10;
  if (board.every((c) => c !== null)) return 0;

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;
      board[i] = "O";
      best = Math.max(best, minimax(board, false));
      board[i] = null;
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;
      board[i] = "X";
      best = Math.min(best, minimax(board, true));
      board[i] = null;
    }
    return best;
  }
}

function aiMove(board: Board): number {
  let bestScore = -Infinity;
  let bestMove = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = "O";
    const score = minimax(board, false);
    board[i] = null;
    if (score > bestScore) { bestScore = score; bestMove = i; }
  }
  return bestMove;
}

export default function GameTicTacToe() {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [winner, setWinner] = useState<Player>(null);
  const [draw, setDraw] = useState(false);
  const [score, setScore] = useState({ player: 0, ai: 0, draw: 0 });

  const reset = useCallback(() => { setBoard(Array(9).fill(null)); setIsPlayerTurn(true); setWinner(null); setDraw(false); }, []);

  const handleClick = useCallback((i: number) => {
    if (board[i] || winner || draw || !isPlayerTurn) return;
    const newBoard = [...board];
    newBoard[i] = "X";
    setBoard(newBoard);

    const w = checkWinner(newBoard);
    if (w) { setWinner(w); setScore((s) => ({ ...s, player: s.player + 1 })); return; }
    if (newBoard.every((c) => c !== null)) { setDraw(true); setScore((s) => ({ ...s, draw: s.draw + 1 })); return; }

    setIsPlayerTurn(false);
    setTimeout(() => {
      const ai = aiMove([...newBoard]);
      if (ai === -1) return;
      const afterAi = [...newBoard];
      afterAi[ai] = "O";
      setBoard(afterAi);
      const w2 = checkWinner(afterAi);
      if (w2) { setWinner(w2); setScore((s) => ({ ...s, ai: s.ai + 1 })); return; }
      if (afterAi.every((c) => c !== null)) { setDraw(true); setScore((s) => ({ ...s, draw: s.draw + 1 })); return; }
      setIsPlayerTurn(true);
    }, 400);
  }, [board, winner, draw, isPlayerTurn]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between">
        <div className="flex gap-3">
          <div className="glass-panel rounded-xl px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-stone-500">你</p>
            <p className="font-display text-lg text-blue-600">{score.player}</p>
          </div>
          <div className="glass-panel rounded-xl px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-stone-500">平局</p>
            <p className="font-display text-lg text-stone-600">{score.draw}</p>
          </div>
          <div className="glass-panel rounded-xl px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-stone-500">AI</p>
            <p className="font-display text-lg text-red-600">{score.ai}</p>
          </div>
        </div>
        <button onClick={reset} className="glass-panel rounded-xl px-4 py-2 text-sm text-stone-700">
          新游戏
        </button>
      </div>

      <div className="glass-panel grid grid-cols-3 gap-2 rounded-2xl p-3" style={{ width: "min(80vw, 300px)" }}>
        {board.map((cell, i) => (
          <button
            key={i}
            className={`aspect-square rounded-xl text-4xl font-bold transition-all ${
              cell ? "bg-white/30" : "bg-white/20 hover:bg-white/30"
            } ${cell === "X" ? "text-blue-600" : "text-red-500"}`}
            onClick={() => handleClick(i)}
          >
            {cell}
          </button>
        ))}
      </div>

      {(winner || draw) && (
        <div className="glass-panel fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
          <p className="font-display text-3xl text-stone-900">
            {winner === "X" ? "你赢了！" : winner === "O" ? "AI 赢了" : "平局"}
          </p>
          <button onClick={reset} className="mt-4 glass-panel rounded-xl px-6 py-2 text-sm text-stone-700">再来一局</button>
        </div>
      )}
      {!winner && !draw && (
        <p className="text-xs text-stone-500">{isPlayerTurn ? "你的回合 (X)" : "AI 思考中..."}</p>
      )}
    </div>
  );
}
