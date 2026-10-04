import { useEffect, useRef, useState } from "react";
import { GameNotice, GameStats, gameButton, useGameBest } from "./GameKit";

const TEXTS = {
  en: ["Keep curious and keep building. Small steps can turn a simple idea into something useful. Write code, take notes, and enjoy the little things along the way. ", "The best way to learn is to try. Read a page, solve a puzzle, and share what you discover. Every new day brings a chance to make something better. "],
  zh: ["保持好奇，持续探索。把平凡的日子慢慢写成故事，在代码与文字之间记录生活。每一个小小的进步，都值得认真收藏。", "走过不同的城市，认识不同的风景。偶尔停下来读一篇文章，玩一个游戏，让想法在轻松的片刻慢慢生长。"],
};
export default function GameTyping() {
  const [language, setLanguage] = useState<"en" | "zh">("en"); const [text, setText] = useState(TEXTS.en[0].repeat(4));
  const [input, setInput] = useState(""); const [remaining, setRemaining] = useState(30); const [running, setRunning] = useState(false); const [finished, setFinished] = useState(false);
  const start = useRef(0); const inputRef = useRef<HTMLTextAreaElement>(null); const { best, record } = useGameBest("typing-en");
  const correct = [...input].filter((char, index) => char === text[index]).length;
  const accuracy = input.length ? Math.round(correct / input.length * 100) : 100;
  const elapsed = Math.max(1, 30 - remaining); const speed = Math.round(correct / (language === "en" ? 5 : 1) * 60 / elapsed);
  useEffect(() => {
    if (!running) return;
    const clock = setInterval(() => { const left = Math.max(0, 30 - Math.floor((Date.now() - start.current) / 1000)); setRemaining(left); if (!left) { setRunning(false); setFinished(true); } }, 100);
    return () => clearInterval(clock);
  }, [running]);
  useEffect(() => { if (finished && language === "en") record(speed); }, [finished, language, speed, record]);
  const reset = (lang = language) => { setText(TEXTS[lang][Math.floor(Math.random() * TEXTS[lang].length)].repeat(4)); setInput(""); setRemaining(30); setRunning(false); setFinished(false); start.current = 0; };
  return <div className="game-space">
    <div className="game-actions"><label>练习语言 <select value={language} onChange={(event) => { const next = event.target.value as "en" | "zh"; setLanguage(next); reset(next); }}><option value="en">English</option><option value="zh">中文</option></select></label><button className={gameButton} onClick={() => { reset(); inputRef.current?.focus(); }}>换段文字</button></div>
    <GameStats values={[["剩余", `${remaining}s`], [language === "en" ? "速度 WPM" : "速度 字/分钟", input.length ? speed : "—"], ["准确率", `${accuracy}%`], ...(language === "en" ? [["英语最高 WPM", best || "—"] as [string, string | number]] : [])]} />
    <div className="typing-passage" aria-label="待输入的练习文字">{[...text.slice(0, Math.min(text.length, Math.max(260, input.length + 40)))].map((char, index) => <span key={index} className={index < input.length ? input[index] === char ? "correct" : "incorrect" : index === input.length ? "cursor" : ""}>{char}</span>)}</div>
    <textarea ref={inputRef} className="typing-input" aria-label="在此输入练习文字" placeholder="输入第一个字后开始 30 秒计时…" spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off" value={input} disabled={finished} onPaste={(event) => event.preventDefault()} onChange={(event) => {
      if (start.current && Date.now() - start.current >= 30000) return;
      if (!start.current && event.target.value) { start.current = Date.now(); setRunning(true); }
      setInput(event.target.value.slice(0, text.length));
      if (event.target.value.length >= text.length) { setRunning(false); setFinished(true); }
    }} />
    {finished && <GameNotice>练习完成：{speed} {language === "en" ? "WPM" : "字/分钟"}，准确率 {accuracy}%。</GameNotice>}
    <p className="game-help">按显示的文字输入，标点与空格也需一致。英语速度按 5 个字符折算一个词，中文按正确字数计算。本练习不接受粘贴。</p>
  </div>;
}
