export type F1Driver = { driverId: string; permanentNumber?: string; code?: string; givenName: string; familyName: string; dateOfBirth?: string; nationality: string; url?: string };
export type F1Team = { constructorId: string; name: string; nationality: string; url?: string };
export type F1Race = { season: string; round: string; raceName: string; date: string; time?: string; url?: string; Circuit: { circuitId: string; circuitName: string; url?: string; Location: { lat: string; long: string; locality: string; country: string } }; FirstPractice?: F1Date; SecondPractice?: F1Date; ThirdPractice?: F1Date; Qualifying?: F1Date; SprintQualifying?: F1Date; Sprint?: F1Date };
export type F1Date = { date: string; time?: string };
export type DriverStanding = { position: string; points: string; wins: string; Driver: F1Driver; Constructors: F1Team[] };
export type TeamStanding = { position: string; points: string; wins: string; Constructor: F1Team };
export type F1Result = { position: string; points?: string; grid?: string; laps?: string; status?: string; Driver: F1Driver; Constructor: F1Team; Time?: { time: string }; FastestLap?: { rank: string; lap: string; Time: { time: string } }; Q1?: string; Q2?: string; Q3?: string };
export type F1Meeting = { meeting_key: number; meeting_name: string; meeting_official_name: string; date_start: string; date_end: string; country_name: string; country_flag?: string; location: string; circuit_short_name: string; circuit_image?: string; circuit_info_url?: string; is_cancelled?: boolean };
export type F1Session = { session_key: number; meeting_key: number; session_name: string; session_type: string; date_start: string; date_end: string; year: number; country_name: string; location: string; circuit_short_name: string; is_cancelled?: boolean };
export type TrackDriver = { driver_number: number; full_name: string; name_acronym: string; team_name: string; team_colour?: string; headshot_url?: string };
export type TimingRow = TrackDriver & { position?: number; gap?: number | string | (number | string | null)[]; interval?: number | string; duration?: number | number[]; laps?: number; compound?: string; stint?: number; dnf?: boolean; dns?: boolean; dsq?: boolean; date?: string };
export type RaceControl = { date: string; message: string; flag?: string; category?: string; lap_number?: number; driver_number?: number; scope?: string; sector?: number };
export type F1Weather = { date: string; air_temperature: number; track_temperature: number; humidity: number; wind_speed: number; rainfall: number; pressure?: number; wind_direction?: number };
export type F1Lap = { driver_number: number; lap_number: number; lap_duration: number | null; duration_sector_1?: number | null; duration_sector_2?: number | null; duration_sector_3?: number | null; segments_sector_1?: number[]; segments_sector_2?: number[]; segments_sector_3?: number[]; st_speed?: number | null; is_pit_out_lap?: boolean; date_start?: string };
export type F1Stint = { driver_number: number; stint_number: number; compound?: string; lap_start?: number | null; lap_end?: number | null; tyre_age_at_start?: number | null };
export type F1Pit = { driver_number: number; date: string; lap_number?: number; lane_duration?: number | null; pit_duration?: number | null; stop_duration?: number | null };
export type F1Radio = { driver_number: number; date: string; recording_url: string };
export type F1Meta = { fetchedAt: string; source: string; errors: string[] };
export type SeasonData = F1Meta & { year: number; races: F1Race[]; drivers: DriverStanding[]; teams: TeamStanding[]; standingsRound?: string; teamStandingsRound?: string };
export type WeekendData = F1Meta & { meetings: F1Meeting[]; sessions: F1Session[] };
export type ResultsData = F1Meta & { race?: F1Race; results: F1Result[]; kind: string };
export type LeclercFourth = { race: F1Race; result: F1Result; kind: "results" | "sprint" };
export type LeclercData = F1Meta & { year: number; current?: { race: F1Race; result?: F1Result }; fourths: LeclercFourth[]; available: { current: boolean; results: boolean; sprint: boolean }; starts: { results: number; sprint: number } };
export type LiveData = F1Meta & { session?: F1Session; rows: TimingRow[]; stints?: F1Stint[]; control: RaceControl[]; weather?: F1Weather; state: "live" | "upcoming" | "finished" | "unavailable" | "cancelled"; asOf?: string; liveAccess: boolean; restricted: boolean; partial: boolean };
export type RaceDashboardData = F1Meta & { session: number; laps: F1Lap[]; pits: F1Pit[]; radio: F1Radio[]; available: { laps: boolean; pits: boolean; radio: boolean }; restricted: boolean };
export type LapsData = F1Meta & { laps: F1Lap[]; drivers: TrackDriver[]; session: number };
export type F1NewsItem = { title: string; link: string; pubDate: string; source: string; sourceLabel: string };
export type F1NewsData = F1Meta & { items: F1NewsItem[] };

