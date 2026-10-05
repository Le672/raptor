import type { F1Driver } from "@/lib/f1";

export type DriverNumberMark = { driverId: string; code: string; number: string; asset: string };

// Number artwork and racing numbers verified on Formula1.com's 2026 driver cards.
const MARKS_2026: DriverNumberMark[] = [
  { driverId: "russell", code: "RUS", number: "63", asset: "/f1/numbers/2026/george-russell.webp" },
  { driverId: "antonelli", code: "ANT", number: "12", asset: "/f1/numbers/2026/kimi-antonelli.webp" },
  { driverId: "leclerc", code: "LEC", number: "16", asset: "/f1/numbers/2026/charles-leclerc.webp" },
  { driverId: "hamilton", code: "HAM", number: "44", asset: "/f1/numbers/2026/lewis-hamilton.webp" },
  { driverId: "norris", code: "NOR", number: "1", asset: "/f1/numbers/2026/lando-norris.webp" },
  { driverId: "piastri", code: "PIA", number: "81", asset: "/f1/numbers/2026/oscar-piastri.webp" },
  { driverId: "max_verstappen", code: "VER", number: "3", asset: "/f1/numbers/2026/max-verstappen.webp" },
  { driverId: "hadjar", code: "HAD", number: "6", asset: "/f1/numbers/2026/isack-hadjar.webp" },
  { driverId: "lawson", code: "LAW", number: "30", asset: "/f1/numbers/2026/liam-lawson.webp" },
  { driverId: "lindblad", code: "LIN", number: "41", asset: "/f1/numbers/2026/arvid-lindblad.webp" },
  { driverId: "gasly", code: "GAS", number: "10", asset: "/f1/numbers/2026/pierre-gasly.webp" },
  { driverId: "colapinto", code: "COL", number: "43", asset: "/f1/numbers/2026/franco-colapinto.webp" },
  { driverId: "ocon", code: "OCO", number: "31", asset: "/f1/numbers/2026/esteban-ocon.webp" },
  { driverId: "bearman", code: "BEA", number: "87", asset: "/f1/numbers/2026/oliver-bearman.webp" },
  { driverId: "hulkenberg", code: "HUL", number: "27", asset: "/f1/numbers/2026/nico-hulkenberg.webp" },
  { driverId: "bortoleto", code: "BOR", number: "5", asset: "/f1/numbers/2026/gabriel-bortoleto.webp" },
  { driverId: "sainz", code: "SAI", number: "55", asset: "/f1/numbers/2026/carlos-sainz.webp" },
  { driverId: "albon", code: "ALB", number: "23", asset: "/f1/numbers/2026/alexander-albon.webp" },
  { driverId: "alonso", code: "ALO", number: "14", asset: "/f1/numbers/2026/fernando-alonso.webp" },
  { driverId: "stroll", code: "STR", number: "18", asset: "/f1/numbers/2026/lance-stroll.webp" },
  { driverId: "perez", code: "PER", number: "11", asset: "/f1/numbers/2026/sergio-perez.webp" },
  { driverId: "bottas", code: "BOT", number: "77", asset: "/f1/numbers/2026/valtteri-bottas.webp" },
];

export function driverNumberMark(year: number, driverId?: string, code?: string, racingNumber?: string | number) {
  if (year !== 2026) return undefined;
  const mark = MARKS_2026.find((entry) => entry.driverId === driverId) || MARKS_2026.find((entry) => entry.code === code?.toUpperCase());
  return mark && (racingNumber === undefined || String(racingNumber) === mark.number) ? mark : undefined;
}

export function seasonDriverNumber(year: number, driver: F1Driver) {
  return driverNumberMark(year, driver.driverId, driver.code)?.number || driver.permanentNumber || driver.code || "—";
}
