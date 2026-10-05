import { useState } from "react";
import { ArrowRight, Flag, Trophy } from "lucide-react";
import { useF1Data } from "@/hooks/useF1Data";
import { formatRaceDate, raceName } from "@/lib/f1";
import type { LeclercData } from "@/lib/f1";
import { DataStatus, Empty, External } from "./F1Common";
import { F1DriverName, F1TeamName } from "./F1Identity";

const CHARLES = { driverId: "leclerc", givenName: "Charles", familyName: "Leclerc" };
export function F1Leclerc({ year, timezone, onResult }: { year: number; timezone: string; onResult: (values: Record<string, string>) => void }) {
  const query = useF1Data<LeclercData>(`action=leclerc&year=${year}`, 300);
  const data = query.data, current = data?.current;
  const position = current?.result?.position;
  const known = !!position && /^[1-9]\d?$/.test(position);
  const answer = known ? position === "4" ? "YES" : "NO" : "WAIT";
  const fourths = data?.fourths || [];
  const [filter, setFilter] = useState("all"), [historyYear, setHistoryYear] = useState("all");
  const years = [...new Set(fourths.map(entry => entry.race.season))].sort((a, b) => Number(b) - Number(a));
  const entries = fourths.filter(entry => (filter === "all" || entry.kind === filter) && (historyYear === "all" || entry.race.season === historyYear));
  const raceFourths = fourths.filter(entry => entry.kind === "results"), sprintFourths = fourths.filter(entry => entry.kind === "sprint");
  const dual = new Set(raceFourths.map(entry => `${entry.race.season}:${entry.race.round}`));
  const complete = !!data?.available.results && !!data?.available.sprint;
  return <section className="f1-section f1-leclerc-section">
    <div className="f1-section-heading"><div><p className="f1-eyebrow">THE P4 CLUB · 16</p><h1 className="f1-section-title">勒克莱尔今天拿第四了吗？</h1></div><span className="f1-leclerc-badge"><Flag size={14}/>一个有成绩依据的围场玩笑</span></div>
    <DataStatus {...query} timezone={timezone}/>
    <article className={`f1-leclerc-answer answer-${answer.toLowerCase()}`} aria-live="polite">
      <div className="f1-leclerc-verdict">
        <p className="f1-eyebrow">{year} · 最近已公布的正赛</p>
        <strong className="f1-leclerc-answer-word">{query.loading && !data ? "…" : answer}</strong>
        <h2>{answer === "YES" ? "熟悉的位置，熟悉的 Charles。" : answer === "NO" ? `这次是 P${position}，今天不进第四名俱乐部。` : query.error || data && !data.available.current ? "暂时读不到成绩，答案先留白。" : current ? "还没有读取到他的最终成绩，先等等。" : "成绩还没到，先等等方格旗。"}</h2>
        {current && <div className="f1-leclerc-current"><h3>{raceName(current.race.raceName)}</h3><p>{current.race.season} · 第 {current.race.round} 站 · {formatRaceDate(current.race, timezone)}</p><p>{current.race.Circuit.circuitName}</p>{current.result && <p className="f1-leclerc-classification">最终名次 <b>{known ? `P${position}` : "待确认"}</b><span>{current.result.Time?.time || current.result.status || "时间待公布"}</span><span>{current.result.points ?? "—"} PTS</span></p>}<button className="f1-text-button" onClick={() => onResult({ tab: "results", year: current.race.season, round: current.race.round, kind: "results" })}>查看完整比赛成绩<ArrowRight size={14}/></button></div>}
        <p className="f1-footnote">“今天”参考所选赛季最近公布的正赛成绩；不是比赛中的临时排名。没有成绩时不判为 NO。</p>
      </div>
      <div className="f1-leclerc-hero-photo" aria-hidden="true"><F1DriverName driver={CHARLES} year={2026} withPhoto={false}/><img src="/f1/portraits/2026/charles-leclerc.webp" alt="" loading="lazy"/><small>16 · 2026 官方资料照</small></div>
    </article>
    <div className="f1-leclerc-stats">
      <div><span>正赛 P4</span><strong>{data?.available.results ? raceFourths.length : "—"}</strong><small>职业生涯全部正赛</small></div>
      <div><span>冲刺赛 P4</span><strong>{data?.available.sprint ? sprintFourths.length : "—"}</strong><small>冲刺赛单独统计</small></div>
      <div><span>周末双 P4</span><strong>{complete ? sprintFourths.filter(entry => dual.has(`${entry.race.season}:${entry.race.round}`)).length : "—"}</strong><small>同一站正赛与冲刺都第四</small></div>
    </div>
    <div className="f1-section-heading f1-leclerc-history-heading"><div><p className="f1-eyebrow">EVERY FOURTH PLACE, ON RECORD</p><h2>第四名收藏册</h2><p className="f1-footnote">{complete ? "已完整读取职业生涯正赛与冲刺赛成绩" : query.loading ? "正在读取职业生涯记录…" : "部分记录暂不可用，以下展示已读取的场次"} · {fourths.length} 条 P4 记录</p></div><Trophy size={22}/></div>
    <div className="f1-controls f1-leclerc-history-controls"><div className="f1-switch" aria-label="第四名场次类别">{[{value:"all",label:"全部场次"},{value:"results",label:"正赛 P4"},{value:"sprint",label:"冲刺赛 P4"}].map(option => <button key={option.value} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}</button>)}</div><label>历史赛季<select value={historyYear} onChange={event => setHistoryYear(event.target.value)}><option value="all">全部赛季</option>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label><span className="f1-footnote">{entries.length} 条符合筛选</span></div>
    {entries.length ? <div className="f1-table-wrap"><table className="f1-table f1-leclerc-history"><caption className="sr-only">勒克莱尔正赛与冲刺赛第四名全部场次</caption><thead><tr><th>赛季 / 站次</th><th>大奖赛</th><th>场次</th><th>车队</th><th>成绩</th><th>回看</th></tr></thead><tbody>{entries.map(entry => <tr key={`${entry.race.season}-${entry.race.round}-${entry.kind}`}><td className="f1-mono">{entry.race.season}<small>R{entry.race.round}</small></td><td><strong>{raceName(entry.race.raceName)}</strong><small>{entry.race.Circuit.circuitName}</small></td><td><span className={`f1-leclerc-kind kind-${entry.kind}`}>{entry.kind === "results" ? "正赛" : "冲刺赛"}</span></td><td><F1TeamName year={Number(entry.race.season)} team={entry.result.Constructor} compact/></td><td><b className="f1-leclerc-p4">P4</b><small>{entry.result.points ?? "—"} PTS · {entry.result.Time?.time || entry.result.status || "—"}</small></td><td><button className="f1-text-button" onClick={() => onResult({ tab: "results", year: entry.race.season, round: entry.race.round, kind: entry.kind })}>成绩<ArrowRight size={13}/></button></td></tr>)}</tbody></table></div> : !query.loading && <Empty>{complete ? "这个筛选下，Charles 没有拿过第四。" : "完整记录暂不可用，请刷新重试。"}</Empty>}
    <p className="f1-footnote">仅按已公布的最终名次统计正赛与冲刺赛，不计排位赛。改判后以数据源更新的成绩为准。历史列表覆盖整个职业生涯，不受顶端赛季选择限制。</p>
    <External href="https://www.formula1.com/en/drivers/charles-leclerc">Charles Leclerc · 官方车手资料</External>
  </section>;
}
