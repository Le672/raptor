import { FormEvent, useState } from "react";
import { guessFeedback, shuffle } from "@/lib/game-engines";
import { GameNotice, GameStats, gameButton, useGameBest } from "./GameKit";

const makeSecret = () => shuffle(Array.from({ length: 10 }, (_, i) => String(i))).slice(0, 4).join("");
export default function GameCodeBreaker() {
  const [secret, setSecret] = useState(makeSecret); const [input, setInput] = useState(""); const [error, setError] = useState("");
  const [guesses, setGuesses] = useState<{ guess: string; exact: number; present: number }[]>([]); const { best, record } = useGameBest("codebreaker", true);
  const won = guesses.some((g) => g.exact === 4); const over = won || guesses.length >= 10;
  const submit = (event: FormEvent) => {
    event.preventDefault(); if (over) return;
    if (!/^\d{4}$/.test(input) || new Set(input).size !== 4) { setError("请输入四个不重复的数字，可以以 0 开头。"); return; }
    if (guesses.some((g) => g.guess === input)) { setError("已经猜过这组数字，换一个试试。"); return; }
    const feedback = guessFeedback(secret, input); setGuesses((previous) => [...previous, { guess: input, ...feedback }]); setInput(""); setError(""); if (feedback.exact === 4) record(guesses.length + 1);
  };
  return <div className="game-space">
    <GameStats values={[["剩余机会", 10 - guesses.length], ["最少次数", best || "—"]]} />
    <form className="game-actions" onSubmit={submit}><label className="sr-only" htmlFor="code-guess">四位不重复数字</label><input id="code-guess" className="code-input" value={input} disabled={over} inputMode="numeric" autoComplete="off" maxLength={4} placeholder="例如 0123" onChange={(event) => setInput(event.target.value.replace(/\D/g, ""))} /><button className={gameButton} disabled={over || input.length !== 4}>提交猜测</button></form>
    {error && <GameNotice>{error}</GameNotice>}
    <div className="guess-history"><div className="guess-row"><span>次数</span><span>猜测</span><span>提示</span></div>{guesses.map((guess, index) => <div className="guess-row" key={guess.guess}><span>{index + 1}</span><strong>{guess.guess}</strong><span>{guess.exact}A {guess.present}B</span></div>)}{!guesses.length && <p className="game-help">秘密数字已准备好，开始你的第一轮推理。</p>}</div>
    {over && <GameNotice>{won ? `破解成功！用了 ${guesses.length} 次。` : `机会用完了，答案是 ${secret}。`}</GameNotice>}
    <button className={gameButton} onClick={() => { setSecret(makeSecret()); setGuesses([]); setInput(""); setError(""); }}>新游戏</button>
    <p className="game-help">答案是四个不重复的数字。A 表示数字和位置都正确，B 表示数字正确但位置不对。你有 10 次机会。</p>
  </div>;
}
