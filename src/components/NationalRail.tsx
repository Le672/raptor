import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Layers, LocateFixed, Search, TrainFront } from "lucide-react";
import { NationalRailMap } from "./NationalRailMap";
import { beijingDay, categoryOf, nationalCategories, nationalTrainsAt, parseNationalTimetable } from "../lib/rail-national";
import type { NationalCategory, NationalTimetable, NationalTrain } from "../lib/rail-national";
import type { Coordinate } from "../lib/train-position";
import { DETAIL_ZOOM, dwellForTrain, platformTrainBody, symbolLength } from "../lib/rail-national-detail";
import type { RailViewport } from "../lib/rail-national-detail";
import { equipmentKey, useNationalRailDetail } from "../hooks/useNationalRailDetail";
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
  const [focus, setFocus] = useState<{ point: Coordinate; zoom?: number } | null>(null);
  const [showBasemap, setShowBasemap] = useState(true);
  const [view, setView] = useState<RailViewport | null>(null);

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
  const { geometry, arrivals, equipment } = useNationalRailDetail(view, filtered, selected);
  const station = view?.station ? data?.stations.find(item => item[0] === view.station) : undefined;
  const stationMatches = useMemo(() => {
    const term = query.trim().toUpperCase();
    if (!term || !data) return [];
    return data.stations.filter(([code, name]) => code === term || name.includes(term))
      .sort((a, b) => Number(b[1] === term) - Number(a[1] === term)).slice(0, 4);
  }, [data, query]);
  const activeDwell = useMemo(() => arrivals?.data?.rows.filter(row => row.arrivalAt <= now && row.departureAt > now) || [], [arrivals, now]);
  const selectedLength = selected ? symbolLength(selected, equipment[equipmentKey(selected)]) : null;
  const selectedAssignment = selected?.stopped && selected.stationCode === view?.station ? dwellForTrain(selected, activeDwell) : undefined;
  const detailZoom = view?.zoom ?? 0;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const mapped = active.reduce((count, train) => count + Number(!!train.point), 0);
  const inMotion = active.reduce((count, train) => count + Number(!train.stopped), 0);
  const recentDays = data?.days.filter(([date]) => date <= today && Date.parse(today) - Date.parse(date) <= 4 * 86400_000);
  const rosterGaps = recentDays?.some(([date, , count]) => date < today && count === null);
  const select = (train: NationalTrain) => {
    setSelectedId(train.id);
    if (train.point) setFocus({ point: train.point, zoom: train.stopped ? DETAIL_ZOOM.station + 1 : DETAIL_ZOOM.lengths });
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
        <div className="rail-national-view-actions">
          <button type="button" aria-pressed={!showBasemap} onClick={() => setShowBasemap(value => !value)}><Layers size={16} /> 仅铁路</button>
          <button type="button" className="rail-national-reset" onClick={() => setReset(value => value + 1)}><LocateFixed size={16} /> 全国视图</button>
        </div>
      </div>
      <div className="rail-national-grid">
        <div className="rail-national-map-panel">
          <NationalRailMap trains={filtered} stations={data?.stations || []} selected={selected} onSelect={setSelectedId}
            reset={reset} focus={focus} showBasemap={showBasemap} onMapNotice={setMapNotice} onView={setView}
            geometry={geometry?.data} arrivals={activeDwell} equipment={equipment} />
          <div className="rail-national-map-caption">
            <span>{detailZoom >= DETAIL_ZOOM.station ? "琥珀色轮廓为站台。虚线车身沿站台示意，具体股道未确认。"
              : detailZoom >= DETAIL_ZOOM.lengths ? "车身沿估算路径按地图比例显示，继续放大可查看附近车站的站台。"
              : "滚轮可缩放。圆点代表车次，数字为聚合车次数。放大后显示轨道、车身和站台。"}</span>
            {mapNotice && <span role="status">{mapNotice}</span>}
          </div>
        </div>
        <aside className="rail-national-side" aria-label="车次列表">
          <label className="rail-national-search">
            <Search size={16} aria-hidden="true" />
            <input aria-label="搜索车次或车站" placeholder="搜索车次或车站" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} />
          </label>
          {stationMatches.length > 0 && <div className="rail-national-station-matches" aria-label="车站地图定位">
            {stationMatches.map(([code, name, lon, lat]) => <button key={code} type="button" onClick={() => {
              setQuery(""); setPage(0); setSelectedId(""); setFocus({ point: [lon, lat], zoom: 17 });
            }}><LocateFixed size={13} /> {name}</button>)}
          </div>}
          {selected && <article className="rail-national-detail">
            <div><strong>{selected.code}</strong><span>{selected.stopped ? "中途停站" : "区间行驶"}</span></div>
            <p>{selected.from} → {selected.to}</p>
            <p>{selected.stopped ? `停靠 ${selected.previous}` : `${selected.previous} → ${selected.next}`}</p>
            <p>下一站 {selected.next} · 计划 {stopClock.format(selected.nextAt)}</p>
            {selectedAssignment?.platform && <p>12306 站台 {selectedAssignment.platform}{selectedAssignment.wicket ? ` · 检票口 ${selectedAssignment.wicket}` : ""}</p>}
            {selectedLength && <p>{selectedLength.source === "12306" ? "" : "约 "}{selectedLength.meters} 米
              {selectedLength.coaches ? ` · ${selectedLength.coaches} 辆` : ""} · {selectedLength.source}</p>}
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
      {station && <section className="rail-national-station-detail" aria-label={station[1] + "站台详情"}>
        <div className="rail-national-station-heading">
          <h3>{station[1]}站台详情</h3>
          <span>{geometry?.data ? `地图收录 ${geometry.data.platforms.length} 处站台轮廓或边线`
            : geometry?.failed ? "站台地图暂不可用" : geometry ? "地图暂无本站站台轮廓" : "正在读取站台地图…"}</span>
        </div>
        <p>显示 12306 时刻表中此刻处于中途停站窗口的列车。长度示意条共用 800 米量程。</p>
        {activeDwell.length ? <ul className="rail-national-berths">
          {activeDwell.map(row => {
            const train = active.find(item => item.stationCode === station[0] && dwellForTrain(item, [row]));
            const code = train?.code || row.train;
            const length = symbolLength({ code, category: categoryOf(code) }, equipment[equipmentKey({ code, date: row.originDate })]);
            const mapped = geometry?.data && row.platform ? platformTrainBody(geometry.data, row.platform, length.meters) : null;
            return <li key={`${row.trainNo}/${row.originDate}`}>
              <div><strong>{row.train}</strong><span>{row.platform ? `${row.platform} · 12306` : "站台未提供"}</span></div>
              <p>{row.from} → {row.to}</p>
              <p>{stopClock.format(row.arrivalAt)} 到 · {stopClock.format(row.departureAt)} 发{row.wicket ? ` · 检票口 ${row.wicket}` : ""}</p>
              <div className="rail-national-length-bar" aria-hidden="true"><i style={{ width: `${length.meters / 8}%`, background: nationalCategories[categoryOf(code)].color }} /></div>
              <small>{length.source === "12306" ? "" : "约 "}{length.meters} 米{length.coaches ? ` · ${length.coaches} 辆` : ""} · {length.source}
                {row.platform && !mapped ? " · 站台号未匹配地图几何" : mapped && !mapped.track ? " · 车身沿站台示意" : ""}</small>
              <button type="button" onClick={() => {
                if (train && filtered.some(item => item.id === train.id)) setSelectedId(train.id);
                else onPosition(row.train, row.originDate);
              }}>{train && filtered.some(item => item.id === train.id) ? "选中车次" : "打开车次详情"} <ArrowUpRight size={14} /></button>
            </li>;
          })}
        </ul> : <p role="status">{arrivals?.failed ? "12306 站台数据暂不可用。" : arrivals?.data ? "暂无处于中途停站窗口的列车。" : "正在读取 12306 停站和站台…"}</p>}
        {arrivals?.data?.truncated && <p>本站当前只展示计划最早发车的 30 趟停站列车。</p>}
      </section>}
      <footer className="rail-national-source">
        {error && <div role="status">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>重新加载</button></div>}
        {data && <p>时刻表快照 {data.feedDate}。{todayPlan && `当日纳入 ${todayPlan[1].toLocaleString("zh-CN")} 趟计划车次。`}
          {todayPlan && (todayPlan[2] === null ? "今日按开放时刻表的开行日历推算。" : "今日车次已与 12306 日期车次表核对。")}
          {rosterGaps && "部分跨日班次按开放时刻表的开行日历推算。"}{" "}
          <a href={data.feedUrl} target="_blank" rel="noreferrer">中国铁路 GTFS · wensimehrp</a>{" · "}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>（数据经筛选和简化）
        </p>}
        <p>位置按时刻表估算，车身长度优先取 12306 编组资料，缺失时按类别画示意长度。地图无法反映临时停运、晚点或改线，乘车请核对 12306。</p>
      </footer>
    </section>
  );
}
