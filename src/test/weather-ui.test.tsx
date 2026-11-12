import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WeatherCard } from '../components/WeatherCard';
import { findWeatherCities, loadWeather, WeatherRequestError } from '../lib/weather-client';
import { readWeatherPreference, WEATHER_STORAGE_KEY, type WeatherLocation, type WeatherReport } from '../lib/weather';
vi.mock('../lib/weather-client', async importOriginal => ({ ...await importOriginal<typeof import('../lib/weather-client')>(), loadWeather: vi.fn(), findWeatherCities: vi.fn() }));
const city: WeatherLocation = { name: '广州', region: '广东', country: '中国', latitude: 23.12, longitude: 113.25, timezone: 'Asia/Shanghai', source: 'manual' };
const report: WeatherReport = { provider: 'open-meteo', location: { ...city, name: 'IP City', source: 'ip' }, timezone: 'Asia/Shanghai', fetchedAt: new Date().toISOString(), current: { time: new Date().toISOString(), temperature: 25, feelsLike: 27, humidity: 60, windKmh: 12, isDay: true, condition: { label: '晴', icon: 'sun' } }, hourly: [], daily: [], stale: false, cached: false };
beforeEach(() => { localStorage.clear(); vi.mocked(loadWeather).mockReset().mockResolvedValue(report); vi.mocked(findWeatherCities).mockReset().mockResolvedValue({ locations: [city] }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('defaults to IP weather, supports saved manual cities, and restores IP location', async () => {
  const view = render(<WeatherCard />); await screen.findByRole('heading', { name: 'IP City' }); expect(loadWeather).toHaveBeenCalledWith(null, 'auto', expect.any(AbortSignal));
  fireEvent.click(screen.getByRole('button', { name: '改城市' })); fireEvent.change(screen.getByLabelText('搜索城市'), { target: { value: '广州' } }); fireEvent.click(screen.getByRole('button', { name: '搜索' }));
  vi.mocked(loadWeather).mockResolvedValue({ ...report, location: city }); fireEvent.click(await screen.findByRole('button', { name: '广州 广东 · 中国' }));
  await screen.findByRole('heading', { name: '广州' }); expect(readWeatherPreference().location?.name).toBe('广州');
  view.unmount(); render(<WeatherCard />); await waitFor(() => expect(loadWeather).toHaveBeenLastCalledWith(city, 'auto', expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole('button', { name: '改城市' })); vi.mocked(loadWeather).mockResolvedValue(report); fireEvent.click(screen.getByRole('button', { name: '恢复 IP 定位' }));
  await screen.findByRole('heading', { name: 'IP City' }); expect(readWeatherPreference().location).toBeNull();
});
it('keeps the chosen city when a late IP request resolves after the switch', async () => {
  let finish: (value: WeatherReport) => void;
  vi.mocked(loadWeather).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ ...report, location: city });
  render(<WeatherCard />); fireEvent.click(screen.getByRole('button', { name: '改城市' })); fireEvent.change(screen.getByLabelText('搜索城市'), { target: { value: '广州' } }); fireEvent.click(screen.getByRole('button', { name: '搜索' })); fireEvent.click(await screen.findByRole('button', { name: '广州 广东 · 中国' }));
  await screen.findByRole('heading', { name: '广州' }); await act(async () => finish!(report)); expect(screen.queryByRole('heading', { name: 'IP City' })).not.toBeInTheDocument();
});
it('offers manual city search when IP geography is unavailable and retries a failed provider', async () => {
  vi.mocked(loadWeather).mockRejectedValueOnce(new WeatherRequestError('无法确定 IP 所在地区', 'LOCATION_UNAVAILABLE')).mockResolvedValue(report);
  render(<WeatherCard />); expect(await screen.findByLabelText('搜索城市')).toBeVisible(); expect(screen.getByRole('alert')).toHaveTextContent('IP');
  fireEvent.click(screen.getByRole('button', { name: '重试天气' })); await screen.findByRole('heading', { name: 'IP City' });
  vi.mocked(loadWeather).mockResolvedValue({ ...report, provider: 'met-no', current: { ...report.current, feelsLike: null } });
  fireEvent.change(screen.getByLabelText('天气服务'), { target: { value: 'met-no' } }); await screen.findByRole('link', { name: /MET Norway/ }); expect(readWeatherPreference().provider).toBe('met-no'); expect(screen.getByText(/体感 —/)).toBeVisible();
});
it('ignores corrupted coordinates and still changes city when storage is blocked', async () => {
  localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify({ provider: 'auto', location: { ...city, latitude: null } })); expect(readWeatherPreference().location).toBeNull();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); }); render(<WeatherCard />);
  await screen.findByRole('heading', { name: 'IP City' }); fireEvent.click(screen.getByRole('button', { name: '改城市' })); fireEvent.change(screen.getByLabelText('搜索城市'), { target: { value: '广州' } }); fireEvent.click(screen.getByRole('button', { name: '搜索' }));
  vi.mocked(loadWeather).mockResolvedValue({ ...report, location: city }); fireEvent.click(await screen.findByRole('button', { name: '广州 广东 · 中国' })); await screen.findByRole('heading', { name: '广州' }); expect(screen.getByText(/浏览器暂不允许记住/)).toBeVisible();
});
it('does not show search results for a city name that has already changed', async () => {
  let finish: (value: { locations: WeatherLocation[] }) => void; vi.mocked(findWeatherCities).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<WeatherCard />); fireEvent.click(screen.getByRole('button', { name: '改城市' })); const field = screen.getByLabelText('搜索城市'); fireEvent.change(field, { target: { value: '广州' } }); fireEvent.click(screen.getByRole('button', { name: '搜索' })); fireEvent.change(field, { target: { value: 'London' } }); await act(async () => finish!({ locations: [city] }));
  expect(screen.queryByRole('list', { name: '城市搜索结果' })).not.toBeInTheDocument(); expect(field).toHaveValue('London');
});
