import type { Coordinate } from "./train-position";

type StationRow = [code: string, name: string, longitude: number, latitude: number];
type Stop = [station: number, arrival: number, departure: number];
type Trip = [code: string, days: number, stops: Stop[], paths: number[]];
type ServiceDay = [date: string, tripCount: number, officialCatalogCount: number | null];

export type NationalTimetable = {
  schema: 1;
  feedDate: string;
  feedUrl: string;
  days: ServiceDay[];
  stations: StationRow[];
  trains: Trip[];
  paths: Coordinate[][];
};
export const nationalCategories = {
  high: { label: "高铁 G", color: "#71efbc" },
  emu: { label: "动车／城际 D·C", color: "#65c8ff" },
  classic: { label: "普速及其他", color: "#ffc477" },
} as const;
export type NationalCategory = keyof typeof nationalCategories;
export type NationalTrain = {
  id: string;
  code: string;
  date: string;
  category: NationalCategory;
  from: string;
  to: string;
  previous: string;
  next: string;
  nextAt: number;
  stopped: boolean;
  point: Coordinate | null;
  path: Coordinate[] | null;
};
const pathsBySnapshot = new WeakMap<NationalTimetable, Map<number, { points: Coordinate[]; distances: number[] }>>();

export function parseNationalTimetable(data: unknown): NationalTimetable {
  const value = data as NationalTimetable;
  if (value?.schema !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(value.feedDate)
    || !/^https:\/\/github\.com\/wensimehrp\/chinese-railway-gtfs\/releases\/tag\/gtfs-[\d-]+$/.test(value.feedUrl)
    || !Array.isArray(value.days) || !value.days.length || value.days.length > 7
    || !value.days.every(day => Array.isArray(day) && /^\d{4}-\d{2}-\d{2}$/.test(day[0]) && Number.isInteger(day[1]))
    || !Array.isArray(value.trains) || !value.trains.length || value.trains.length > 25000
    || !Array.isArray(value.stations) || !Array.isArray(value.paths)) throw new Error("全国时刻表格式异常");
  return value;
}

export const beijingDay = (now: number) => new Date(now + 8 * 3600_000).toISOString().slice(0, 10);
const categoryOf = (code: string): NationalCategory => code.startsWith("G") ? "high" : /^[DC]/.test(code) ? "emu" : "classic";
const pointOf = (station?: StationRow): Coordinate | null => station ? [station[2], station[3]] : null;

function getPath(data: NationalTimetable, id: number) {
  const row = data.paths[id];
  if (!row || row.length < 2) return null;
  let cache = pathsBySnapshot.get(data);
  if (!cache) {
    cache = new Map();
    pathsBySnapshot.set(data, cache);
  }
  const saved = cache.get(id);
  if (saved) return saved;
  const points = row.map(([x, y]): Coordinate => [x / 10000, y / 10000]);
  const distances = [0];
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i], [ax, ay] = points[i - 1];
    distances.push(distances[i - 1] + Math.hypot((x - ax) * Math.cos((y + ay) * Math.PI / 360), y - ay));
  }
  const path = { points, distances };
  cache.set(id, path);
  return path;
}

function interpolate(a: Coordinate, b: Coordinate, progress: number): Coordinate {
  return [a[0] + (b[0] - a[0]) * progress, a[1] + (b[1] - a[1]) * progress];
}

function pointOnPath(path: NonNullable<ReturnType<typeof getPath>>, fraction: number): Coordinate {
  const target = path.distances.at(-1)! * fraction;
  const i = firstGreater(path.distances.length, index => path.distances[index] > target);
  if (i >= path.points.length) return path.points.at(-1)!;
  const before = path.distances[i - 1];
  return interpolate(path.points[i - 1], path.points[i], (target - before) / (path.distances[i] - before));
}

function firstGreater(length: number, predicate: (index: number) => boolean) {
  let first = 0, end = length;
  while (first < end) {
    const mid = (first + end) >>> 1;
    if (predicate(mid)) end = mid;
    else first = mid + 1;
  }
  return first;
}

export function nationalTrainsAt(data: NationalTimetable, now: number): NationalTrain[] {
  const today = beijingDay(now);
  if (!data.days.some(([day]) => day === today)) return [];
  const days = data.days.map(([date], index) => {
    const midnight = Date.parse(date + "T00:00:00+08:00");
    return { midnight, seconds: (now - midnight) / 1000, mask: 1 << index, date };
  }).filter(day => day.seconds >= 0);
  const result: NationalTrain[] = [];
  data.trains.forEach(([code, mask, stops, paths], index) => {
    for (const day of days) {
      const time = day.seconds;
      if (!(mask & day.mask) || time < stops[0][2] || time >= stops.at(-1)![1]) continue;
      const current = firstGreater(stops.length, i => stops[i][2] > time);
      const stopped = time >= stops[current][1];
      const fromStop = stopped ? current : current - 1, nextStop = stopped ? current + 1 : current;
      const from = data.stations[stops[fromStop][0]], to = data.stations[stops[nextStop][0]];
      const a = pointOf(from), b = pointOf(to);
      const path = stopped ? null : getPath(data, paths[fromStop]);
      const fraction = stopped ? 0 : (time - stops[fromStop][2]) / (stops[nextStop][1] - stops[fromStop][2]);
      const point = stopped ? a : path ? pointOnPath(path, fraction) : a && b ? interpolate(a, b, fraction) : null;
      result.push({
        id: `${day.date}/${index}`, code, date: day.date, category: categoryOf(code), stopped, point, path: path?.points ?? null,
        from: data.stations[stops[0][0]]?.[1] || "—", to: data.stations[stops.at(-1)![0]]?.[1] || "—",
        previous: from?.[1] || "—", next: to?.[1] || "—", nextAt: day.midnight + stops[nextStop][1] * 1000,
      });
    }
  });
  return result;
}
