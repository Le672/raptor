import type { F1Lap, F1Pit, F1Stint, RaceControl } from "./f1";

export const TYRES: Record<string, { label: string; name: string; color: string }> = {
  SOFT: { label: "S", name: "软胎", color: "#c8473d" }, MEDIUM: { label: "M", name: "中性胎", color: "#a18724" },
  HARD: { label: "H", name: "硬胎", color: "#6e7a70" }, INTERMEDIATE: { label: "I", name: "半雨胎", color: "#2e9263" }, WET: { label: "W", name: "全雨胎", color: "#527ec7" },
};
export const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
export const sectorTime = (value: unknown) => positive(value) ? value.toFixed(3) : "—";
export function driverLaps(laps: F1Lap[], number: number) {
  const unique = new Map<number, F1Lap>();
  for (const lap of laps) {
    if (lap.driver_number !== number || !Number.isInteger(lap.lap_number) || lap.lap_number < 1) continue;
    const previous = unique.get(lap.lap_number);
    if (!previous || (lap.date_start || "") >= (previous.date_start || "")) unique.set(lap.lap_number, lap);
  }
  return [...unique.values()].sort((a, b) => a.lap_number - b.lap_number);
}
export function lapSummary(laps: F1Lap[], number: number) {
  const ordered = driverLaps(laps, number), completed = ordered.filter((lap) => positive(lap.lap_duration));
  const timed = completed.filter((lap) => !lap.is_pit_out_lap);
  return { ordered, latest: ordered[ordered.length - 1], last: completed[completed.length - 1], best: timed.reduce<F1Lap | undefined>((best, lap) => !best || lap.lap_duration! < best.lap_duration! ? lap : best, undefined), completed: completed[completed.length - 1]?.lap_number };
}
export function driverStints(stints: F1Stint[], number: number) {
  const unique = new Map<number, F1Stint>();
  for (const stint of stints) if (stint.driver_number === number && positive(stint.stint_number)) unique.set(stint.stint_number, stint);
  return [...unique.values()].sort((a, b) => a.stint_number - b.stint_number);
}
export function stintRange(stint: F1Stint, completed?: number) {
  const start = positive(stint.lap_start) ? stint.lap_start : undefined;
  const end = positive(stint.lap_end) ? stint.lap_end : completed;
  const length = start !== undefined && end !== undefined && end >= start ? end - start + 1 : undefined;
  const age = length !== undefined && typeof stint.tyre_age_at_start === "number" && Number.isFinite(stint.tyre_age_at_start) && stint.tyre_age_at_start >= 0 ? stint.tyre_age_at_start + length : undefined;
  return { start, end, length, age };
}
export const pitLaneTime = (pit: F1Pit) => positive(pit.lane_duration) ? pit.lane_duration : positive(pit.pit_duration) ? pit.pit_duration : undefined;
export function average(values: (number | null | undefined)[]) {
  const known = values.filter(positive);
  return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : undefined;
}
export function trackStatus(control: RaceControl[], finished = false) {
  if (finished) return { label: "场次已结束", tone: "ended" };
  for (const event of [...control].sort((a, b) => b.date.localeCompare(a.date))) {
    if (event.scope === "Driver" || event.scope === "Sector" || event.driver_number || event.sector) continue;
    if (/VIRTUAL SAFETY CAR.*(DEPLOYED|IN THIS LAP)/i.test(event.message)) return { label: "虚拟安全车 · VSC", tone: "yellow" };
    if (/SAFETY CAR.*(DEPLOYED|IN THIS LAP)/i.test(event.message)) return { label: "安全车 · SC", tone: "yellow" };
    if (event.flag === "RED") return { label: "红旗 · 暂停", tone: "red" };
    if (["YELLOW", "DOUBLE YELLOW"].includes(event.flag || "")) return { label: "全场黄旗", tone: "yellow" };
    if (["GREEN", "CLEAR"].includes(event.flag || "") || /TRACK CLEAR|SESSION STARTED|SAFETY CAR.*WITHDRAWN/i.test(event.message)) return { label: "赛道开放", tone: "green" };
    if (event.flag === "CHEQUERED") return { label: "方格旗", tone: "ended" };
  }
  return { label: "等待赛道状态", tone: "unknown" };
}
