import { metCondition, validTimezone, weatherDate, wmoCondition, type WeatherData, type WeatherLocation, type WeatherProvider, type WeatherReport } from '../../src/lib/weather';

type EdgeRequest = Request & { cf?: { latitude?: string; longitude?: string; city?: string; region?: string; country?: string; timezone?: string } };
export type WeatherContext = { request: EdgeRequest; waitUntil?: (promise: Promise<unknown>) => void };
type Raw = { data: any; fetchedAt: number; expiresAt: number; modified: string | null };
const memory = new Map<string, Raw>(), pending = new Map<string, Promise<Raw>>();
const callers = new Map<string, { count: number; until: number }>(), cooldowns = new Map<string, number>();
const FRESH_MS = 600000, STALE_MS = 10800000;
class WeatherError extends Error { constructor(message: string, public status = 502, public code = 'WEATHER_UNAVAILABLE') { super(message); } }
const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const bounded = (value: unknown, low: number, high: number) => { const number = finite(value); return number !== null && number >= low && number <= high ? number : null; };
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value.trim().slice(0, 100) || fallback : fallback;
const iso = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null;
function coordinate(value: unknown, maximum: number): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= maximum ? Math.round(number * 100) / 100 : null;
}
export function requestWeatherLocation(request: EdgeRequest): WeatherLocation {
  const params = new URL(request.url).searchParams, manual = params.has('lat') || params.has('lon');
  const latitude = coordinate(manual ? params.get('lat') : request.cf?.latitude, 90), longitude = coordinate(manual ? params.get('lon') : request.cf?.longitude, 180);
  if (latitude === null || longitude === null) throw new WeatherError(manual ? '城市坐标无效，请重新搜索选择城市。' : '暂时无法确定 IP 所在地区，请手动选择城市。', manual ? 400 : 404, manual ? 'INVALID_LOCATION' : 'LOCATION_UNAVAILABLE');
  let country = text(manual ? params.get('country') : request.cf?.country);
  if (!manual && /^[A-Z]{2}$/.test(country)) { try { country = new Intl.DisplayNames(['zh-CN'], { type: 'region' }).of(country) || country; } catch { /* Keep the country code if localization is unavailable. */ } }
  return { latitude, longitude, name: text(manual ? params.get('name') : request.cf?.city, manual ? '所选位置' : 'IP 所在地区'), region: text(manual ? params.get('region') : request.cf?.region), country, timezone: validTimezone(manual ? params.get('tz') : request.cf?.timezone) || 'UTC', source: manual ? 'manual' : 'ip' };
}
function cacheStore(): Cache | undefined { return (globalThis.caches as CacheStorage & { default?: Cache } | undefined)?.default; }
function cacheKey(key: string) { return new Request(`https://www.yukino.bond/.weather-cache/v1/${encodeURIComponent(key)}`); }
async function cachedRaw(key: string): Promise<Raw | undefined> {
  const local = memory.get(key);
  if (local) return local;
  try {
    const response = await cacheStore()?.match(cacheKey(key));
    const value: Raw | undefined = response ? await response.json() : undefined;
    if (value && Number.isFinite(value.fetchedAt) && Number.isFinite(value.expiresAt) && value.data) { remember(key, value); return value; }
  } catch { /* Weather remains available without the edge cache. */ }
}
function remember(key: string, value: Raw) { if (memory.size >= 128) memory.delete(memory.keys().next().value!); memory.set(key, value); }
async function saveRaw(key: string, raw: Raw, context: WeatherContext) {
  remember(key, raw);
  const store = cacheStore(); if (!store) return;
  const task = store.put(cacheKey(key), new Response(JSON.stringify(raw), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${Math.max(10800, Math.ceil((raw.expiresAt - Date.now() + STALE_MS) / 1000))}` } })).catch(() => {});
  if (context.waitUntil) context.waitUntil(task); else await task;
}
async function networkJson(url: string, previous?: Raw): Promise<Raw> {
  const host = new URL(url).hostname, now = Date.now();
  if ((cooldowns.get(host) || 0) > now) throw new WeatherError('天气服务限流，请稍后重试。');
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Yukino-Weather/1.0 (+https://www.yukino.bond)', ...(previous?.modified ? { 'If-Modified-Since': previous.modified } : {}) }, redirect: 'manual', signal: controller.signal });
    const expires = Date.parse(response.headers.get('expires') || ''), expiresAt = Math.max(now + FRESH_MS, Number.isFinite(expires) ? expires : 0);
    if (response.status === 304 && previous) return { ...previous, expiresAt };
    if (response.status === 429) {
      const retry = response.headers.get('retry-after'), seconds = retry && /^\d+$/.test(retry) ? Number(retry) : 60;
      cooldowns.set(host, now + Math.max(60000, Math.min(seconds * 1000, 86400000))); throw new WeatherError('天气服务限流，请稍后重试。');
    }
    if (!response.ok) throw new WeatherError(`天气服务返回 HTTP ${response.status}。`);
    if (response.headers.get('content-type')?.includes('text/html')) throw new WeatherError('天气服务返回的数据格式异常。');
    if (!response.body) throw new WeatherError('天气服务未提供资料。');
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const value = await reader.read(); if (value.done) break; size += value.value.byteLength; if (size > 512000) throw new WeatherError('天气响应超过读取上限。'); chunks.push(value.value); } }
    finally { await reader.cancel().catch(() => {}); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || data.error) throw new WeatherError('天气服务暂时没有可用资料。');
    return { data, fetchedAt: now, expiresAt, modified: response.headers.get('last-modified') };
  } catch (error) {
    if (error instanceof WeatherError) throw error;
    throw new WeatherError(controller.signal.aborted ? '天气服务连接超时。' : '暂时无法连接天气服务。');
  } finally { clearTimeout(timeout); }
}
export function normalizeOpenMeteo(data: any, location: WeatherLocation): WeatherData {
  const timezone = validTimezone(data?.timezone) || location.timezone, current = data?.current;
  const temperature = bounded(current?.temperature_2m, -120, 70), time = iso(current?.time);
  if (temperature === null || !time || Math.abs(Date.parse(time) - Date.now()) > STALE_MS) throw new WeatherError('天气服务没有提供有效的当前资料。');
  const hourly = (Array.isArray(data.hourly?.time) ? data.hourly.time : []).flatMap((value: number, index: number) => {
    const hour = iso(value), temperature = bounded(data.hourly.temperature_2m?.[index], -120, 70);
    return hour && Date.parse(hour) >= Date.now() && temperature !== null ? [{ time: hour, temperature, condition: wmoCondition(data.hourly.weather_code?.[index]), rainChance: bounded(data.hourly.precipitation_probability?.[index], 0, 100) }] : [];
  }).slice(0, 12);
  const daily = (Array.isArray(data.daily?.time) ? data.daily.time : []).flatMap((value: number, index: number) => {
    const date = iso(value), minimum = bounded(data.daily.temperature_2m_min?.[index], -120, 70), maximum = bounded(data.daily.temperature_2m_max?.[index], -120, 70);
    return date && minimum !== null && maximum !== null && minimum <= maximum ? [{ date: weatherDate(date, timezone), minimum, maximum, condition: wmoCondition(data.daily.weather_code?.[index]), rainChance: bounded(data.daily.precipitation_probability_max?.[index], 0, 100), partial: false }] : [];
  }).filter(day => day.date >= weatherDate(Date.now(), timezone)).slice(0, 3);
  return { timezone, current: { time, temperature, feelsLike: bounded(current.apparent_temperature, -150, 100), humidity: bounded(current.relative_humidity_2m, 0, 100), windKmh: bounded(current.wind_speed_10m, 0, 500), isDay: typeof current.is_day === 'number' ? current.is_day === 1 : null, condition: wmoCondition(current.weather_code) }, hourly, daily };
}
export function normalizeMet(data: any, location: WeatherLocation): WeatherData {
  const timezone = location.timezone, now = Date.now();
  const series = (Array.isArray(data?.properties?.timeseries) ? data.properties.timeseries : []).filter((entry: any) => Number.isFinite(Date.parse(entry?.time)) && bounded(entry.data?.instant?.details?.air_temperature, -120, 70) !== null).sort((a: any, b: any) => Date.parse(a.time) - Date.parse(b.time));
  const current = series.reduce((closest: any, entry: any) => !closest || Math.abs(Date.parse(entry.time) - now) < Math.abs(Date.parse(closest.time) - now) ? entry : closest, null);
  if (!current || Math.abs(Date.parse(current.time) - now) > 7200000) throw new WeatherError('天气服务没有提供有效的当前资料。');
  const summary = (entry: any) => entry.data.next_1_hours?.summary?.symbol_code || entry.data.next_6_hours?.summary?.symbol_code || entry.data.next_12_hours?.summary?.symbol_code;
  const hourly = series.filter((entry: any) => Date.parse(entry.time) >= now).slice(0, 12).map((entry: any) => ({ time: new Date(entry.time).toISOString(), temperature: entry.data.instant.details.air_temperature, condition: metCondition(summary(entry)), rainChance: bounded(entry.data.next_1_hours?.details?.probability_of_precipitation, 0, 100) }));
  const dates = [...new Set<string>(series.filter((entry: any) => Date.parse(entry.time) >= now).map((entry: any) => weatherDate(entry.time, timezone)))].slice(0, 3);
  const today = weatherDate(now, timezone);
  const daily = dates.map(date => {
    const entries = series.filter((entry: any) => Date.parse(entry.time) >= now && weatherDate(entry.time, timezone) === date);
    const temperatures = entries.map((entry: any) => entry.data.instant.details.air_temperature);
    const noon = entries.reduce((closest: any, entry: any) => {
      const hour = (value: any) => Number(new Intl.DateTimeFormat('en', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' }).format(new Date(value.time)));
      return !closest || Math.abs(hour(entry) - 12) < Math.abs(hour(closest) - 12) ? entry : closest;
    }, null);
    return { date, minimum: Math.min(...temperatures), maximum: Math.max(...temperatures), condition: metCondition(summary(noon)), rainChance: null, partial: date === today };
  });
  const details = current.data.instant.details, symbol = summary(current);
  return { timezone, current: { time: new Date(current.time).toISOString(), temperature: details.air_temperature, feelsLike: null, humidity: bounded(details.relative_humidity, 0, 100), windKmh: bounded(details.wind_speed, 0, 150) === null ? null : details.wind_speed * 3.6, isDay: typeof symbol === 'string' && /_(?:day|night)$/.test(symbol) ? symbol.endsWith('_day') : null, condition: metCondition(symbol) }, hourly, daily, modelUpdatedAt: typeof data.properties.meta?.updated_at === 'string' ? data.properties.meta.updated_at : undefined };
}
function providerUrl(provider: Exclude<WeatherProvider, 'auto'>, location: WeatherLocation) {
  if (provider === 'met-no') return `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${location.latitude}&lon=${location.longitude}`;
  const params = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m', hourly: 'temperature_2m,weather_code,precipitation_probability', daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max', forecast_days: '3', timezone: 'auto', timeformat: 'unixtime' });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}
export async function weatherForecast(location: WeatherLocation, preference: WeatherProvider, context: WeatherContext): Promise<WeatherReport> {
  const providers: Exclude<WeatherProvider, 'auto'>[] = preference === 'auto' ? ['open-meteo', 'met-no'] : [preference];
  const alternatives: { raw: Raw; provider: Exclude<WeatherProvider, 'auto'> }[] = [];
  for (const provider of providers) {
    const key = `forecast:${provider}:${location.latitude}:${location.longitude}`, previous = await cachedRaw(key);
    const normalize = provider === 'open-meteo' ? normalizeOpenMeteo : normalizeMet;
    if (previous) alternatives.push({ raw: previous, provider });
    try {
      let raw = previous, cached = !!raw && raw.expiresAt > Date.now();
      if (!cached) {
        let task = pending.get(key);
        if (!task) {
          task = networkJson(providerUrl(provider, location), previous).then(async value => { normalize(value.data, location); await saveRaw(key, value, context); return value; });
          pending.set(key, task);
        }
        try { raw = await task; } finally { if (pending.get(key) === task) pending.delete(key); }
      }
      const data = normalize(raw!.data, location);
      return { ...data, location: { ...location, timezone: data.timezone }, provider, fetchedAt: new Date(raw!.fetchedAt).toISOString(), cached, stale: false, ...(preference === 'auto' && provider === 'met-no' ? { notice: 'Open-Meteo 暂不可用，已自动切换至 MET Norway。' } : {}) };
    } catch { /* In auto mode, try a fresh second provider before falling back to an old report. */ }
  }
  for (const { raw, provider } of alternatives) {
    if (Date.now() - raw.fetchedAt > STALE_MS) continue;
    try {
      const data = (provider === 'open-meteo' ? normalizeOpenMeteo : normalizeMet)(raw.data, location);
      return { ...data, location: { ...location, timezone: data.timezone }, provider, fetchedAt: new Date(raw.fetchedAt).toISOString(), cached: true, stale: true, notice: '天气暂时无法更新，显示上次获取的资料，请留意数据时刻。' };
    } catch { /* An obsolete or invalid report must not be presented as current weather. */ }
  }
  throw new WeatherError('天气服务暂时不可用，请重试或切换服务商。');
}
async function searchCities(query: string, context: WeatherContext) {
  if (query.length < 2 || query.length > 80) throw new WeatherError('请输入 2–80 个字符的城市名称。', 400, 'INVALID_QUERY');
  const key = `city:${query.toLowerCase()}`, previous = await cachedRaw(key);
  const raw = previous && previous.expiresAt > Date.now() ? previous : await networkJson(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: query, count: '8', language: 'zh', format: 'json' })}`);
  if (raw !== previous) { raw.expiresAt = Date.now() + 86400000; await saveRaw(key, raw, context); }
  const seen = new Set<string>();
  const locations: WeatherLocation[] = (Array.isArray(raw.data.results) ? raw.data.results : []).flatMap((city: any) => {
    const latitude = coordinate(city.latitude, 90), longitude = coordinate(city.longitude, 180), name = text(city.name);
    const identity = `${name}:${latitude}:${longitude}`;
    if (latitude === null || longitude === null || !name || seen.has(identity)) return [];
    seen.add(identity);
    return [{ latitude, longitude, name, region: text(city.admin1), country: text(city.country), timezone: validTimezone(city.timezone) || 'UTC', source: 'manual' }];
  });
  return { locations };
}
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store', 'Cloudflare-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }); }
export async function handleWeather(context: WeatherContext) {
  const { request } = context;
  if (request.method !== 'GET') return json({ error: '此接口仅支持 GET。' }, 405);
  const now = Date.now(), caller = request.headers.get('CF-Connecting-IP') || 'local-development';
  for (const [key, bucket] of callers) if (bucket.until <= now) callers.delete(key);
  if (callers.size >= 2000 && !callers.has(caller)) return json({ error: '请求过于频繁，请稍后重试。' }, 429);
  const bucket = callers.get(caller) || { count: 0, until: now + 60000 }; bucket.count++; callers.set(caller, bucket);
  if (bucket.count > 40) return json({ error: '请求过于频繁，请稍后重试。' }, 429);
  try {
    const params = new URL(request.url).searchParams;
    if (params.has('q')) return json(await searchCities(params.get('q')!.trim(), context));
    const provider = params.get('provider') || 'auto';
    if (!['auto', 'open-meteo', 'met-no'].includes(provider)) throw new WeatherError('天气服务商无效。', 400);
    return json(await weatherForecast(requestWeatherLocation(request), provider as WeatherProvider, context));
  } catch (error) { return json({ error: error instanceof WeatherError ? error.message : '天气资料暂时无法读取，请重试。', code: error instanceof WeatherError ? error.code : 'WEATHER_UNAVAILABLE' }, error instanceof WeatherError ? error.status : 502); }
}
