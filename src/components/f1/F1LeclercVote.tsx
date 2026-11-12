import { useCallback, useEffect, useRef, useState } from "react";
import { Check, LogIn, RefreshCw, Vote } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/hooks/useAuthStore";
import { formatRaceDate, raceName } from "@/lib/f1";
import type { P4Choice, P4Poll } from "@/lib/f1-community";

export function F1LeclercVote({ timezone }: { timezone: string }) {
  const token = useAuthStore(state => state.token);
  const [data, setData] = useState<P4Poll | null>(null), [error, setError] = useState("");
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [message, setMessage] = useState("");
  const version = useRef(0), busy = useRef(false), clockOffset = useRef(0);
  const [, tick] = useState(0);
  const load = useCallback(async () => {
    if (busy.current) return;
    const identity = ++version.current;
    setLoading(true);
    try {
      const result = await api.getLeclercPoll();
      if (version.current !== identity) return;
      clockOffset.current = Date.parse(result.serverTime) - Date.now() || 0;
      setData(result); setError("");
    } catch (failure) { if (version.current === identity) setError(failure instanceof Error ? failure.message : "投票暂不可用"); }
    finally { if (version.current === identity) setLoading(false); }
  }, [token]);
  useEffect(() => {
    busy.current = false; setSaving(false); setData(null); setMessage(""); void load();
    const onVisible = () => { if (document.visibilityState !== "hidden") { tick(value => value + 1); void load(); } };
    const interval = setInterval(onVisible, 30000);
    document.addEventListener("visibilitychange", onVisible);
    return () => { version.current++; clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);
  const poll = data?.poll;
  const closed = !!poll && Date.now() + clockOffset.current >= Date.parse(poll.closesAt);
  const vote = async (choice: P4Choice) => {
    if (!poll || !data.authenticated || closed || busy.current) return;
    const identity = ++version.current;
    busy.current = true; setSaving(true); setMessage(""); setError("");
    try {
      const result = await api.voteLeclerc(poll.key, choice);
      if (version.current === identity) { setData(result); setMessage(`已${data.myVote ? "更新" : "记录"}你的预测：${choice === "yes" ? "能拿第四" : "不能拿第四"}。`); }
    } catch (failure) { if (version.current === identity) setError(failure instanceof Error ? failure.message : "投票未保存"); }
    finally { busy.current = false; if (version.current === identity) { setSaving(false); setLoading(false); } }
  };
  return <article className="f1-leclerc-poll" id="leclerc-next-race-vote" aria-labelledby="f1-poll-title">
    <div className="f1-poll-intro"><p className="f1-eyebrow"><Vote size={14}/> THE NEXT P4?</p><h2 id="f1-poll-title">下场大奖赛，Charles 能拿第四吗？</h2><p>下一场的答案，交给方格旗。先留下你的预测。</p>{poll ? <div className="f1-poll-race"><strong>{raceName(poll.race.raceName)}</strong><span>{poll.race.season} · R{poll.race.round} · {formatRaceDate(poll.race, timezone)}</span><small>{closed ? "本场投票已截止，正在切换下场赛事。" : "正赛开始时截止 · 每个账号一票 · 截止前可改选"}</small></div> : <p className="f1-footnote">{loading ? "正在读取下场大奖赛…" : error ? "赛历或投票数据暂不可用" : "下场大奖赛赛历尚未公布，投票暂未开放。"}</p>}</div>
    <div className="f1-poll-ballot">
      {poll && <><div className="f1-poll-choices" aria-label="预测勒克莱尔下场正赛能否第四">{([ ["yes", "能，P4 见", "YES"], ["no", "不能，换个名次", "NO"] ] as const).map(([choice, label, word]) => { const n = data.counts[choice], percentage = data.counts.total ? Math.round(n / data.counts.total * 100) : 0; return <div className={`f1-poll-option choice-${choice}`} key={choice}><button type="button" disabled={!data.authenticated || closed || loading || saving || !!error} aria-pressed={data.myVote === choice} onClick={() => void vote(choice)}><span>{word}</span><strong>{label}</strong>{data.myVote === choice && <Check size={15} aria-label="我的选择"/>}</button><div className="f1-poll-distribution"><span>{n} 票</span><strong>{percentage}%</strong></div><div className="f1-poll-bar" role="progressbar" aria-label={`${label}投票比例`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><i style={{width:`${percentage}%`}}/></div></div>; })}</div><p className="f1-poll-total">{data.counts.total} 人参与{saving ? " · 正在保存…" : data.myVote ? " · 你已投票，可点击另一项改选" : ""}</p>{!data.authenticated && <a className="f1-button f1-poll-login" href={`/login?next=${encodeURIComponent("/f1?tab=leclerc#leclerc-next-race-vote")}`}><LogIn size={14}/>登录后投票</a>}</>}
      <div className="f1-poll-message" aria-live="polite">{message && <p>{message}</p>}{error && <p role="alert">{error}</p>}</div>
      <button type="button" className="f1-text-button" disabled={loading || saving} onClick={() => void load()}><RefreshCw size={12}/>{loading ? "更新中…" : "刷新投票"}</button>
      <p className="f1-footnote">车迷预测票数与上方的最终比赛成绩分开展示。</p>
    </div>
  </article>;
}
