export type WeatherProvider = 'auto' | 'open-meteo' | 'met-no';
export type WeatherLocation = { name: string; region: string; country: string; latitude: number; longitude: number; timezone: string; source: 'ip' | 'manual' };
export type WeatherCondition = { label: string; icon: 'sun' | 'partly' | 'cloud' | 'rain' | 'snow' | 'fog' | 'thunder' };
export type WeatherHour = { time: string; temperature: number; condition: WeatherCondition; rainChance: number | null };
export type WeatherDay = { date: string; minimum: number; maximum: number; condition: WeatherCondition; rainChance: number | null; partial: boolean };
export type WeatherData = {
  timezone: string;
  current: { time: string; temperature: number; feelsLike: number | null; humidity: number | null; windKmh: number | null; isDay: boolean | null; condition: WeatherCondition };
  hourly: WeatherHour[];
  daily: WeatherDay[];
  modelUpdatedAt?: string;
};
export type WeatherReport = WeatherData & { location: WeatherLocation; provider: Exclude<WeatherProvider, 'auto'>; fetchedAt: string; cached: boolean; stale: boolean; notice?: string };
export type WeatherPreference = { location: WeatherLocation | null; provider: WeatherProvider };
export const WEATHER_PROVIDERS = [
  { id: 'auto', label: '自动选择' },
  { id: 'open-meteo', label: 'Open-Meteo' },
  { id: 'met-no', label: 'MET Norway' },
] as const;
export const WEATHER_STORAGE_KEY = 'yukino:weather:preferences:v1';

export function validTimezone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 80) return null;
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return value; } catch { return null; }
}
export function validWeatherLocation(value: unknown): value is WeatherLocation {
  if (!value || typeof value !== 'object') return false;
  const location = value as WeatherLocation;
  return typeof location.latitude === 'number' && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90
    && typeof location.longitude === 'number' && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180
    && typeof location.name === 'string' && location.name.trim().length > 0 && location.name.length <= 100
    && typeof location.region === 'string' && location.region.length <= 100 && typeof location.country === 'string' && location.country.length <= 100
    && !!validTimezone(location.timezone) && ['ip', 'manual'].includes(location.source);
}
export function readWeatherPreference(): WeatherPreference {
  const fallback: WeatherPreference = { location: null, provider: 'auto' };
  try {
    const value = JSON.parse(localStorage.getItem(WEATHER_STORAGE_KEY) || 'null');
    if (!value || !WEATHER_PROVIDERS.some(provider => provider.id === value.provider) || (value.location !== null && !validWeatherLocation(value.location))) return fallback;
    return { location: value.location ? { ...value.location, source: 'manual' } : null, provider: value.provider };
  } catch { return fallback; }
}
export function saveWeatherPreference(value: WeatherPreference): boolean {
  try { localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(value)); return true; } catch { return false; }
}
export function weatherDate(time: string | number, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(time));
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}
export function wmoCondition(code: unknown): WeatherCondition {
  const value = typeof code === 'number' ? code : -1;
  if (value === 0) return { label: '晴', icon: 'sun' };
  if (value === 1 || value === 2) return { label: value === 1 ? '少云' : '多云', icon: 'partly' };
  if (value === 3) return { label: '阴', icon: 'cloud' };
  if ([45, 48].includes(value)) return { label: '雾', icon: 'fog' };
  if ([71, 73, 75, 77, 85, 86].includes(value)) return { label: '雪', icon: 'snow' };
  if ([95, 96, 99].includes(value)) return { label: '雷雨', icon: 'thunder' };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return { label: [65, 67, 82].includes(value) ? '大雨' : '雨', icon: 'rain' };
  return { label: '天气状况未提供', icon: 'cloud' };
}
export function metCondition(symbol: unknown): WeatherCondition {
  const value = typeof symbol === 'string' ? symbol : '';
  if (value.includes('thunder')) return { label: '雷雨', icon: 'thunder' };
  if (/snow|sleet/.test(value)) return { label: value.includes('sleet') ? '雨夹雪' : '雪', icon: 'snow' };
  if (value.includes('rain')) return { label: value.includes('heavy') ? '大雨' : '雨', icon: 'rain' };
  if (value.includes('fog')) return { label: '雾', icon: 'fog' };
  if (value.includes('clearsky')) return { label: '晴', icon: 'sun' };
  if (/fair|partlycloudy/.test(value)) return { label: '多云', icon: 'partly' };
  if (value.includes('cloudy')) return { label: '阴', icon: 'cloud' };
  return { label: '天气状况未提供', icon: 'cloud' };
}
