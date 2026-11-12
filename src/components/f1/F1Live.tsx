import { useEffect, useRef, useState } from "react";
import { Radio, Play, Tv, ExternalLink } from "lucide-react";
import { useF1Data } from "@/hooks/useF1Data";
import { BROADCAST_INFO, F1_TIMING, SESSION_NAMES, formatF1Date, sessionState } from "@/lib/f1";
import type { F1Meeting, F1Session, LiveData } from "@/lib/f1";
import { DataStatus, External } from "./F1Common";
import { F1RaceDashboard } from "./F1RaceDashboard";

const STATE_NAMES = { live: "计时更新中", finished: "已结束 · 历史记录", upcoming: "尚未开始", unavailable: "计时暂不可用", cancelled: "场次已取消" };
type HlsInstance = { loadSource: (url: string) => void; attachMedia: (media: HTMLVideoElement) => void; destroy: () => void; on: (event: string, callback: (...args: any[]) => void) => void };
type HlsClass = { new(options?: object): HlsInstance; isSupported: () => boolean; Events: { ERROR: string } };
let hlsLoading: Promise<HlsClass> | undefined;
function loadHls(): Promise<HlsClass> {
  const get = () => (window as unknown as { Hls?: HlsClass }).Hls;
  if (get()) return Promise.resolve(get()!);
  if (!hlsLoading) hlsLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script"); script.src = "/f1-player/hls-1.6.13.min.js";
    const timer = setTimeout(() => { script.remove(); hlsLoading = undefined; reject(new Error("播放器加载超时，请检查网络")); }, 12000);
    script.onload = () => { clearTimeout(timer); const Hls = get(); if (Hls) resolve(Hls); else { hlsLoading = undefined; reject(new Error("播放器暂时无法加载")); } };
    script.onerror = () => { clearTimeout(timer); script.remove(); hlsLoading = undefined; reject(new Error("播放器组件无法加载，请检查网络")); };
    document.head.appendChild(script);
  });
  return hlsLoading;
}
export function StreamPlayer() {
  const [input, setInput] = useState(""), [mode, setMode] = useState("hls"), [active, setActive] = useState<{ url: string; mode: string } | null>(null), [error, setError] = useState("");
  const media = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = media.current; if (!active || !video) return;
    let stopped = false, instance: HlsInstance | undefined;
    setError("");
    if (active.mode === "mp4") video.src = active.url;
    else void loadHls().then((Hls) => {
      if (stopped) return;
      // Chromium can report native HLS support while failing on some streams.
      if (!Hls.isSupported()) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) video.src = active.url;
        else setError("当前浏览器不支持该直播格式，请打开来源平台观看");
        return;
      }
      instance = new Hls({ enableWorker: true, lowLatencyMode: true, maxBufferLength: 30 });
      instance.on(Hls.Events.ERROR, (_event, detail) => { if (detail?.fatal && !stopped) setError("直播源无法播放或需要来源方允许跨域访问。可直接在来源平台观看。"); });
      instance.loadSource(active.url); instance.attachMedia(video);
    }).catch((e) => {
      if (stopped) return;
      if (video.canPlayType("application/vnd.apple.mpegurl")) video.src = active.url;
      else setError(e.message);
    });
    return () => { stopped = true; instance?.destroy(); video.pause(); video.removeAttribute("src"); video.load(); };
  }, [active]);
  function open() {
    try { const url = new URL(input.trim()); if (url.protocol !== "https:" || url.username || url.password) throw new Error(); setError(""); setActive({ url: url.href, mode }); }
    catch { setError("请输入有效的 HTTPS 播放地址"); }
  }
  return <div className="f1-stream"><div className="f1-stream-head"><Tv size={19}/><div><h3>站内直播播放器</h3><p>播放你拥有观看权限的 HLS / MP4 地址</p></div></div>{active ? <video ref={media} controls playsInline aria-label="直播视频播放器" onError={() => setError("播放地址无法读取，请检查来源、格式和观看权限")}/> : <div className="f1-video-empty"><Play size={32}/><span>选择下方官方平台观看，或接入自己的播放源</span></div>}<form onSubmit={(event) => { event.preventDefault(); open(); }} className="f1-stream-form"><input aria-label="直播源地址" type="url" placeholder="https://…/stream.m3u8" value={input} onChange={(event) => setInput(event.target.value)} required/><select aria-label="直播源格式" value={mode} onChange={(event) => setMode(event.target.value)}><option value="hls">HLS</option><option value="mp4">MP4</option></select><button type="submit" className="f1-button f1-button-dark"><Play size={14}/>加载</button></form>{error && <p className="f1-warning" role="alert">{error}</p>}<p className="f1-footnote">播放地址仅在当前页面使用。F1 官方转播请在授权平台登录；本站未提供赛事视频信号。</p></div>;
}
export function WatchLinks() {
  return <div className="f1-watch-links"><External href="https://f1tv.formula1.com/"><Tv size={18}/><span><strong>F1 TV</strong><small>官方直播、车载视角与回放 · 地区及订阅限制</small></span></External><External href="https://sports.qq.com/"><Play size={18}/><span><strong>腾讯体育</strong><small>中国大陆 · F1 转播与节目安排</small></span></External><External href="https://connect-sg.beinsports.com/"><Play size={18}/><span><strong>beIN SPORTS</strong><small>新加坡 · 赛事直播与回放</small></span></External><External href={BROADCAST_INFO}><ExternalLink size={18}/><span><strong>全球转播查询</strong><small>按所在地查找官方授权平台</small></span></External></div>;
}
export function F1Live({ year, sessions, meetings, sessionKey, timezone, onSelect }: { year: number; sessions: F1Session[]; meetings: F1Meeting[]; sessionKey: string; timezone: string; onSelect: (key: string) => void }) {
  const selected = sessions.find((session) => String(session.session_key) === sessionKey);
  const poll = sessionKey === "latest" || selected && ["live", "upcoming"].includes(sessionState(selected)) ? 30 : 0;
  const result = useF1Data<LiveData>(`action=live&year=${year}&session=${sessionKey}`, poll);
  const [highlight, setHighlight] = useState(false);
  const current = result.data && (sessionKey === "latest" || !result.data.session || String(result.data.session.session_key) === sessionKey) ? result.data : null;
  const live = current?.restricted && current.state === "live" ? { ...current, state: "unavailable" as const } : current;
  const recent = sessions.filter((session) => !session.is_cancelled).sort((a, b) => b.date_start.localeCompare(a.date_start));
  return <section className="f1-section">
    <div className="f1-section-heading"><div><p className="f1-eyebrow">THE RACE, AS IT HAPPENS</p><h2>比赛中心</h2></div><label className="f1-session-select">场次<select value={sessionKey} onChange={(event) => onSelect(event.target.value)}><option value="latest">最新 / 当前场次</option>{recent.map((session) => <option key={session.session_key} value={session.session_key}>{session.location} · {SESSION_NAMES[session.session_name] || session.session_name} · {formatF1Date(session.date_start, timezone)}</option>)}</select></label></div>
    <div className="f1-live-banner"><div><span className={`f1-live-label ${live?.state === "live" && !result.error ? "is-live" : ""}`}><Radio size={14}/>{live ? result.error ? "更新中断 · 上次记录" : STATE_NAMES[live.state] : "连接计时源"}</span>{live?.session && <h3>{live.session.location} · {SESSION_NAMES[live.session.session_name] || live.session.session_name}</h3>}<p>{live?.session ? `${formatF1Date(live.session.date_start, timezone)} · ${live.session.circuit_short_name}` : "选择比赛周末场次，查看计时、旗帜与天气"}</p></div><External href={F1_TIMING} className="f1-button">官方实时计时</External></div>
    <DataStatus {...result} timezone={timezone}/>
    {live?.asOf && <p className="f1-footnote">赛道数据时间：{formatF1Date(live.asOf, timezone, { second: "2-digit" })}。页面检查时间与赛道数据时间分别显示。</p>}
    {live?.restricted && <div className="f1-warning">实时数据通道尚未取得有效订阅授权。官方计时和视频入口可继续使用；本站计时面板将在接入服务端凭据后更新。</div>}
    <F1RaceDashboard live={live} session={live?.session || selected} meetings={meetings} year={year} timezone={timezone} loading={result.loading}/>
    <div className="f1-section-heading"><div><p className="f1-eyebrow">WATCH YOUR WAY</p><h2>找到你的观赛席</h2></div><External href={BROADCAST_INFO}>转播信息来源</External></div>
    <WatchLinks/>
    <div className="f1-video-layout"><StreamPlayer/><div className="f1-highlight"><h3>经典回看 · 新加坡 2025</h3><p>FORMULA 1 官方正赛集锦</p>{highlight ? <iframe title="2025 新加坡大奖赛官方集锦" src="https://www.youtube-nocookie.com/embed/XZhXFbFCOu4" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen/> : <button className="f1-highlight-play" onClick={() => setHighlight(true)}><Play size={30}/><span>加载官方视频</span></button>}<External href="https://www.youtube.com/watch?v=XZhXFbFCOu4">在 YouTube 上观看</External><External href="https://www.formula1.com/en/video">更多官方视频与集锦</External><p className="f1-footnote">这是历史集锦。视频嵌入与播放受来源平台和地区网络影响。</p></div></div>
  </section>;
}
