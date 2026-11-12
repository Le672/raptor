import type { F1Meta, F1Race } from "./f1";

export type DriverOfTheDay = { race: string; driver: string; raceUrl?: string };
export type DriverOfTheDayData = F1Meta & { year: number; rows: DriverOfTheDay[] };

export function driverOfTheDaySource(year: number) {
  return year >= 2019
    ? `https://www.formula1.com/en/results/${year}/awards/driver-of-the-day`
    : "https://www.formula1.com/en/latest/article/driver-of%20-the-day-2024.1I7A0iPl3nMaXyPIeFVFLZ.1I7A0iPl3nMaXyPIeFVFLZ";
}

const raceAliases: Record<string, string> = {
  australia: "australian", china: "chinese", japan: "japanese", canada: "canadian",
  austria: "austrian", greatbritain: "british", belgium: "belgian", hungary: "hungarian",
  netherlands: "dutch", italy: "italian", spain: "spanish", saudiarabia: "saudiarabian",
  portugal: "portuguese", france: "french", germany: "german", russia: "russian",
  turkey: "turkish", europe: "european", malaysia: "malaysian", mexico: "mexicocity", mexican: "mexicocity",
  brazil: "saopaulo", brazilian: "saopaulo", barcelonacatalunya: "barcelona",
  bahraininmalaysia: "bahrain",
};

export function awardRaceKey(name: string) {
  const key = name.replace(/ Grand Prix$/i, "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return raceAliases[key] ?? key;
}

export function awardRaceName(award: DriverOfTheDay, races: F1Race[]) {
  return races.find(race => awardRaceKey(race.raceName) === awardRaceKey(award.race))?.raceName ?? `${award.race} Grand Prix`;
}
