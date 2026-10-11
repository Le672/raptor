import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDown, ArrowUpRight, Check, Download, Gauge, Globe2, Github, HardDrive, Layers3, LockKeyhole, Pause, Play, Radio, RotateCcw, Search, Square, Timer, UnlockKeyhole, Zap } from 'lucide-react';
import { DownloadRunner, formatBytes, formatDuration, validateConfig } from './engine.mjs';
import { Reporter, fetchApi, readRuns, saveRun } from './storage.mjs';
import { SERVERS, SERVER_GROUPS, COUNTRIES } from './servers';
import { filterServers } from './catalog.mjs';
import type { Server } from './servers';
import './speed.css';

declare global { interface Window { yukinoSpeed?: { version: string; start: (config: any) => Promise<any>; pause: () => Promise<any>; resume: () => Promise<any>; stop: () => Promise<any>; limits: (value: any) => Promise<any>; state: () => Promise<any>; records: () => Promise<any[]>; onState: (fn: (state: any) => void) => () => void; probe: (input: string | { url: string; referrer?: string }) => Promise<any> } } }
const EMPTY = { id: '', status: 'idle', bytes: 0, elapsedMs: 0, rateBps: 0, averageBps: 0, peakBps: 0, history: [], workers: [], message: '', config: null, startedAt: '' };
const LABELS = { idle: '准备就绪', running: '正在下载', paused: '已暂停', completed: '任务完成', stopped: '已结束', error: '连接失败' };
const REPO = 'https://github.com/Le672/yukino-speed';
function effectiveUrl(value: string) {
  const text = value.trim();
  if (/^(https?:\/\/)?speed\.cloudflare\.com\/?$/.test(text)) return 'https://speed.cloudflare.com/__down';
  return text;
}
function safeSettings() { try { return JSON.parse(localStorage.getItem('yukino-speed:settings') || '{}'); } catch { return {}; } }

