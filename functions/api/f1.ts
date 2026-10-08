import { latestByDriver, sessionState } from "../../src/lib/f1";
import type { F1Session, TimingRow, TrackDriver, RaceControl, LiveData, F1Stint, RaceDashboardData, F1Race, F1Result, LeclercFourth } from "../../src/lib/f1";
import { parseFeed } from "../_utils/news-feed";

type Context = { request: Request; env?: { OPENF1_TOKEN?: string }; waitUntil?: (promise: Promise<unknown>) => void };
type Json = Record<string, any>;
class UpstreamError extends Error { constructor(public status: number, public label: string) { super(`${label} ${status === 429 ? "请求频率受限，请稍后重试" : status === 401 || status === 403 ? "需要有效的实时数据订阅凭据" : `暂时不可用（HTTP ${status}）`}`); } }
const localCache = new Map<string, { until: number; value: any }>();
const pending = new Map<string, Promise<any>>();
let nextOpenRequest = 0;
async function upstream(address: string, token?: string, ttl = 60000) {
  const key = `${address}|${token ? "authenticated" : "public"}`;
  const stored = localCache.get(key); if (stored && stored.until > Date.now()) return stored.value;
  if (pending.has(key)) return pending.get(key);
  const task = (async () => {
    const isOpen = address.startsWith("https://api.openf1.org/");
    if (isOpen) { const start = Math.max(Date.now(), nextOpenRequest); nextOpenRequest = start + 400; const delay = start - Date.now(); if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay)); }
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 11000);
    try {
      const headers: Record<string, string> = { Accept: "application/json", "User-Agent": "Yukino-F1/1.0 (+https://f1.yukino.bond)" };
      if (isOpen && token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(address, { headers, signal: controller.signal });
      if (!response.ok) throw new UpstreamError(response.status, isOpen ? "OpenF1" : "Jolpica");
      const body = await response.text(); if (body.length > 5000000) throw new Error("数据源响应过大，请缩小查询范围");
      const value = JSON.parse(body);
      if (isOpen ? !Array.isArray(value) : !value?.MRData) throw new Error("数据源返回格式异常");
      if (localCache.size >= 150) localCache.delete(localCache.keys().next().value!);
      localCache.set(key, { until: Date.now() + ttl, value });
      return value;
    } catch (error) { if (error instanceof UpstreamError) throw error; throw new Error(controller.signal.aborted ? "数据源连接超时" : error instanceof Error && /^(数据源|数据源响应)/.test(error.message) ? error.message : "暂时无法连接数据源"); }
    finally { clearTimeout(timer); }
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}
export const jolpica = (path: string) => upstream(`https://api.jolpi.ca/ergast/f1/${path}.json?limit=100`);
export const openf1 = (endpoint: string, params: Record<string, string | number>, token?: string, ttl = 60000) => upstream(`https://api.openf1.org/v1/${endpoint}?${new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]))}`, token, ttl);
function settled<T>(result: PromiseSettledResult<T>, errors: string[], fallback: T): T { if (result.status === "fulfilled") return result.value; errors.push(result.reason instanceof Error ? result.reason.message : "数据源暂时不可用"); return fallback; }
function array(value: unknown): any[] { return Array.isArray(value) ? value : []; }

