import { afterEach, expect, it, vi } from 'vitest';
import { findWeatherCities, loadWeather } from '../lib/weather-client';
afterEach(() => vi.unstubAllGlobals());
it('reports malformed successful responses instead of sending an invalid report to the home page', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ current: { temperature: 0 } })));
  await expect(loadWeather(null, 'auto')).rejects.toThrow('资料不完整');
});
it('retains server error details and location-selection guidance rather than interpreting them as weather', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: '请选择城市', code: 'LOCATION_UNAVAILABLE' }, { status: 404 })));
  await expect(loadWeather(null, 'auto')).rejects.toMatchObject({ message: '请选择城市', code: 'LOCATION_UNAVAILABLE' });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>offline</html>', { status: 502 })));
  await expect(findWeatherCities('广州')).rejects.toThrow('暂时不可用');
});
