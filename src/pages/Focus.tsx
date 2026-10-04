import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Download, Pause, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { HomeLink } from "@/components/HomeLink";
import { useStoredState } from "@/hooks/useStoredState";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { todayKey } from "@/lib/game-engines";

type Mode = "focus" | "short" | "long";
type Session = { mode: Mode; duration: number; remaining: number; deadline: number | null };
type Task = { id: string; text: string; done: boolean };
type Log = { id: string; date: string; seconds: number };
const modeLabels: Record<Mode, string> = { focus: "专注", short: "短休息", long: "长休息" };
const secondsLabel = (n: number) => `${Math.floor(n / 60).toString().padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;
const validTasks = (value: unknown): value is Task[] => Array.isArray(value) && value.length <= 100 && value.every((task) => task && typeof task.id === "string" && typeof task.text === "string" && task.text.length <= 160 && typeof task.done === "boolean");
const validLog = (value: unknown): value is Log[] => Array.isArray(value) && value.length <= 365 && value.every((log) => log && typeof log.id === "string" && typeof log.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(log.date) && Number.isFinite(log.seconds) && log.seconds >= 60 && log.seconds <= 7200);
const validSettings = (value: unknown): value is Record<Mode, number> => !!value && typeof value === "object" && ["focus", "short", "long"].every((key) => Number.isInteger((value as Record<string, number>)[key]) && (value as Record<string, number>)[key] >= 1 && (value as Record<string, number>)[key] <= 120);
const validSession = (value: unknown): value is Session => !!value && typeof value === "object" && ["focus", "short", "long"].includes((value as Session).mode) && Number.isInteger((value as Session).duration) && (value as Session).duration >= 60 && (value as Session).duration <= 7200 && Number.isInteger((value as Session).remaining) && (value as Session).remaining >= 0 && (value as Session).remaining <= (value as Session).duration && ((value as Session).deadline === null || Number.isFinite((value as Session).deadline));

export default function Focus() {
  const [settings, setSettings, settingsSaved] = useStoredState<Record<Mode, number>>("yukino.focus.settings", { focus: 25, short: 5, long: 15 }, validSettings);
  const [session, setSession, sessionSaved] = useStoredState<Session>("yukino.focus.session", { mode: "focus", duration: 1500, remaining: 1500, deadline: null }, validSession);
  const [tasks, setTasks, tasksSaved] = useStoredState("yukino.focus.tasks", [], validTasks);
  const [notes, setNotes, notesSaved] = useStoredState("yukino.focus.notes", "", (v): v is string => typeof v === "string" && v.length <= 12000);
  const [logs, setLogs, logsSaved] = useStoredState("yukino.focus.logs", [], validLog);
  const [remaining, setRemaining] = useState(session.remaining); const [taskText, setTaskText] = useState("");
  const [finished, setFinished] = useState(false); const [undo, setUndo] = useState<Task[] | null>(null); const [message, setMessage] = useState("");
  const completed = useRef<number | null>(null); const running = session.deadline !== null;
  useDocumentMeta(`${running ? `${secondsLabel(remaining)} · ` : ""}专注角落`, "番茄钟、任务清单和随手记，给需要安静做事的片刻留一个位置。");
  useEffect(() => {
    if (session.deadline === null) { setRemaining(session.remaining); return; }
    const deadline = session.deadline;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); setRemaining(left);
      if (left === 0 && completed.current !== deadline) {
        completed.current = deadline; setSession((previous) => ({ ...previous, remaining: 0, deadline: null })); setFinished(true);
        if (session.mode === "focus") setLogs((previous) => previous.some((n) => n.id === String(deadline)) ? previous : [...previous, { id: String(deadline), date: todayKey(new Date(deadline)), seconds: session.duration }].slice(-365));
      }
    };
    tick(); const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [session.deadline, session.remaining, session.mode, session.duration, setSession, setLogs]);
  const selectMode = (mode: Mode) => { const duration = settings[mode] * 60; setSession({ mode, duration, remaining: duration, deadline: null }); setFinished(false); };
  const start = () => { const seconds = session.remaining || settings[session.mode] * 60; setSession((previous) => ({ ...previous, duration: previous.remaining ? previous.duration : seconds, remaining: seconds, deadline: Date.now() + seconds * 1000 })); setFinished(false); };
  const addTask = (event: FormEvent) => { event.preventDefault(); const text = taskText.trim(); if (!text) return; if (tasks.length >= 100) { setMessage("任务最多保留 100 条，请先整理已完成任务。"); return; } setTasks((previous) => [...previous, { id: crypto.randomUUID(), text, done: false }]); setTaskText(""); setMessage("已添加任务。"); };
  const today = todayKey(); const todayLogs = logs.filter((n) => n.date === today); const doneTasks = tasks.filter((n) => n.done).length;
  const week = Array.from({ length: 7 }, (_, index) => { const date = new Date(Date.now() - (6 - index) * 86400000); const key = todayKey(date); return { key, minutes: Math.round(logs.filter((n) => n.date === key).reduce((sum, n) => sum + n.seconds, 0) / 60) }; });
  const maxMinutes = Math.max(30, ...week.map((n) => n.minutes));
  return <div className="feature-page focus-page">
    <div><div className="feature-heading"><HomeLink className="pill-button"><ArrowLeft size={15} />返回首页</HomeLink><span className="feature-eyebrow">ONE THING AT A TIME</span></div><h1 className="feature-title">专注角落<span>慢一点，也能走很远</span></h1><p className="feature-description">选一件值得做的事，留一段不被打扰的时间。计时、任务和随手记，都在同一个页面。</p></div>
    {![settingsSaved, sessionSaved, tasksSaved, notesSaved, logsSaved].every(Boolean) && <p role="alert" className="feature-warning">浏览器存储不可用，计时和编辑仍可使用；关闭页面前请导出记录。</p>}
    <div className="focus-layout"><section className="focus-timer" aria-label="番茄钟"><div className="filter-chips">{(["focus", "short", "long"] as const).map((mode) => <button key={mode} disabled={running} aria-pressed={session.mode === mode} onClick={() => selectMode(mode)}>{modeLabels[mode]}</button>)}</div><div className="focus-clock" role="timer" aria-label={`剩余 ${Math.floor(remaining / 60)} 分 ${remaining % 60} 秒`}>{secondsLabel(remaining)}</div><p>{running ? "把注意力留给眼前这一件事。" : finished ? "这一轮完成了，伸个懒腰吧。" : "准备好了，就从这里开始。"}</p><progress value={session.duration - remaining} max={session.duration} aria-label="本轮进度" /><div className="game-actions"><button className="primary-button" onClick={() => running ? setSession((previous) => ({ ...previous, remaining: Math.max(0, Math.ceil((previous.deadline! - Date.now()) / 1000)), deadline: null })) : start()}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? "暂停" : session.remaining && session.remaining < session.duration ? "继续" : "开始"}</button><button className="pill-button" onClick={() => selectMode(session.mode)}><RotateCcw size={15} />重置</button></div>{finished && <p className="game-notice" role="status">{session.mode === "focus" ? "专注完成，已记入今日记录。可以切换到短休息放松一下。" : "休息结束，准备好开始下一轮了吗？"}</p>}<div className="focus-settings">{(["focus", "short", "long"] as const).map((mode) => <label key={mode}>{modeLabels[mode]} / 分钟<input type="number" min={1} max={120} disabled={running} value={settings[mode]} onChange={(event) => { const value = Number(event.target.value); if (!Number.isInteger(value) || value < 1 || value > 120) return; setSettings((previous) => ({ ...previous, [mode]: value })); if (session.mode === mode) { setSession({ mode, duration: value * 60, remaining: value * 60, deadline: null }); setFinished(false); } }} /></label>)}</div><p className="local-note">刷新页面可继续计时。后台标签页按实际经过时间计算；浏览器关闭时无法发出提醒。</p></section>
    <section className="focus-tasks" aria-label="待办清单"><div className="feature-toolbar"><h2>今天想做什么</h2><span>{doneTasks} / {tasks.length} 完成</span></div><form className="task-form" onSubmit={addTask}><input aria-label="新任务" value={taskText} onChange={(event) => setTaskText(event.target.value)} maxLength={160} placeholder="写下一个小目标…" /><button className="primary-button" aria-label="添加任务" disabled={!taskText.trim()}><Plus size={18} /></button></form><div className="task-list">{tasks.map((task) => <div className={`task-row ${task.done ? "is-done" : ""}`} key={task.id}><label><input type="checkbox" checked={task.done} onChange={() => setTasks((previous) => previous.map((n) => n.id === task.id ? { ...n, done: !n.done } : n))} /><span>{task.text}</span></label><button aria-label={`删除任务：${task.text}`} onClick={() => { setUndo(tasks); setTasks((previous) => previous.filter((n) => n.id !== task.id)); setMessage("任务已删除，可撤销。"); }}><Trash2 size={15} /></button></div>)}{!tasks.length && <p className="game-help">不用列很多，先从一件事开始。</p>}</div><div className="game-actions"><button className="pill-button" disabled={!doneTasks} onClick={() => { setUndo(tasks); setTasks((previous) => previous.filter((n) => !n.done)); setMessage("已整理完成的任务，可撤销。"); }}><Check size={14} />整理已完成</button>{undo && <button className="pill-button" onClick={() => { setTasks(undo); setUndo(null); setMessage("已撤销任务删除。"); }}>撤销删除</button>}</div><p className="sr-only" role="status">{message}</p></section></div>
    <div className="focus-bottom"><section className="focus-notes"><div className="feature-toolbar"><h2>随手记</h2><span>{notesSaved ? "自动保存在本机" : "尚未保存"}</span></div><textarea aria-label="随手记" value={notes} maxLength={12000} onChange={(event) => setNotes(event.target.value)} placeholder="把灵感、要查的事情或今天的小收获留在这里…" /><small>{notes.length} / 12000</small></section><section className="focus-history"><h2>一点点积累</h2><div className="focus-totals"><div><strong>{todayLogs.length}</strong><span>今日专注轮数</span></div><div><strong>{Math.round(todayLogs.reduce((sum, n) => sum + n.seconds, 0) / 60)}</strong><span>今日专注分钟</span></div></div><div className="focus-week" aria-label="最近七天专注分钟">{week.map((day) => <div key={day.key} title={`${day.key}：${day.minutes} 分钟`}><span>{day.minutes || "—"}</span><i style={{ height: `${Math.max(3, day.minutes / maxMinutes * 70)}px` }} /><small>{day.key.slice(5)}</small></div>)}</div></section></div>
    <div className="feature-toolbar"><p className="local-note">任务、笔记与记录仅存于当前浏览器，不会上传。定期导出可保留一份备份。</p><button className="pill-button" onClick={() => {
      const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks, notes, logs, settings }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `yukino-focus-${today}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}><Download size={15} />导出记录</button></div>
  </div>;
}