export default function SpeedApp({ embedded = false }: { embedded?: boolean }) {
  const desktop = !!window.yukinoSpeed;
  const initial = useRef(safeSettings()).current;
  const [mode, setMode] = useState(initial.mode || 'test');
  const [serverId, setServerId] = useState(initial.serverId === 'steam' ? 'steam-fastly-package' : SERVERS.some(s => s.id === initial.serverId) ? initial.serverId : 'cloudflare');
  const [customUrl, setCustomUrl] = useState(initial.customUrl || '');
  const [threads, setThreads] = useState(initial.threads || 4);
  const [duration, setDuration] = useState(initial.duration || 15);
  const [quotaOn, setQuotaOn] = useState(!!initial.quotaOn);
  const [quota, setQuota] = useState(initial.quota || '1');
  const [quotaUnit, setQuotaUnit] = useState(initial.quotaUnit || 'GB');
  const [rateOn, setRateOn] = useState(!!initial.rateOn);
  const [rate, setRate] = useState(initial.rate || '50');
  const [cacheBust, setCacheBust] = useState(initial.cacheBust !== false);
  const [state, setState] = useState<any>(EMPTY);
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState<any>(null);
  const [statsError, setStatsError] = useState('');
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [query, setQuery] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogGroup, setCatalogGroup] = useState('all');
  const [catalogCountry, setCatalogCountry] = useState('all');
  const [catalogClient, setCatalogClient] = useState('all');
  const [discovered, setDiscovered] = useState<Server[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [probing, setProbing] = useState(false);
  const [probe, setProbe] = useState<any>(null);
  const stateRef = useRef(state); stateRef.current = state;
  const savedAt = useRef(0);
  const runner = useRef<any>(null);
  const api = desktop || embedded || ['localhost', '127.0.0.1'].includes(location.hostname) ? ['https://speed.yukino.bond/api/speed', 'https://yukino-speed.pages.dev/api/speed'] : ['/api/speed', 'https://yukino-speed.pages.dev/api/speed'];
  const reporter = useRef<any>(null);
  const selected = [...SERVERS, ...discovered].find(s => s.id === serverId) || SERVERS[0];
  const url = (desktop && selected.httpUrl ? selected.httpUrl : selected.url) || effectiveUrl(customUrl);
  const unsupported = !desktop && !!selected.desktopOnly;
  const active = state.status === 'running' || state.status === 'paused';
  const filteredServers = filterServers(SERVERS, { query: catalogQuery, group: catalogGroup, country: catalogCountry, client: catalogClient });
  const selectionOutsideFilter = !!selected.url && SERVERS.some(s => s.id === serverId) && !filteredServers.some(s => s.id === serverId);
  const presetCount = SERVERS.filter(s => s.url).length;
  const webCount = SERVERS.filter(s => s.url && !s.desktopOnly).length;
  const localTotal = records.reduce((sum, record) => sum + record.bytes, 0);
  const refreshRecords = () => { try { setRecords(readRuns()); } catch { setStorageError('本地存储不可用，本机累计与历史无法持久保存；当前任务仍可继续。'); } };
  const checkpoint = (next: any, force = false) => {
    setState(next);
    if (next.id && (force || next.status !== 'running' || Date.now() - savedAt.current >= 1000)) {
      savedAt.current = Date.now();
      try { saveRun(next); if (!desktop) reporter.current?.enqueue(next); refreshRecords(); } catch { setStorageError('本地存储写入失败，历史记录与待同步统计可能无法保存。'); }
      if (!desktop && next.status !== 'running') void reporter.current?.flush();
    }
  };
  useEffect(() => {
    document.title = `Yukino Speed · 网络测速与流量消耗${desktop ? ' · Windows' : ''}`;
    reporter.current = new Reporter(api, result => { if (result.ok) { setStatsError(''); if (result.total) setTotal(result.total); } else setStatsError('统计暂未同步，联网后自动重试；下载与本机记录不受影响。'); });
    runner.current = new DownloadRunner({ onUpdate: (next: any) => checkpoint(next) });
    refreshRecords();
    const off = window.yukinoSpeed?.onState((next: any) => checkpoint(next));
    void window.yukinoSpeed?.state().then((next: any) => checkpoint(next));
    void window.yukinoSpeed?.records().then((runs: any[]) => { try { runs.forEach(run => saveRun(run)); refreshRecords(); } catch { setStorageError('本机历史记录暂时无法读取。'); } });
    const readTotal = async () => {
      try { const response = await fetchApi(api, '/totals', { cache: 'no-store' }); if (!response.ok) throw new Error(); setTotal(await response.json()); setStatsError(''); }
      catch { setStatsError('全站统计暂时无法读取；连接恢复后自动更新。'); }
    };
    void readTotal(); if (!desktop) void reporter.current.flush();
    const statTimer = setInterval(() => { if (!desktop) void reporter.current.flush(); void readTotal(); }, 15000);
    const syncTimer = setInterval(() => { if (!desktop) void reporter.current.flush(); }, 5000);
    const storageListener = () => refreshRecords();
    const onlineListener = () => { if (!desktop) void reporter.current.flush(); void readTotal(); };
    const checkpointOnHide = () => {
      try { if (stateRef.current.id) { saveRun(stateRef.current); if (!desktop) reporter.current.enqueue(stateRef.current); } } catch { /* pending report remains best effort */ }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => { checkpointOnHide(); if (stateRef.current.status === 'running') { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('storage', storageListener); window.addEventListener('online', onlineListener);
    window.addEventListener('pagehide', checkpointOnHide); window.addEventListener('beforeunload', beforeUnload);
    return () => { off?.(); runner.current?.stop(); clearInterval(statTimer); clearInterval(syncTimer); window.removeEventListener('storage', storageListener); window.removeEventListener('online', onlineListener); window.removeEventListener('pagehide', checkpointOnHide); window.removeEventListener('beforeunload', beforeUnload); };
  }, []);
  useEffect(() => {
    try { localStorage.setItem('yukino-speed:settings', JSON.stringify({ mode, serverId: SERVERS.some(s => s.id === serverId) ? serverId : 'custom', customUrl: selected.url && !SERVERS.some(s => s.id === serverId) ? selected.url : customUrl, threads, duration, quotaOn, quota, quotaUnit, rateOn, rate, cacheBust })); } catch { /* storage status is shown on checkpoint */ }
  }, [mode, serverId, customUrl, threads, duration, quotaOn, quota, quotaUnit, rateOn, rate, cacheBust]);
  function limits() {
    if (quotaOn && (!Number.isFinite(Number(quota)) || Number(quota) <= 0)) throw new Error('流量配额须大于 0。');
    if (rateOn && (!Number.isFinite(Number(rate)) || Number(rate) < 0.1 || Number(rate) > 100000)) throw new Error('目标带宽须为 0.1–100000 Mbps。');
    const limitBytes = quotaOn ? Math.floor(Number(quota) * (quotaUnit === 'GB' ? 1e9 : 1e6)) : 0;
    if (quotaOn && limitBytes < 1) throw new Error('流量配额至少需要 1 字节。');
    return { limitBytes, rateBps: rateOn ? Number(rate) * 1e6 / 8 : 0, durationMs: mode === 'test' ? Number(duration) * 1000 : 0 };
  }
  async function start() {
    setError(''); setProbe(null);
    try {
      if (unsupported) throw new Error('此源未开放网页跨域下载，请使用 Windows 版，地址已内置。');
      const address = new URL(url);
      const kind = address.hostname === 'speed.cloudflare.com' && address.pathname === '/__down' ? 'cloudflare' : selected.kind;
      const config = validateConfig({ url, kind, referrer: desktop ? selected.referrer : undefined, threads: Number(threads), cacheBust: cacheBust && selected.cacheBust !== false, ...limits() });
      if (!desktop && new URL(config.url).protocol === 'http:') throw new Error('HTTPS 网页无法下载 HTTP 文件，请使用 Windows 版或 HTTPS 地址。');
      checkpoint(desktop ? await window.yukinoSpeed!.start(config) : runner.current.start(config), true);
    } catch (failure: any) { setError(failure.message); }
  }
  async function act(command: 'pause' | 'resume' | 'stop') {
    try { setError(''); if (desktop) checkpoint(await window.yukinoSpeed![command](), true); else runner.current[command](); } catch (failure: any) { setError(failure.message); }
  }
  async function applyLimits() {
    try { setError(''); const next = limits(); if (desktop) checkpoint(await window.yukinoSpeed!.limits(next), true); else runner.current.updateLimits(next); }
    catch (failure: any) { setError(failure.message); }
  }
  async function search() {
    setSearching(true); setSearchError('');
    try {
      const response = await fetchApi(api, '/servers?q=' + encodeURIComponent(query.trim()));
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '节点目录暂不可用');
      setDiscovered(data.servers || []); if (!data.servers?.length) setSearchError('未找到匹配节点，请尝试城市英文名、运营商名称，或自定义完整文件链接。');
    } catch (failure: any) { setSearchError(failure.message || '暂时无法连接运营商节点目录'); }
    finally { setSearching(false); }
  }
  async function checkConnection() {
    setProbing(true); setProbe(null); setError('');
    try {
      validateConfig({ url });
      if (desktop) setProbe(await window.yukinoSpeed!.probe({ url, referrer: selected.referrer }));
      else {
        const address = new URL(url); if (selected.kind === 'cloudflare') address.searchParams.set('bytes', '0');
        const start = performance.now(); const response = await fetch(address.href, { method: 'HEAD', cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setProbe({ ms: performance.now() - start, status: response.status });
      }
    } catch (failure: any) { setError(`连接检查失败：${failure.message || '服务器不支持 HEAD / CORS，请更换节点或使用 Windows 版。'}`); }
    finally { setProbing(false); }
  }
  function exportHistory() {
    const blob = new Blob([JSON.stringify({ product: 'Yukino Speed', exportedAt: new Date().toISOString(), unit: 'decimal bytes', totalBytes: localTotal, runs: records }, null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = objectUrl; anchor.download = `yukino-speed-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  const chart = state.history as { t: number; bps: number }[];
  const chartMax = Math.max(1e6 / 8, ...chart.map(p => p.bps), state.config?.rateBps || 0);
  const points = chart.map((p, i) => `${i * 680 / Math.max(1, chart.length - 1)},${116 - p.bps / chartMax * 105}`).join(' ');
  const progress = state.config?.limitBytes ? Math.min(100, state.bytes / state.config.limitBytes * 100) : state.config?.durationMs ? Math.min(100, state.elapsedMs / state.config.durationMs * 100) : 0;
  const gaugeFraction = state.rateBps ? Math.min(.99, Math.log10(1 + state.rateBps * 8 / 1e6) / 4) : 0;
  return <div className={`ys-app ${embedded ? 'ys-embedded' : ''}`}>
    <header className="ys-header"><a className="ys-brand" href="https://www.yukino.bond/"><span className="ys-brand-icon"><Gauge size={22}/></span><span>Yukino<span className="ys-brand-dot">.</span> <span className="ys-brand-sub">Speed</span></span></a><nav aria-label="工具导航"><span className="ys-edition">{desktop ? `WINDOWS · v${window.yukinoSpeed!.version}` : 'WEB EDITION'}</span><a href={REPO + '/releases/latest'} target="_blank" rel="noreferrer"><Download size={15}/><span>Windows 版</span><ArrowUpRight size={13}/></a><a href={REPO} target="_blank" rel="noreferrer" aria-label="GitHub 源码"><Github size={19}/></a></nav></header>
    <main className="ys-main">
      <div className="ys-intro"><div><p className="ys-eyebrow"><span className="ys-dot"/> YOUR CONNECTION, IN REAL TIME</p><h1>让速度，<span>看得见。</span></h1><p className="ys-description">测一测网络，也让每一份流量都有记录。</p></div><div className="ys-intro-note"><Radio size={16}/><span>直接连接所选服务器<br/><small>数据流不经本站中转 · 下载后即时丢弃</small></span></div></div>
      <div className="ys-workspace">
        <aside className="ys-panel ys-config">
          <div className="ys-panel-heading"><span><Layers3 size={17}/> 任务设置</span><span className="ys-small">01 / CONFIGURE</span></div>
          <div className="ys-tabs" role="tablist" aria-label="运行模式"><button role="tab" aria-selected={mode === 'test'} disabled={active} onClick={() => setMode('test')}>网络测速</button><button role="tab" aria-selected={mode === 'consume'} disabled={active} onClick={() => setMode('consume')}>持续消耗</button></div>
          <div className="ys-source-shortcuts" role="group" aria-label="源分类">{[{ id: 'all', name: '全部' }, ...SERVER_GROUPS.filter(g => g.id !== 'custom')].map(g => <button key={g.id} type="button" aria-pressed={catalogGroup === g.id} disabled={active} onClick={() => { setCatalogGroup(g.id); setCatalogQuery(''); setCatalogCountry('all'); if (g.id !== 'all') { const choices = SERVERS.filter(s => s.group === g.id && s.url); setServerId((!desktop ? choices.find(s => !s.desktopOnly) : null)?.id || choices[0].id); } setProbe(null); setError(''); }}>{g.name}</button>)}</div>
          <p className="ys-catalog-summary">{presetCount} 个地址 · {COUNTRIES.filter(c => c.id !== 'GLOBAL').length} 个国家 / 地区 · {webCount} 个网页可用</p>
          <label className="ys-field ys-catalog-search">筛选预置源<input type="search" aria-label="筛选预置源" placeholder="名称、国家地区或域名，如 Vultr 日本" value={catalogQuery} disabled={active} onChange={e => setCatalogQuery(e.target.value)}/></label>
          <div className="ys-two-fields ys-catalog-filters"><label className="ys-field">国家 / 地区<select aria-label="国家或地区" value={catalogCountry} disabled={active} onChange={e => setCatalogCountry(e.target.value)}><option value="all">全部国家 / 地区</option>{COUNTRIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="ys-field">客户端<select aria-label="源兼容性" value={catalogClient} disabled={active} onChange={e => setCatalogClient(e.target.value)}><option value="all">全部源</option><option value="web">网页 / Windows</option><option value="windows">仅 Windows</option></select></label></div>
          <p className="ys-filter-result" role="status">匹配 {filteredServers.length} 个源{selectionOutsideFilter ? ' · 当前选择保留在下方' : ''}{!filteredServers.length && ' · 可调整筛选或自定义地址'}</p>
          <label className="ys-field">下载服务器<select aria-label="下载服务器" value={serverId} disabled={active} onChange={e => { setServerId(e.target.value); setProbe(null); }}>{selectionOutsideFilter && <optgroup label="当前选择（筛选外）"><option value={selected.id}>{selected.name}{selected.desktopOnly ? ' · Windows' : ' · 网页 / Windows'}</option></optgroup>}{SERVER_GROUPS.filter(g => g.id !== 'custom').map(g => { const choices = filteredServers.filter(s => s.group === g.id); return choices.length ? <optgroup key={g.id} label={g.name}>{choices.map(s => <option value={s.id} key={s.id}>{s.name}{s.desktopOnly ? ' · Windows' : ' · 网页 / Windows'}</option>)}</optgroup> : null; })}<optgroup label="自定义"><option value="custom">自定义 · 完整文件 URL</option></optgroup>{discovered.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
          {!selected.url && <label className="ys-field">完整下载文件地址<input type="url" aria-label="完整下载文件地址" placeholder="https://cdn.example.com/test.bin" value={customUrl} disabled={active} onChange={e => setCustomUrl(e.target.value)}/></label>}
          <p className="ys-server-note"><Globe2 size={14}/><span>{selected.region} · {selected.note}</span></p>
          {selected.checkedAt && <p className="ys-source-meta">{selected.fileBytes ? '文件 ' + formatBytes(selected.fileBytes) + ' · ' : ''}核验 {selected.checkedAt}{selected.source && <a href={selected.source} target="_blank" rel="noreferrer">{selected.sourceLabel || '官方来源'}<ArrowUpRight size={11}/></a>}</p>}
          {selected.cacheBust === false && <p className="ys-small ys-source-hint">此源已自动保留原始地址与必要来源信息。</p>}
          {unsupported && <p className="ys-compat-note" role="status">此源仅 Windows 版可用，下载地址已内置。<a href={REPO + '/releases/latest'} target="_blank" rel="noreferrer">下载 Windows 版<ArrowUpRight size={12}/></a></p>}
          <details className="ys-discovery"><summary>查找运营商 / Speedtest 节点</summary><div className="ys-search"><input aria-label="城市或运营商" placeholder="如 Guangzhou / China Telecom" value={query} disabled={active || searching} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !searching) void search(); }}/><button aria-label="搜索运营商服务器" disabled={active || searching} onClick={search}><Search size={16}/></button></div>{searching && <p role="status">正在读取节点目录…</p>}{searchError && <p className="ys-error" role="status">{searchError}</p>}{discovered.length > 0 && <div className="ys-found">{discovered.map(s => <button key={s.id} disabled={active} onClick={() => setServerId(s.id)}><span>{s.name}</span><small>{s.region}</small>{s.id === serverId && <Check size={14}/>}</button>)}</div>}<small>读取公开节点目录。兼容 HTTP 文件接口的节点可用；部分节点仅支持 Speedtest 专用协议或不允许跨域。</small></details>
          <div className="ys-two-fields"><label className="ys-field">下载线程<select aria-label="下载线程" value={threads} disabled={active} onChange={e => setThreads(Number(e.target.value))}>{[1, 2, 4, 6, 8, 12, 16, 24, 32].map(n => <option key={n} value={n}>{n} 线程</option>)}</select></label><label className="ys-field">持续时间<select aria-label="持续时间" value={duration} disabled={active || mode === 'consume'} onChange={e => setDuration(Number(e.target.value))}>{[10, 15, 30, 60, 120, 300].map(n => <option key={n} value={n}>{n} 秒</option>)}</select></label></div>
          <div className="ys-limit-block"><label className="ys-switch"><span><HardDrive size={16}/> 锁定消耗流量</span><input type="checkbox" aria-label="锁定消耗流量" checked={quotaOn} onChange={e => setQuotaOn(e.target.checked)}/></label><div className="ys-input-group"><input aria-label="目标流量" type="number" min="0.001" step="any" value={quota} disabled={!quotaOn} onChange={e => setQuota(e.target.value)}/><select aria-label="流量单位" value={quotaUnit} disabled={!quotaOn} onChange={e => setQuotaUnit(e.target.value)}><option>GB</option><option>MB</option></select></div><small>{quotaOn ? '累计到配额后自动结束。' : '未设流量配额。'}</small></div>
          <div className="ys-limit-block"><label className="ys-switch"><span><Gauge size={16}/> 锁定实时带宽</span><input type="checkbox" aria-label="锁定实时带宽" checked={rateOn} onChange={e => setRateOn(e.target.checked)}/></label><div className="ys-input-group"><input aria-label="目标带宽 Mbps" type="number" min="0.1" max="100000" step="any" value={rate} disabled={!rateOn} onChange={e => setRate(e.target.value)}/><span>Mbps</span></div><small>{rateOn ? `总带宽上限 ≈ ${formatBytes(Number(rate) * 1e6 / 8)}/s，所有线程共享。` : '尽量使用连接可提供的带宽。'}</small></div>
          {active && <button className="ys-apply" onClick={applyLimits}><LockKeyhole size={14}/> 应用流量与带宽限制</button>}
          <label className="ys-check"><input type="checkbox" aria-label="下载链接添加防缓存参数" checked={cacheBust} disabled={active} onChange={e => setCacheBust(e.target.checked)}/> 下载链接添加防缓存参数</label>
          {!cacheBust && <p className="ys-small">签名链接可关闭此项；重复请求可能命中 CDN 缓存，但仍统计实际收到的数据。</p>}
          <button className="ys-probe" disabled={active || probing || unsupported} onClick={checkConnection}><Activity size={14}/>{probing ? '检查连接中…' : probe ? `HTTP ${probe.status} · ${Math.round(probe.ms)} ms` : '检查服务器连接'}<span>HEAD</span></button>
        </aside>
        <section className="ys-panel ys-monitor" aria-label="实时测速数据">
          <div className="ys-panel-heading"><span><Activity size={17}/> 实时监测</span><span className={`ys-status ys-status-${state.status}`} data-testid="run-status"><span/>{LABELS[state.status]}</span></div>
          <div className="ys-gauge"><svg viewBox="0 0 300 166" aria-hidden="true"><path d="M 33 142 A 117 117 0 0 1 267 142" className="ys-gauge-track" pathLength="100"/><path d="M 33 142 A 117 117 0 0 1 267 142" className="ys-gauge-value" pathLength="100" strokeDasharray={`${gaugeFraction * 100} 100`}/><text x="26" y="166">0</text><text x="242" y="166">10 Gbps</text></svg><div className="ys-speed"><span className="ys-eyebrow">LIVE BANDWIDTH</span><strong data-testid="live-bandwidth">{(state.rateBps * 8 / 1e6).toFixed(2)}</strong><span className="ys-speed-unit">Mbps</span><small data-testid="live-speed"><ArrowDown size={13}/>{formatBytes(state.rateBps)} / s</small></div></div>
          <div className="ys-metrics"><div><span><HardDrive size={14}/> 已消耗流量</span><strong data-testid="consumed-bytes">{formatBytes(state.bytes)}</strong></div><div><span><Timer size={14}/> 持续时间</span><strong data-testid="elapsed-time">{formatDuration(state.elapsedMs)}</strong></div><div><span><Zap size={14}/> 平均带宽</span><strong>{(state.averageBps * 8 / 1e6).toFixed(2)} <small>Mbps</small></strong></div><div><span><Gauge size={14}/> 峰值带宽</span><strong>{(state.peakBps * 8 / 1e6).toFixed(2)} <small>Mbps</small></strong></div></div>
          <div className="ys-chart-heading"><span>下载带宽曲线</span><span>Mbps · 最近 45 秒</span></div><div className="ys-chart"><svg viewBox="0 0 680 130" preserveAspectRatio="none" role="img" aria-label="实时下载带宽曲线"><defs><linearGradient id="ys-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#70936b" stopOpacity=".22"/><stop offset="100%" stopColor="#70936b" stopOpacity="0"/></linearGradient></defs>{[12, 46, 80, 116].map(y => <line key={y} x1="0" x2="680" y1={y} y2={y} className="ys-grid-line"/>)}{points && <><polygon points={`0,130 ${points} ${chart.length > 1 ? 680 : 0},130`} fill="url(#ys-chart-fill)"/><polyline points={points} fill="none" stroke="#63865b" strokeWidth="2" vectorEffect="non-scaling-stroke"/></>}</svg>{!chart.length && <span>开始任务后，速度曲线将在这里生长。</span>}</div>
          <div className="ys-progress"><div><i style={{ width: progress + '%' }}/></div><span>{state.config?.limitBytes ? `${formatBytes(state.bytes)} / ${formatBytes(state.config.limitBytes)}` : state.config?.durationMs ? `${formatDuration(state.elapsedMs)} / ${formatDuration(state.config.durationMs)}` : mode === 'consume' ? '持续下载，直到手动结束或达到流量配额。' : '选择服务器，开始一段测速。'}</span><span>{state.config?.rateBps ? <><LockKeyhole size={12}/>{(state.config.rateBps * 8 / 1e6).toFixed(1)} Mbps</> : <><UnlockKeyhole size={12}/>不限速</>}</span></div>
          <div className="ys-actions">{!active ? <button className="ys-start" disabled={unsupported} onClick={start}><Play size={17}/>{state.id ? '再测一次' : mode === 'consume' ? '开始消耗' : '开始测速'}</button> : <><button className="ys-start" onClick={() => act(state.status === 'paused' ? 'resume' : 'pause')}>{state.status === 'paused' ? <Play size={17}/> : <Pause size={17}/>} {state.status === 'paused' ? '继续下载' : '暂停下载'}</button><button className="ys-stop" onClick={() => act('stop')}><Square size={15}/>结束任务</button></>}<span>{active ? `${state.config?.threads} 个并发下载任务` : '文件不保存到磁盘'}</span></div>
          {(error || state.message) && <p className={error || state.status === 'error' ? 'ys-alert ys-alert-error' : 'ys-alert'} role="status">{error || state.message}</p>}
          {state.workers.length > 0 && <details className="ys-thread-details"><summary>下载线程详情 · {state.workers.length} 线程</summary><div>{state.workers.map((w: any) => <p key={w.index}><span>#{w.index + 1} · {w.status}</span><span>{formatBytes(w.bytes)} · {w.requests} 次请求</span>{w.error && <small>{w.error}</small>}</p>)}</div></details>}
        </section>
      </div>
      <section className="ys-totals" aria-label="累计流量统计"><div><span className="ys-total-icon"><Globe2 size={24}/></span><div><span>所有人的流量，汇成一条河。</span><strong data-testid="global-total">{total ? formatBytes(total.bytes) : '—'}</strong><small>全站累计 · 网页与 Windows 客户端上报{total ? ` · ${total.sessions} 次有效任务` : ''}</small></div></div><div><span className="ys-total-icon"><HardDrive size={23}/></span><div><span>你的每一次连接，也被记得。</span><strong data-testid="local-total">{formatBytes(localTotal)}</strong><small>本机累计 · {records.length} 次任务 · 保存在当前设备</small></div></div></section>
      {(statsError || storageError) && <p className="ys-sync-note" role="status">{storageError || statsError}</p>}
      <section className="ys-history"><div className="ys-section-heading"><h2>连接留下的足迹<span>RECENT SESSIONS</span></h2><button disabled={!records.length} onClick={exportHistory}><Download size={14}/>导出本机记录</button></div>{records.length ? <div className="ys-history-scroll"><table><thead><tr><th>开始时间</th><th>下载服务器</th><th>消耗流量</th><th>持续时间</th><th>平均带宽</th><th>状态</th></tr></thead><tbody>{records.slice(0, 10).map(record => <tr key={record.id}><td>{new Date(record.startedAt).toLocaleString('zh-CN', { hour12: false })}</td><td title={record.config?.url}>{(() => { try { return new URL(record.config?.url).hostname; } catch { return '未知服务器'; } })()}</td><td>{formatBytes(record.bytes)}</td><td>{formatDuration(record.elapsedMs)}</td><td>{(record.averageBps * 8 / 1e6).toFixed(2)} Mbps</td><td>{record.status === 'running' && record.id !== state.id ? '中断记录' : LABELS[record.status]}</td></tr>)}</tbody></table></div> : <p className="ys-history-empty"><RotateCcw size={18}/>第一段连接，从点击开始。</p>}</section>
      <details className="ys-help"><summary>关于统计、带宽限制与服务器兼容性</summary><div><p>实时网速以 MB/s 等字节单位显示，实时带宽以 Mbps 显示；1 MB/s = 8 Mbps。容量采用十进制：1 GB = 1000 MB。平均带宽包含连接与重试时间，暂停期间不计时。</p><p>统计的是下载到应用的数据有效载荷，不包含 TLS、TCP、HTTP 头等开销。停止或限制流量时，网络及浏览器可能已经预读少量额外数据；运营商计费以运营商账单为准。缓存参数避免浏览器重复使用文件；CDN 的边缘缓存仍会通过网络传输。</p><p>带宽锁定表示所有线程共享的下载上限，不能保证网络达到该速率。网页版采用分块请求和请求间隔控制，瞬时速度可能波动，后台标签页可能被浏览器限速。Windows 版采用原生流式连接；两端都推荐 Cloudflare 或支持 Range 的文件服务器。</p><p>网页版需要目标服务器允许 CORS，HTTPS 页面无法下载 HTTP 文件。Windows 版可以直接访问 HTTP 与无 CORS 的文件链接。已内置电信、联通、移动、广电、国内 CDN、Steam 及全球机房文件，可按名称、国家地区、域名与客户端筛选，直接选择。地区标签采用提供方标示，CDN 实际出口可能随解析变化。小文件适合低速和连通性检查；未支持分段读取的源在配额结束时可能超出一个数据块，均保留实际字节计量。运营商组使用其官方 CDN 文件，实际路由由 CDN 决定，并非保证接入该运营商专网。Steam 组使用官方客户端资源包及安装文件，不能代表某款游戏的专属下载线路。自定义 CDN 需要完整且未过期的文件链接；网站首页、登录页、仅专用协议的节点和受限制文件不能作为测试文件。这里使用兼容的 HTTP 下载文件，未使用 Ookla 的官方测速算法。</p><p>本机历史不会自动跨设备同步。全站统计保存匿名任务 ID、已接收字节和持续时间，包含网页和 Windows 版；客户端数据可以被篡改，因此全站总量属于客户端上报统计。失败时保留本机待同步记录，下次联网自动重试；重复上报只计新增字节。清除浏览器数据会移除本机历史与尚未同步的记录。</p></div></details>
    </main><footer className="ys-footer"><span>Yukino Speed<span> · </span>给连接留一点刻度。</span><div><a href="https://www.yukino.bond/">返回主站<ArrowUpRight size={12}/></a><a href={REPO}>开源代码<ArrowUpRight size={12}/></a><span>v{desktop ? window.yukinoSpeed!.version : '1.0.3'}</span></div></footer>
  </div>;
}
