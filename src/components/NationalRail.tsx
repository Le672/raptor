import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, LocateFixed, Search, TrainFront } from "lucide-react";
import { NationalRailMap } from "./NationalRailMap";
import { beijingDay, nationalCategories, nationalTrainsAt, parseNationalTimetable } from "../lib/rail-national";
import type { NationalCategory, NationalTimetable, NationalTrain } from "../lib/rail-national";
import type { Coordinate } from "../lib/train-position";
import "./rail-national.css";

const clock = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const stopClock = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const PAGE_SIZE = 30;

export default function NationalRail({ onPosition }: { onPosition: (train: string, date: string) => void }) {
  const [data, setData] = useState<NationalTimetable>();
  const [error, setError] = useState("");
  const [mapNotice, setMapNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<NationalCategory | "all">("all");
  const [selectedId, setSelectedId] = useState("");
  const [page, setPage] = useState(0);
  const [reset, setReset] = useState(0);
  const [focus, setFocus] = useState<{ id: number; point: Coordinate } | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 2000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const response = await fetch("/api/rail-national", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]) });
        if (!response.ok) throw new Error();
        const next = parseNationalTimetable(await response.json());
        if (!controller.signal.aborted) {
          setData(next);
          setError("");
        }
      } catch {
        if (!controller.signal.aborted) setError("时刻表更新失败，请稍后重试。");
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 20 * 60_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [retry]);

  const today = beijingDay(now);
  const todayPlan = data?.days.find(([date]) => date === today);
  const active = useMemo(() => data ? nationalTrainsAt(data, now) : [], [data, now]);
  const filtered = useMemo(() => {
    const key = query.trim().toUpperCase();
    return active.filter(train => (category === "all" || train.category === category)
      && (!key || [train.code, train.from, train.to, train.previous, train.next].some(value => value.includes(key))))
      .sort((a, b) => a.nextAt - b.nextAt || a.code.localeCompare(b.code, "zh-CN"));
  }, [active, category, query]);
  const selected = filtered.find(train => train.id === selectedId);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const mapped = active.reduce((count, train) => count + Number(!!train.point), 0);
  const inMotion = active.reduce((count, train) => count + Number(!train.stopped), 0);
  const recentDays = data?.days.filter(([date]) => date <= today && Date.parse(today) - Date.parse(date) <= 4 * 86400_000);
  const rosterGaps = recentDays?.some(([date, , count]) => date < today && count === null);
  const select = (train: NationalTrain) => {
    setSelectedId(train.id);
    if (train.point) setFocus({ id: Date.now(), point: train.point });
  };

  return (
    <section className="rail-national" aria-labelledby="rail-national-heading">
      <header className="rail-national-header">
        <div>
          <h2 id="rail-national-heading"><TrainFront size={26} aria-hidden="true" /> 全国运行图</h2>
          <p>按当前北京时间推算全国铁路客运列车的位置。</p>
        </div>
        <div className="rail-national-clock"><span>{today} · 北京时间</span><time dateTime={new Date(now).toISOString()}>{clock.format(now)}</time></div>
      </header>
      <div className="rail-national-metrics">
        <div><strong>{todayPlan ? active.length.toLocaleString("zh-CN") : "—"}</strong><span>行程进行中</span></div>
        <div><strong>{todayPlan ? inMotion.toLocaleString("zh-CN") : "—"}</strong><span>区间行驶</span></div>
        <div><strong>{todayPlan ? (active.length - inMotion).toLocaleString("zh-CN") : "—"}</strong><span>中途停站</span></div>
        <div><strong>{todayPlan ? mapped.toLocaleString("zh-CN") : "—"}</strong><span>地图可定位</span></div>
      </div>
      <div className="rail-national-toolbar">
        <div className="rail-national-filters" role="group" aria-label="列车类别">
          <button type="button" aria-pressed={category === "all"} onClick={() => { setCategory("all"); setPage(0); }}>全部</button>
          {(Object.entries(nationalCategories) as [NationalCategory, typeof nationalCategories[NationalCategory]][]).map(([id, value]) =>
            <button key={id} type="button" aria-pressed={category === id} onClick={() => { setCategory(id); setPage(0); }}>
              <i style={{ background: value.color }} />{value.label}
            </button>)}
        </div>
        <button type="button" className="rail-national-reset" onClick={() => setReset(value => value + 1)}><LocateFixed size={16} /> 全国视图</button>
      </div>
      <div className="rail-national-grid">
        <div className="rail-national-map-panel">
          <NationalRailMap trains={filtered} selected={selected} onSelect={setSelectedId} reset={reset} focus={focus} onMapNotice={setMapNotice} />
          <div className="rail-national-map-caption">
            <span>圆点代表车次，数字代表该区域合并显示的车次数。</span>
            {mapNotice && <span role="status">{mapNotice}</span>}
          </div>
        </div>
        <aside className="rail-national-side" aria-label="车次列表">
          <label className="rail-national-search">
            <Search size={16} aria-hidden="true" />
            <input aria-label="搜索车次或车站" placeholder="搜索车次或车站" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} />
          </label>
          {selected && <article className="rail-national-detail">
            <div><strong>{selected.code}</strong><span>{selected.stopped ? "中途停站" : "区间行驶"}</span></div>
            <p>{selected.from} → {selected.to}</p>
            <p>{selected.stopped ? `停靠 ${selected.previous}` : `${selected.previous} → ${selected.next}`}</p>
            <p>下一站 {selected.next} · 计划 {stopClock.format(selected.nextAt)}</p>
            <small>{selected.date} 始发 · {selected.stopped ? "按停站时刻推算" : selected.path ? "按铁路路径推算" : selected.point ? "站间直线粗估" : "缺少站点坐标"}</small>
            <button type="button" onClick={() => onPosition(selected.code, selected.date)}>查看位置与停站表 <ArrowUpRight size={15} /></button>
          </article>}
          <div className="rail-national-list-meta"><strong>当前车次</strong><span>{todayPlan ? `${filtered.length.toLocaleString("zh-CN")} 趟` : "—"}</span></div>
          <ul className="rail-national-trains">
            {filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map(train => <li key={train.id}>
              <button type="button" aria-pressed={train.id === selectedId} onClick={() => select(train)}>
                <i style={{ background: nationalCategories[train.category].color }} /><strong>{train.code}</strong>
                <span>{train.stopped ? "停靠 " + train.previous : `${train.previous} → ${train.next}`}</span>
              </button>
            </li>)}
            {!filtered.length && <li className="rail-national-empty">{!data && !error ? "正在加载全国时刻表…" : !todayPlan ? "当日时刻表暂不可用。" : "没有符合当前条件的列车。"}</li>}
          </ul>
          {totalPages > 1 && <div className="rail-national-pages">
            <button type="button" disabled={!currentPage} onClick={() => setPage(currentPage - 1)} aria-label="上一页"><ChevronLeft size={18} /></button>
            <span>{currentPage + 1} / {totalPages}</span>
            <button type="button" disabled={currentPage + 1 === totalPages} onClick={() => setPage(currentPage + 1)} aria-label="下一页"><ChevronRight size={18} /></button>
          </div>}
        </aside>
      </div>
      <footer className="rail-national-source">
        {error && <div role="status">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>重新加载</button></div>}
        {data && <p>时刻表快照 {data.feedDate}。{todayPlan && `当日纳入 ${todayPlan[1].toLocaleString("zh-CN")} 趟计划车次。`}
          {todayPlan && (todayPlan[2] === null ? "今日按开放时刻表的开行日历推算。" : "今日车次已与 12306 日期车次表核对。")}
          {rosterGaps && "部分跨日班次按开放时刻表的开行日历推算。"}{" "}
          <a href={data.feedUrl} target="_blank" rel="noreferrer">中国铁路 GTFS · wensimehrp</a>{" · "}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>（数据经筛选和简化）
        </p>}
        <p>位置为时刻表估算，缺少线路几何时按站间直线粗估。地图无法反映临时停运、晚点或改线，乘车请核对 12306。</p>
      </footer>
    </section>
  );
}