async function loadSeason(year: number) {
  const errors: string[] = [];
  const requests = await Promise.allSettled([jolpica(String(year)), jolpica(`${year}/driverStandings`), jolpica(`${year}/constructorStandings`)]);
  const schedule = settled(requests[0], errors, {}) as Json;
  const drivers = (settled(requests[1], errors, {}) as Json)?.MRData?.StandingsTable?.StandingsLists?.[0];
  const teams = (settled(requests[2], errors, {}) as Json)?.MRData?.StandingsTable?.StandingsLists?.[0];
  const races = array(schedule?.MRData?.RaceTable?.Races);
  return { year, races, drivers: array(drivers?.DriverStandings), teams: array(teams?.ConstructorStandings), standingsRound: drivers?.round, teamStandingsRound: teams?.round, errors, source: "Jolpica F1", unavailable: !races.length && !drivers && !teams && errors.length > 0 };
}
async function loadWeekend(year: number, token?: string) {
  const errors: string[] = [];
  const requests = await Promise.allSettled([openf1("meetings", { year }, token, 3600000), openf1("sessions", { year }, token, 3600000)]);
  const meetings = settled(requests[0], errors, []), sessions = settled(requests[1], errors, []);
  return { meetings, sessions, errors, source: "OpenF1", unavailable: !meetings.length && !sessions.length && errors.length > 0 };
}
async function loadResults(year: number, round: string, kind: string) {
  const value = await jolpica(`${year}/${round}/${kind}`);
  const race = value.MRData?.RaceTable?.Races?.[0];
  const key = kind === "qualifying" ? "QualifyingResults" : kind === "sprint" ? "SprintResults" : "Results";
  return { race, results: array(race?.[key]), kind, errors: [], source: "Jolpica F1" };
}

async function leclercCareer(kind: "results" | "sprint") {
  const field = kind === "results" ? "Results" : "SprintResults";
  const entries: LeclercFourth[] = [];
  let offset = 0, total = 0;
  do {
    const page = await upstream(`https://api.jolpi.ca/ergast/f1/drivers/leclerc/${kind}.json?limit=100&offset=${offset}`, undefined, 300000);
    total = Number(page.MRData.total);
    if (!Number.isSafeInteger(total) || total < 0 || total > 1000 || Number(page.MRData.offset) !== offset) throw new Error("勒克莱尔历史记录分页格式异常");
    const races = array(page.MRData?.RaceTable?.Races);
    let received = 0;
    for (const race of races) for (const result of array(race[field])) {
      received++;
      if (result.Driver?.driverId === "leclerc") {
        const { Results: _results, SprintResults: _sprint, ...metadata } = race;
        entries.push({ race: metadata as F1Race, result: result as F1Result, kind });
      }
    }
    if (received === 0 && offset < total) throw new Error("勒克莱尔历史记录分页不完整，请稍后重试");
    offset += received;
  } while (offset < total);
  return entries;
}

