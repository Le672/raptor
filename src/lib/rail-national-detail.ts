import { distanceKm } from "./train-position";
import type { Coordinate } from "./train-position";
import type { TrainEquipment } from "./rail-equipment";
import type { NationalTrain } from "./rail-national";
import { railApiUrl, readRailResponse } from "./rail-api";

export const DETAIL_ZOOM = { tracks: 11, lengths: 13, station: 15 } as const;
type RefTrack = [id: number, refs: string[], points: Coordinate[]];
export type PlatformFeature = [id: number, kind: "area" | "edge" | "line", ref: string, name: string, refs: string[], points: Coordinate[]];
export type StationGeometry = { platforms: PlatformFeature[]; tracks: RefTrack[] };
export type StationDwell = { train: string; trainNo: string; originDate: string; from: string; to: string;
  arrivalAt: number; departureAt: number; model: string | null; platform: string | null; wicket: string | null };
export type StationDwellResponse = { source: "12306"; station: string; rows: StationDwell[]; checkedAt: number; truncated: boolean };
export type RailViewport = { zoom: number; bounds: [number, number, number, number]; station: string | null };

const ROOT = "/rail-network/20261004-v1/station-details-v1/";
let indexRequest: Promise<{ stations: Record<string, string> }> | undefined;
const tiles = new Map<string, Promise<Record<string, StationGeometry>>>();
async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(ROOT + path, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("车站几何暂不可用");
  return response.json();
}
export async function loadStationGeometry(code: string): Promise<StationGeometry | null> {
  indexRequest ??= fetchJson<{ schema: number; stations: Record<string, string> }>("index.json").then(value => {
    if (value.schema !== 1 || !value.stations) throw new Error("车站几何索引格式不符");
    return value;
  }).catch(error => { indexRequest = undefined; throw error; });
  const tile = (await indexRequest).stations[code];
  if (!tile || !/^\d{2,3}-\d{2,3}$/.test(tile)) return null;
  let request = tiles.get(tile);
  if (!request) {
    if (tiles.size >= 48) tiles.delete(tiles.keys().next().value!);
    request = fetchJson<Record<string, StationGeometry>>(tile + ".json").catch(error => { tiles.delete(tile); throw error; });
    tiles.set(tile, request);
  }
  const value = (await request)[code];
  return value && Array.isArray(value.platforms) && Array.isArray(value.tracks) ? value : null;
}
export async function loadStationDwell(code: string, signal: AbortSignal): Promise<StationDwellResponse> {
  const response = await fetch(railApiUrl(new URLSearchParams({ mode: "national-station", station: code })), {
    signal: AbortSignal.any([signal, AbortSignal.timeout(18000)]),
  });
  const result = await readRailResponse<StationDwellResponse>(response);
  if (result.source !== "12306" || result.station !== code || !Array.isArray(result.rows)) throw new Error("12306 站台资料与车站不符");
  return result;
}

export const inRailView = ([x, y]: Coordinate, [west, south, east, north]: RailViewport["bounds"]) =>
  x >= west && x <= east && y >= south && y <= north;

export function dwellForTrain(train: NationalTrain, rows: StationDwell[]) {
  const matches = rows.filter(row => row.originDate === train.date &&
    (train.trainNo ? row.trainNo === train.trainNo : row.train === train.code && row.from === train.from && row.to === train.to));
  return matches.length === 1 ? matches[0] : undefined;
}

export function symbolLength(train: Pick<NationalTrain, "category" | "code">, equipment?: TrainEquipment | null) {
  if (equipment?.lengthMeters) return { meters: equipment.lengthMeters, coaches: equipment.coachCount, source: "12306" as const };
  if (equipment?.coachCount) return { meters: equipment.coachCount * 25, coaches: equipment.coachCount, source: "编组估算" as const };
  return { meters: train.category === "classic" ? 400 : train.code.startsWith("C") ? 150 : 200, source: "示意长度" as const, coaches: undefined };
}

const profileCache = new WeakMap<Coordinate[], number[]>();
function profile(points: Coordinate[]) {
  let meters = profileCache.get(points);
  if (!meters) {
    meters = [0];
    for (let i = 1; i < points.length; i++) meters.push(meters[i - 1] + distanceKm(points[i - 1], points[i]) * 1000);
    profileCache.set(points, meters);
  }
  return meters;
}

