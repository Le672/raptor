import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Cloud, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, MapPin, Moon, RefreshCw, Search, Sun, X } from 'lucide-react';
import { findWeatherCities, loadWeather, WeatherRequestError } from '@/lib/weather-client';
import { readWeatherPreference, saveWeatherPreference, WEATHER_PROVIDERS, weatherDate, type WeatherCondition, type WeatherLocation, type WeatherPreference, type WeatherReport } from '@/lib/weather';
import '@/weather.css';

function ConditionIcon({ condition, night = false, size = 22 }: { condition: WeatherCondition; night?: boolean; size?: number }) {
  const Icon = { sun: night ? Moon : Sun, partly: night ? CloudMoon : CloudSun, cloud: Cloud, rain: CloudRain, snow: CloudSnow, fog: CloudFog, thunder: CloudLightning }[condition.icon];
  return <Icon size={size} aria-hidden="true" strokeWidth={1.6} />;
}
const temperature = (value: number | null) => value === null ? '—' : `${Math.round(value)}°`;
const timeLabel = (time: string, timezone: string) => new Intl.DateTimeFormat('zh-CN', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(time));
const dateTimeLabel = (time: string, timezone: string) => new Intl.DateTimeFormat('zh-CN', { timeZone: timezone, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(time));

export function WeatherCard() {
  const [preference, setPreference] = useState(readWeatherPreference), [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<WeatherReport | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [editing, setEditing] = useState(false), [query, setQuery] = useState(''), [locations, setLocations] = useState<WeatherLocation[] | null>(null);
  const [searching, setSearching] = useState(false), [searchError, setSearchError] = useState(''), [storageWarning, setStorageWarning] = useState('');
  const searchController = useRef<AbortController | null>(null), lastRequestAt = useRef(0);
  useEffect(() => {
    const controller = new AbortController(); lastRequestAt.current = Date.now();
    setLoading(true); setData(null); setError('');
    loadWeather(preference.location, preference.provider, controller.signal).then(report => { if (!controller.signal.aborted) setData(report); })
      .catch(failure => {
        if (controller.signal.aborted) return;
        setError(failure instanceof Error ? failure.message : '天气资料暂时无法读取。');
        if (failure instanceof WeatherRequestError && failure.code === 'LOCATION_UNAVAILABLE') setEditing(true);
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [preference, attempt]);
  useEffect(() => {
    const refreshVisible = () => { if (!document.hidden && Date.now() - lastRequestAt.current >= 600000) setAttempt(value => value + 1); };
    const interval = setInterval(refreshVisible, 600000);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', refreshVisible); searchController.current?.abort(); };
  }, []);
  const updatePreference = (next: WeatherPreference) => {
    setStorageWarning(saveWeatherPreference(next) ? '' : '当前选择已生效，浏览器暂不允许记住它。');
    setPreference(next);
  };
  const cancelSearch = () => { searchController.current?.abort(); searchController.current = null; setSearching(false); };
  const changeQuery = (next: string) => { cancelSearch(); setQuery(next); setLocations(null); setSearchError(''); };
  const search = async (event: FormEvent) => {
    event.preventDefault(); cancelSearch(); setLocations(null); setSearchError('');
    const input = query.trim();
    if (input.length < 2 || input.length > 80) { setSearchError('请输入至少两个字的城市名称。'); return; }
    const controller = new AbortController(); searchController.current = controller; setSearching(true);
    try { const result = await findWeatherCities(input, controller.signal); if (!controller.signal.aborted) setLocations(result.locations); }
    catch (failure) { if (!controller.signal.aborted) setSearchError(failure instanceof Error ? failure.message : '城市暂时无法搜索，请重试。'); }
    finally { if (!controller.signal.aborted) setSearching(false); }
  };
  const selectCity = (location: WeatherLocation) => { cancelSearch(); updatePreference({ ...preference, location }); setEditing(false); setQuery(''); setLocations(null); };
  const displayLocation = data?.location || preference.location;
  const today = data ? weatherDate(Date.now(), data.timezone) : '';
  const provider = WEATHER_PROVIDERS.find(item => item.id === data?.provider);
  return <section className="weather-card" aria-label="所在地天气" aria-busy={loading}>
    <header className="weather-header">
      <div><span className="weather-kicker">此刻的天空</span><h2>{displayLocation?.name || '所在地天气'}</h2><p>{preference.location ? [displayLocation?.region, displayLocation?.country].filter(Boolean).join(' · ') : '根据 IP 估算位置，可修改城市'}</p></div>
      <div className="weather-actions">
        <button type="button" onClick={() => setEditing(value => !value)} aria-expanded={editing} aria-controls="weather-location-editor"><MapPin size={14} aria-hidden="true" /> 改城市</button>
        <button type="button" className="weather-icon-button" onClick={() => setAttempt(value => value + 1)} disabled={loading} aria-label="刷新天气" title="刷新天气"><RefreshCw size={15} aria-hidden="true" /></button>
      </div>
    </header>
    {editing && <div id="weather-location-editor" className="weather-location-editor">
      <form onSubmit={search}><label htmlFor="weather-city-query">搜索城市</label><div className="weather-search-row"><input id="weather-city-query" type="search" value={query} onChange={event => changeQuery(event.target.value)} placeholder="广州 / London" maxLength={80} autoComplete="off" /><button type="submit" disabled={searching}><Search size={14} aria-hidden="true" />{searching ? '搜索中…' : '搜索'}</button><button type="button" className="weather-icon-button" onClick={() => { cancelSearch(); setEditing(false); }} aria-label="关闭城市选择"><X size={15} aria-hidden="true" /></button></div></form>
      {searchError && <p className="weather-message" role="alert">{searchError}</p>}
      {locations && (locations.length ? <ul className="weather-city-results" aria-label="城市搜索结果">{locations.map(location => <li key={`${location.name}:${location.latitude}:${location.longitude}`}><button type="button" onClick={() => selectCity(location)}><strong>{location.name}</strong><span>{[location.region, location.country].filter(Boolean).join(' · ')}</span></button></li>)}</ul> : <p className="weather-message" role="status">没有找到城市，试试中文、英文或“城市, 国家”。</p>)}
      <div className="weather-location-footer"><button type="button" onClick={() => { cancelSearch(); updatePreference({ ...preference, location: null }); setEditing(false); }}>恢复 IP 定位</button><a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noreferrer">城市：GeoNames / Open-Meteo</a></div>
    </div>}
    {loading ? <p className="weather-message weather-loading" role="status">正在读取天气…</p> : error ? <div className="weather-message" role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>重试天气</button></div> : data && <>
      <div className="weather-now"><ConditionIcon condition={data.current.condition} night={data.current.isDay === false} size={36} /><strong className="weather-temperature">{temperature(data.current.temperature)}<small>C</small></strong><div><span>{data.current.condition.label}</span><small>体感 {temperature(data.current.feelsLike)} · 湿度 {data.current.humidity === null ? '—' : `${Math.round(data.current.humidity)}%`}<br />风速 {data.current.windKmh === null ? '—' : `${Math.round(data.current.windKmh)} km/h`}</small></div></div>
      {data.daily.length > 0 && <ul className="weather-days" aria-label="未来三天天气">{data.daily.map(day => <li key={day.date}><span>{day.date === today ? day.partial ? '今天余下' : '今天' : new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', month: 'numeric', day: 'numeric' }).format(new Date(`${day.date}T12:00:00Z`))}</span><ConditionIcon condition={day.condition} size={19} /><span title={day.condition.label}>{temperature(day.minimum)} / {temperature(day.maximum)}</span><small>{day.rainChance === null ? day.condition.label : `降水 ${Math.round(day.rainChance)}%`}</small></li>)}</ul>}
      <details className="weather-hourly"><summary>未来 12 小时</summary>{data.hourly.length ? <ul aria-label="逐小时预报">{data.hourly.map(hour => <li key={hour.time}><time dateTime={hour.time}>{timeLabel(hour.time, data.timezone)}</time><ConditionIcon condition={hour.condition} size={18} /><span>{temperature(hour.temperature)}</span><small>{hour.rainChance === null ? hour.condition.label : `降水 ${Math.round(hour.rainChance)}%`}</small></li>)}</ul> : <p className="weather-message">逐小时预报暂未提供。</p>}</details>
      <p className="weather-updated">预报时刻 {dateTimeLabel(data.current.time, data.timezone)} · {data.timezone}{data.stale ? ' · 旧缓存' : data.cached ? ' · 已缓存' : ''}</p>
      {data.notice && <p className="weather-message weather-notice" role="status">{data.notice}{data.stale && <><br />上次获取：{dateTimeLabel(data.fetchedAt, data.timezone)}</>}</p>}
    </>}
    <footer className="weather-footer"><label>天气服务<select aria-label="天气服务" value={preference.provider} onChange={event => updatePreference({ ...preference, provider: event.target.value as WeatherPreference['provider'] })}>{WEATHER_PROVIDERS.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>{data && <a href={data.provider === 'open-meteo' ? 'https://open-meteo.com/' : 'https://www.met.no/'} target="_blank" rel="noreferrer">{provider?.label}</a>}</footer>
    {data && <p className="weather-footnote">模型预报，仅供日常参考。{data.provider === 'met-no' ? '日预报由逐小时数据整理，缺失项以 — 显示。' : ''}{data.location.source === 'ip' ? 'IP 地区可能为代理或运营商出口。' : ''} <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p>}
    {storageWarning && <p className="weather-message" role="status">{storageWarning}</p>}
  </section>;
}