async function loadLeclerc(year: number) {
  const errors: string[] = [];
  const parts = await Promise.allSettled([loadResults(year, "last", "results"), leclercCareer("results"), leclercCareer("sprint")]);
  const latest = settled(parts[0], errors, undefined), races = settled(parts[1], errors, []), sprints = settled(parts[2], errors, []);
  const unique = new Map<string, LeclercFourth>();
  for (const entry of [...races, ...sprints]) if (entry.result.position === "4") unique.set(`${entry.race.season}:${entry.race.round}:${entry.kind}`, entry);
  const fourths = [...unique.values()].sort((a, b) => Number(b.race.season) - Number(a.race.season) || Number(b.race.round) - Number(a.race.round) || (a.kind === b.kind ? 0 : a.kind === "results" ? -1 : 1));
  return { year, current: latest?.race ? { race: latest.race as F1Race, result: latest.results.find((result: F1Result) => result.Driver?.driverId === "leclerc") as F1Result | undefined } : undefined, fourths, available: { current: parts[0].status === "fulfilled", results: parts[1].status === "fulfilled", sprint: parts[2].status === "fulfilled" }, starts: { results: races.length, sprint: sprints.length }, errors, source: "Jolpica F1 · 勒克莱尔成绩", unavailable: parts.every(part => part.status === "rejected") };
}
async function loadLive(sessionKey: string, token: string | undefined, year: number): Promise<Omit<LiveData, "fetchedAt">> {
  const errors: string[] = [];
  let session: F1Session | undefined;
  if (sessionKey === "latest" && year !== new Date().getUTCFullYear()) {
    const sessions = await openf1("sessions", { year }, token, 3600000) as F1Session[];
    session = sessions.filter((s) => !s.is_cancelled).sort((a, b) => a.date_start.localeCompare(b.date_start)).filter((s) => Date.parse(s.date_start) <= Date.now()).slice(-1)[0];
  } else session = (await openf1("sessions", { session_key: sessionKey }, token, sessionKey === "latest" ? 30000 : 3600000))?.[0];
  if (!session) return { rows: [], control: [], state: "unavailable", liveAccess: !!token, restricted: false, partial: false, errors: ["该场次暂未公布"], source: "OpenF1" };
  const state = sessionState(session);
  const base = { session, state, source: "OpenF1", liveAccess: !!token, errors };
  if (state === "upcoming" || state === "cancelled") return { ...base, rows: [], control: [], restricted: false, partial: false };
  if (state === "unavailable") return { ...base, rows: [], control: [], restricted: false, partial: true };
  // Live access includes the provider's 30-minute window around a session.
  const restrictedWindow = Date.now() < Date.parse(session.date_end) + 30 * 60000;
  if (!token && restrictedWindow) return { ...base, rows: [], control: [], restricted: true, partial: false, errors: ["比赛中的实时计时需要 OpenF1 订阅凭据；可打开官方计时与直播入口。"] };
  const end = Math.min(Date.now(), Date.parse(session.date_end));
  const from = new Date(Math.max(Date.parse(session.date_start), end - 5 * 60000)).toISOString();
  const common = { session_key: session.session_key }, recent = { ...common, "date>": from };
  const ttl = state === "live" ? 25000 : 3600000;
  const parts = await Promise.allSettled([
    openf1("drivers", common, token, 3600000),
    openf1(state === "live" ? "position" : "session_result", state === "live" ? recent : common, token, ttl),
    state === "live" ? openf1("intervals", recent, token, ttl) : Promise.resolve([]),
    openf1("stints", common, token, ttl),
    openf1("race_control", common, token, ttl),
    openf1("weather", state === "live" ? recent : common, token, ttl),
  ]);
  const drivers = settled(parts[0], errors, []) as TrackDriver[];
  const ranks = latestByDriver(settled(parts[1], errors, []));
  const intervals = latestByDriver(settled(parts[2], errors, []));
  const stintRows = settled(parts[3], errors, []) as F1Stint[];
  const stints = new Map<number, F1Stint>(); for (const stint of stintRows) if (!stints.has(stint.driver_number) || stint.stint_number > stints.get(stint.driver_number)!.stint_number) stints.set(stint.driver_number, stint);
  const control = array(settled(parts[4], errors, [])).sort((a, b) => a.date.localeCompare(b.date)).slice(-60) as RaceControl[];
  const weatherRows = array(settled(parts[5], errors, [])).sort((a, b) => a.date.localeCompare(b.date));
  const weather = weatherRows[weatherRows.length - 1];
  const rows: TimingRow[] = drivers.map((driver) => {
    const rank = ranks.get(driver.driver_number) as any, interval = intervals.get(driver.driver_number) as any, stint = stints.get(driver.driver_number);
    return { ...driver, position: rank?.position, duration: rank?.duration, gap: state === "finished" ? rank?.gap_to_leader : interval?.gap_to_leader, interval: interval?.interval, laps: rank?.number_of_laps, compound: stint?.compound, stint: stint?.stint_number, dnf: rank?.dnf, dns: rank?.dns, dsq: rank?.dsq, date: [rank?.date, interval?.date].filter(Boolean).sort().slice(-1)[0] };
  }).sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.driver_number - b.driver_number);
  const times = [...rows.map((row) => row.date), ...control.map((row) => row.date), weather?.date].filter((date): date is string => !!date && Number.isFinite(Date.parse(date))).sort();
  const asOf = times[times.length - 1];
  // A running session with old or absent timing must never masquerade as live.
  const hasRecentTiming = state !== "live" || rows.some((row) => row.position !== undefined && row.date && Date.now() - Date.parse(row.date) < 120000);
  const restricted = parts.some((part) => part.status === "rejected" && part.reason instanceof UpstreamError && [401, 403].includes(part.reason.status));
  return { ...base, state: state === "live" && !hasRecentTiming ? "unavailable" : state, rows, stints: stintRows, control, weather, asOf, restricted, partial: parts.some((part) => part.status === "rejected") || !hasRecentTiming };
}
async function loadDashboard(sessionKey: string, token?: string): Promise<Omit<RaceDashboardData, "fetchedAt"> & { unavailable?: boolean }> {
  const errors: string[] = [];
  const session = (await openf1("sessions", { session_key: sessionKey }, token, 3600000))[0] as F1Session | undefined;
  const base = { session: Number(sessionKey), laps: [], pits: [], radio: [], available: { laps: false, pits: false, radio: false }, restricted: false, errors, source: "OpenF1 · 逐圈 / 进站 / 无线电" };
  if (!session) return { ...base, unavailable: true, errors: ["该场次暂未公布"] };
  const state = sessionState(session);
  if (["upcoming", "cancelled", "unavailable"].includes(state)) return base;
  if (!token && Date.now() < Date.parse(session.date_end) + 30 * 60000) return { ...base, restricted: true, errors: ["实时看板需要有效的 OpenF1 订阅凭据"] };
  const common = { session_key: session.session_key }, ttl = state === "live" ? 25000 : 3600000;
  const parts = await Promise.allSettled([openf1("laps", common, token, ttl), openf1("pit", common, token, ttl), openf1("team_radio", common, token, ttl)]);
  // Independent feeds retain their records when another endpoint fails.
  const laps = settled(parts[0], errors, []).slice(0, 12000);
  const pits = settled(parts[1], errors, []).sort((a: Json, b: Json) => a.date.localeCompare(b.date)).slice(-500);
  const radio = settled(parts[2], errors, []).sort((a: Json, b: Json) => a.date.localeCompare(b.date)).slice(-100);
  const restricted = parts.some((part) => part.status === "rejected" && part.reason instanceof UpstreamError && [401, 403].includes(part.reason.status));
  const available = { laps: parts[0].status === "fulfilled", pits: parts[1].status === "fulfilled", radio: parts[2].status === "fulfilled" };
  return { ...base, laps, pits, radio, available, restricted, errors, unavailable: parts.every((part) => part.status === "rejected") };
}
async function loadLaps(session: string, numbers: string, token?: string) {
  const errors: string[] = [], drivers = await openf1("drivers", { session_key: session }, token, 3600000);
  const wanted = numbers.split(",").filter(Boolean).slice(0, 2);
  const values = await Promise.allSettled(wanted.map((driver) => openf1("laps", { session_key: session, driver_number: driver }, token, 3600000)));
  return { session: Number(session), drivers, laps: values.flatMap((result) => settled(result, errors, [])), errors, source: "OpenF1" };
}
async function loadNews() {
  const feeds = [
    { key: "skyf1", label: "Sky Sports F1", url: "https://www.skysports.com/rss/12040", website: "https://www.skysports.com/f1", category: "国际" as const, language: "en" as const },
    { key: "autosportf1", label: "Autosport F1", url: "https://www.autosport.com/rss/f1/news/", website: "https://www.autosport.com/f1/", category: "国际" as const, language: "en" as const },
    { key: "bbcf1", label: "BBC F1", url: "https://feeds.bbci.co.uk/sport/formula1/rss.xml", website: "https://www.bbc.com/sport/formula1", category: "国际" as const, language: "en" as const },
  ];
  const errors: string[] = [];
  const results = await Promise.allSettled(feeds.map(async (feed) => { const response = await fetch(feed.url, { signal: AbortSignal.timeout(9000), headers: { "User-Agent": "Yukino-F1/1.0", Accept: "application/rss+xml, application/xml, text/xml" } }); if (!response.ok) throw new Error(`${feed.label} 暂不可用`); const body = await response.text(); if (body.length > 1500000) throw new Error(`${feed.label} 内容过大`); const items = parseFeed(body, feed, 20); if (!items.length) throw new Error(`${feed.label} 暂无有效条目`); return items; }));
  const seen = new Set<string>();
  const items = results.flatMap((result) => settled(result, errors, [])).filter((item) => { if (seen.has(item.link)) return false; seen.add(item.link); return true; }).sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
  return { items, errors, source: "Sky Sports / Autosport / BBC", unavailable: !items.length };
}

