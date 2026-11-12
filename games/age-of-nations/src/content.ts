import raw from './data/rules.json';
export type YieldName = 'food' | 'production' | 'gold' | 'science' | 'culture';
export type Yields = Record<YieldName, number>;
export interface Definition {
  id: string; tech?: string | null; era?: number; requires?: string[]; cost?: number;
  food?: number; production?: number; gold?: number; science?: number; culture?: number;
  foodBonus?: number; productionBonus?: number; goldBonus?: number; scienceBonus?: number; cultureBonus?: number; allBonus?: number; militaryBonus?: number;
  stability?: number; upkeep?: number; pollution?: number; defense?: number; specialists?: number; fuel?: string;
  domain?: 'land' | 'sea' | 'air'; civilian?: boolean; moves?: number; strength?: number; range?: number; resources?: Record<string, number>; capacity?: number;
  civ?: string; coastal?: boolean; color?: string; kind?: 'bonus' | 'strategic' | 'luxury'; improvement?: string; slot?: string;
}
export type Civ = typeof raw.civs[number];
const index = <T extends { id: string }>(items: T[]) => Object.fromEntries(items.map(item => [item.id, item])) as Record<string, T>;
// Validate content on startup, with file/field paths rather than failing inside a turn.
for (const [group, values] of Object.entries(raw)) {
  if (!Array.isArray(values)) continue;
  const ids = new Set<string>();
  for (const [i, value] of values.entries()) {
    if (!value.id || ids.has(value.id)) throw new Error(`rules.json/${group}/${i}/id: missing or duplicate`);
    ids.add(value.id);
    for (const [key, number] of Object.entries(value)) if (typeof number === 'number' && !Number.isFinite(number)) throw new Error(`rules.json/${group}/${i}/${key}: not finite`);
  }
}
export const rules = raw.settings;
export const terrains = index(raw.terrains);
export const resources = index(raw.resources as Definition[]);
export const techs = index(raw.techs);
export const buildings = index(raw.buildings as Definition[]);
export const unitTypes = index(raw.units as Definition[]);
export const projects = index(raw.projects as Definition[]);
export const civs = index(raw.civs);
export const governments = index(raw.governments as (Definition & { slots: number; upkeepBonus?: number; fatigueBonus?: number })[]);
export const policies = index(raw.policies as Definition[]);
export const improvements = index(raw.improvements as Definition[]);
export const events = index(raw.events);
export const catalogs = { building: buildings, unit: unitTypes, project: projects };
for (const [group, values] of Object.entries({ buildings, unitTypes, projects, policies, improvements })) {
  for (const item of Object.values(values)) if (item.tech && !techs[item.tech]) throw new Error(`rules.json/${group}/${item.id}/tech: unknown ${item.tech}`);
}
for (const tech of Object.values(techs)) for (const id of tech.requires) if (!techs[id]) throw new Error(`rules.json/techs/${tech.id}/requires: unknown ${id}`);
export const emptyYields = (): Yields => ({ food: 0, production: 0, gold: 0, science: 0, culture: 0 });
