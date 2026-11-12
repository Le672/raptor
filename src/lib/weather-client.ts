import { getApiBase } from './runtime';
import type { WeatherLocation, WeatherProvider, WeatherReport } from './weather';
import { validWeatherLocation, validTimezone } from './weather';
export class WeatherRequestError extends Error { constructor(message: string, public code?: string) { super(message); } }
async function request<T>(params: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController(), abort = () => controller.abort();
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 25000);
  try {
    const response = await fetch(`${getApiBase()}/weather${params.size ? '?' + params : ''}`, { signal: controller.signal, cache: 'no-store', credentials: 'omit', headers: { Accept: 'application/json' } });
    let result: any; try { result = await response.json(); } catch { throw new WeatherRequestError('天气服务暂时不可用，请稍后重试。'); }
    if (!response.ok) throw new WeatherRequestError(typeof result?.error === 'string' ? result.error : '天气请求失败，请重试。', result?.code);
    return result;
  } catch (error) {
    if (error instanceof WeatherRequestError || signal?.aborted) throw error;
    throw new WeatherRequestError(controller.signal.aborted ? '天气请求超时，请重试。' : '天气连接失败，请检查网络后重试。');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
export function loadWeather(location: WeatherLocation | null, provider: WeatherProvider, signal?: AbortSignal) {
  const params = new URLSearchParams({ provider });
  if (location) for (const [key, value] of Object.entries({ lat: location.latitude, lon: location.longitude, name: location.name, region: location.region, country: location.country, tz: location.timezone })) params.set(key, String(value));
  return request<WeatherReport>(params, signal).then(report => {
    const condition = (value: any) => value && typeof value.label === 'string' && ['sun', 'partly', 'cloud', 'rain', 'snow', 'fog', 'thunder'].includes(value.icon);
    const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
    const optionalNumber = (value: unknown) => value === null || number(value);
    const timestamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
    if (!report || !validWeatherLocation(report.location) || !validTimezone(report.timezone) || !['open-meteo', 'met-no'].includes(report.provider)
      || !timestamp(report.fetchedAt) || !timestamp(report.current?.time) || !number(report.current?.temperature) || !condition(report.current?.condition)
      || !optionalNumber(report.current.feelsLike) || !optionalNumber(report.current.humidity) || !optionalNumber(report.current.windKmh)
      || !Array.isArray(report.hourly) || !report.hourly.every(hour => hour && timestamp(hour.time) && number(hour.temperature) && condition(hour.condition) && optionalNumber(hour.rainChance))
      || !Array.isArray(report.daily) || !report.daily.every(day => day && /^\d{4}-\d{2}-\d{2}$/.test(day.date) && Number.isFinite(Date.parse(day.date)) && number(day.minimum) && number(day.maximum) && condition(day.condition) && optionalNumber(day.rainChance))) {
      throw new WeatherRequestError('天气返回资料不完整，请重试或切换服务商。');
    }
    return report;
  });
}
export function findWeatherCities(query: string, signal?: AbortSignal) { return request<{ locations: WeatherLocation[] }>(new URLSearchParams({ q: query.trim() }), signal); }