export async function onRequestGet(context: Context) {
  const url = new URL(context.request.url);
  const action = url.searchParams.get("action") || "season";
  const rawYear = url.searchParams.get("year") || String(new Date().getUTCFullYear());
  const year = Number(rawYear), maxYear = new Date().getUTCFullYear() + 1;
  const round = url.searchParams.get("round") || "last", kind = url.searchParams.get("kind") || "results";
  const session = url.searchParams.get("session") || "latest", drivers = url.searchParams.get("drivers") || "";
  const headers = { "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff" };
  if (!["season", "weekend", "results", "leclerc", "live", "dashboard", "laps", "drivers", "news"].includes(action) || !/^\d{4}$/.test(rawYear) || year < 1950 || year > maxYear || !/^(last|[1-9]\d?)$/.test(round) || !["results", "qualifying", "sprint"].includes(kind) || !/^(latest|[1-9]\d{0,7})$/.test(session) || !/^$|^\d{1,3}(,\d{1,3})?$/.test(drivers) || (action === "laps" && (session === "latest" || !drivers)) || (action === "dashboard" && session === "latest")) return new Response(JSON.stringify({ error: "查询参数无效" }), { status: 400, headers });
  if (["weekend", "dashboard", "laps", "drivers"].includes(action) && year < 2023) return new Response(JSON.stringify({ error: "OpenF1 详细数据从 2023 赛季开始提供" }), { status: 400, headers });
  const token = context.env?.OPENF1_TOKEN;
  const cache = typeof caches !== "undefined" ? (caches as CacheStorage & { default?: Cache }).default : undefined;
  const cacheUrl = new URL(`${url.origin}${url.pathname}`); cacheUrl.search = new URLSearchParams({ v: "2", action, year: String(year), round, kind, session, drivers, access: token ? "configured" : "public" }).toString();
  const cacheKey = new Request(cacheUrl.href);
  try { const cached = await cache?.match(cacheKey); if (cached) return cached; } catch { /* Edge caching is optional. */ }
  try {
    const value = action === "season" ? await loadSeason(year) : action === "weekend" ? await loadWeekend(year, token) : action === "results" ? await loadResults(year, round, kind) : action === "leclerc" ? await loadLeclerc(year) : action === "live" ? await loadLive(session, token, year) : action === "dashboard" ? await loadDashboard(session, token) : action === "laps" ? await loadLaps(session, drivers, token) : action === "drivers" ? { drivers: await openf1("drivers", { session_key: session }, token, 3600000), errors: [], source: "OpenF1" } : await loadNews();
    const errors = [...new Set(value.errors)];
    const payload = { ...value, errors, fetchedAt: new Date().toISOString() };
    const status = "unavailable" in value && value.unavailable ? 503 : 200;
    const seconds = errors.length || action === "live" || action === "dashboard" ? 30 : action === "news" ? 300 : action === "weekend" || action === "laps" ? 3600 : 300;
    const response = new Response(JSON.stringify(payload), { status, headers: { ...headers, "Cache-Control": status === 200 ? `public, max-age=${seconds}` : "no-store" } });
    if (cache && status === 200) { const save = cache.put(cacheKey, response.clone()).catch(() => {}); if (context.waitUntil) context.waitUntil(save); else await save; }
    return response;
  } catch (error) { return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "数据源暂不可用，请稍后重试", fetchedAt: new Date().toISOString() }), { status: 503, headers: { ...headers, "Cache-Control": "no-store" } }); }
}
