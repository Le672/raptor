// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let service: typeof import('../../functions/_utils/weather-service');
const now = Date.parse('2026-10-12T09:30:00Z');
function openData() {
  return { timezone: 'Asia/Shanghai', current: { time: now / 1000, temperature_2m: 25, apparent_temperature: 27, relative_humidity_2m: 60, wind_speed_10m: 10, is_day: 1, weather_code: 2 }, hourly: { time: Array.from({ length: 24 }, (_, i) => (now + (i + 1) * 3600000) / 1000), temperature_2m: Array(24).fill(25), weather_code: Array(24).fill(2), precipitation_probability: Array(24).fill(15) }, daily: { time: ['2026-10-11T16:00:00Z', '2026-10-12T16:00:00Z', '2026-10-13T16:00:00Z'].map(time => Date.parse(time) / 1000), temperature_2m_min: [18, 19, 20], temperature_2m_max: [28, 29, 30], weather_code: [2, 61, 0], precipitation_probability_max: [15, 40, 0] } };
}
function metData() {
  return { properties: { meta: { updated_at: '2026-10-12T09:00:00Z' }, timeseries: Array.from({ length: 72 }, (_, i) => ({ time: new Date(now + i * 3600000).toISOString(), data: { instant: { details: { air_temperature: 20 + i % 5, relative_humidity: 55, wind_speed: 2 } }, next_1_hours: { summary: { symbol_code: 'fair_day' }, details: { precipitation_amount: 0 } } } })) } };
}
function request(params = '', city = 'Guangzhou') {
  return Object.assign(new Request(`https://www.yukino.bond/api/weather${params}`, { headers: { 'CF-Connecting-IP': '203.0.113.7' } }), { cf: { latitude: '23.1291', longitude: '113.2644', city, region: 'Guangdong', country: 'CN', timezone: 'Asia/Shanghai' } });
}
beforeEach(async () => { vi.useFakeTimers(); vi.setSystemTime(now); vi.resetModules(); service = await import('../../functions/_utils/weather-service'); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('uses edge IP geography privately, shares only forecast coordinates, and keeps local-day boundaries', async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(openData())); vi.stubGlobal('fetch', fetchMock);
  const response = await service.handleWeather({ request: request() }), body = await response.json();
  expect(response.headers.get('Cache-Control')).toContain('private'); expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
  expect(body.location).toMatchObject({ name: 'Guangzhou', latitude: 23.13, longitude: 113.26, source: 'ip', timezone: 'Asia/Shanghai' });
  expect(body.daily[0].date).toBe('2026-10-12'); expect(body.hourly).toHaveLength(12);
  const [url, options] = fetchMock.mock.calls[0]; expect(url).not.toContain('203.0.113.7'); expect(options.headers).not.toHaveProperty('CF-Connecting-IP'); expect(options.redirect).toBe('manual');
  const nearby = await (await service.handleWeather({ request: request('', 'Other city') })).json();
  expect(nearby.location.name).toBe('Other city'); expect(nearby.cached).toBe(true); expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('offers city selection when geography is absent, rejects partial or empty coordinates, and accepts an explicit zero', async () => {
  const missing = await service.handleWeather({ request: new Request('https://www.yukino.bond/api/weather') });
  expect(missing.status).toBe(404); expect(await missing.json()).toMatchObject({ code: 'LOCATION_UNAVAILABLE' });
  for (const query of ['?lat=&lon=', '?lat=0', '?lat=91&lon=0', '?lat=0&lon=NaN']) expect(() => service.requestWeatherLocation(request(query))).toThrow('坐标无效');
  expect(service.requestWeatherLocation(request('?lat=0&lon=0&name=Ocean&tz=UTC'))).toMatchObject({ latitude: 0, longitude: 0, source: 'manual', name: 'Ocean' });
});
it('searches Chinese cities, normalizes results, and rejects malformed coordinates rather than choosing the equator', async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ results: [{ name: '广州', latitude: 23.11667, longitude: 113.25, country: '中国', admin1: '广东', timezone: 'Asia/Shanghai' }, { name: 'Invalid', latitude: null, longitude: null }] })); vi.stubGlobal('fetch', fetchMock);
  const body = await (await service.handleWeather({ request: request('?q=%E5%B9%BF%E5%B7%9E') })).json();
  expect(body.locations).toHaveLength(1); expect(body.locations[0]).toMatchObject({ name: '广州', latitude: 23.12, source: 'manual' });
  expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('name')).toBe('广州');
});
it('falls back to MET Norway with correct wind units and truthful missing fields when the first provider is unavailable', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response('blocked', { status: 429 })).mockResolvedValueOnce(Response.json(metData())); vi.stubGlobal('fetch', fetchMock);
  const body = await (await service.handleWeather({ request: request() })).json();
  expect(body).toMatchObject({ provider: 'met-no', stale: false, current: { temperature: 20, feelsLike: null, windKmh: 7.2 }, daily: [expect.objectContaining({ partial: true, rainChance: null }), expect.anything(), expect.anything()] });
  expect(body.hourly[0].rainChance).toBeNull(); expect(body.notice).toContain('自动切换');
  expect(fetchMock.mock.calls[1][1].headers['User-Agent']).toContain('https://www.yukino.bond');
});
it('honors provider cache expiry and does not repeatedly poll MET Norway before its Expires time', async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(metData(), { headers: { Expires: new Date(now + 3600000).toUTCString() } })); vi.stubGlobal('fetch', fetchMock);
  await service.handleWeather({ request: request('?provider=met-no') }); vi.setSystemTime(now + 660000);
  const result = await (await service.handleWeather({ request: request('?provider=met-no') })).json();
  expect(result.cached).toBe(true); expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('tries a fresh alternate source before using stale cache and never turns missing temperatures into zero', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(openData())); vi.stubGlobal('fetch', fetchMock);
  await service.handleWeather({ request: request() }); vi.setSystemTime(now + 660000);
  fetchMock.mockResolvedValueOnce(Response.json({ ...openData(), current: { temperature_2m: null } })).mockResolvedValueOnce(Response.json(metData()));
  const result = await (await service.handleWeather({ request: request() })).json(); expect(result.provider).toBe('met-no'); expect(result.stale).toBe(false);
});
it('labels an old report after failures and refuses obsolete data after the stale window', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(openData())); vi.stubGlobal('fetch', fetchMock);
  await service.handleWeather({ request: request('?provider=open-meteo') }); vi.setSystemTime(now + 660000); fetchMock.mockRejectedValue(new Error('offline'));
  const old = await (await service.handleWeather({ request: request('?provider=open-meteo') })).json(); expect(old.stale).toBe(true); expect(old.notice).toContain('上次获取');
  vi.setSystemTime(now + 10800001); const expired = await service.handleWeather({ request: request('?provider=open-meteo') }); expect(expired.status).toBe(502);
});
it('validates provider and method without issuing upstream requests', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  expect((await service.handleWeather({ request: request('?provider=unknown') })).status).toBe(400);
  expect((await service.handleWeather({ request: new Request('https://www.yukino.bond/api/weather', { method: 'POST' }) })).status).toBe(405);
  expect(fetchMock).not.toHaveBeenCalled();
});