export const F1_API = "/api/f1";
export const BROADCAST_INFO = "https://www.formula1.com/en/information/f1-broadcast-information.45y3LNsT1D6VoK0ZmX8ciJ";
export const F1_TIMING = "https://www.formula1.com/en/timing/f1-live";
export const TEAM_COLORS: Record<string, string> = { mclaren: "#cf6c1a", mercedes: "#168a80", ferrari: "#c93936", red_bull: "#3f61aa", williams: "#346bc7", aston_martin: "#267465", alpine: "#ac5c87", haas: "#76808a", rb: "#5465aa", racing_bulls: "#5465aa", sauber: "#779839", audi: "#bc3536", cadillac: "#777069" };
export const teamColor = (id: string) => TEAM_COLORS[id] ?? "#68836e";
export const driverName = (driver: F1Driver) => `${driver.givenName} ${driver.familyName}`;
const RACE_NAMES: Record<string, string> = { Australian: "澳大利亚", Chinese: "中国", Japanese: "日本", Bahrain: "巴林", "Saudi Arabian": "沙特阿拉伯", Miami: "迈阿密", Canadian: "加拿大", Monaco: "摩纳哥", "Barcelona-Catalunya": "巴塞罗那", Spanish: "西班牙", Austrian: "奥地利", British: "英国", Belgian: "比利时", Hungarian: "匈牙利", Dutch: "荷兰", Italian: "意大利", Azerbaijan: "阿塞拜疆", Singapore: "新加坡", "United States": "美国", "Mexico City": "墨西哥城", "São Paulo": "圣保罗", Brazilian: "巴西", "Las Vegas": "拉斯维加斯", Qatar: "卡塔尔", "Abu Dhabi": "阿布扎比", Portuguese: "葡萄牙", French: "法国", "Emilia Romagna": "艾米利亚罗马涅", Turkish: "土耳其", Russian: "俄罗斯" };
export function raceName(name: string) { const base = name.replace(/ Grand Prix$/, ""); return RACE_NAMES[base] ? `${RACE_NAMES[base]}大奖赛` : name; }
export const SESSION_NAMES: Record<string, string> = { "Practice 1": "一练", "Practice 2": "二练", "Practice 3": "三练", Qualifying: "排位赛", "Sprint Qualifying": "冲刺排位", "Sprint Shootout": "冲刺排位", Sprint: "冲刺赛", Race: "正赛" };
export function raceSessions(race: F1Race) {
  return ([ ["一练", race.FirstPractice], ["二练", race.SecondPractice], ["三练", race.ThirdPractice], ["冲刺排位", race.SprintQualifying], ["冲刺赛", race.Sprint], ["排位赛", race.Qualifying], ["正赛", { date: race.date, time: race.time }] ] as [string, F1Date | undefined][])
    .filter((entry): entry is [string, F1Date] => !!entry[1]?.date).map(([name, value]) => ({ name, ...value })).sort((a, b) => `${a.date}T${a.time || ""}`.localeCompare(`${b.date}T${b.time || ""}`));
}
export function raceTimestamp(race: F1Date) { return race.time ? Date.parse(`${race.date}T${race.time}`) : Date.parse(`${race.date}T23:59:59Z`); }
export function formatF1Date(value?: string | number, timezone = "Asia/Singapore", options: Intl.DateTimeFormatOptions = {}) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "时间待公布";
  return new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, ...options }).format(new Date(value));
}
export function formatRaceDate(value: F1Date, timezone: string) { return value.time ? formatF1Date(`${value.date}T${value.time}`, timezone) : `${value.date} · 时间待公布`; }
export function lapTime(seconds?: number | number[] | null) {
  const value = Array.isArray(seconds) ? seconds.filter((n) => typeof n === "number" && Number.isFinite(n)).slice(-1)[0] : seconds;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "—";
  return `${Math.floor(value / 60)}:${(value % 60).toFixed(3).padStart(6, "0")}`;
}
export function gapTime(gap?: TimingRow["gap"]) {
  const value = Array.isArray(gap) ? gap.filter((v) => v !== null).slice(-1)[0] : gap;
  if (typeof value === "number" && Number.isFinite(value)) return value === 0 ? "LEADER" : `+${value.toFixed(3)}`;
  return typeof value === "string" && value ? value : "—";
}
export function sessionState(session: F1Session, now = Date.now()): LiveData["state"] {
  if (session.is_cancelled) return "cancelled";
  const start = Date.parse(session.date_start), end = Date.parse(session.date_end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "unavailable";
  return now < start ? "upcoming" : now > end ? "finished" : "live";
}
export function latestByDriver<T extends { driver_number: number; date?: string }>(rows: T[]) {
  const map = new Map<number, T>();
  for (const row of rows) if (!map.has(row.driver_number) || !row.date || (row.date >= (map.get(row.driver_number)?.date || ""))) map.set(row.driver_number, row);
  return map;
}
export function safeF1Url(url?: string) { try { const parsed = new URL(url || ""); return ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href.replace(/^http:/, "https:") : undefined; } catch { return undefined; } }
export function calendarIcs(races: F1Race[], now = new Date()) {
  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const events = races.flatMap((race) => raceSessions(race).map((session) => {
    const start = session.time ? new Date(`${session.date}T${session.time}`) : new Date(`${session.date}T00:00:00Z`);
    if (!Number.isFinite(start.getTime())) return "";
    const end = new Date(start.getTime() + (session.time ? (session.name === "正赛" ? 120 : 60) * 60000 : 86400000));
    const lines = ["BEGIN:VEVENT", `UID:f1-${race.season}-${race.round}-${encodeURIComponent(session.name)}@yukino.bond`, `DTSTAMP:${stamp(now)}`, session.time ? `DTSTART:${stamp(start)}` : `DTSTART;VALUE=DATE:${session.date.replace(/-/g, "")}`, session.time ? `DTEND:${stamp(end)}` : `DTEND;VALUE=DATE:${stamp(end).slice(0, 8)}`, `SUMMARY:${escape(`${raceName(race.raceName)} · ${session.name}`)}`, `LOCATION:${escape(race.Circuit.circuitName)}`, `DESCRIPTION:${escape("赛程来源 Jolpica；比赛时间和预计时长可能调整，请以官方最新安排为准。")}`, "URL:https://f1.yukino.bond", "END:VEVENT"];
    // Fold at 75 UTF-8 bytes without splitting a code point (RFC 5545).
    return lines.map((line) => { const parts: string[] = []; let part = "", bytes = 0; for (const char of line) { const size = new TextEncoder().encode(char).length; if (bytes + size > 75) { parts.push(part); part = " "; bytes = 1; } part += char; bytes += size; } parts.push(part); return parts.join("\r\n"); }).join("\r\n");
  }));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Yukino//Formula 1 Calendar//ZH", "CALSCALE:GREGORIAN", ...events.filter(Boolean), "END:VCALENDAR", ""].join("\r\n");
}
export function downloadF1File(content: string, filename: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