function coordinateAtMeters(points: Coordinate[], distances: number[], target: number): Coordinate {
  let first = 1, end = points.length - 1;
  while (first < end) {
    const mid = (first + end) >>> 1;
    if (distances[mid] >= target) end = mid;
    else first = mid + 1;
  }
  // Extend end tangents by at most half a train to preserve scale on a leg boundary.
  const width = distances[first] - distances[first - 1];
  const q = width > 0 ? (target - distances[first - 1]) / width : 0;
  const [x, y] = points[first - 1], [ex, ey] = points[first];
  return [x + (ex - x) * q, y + (ey - y) * q];
}

function cutLine(points: Coordinate[], distances: number[], start: number, end: number): Coordinate[] {
  return [coordinateAtMeters(points, distances, start),
    ...points.slice(1, -1).filter((_, i) => distances[i + 1] > start && distances[i + 1] < end),
    coordinateAtMeters(points, distances, end)];
}

export function movingTrainBody(train: NationalTrain, meters: number): Coordinate[] | null {
  if (train.stopped) return null;
  const shape = train.path || train.axis;
  if (!shape || shape.length < 2) return null;
  const distances = profile(shape);
  if (distances.at(-1)! < 1) return null;
  const center = train.progress * distances.at(-1)!;
  return cutLine(shape, distances, center - meters / 2, center + meters / 2);
}

const cleanRef = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "").replace(/^(?:第|站台|股道)/, "")
  .replace(/(?:号?(?:站台|股道|道|站臺)|号)$/, "").replace(/^0+(?=\d)/, "");
const platformKey = (label: string) => {
  const ref = cleanRef(label);
  return /^[1-9]\d{0,2}[AB]?$/.test(ref) ? ref : null;
};

function positionOnTrack(target: Coordinate, track: Coordinate[]) {
  const lonScale = Math.cos(target[1] * Math.PI / 180);
  const distances = profile(track);
  let best = { meters: 0, gap: Infinity };
  for (let i = 1; i < track.length; i++) {
    const [ax, ay] = track[i - 1], [bx, by] = track[i];
    const dx = (bx - ax) * lonScale, dy = by - ay, size = dx * dx + dy * dy;
    if (!size) continue;
    const fraction = Math.max(0, Math.min(1, (((target[0] - ax) * lonScale) * dx + (target[1] - ay) * dy) / size));
    const at: Coordinate = [ax + (bx - ax) * fraction, ay + (by - ay) * fraction];
    const gap = distanceKm(target, at) * 1000;
    if (gap < best.gap) best = { gap, meters: distances[i - 1] + fraction * (distances[i] - distances[i - 1]) };
  }
  return best;
}

export function platformTrainBody(geometry: StationGeometry, label: string, meters: number): { line: Coordinate[]; track: boolean; platformId: number } | null {
  const ref = platformKey(label);
  if (!ref) return null;
  const platforms = geometry.platforms.filter(platform => platform[4].includes(ref));
  if (!platforms.length) return null;
  const edges = platforms.filter(platform => platform[1] === "edge");
  const area = edges.length === 1 ? edges[0] : !edges.length && platforms.length === 1 ? platforms[0] : null;
  if (!area || area[5].length < 2) return null;
  const mid: Coordinate = [area[5].reduce((n, p) => n + p[0], 0) / area[5].length,
    area[5].reduce((n, p) => n + p[1], 0) / area[5].length];
  const candidates = geometry.tracks.filter(track => track[1].includes(ref) && track[2].length >= 2)
    .map(track => ({ points: track[2], ...positionOnTrack(mid, track[2]) })).filter(track => track.gap <= 55)
    .sort((a, b) => a.gap - b.gap);
  const track = candidates[0];
  if (track && (!candidates[1] || candidates[1].gap - track.gap >= 12)) {
    const distances = profile(track.points), total = distances.at(-1)!;
    if (total >= meters) {
      const center = Math.max(meters / 2, Math.min(total - meters / 2, track.meters));
      return { line: cutLine(track.points, distances, center - meters / 2, center + meters / 2), track: true, platformId: area[0] };
    }
  }
  // Without a uniquely mapped track, the dashed length glyph stays on the mapped
  // platform itself. Its orientation follows the platform's long axis.
  const points = area[5], anchor = points[0];
  const farthest = (origin: Coordinate) => points.reduce((best, point) =>
    distanceKm(origin, point) > distanceKm(origin, best) ? point : best);
  const end = farthest(anchor), start = farthest(end), long = distanceKm(start, end) * 1000;
  if (long < 35) return null;
  const dx = (end[0] - start[0]) * meters / long / 2, dy = (end[1] - start[1]) * meters / long / 2;
  return { line: [[mid[0] - dx, mid[1] - dy], [mid[0] + dx, mid[1] + dy]], track: false, platformId: area[0] };
}
