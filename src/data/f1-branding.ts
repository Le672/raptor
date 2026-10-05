export type F1TeamBrand = { constructorId: string; slug: string; name: string; aliases?: string[] };

// Verified against the official 2026 team directory; never apply this season's badges to older teams.
const TEAMS_2026: F1TeamBrand[] = [
  { constructorId: "mercedes", slug: "mercedes", name: "Mercedes" },
  { constructorId: "ferrari", slug: "ferrari", name: "Ferrari" },
  { constructorId: "mclaren", slug: "mclaren", name: "McLaren" },
  { constructorId: "red_bull", slug: "red-bull-racing", name: "Red Bull Racing", aliases: ["Red Bull"] },
  { constructorId: "rb", slug: "racing-bulls", name: "Racing Bulls", aliases: ["racing_bulls", "RB F1 Team"] },
  { constructorId: "alpine", slug: "alpine", name: "Alpine", aliases: ["Alpine F1 Team"] },
  { constructorId: "haas", slug: "haas", name: "Haas F1 Team", aliases: ["Haas"] },
  { constructorId: "audi", slug: "audi", name: "Audi" },
  { constructorId: "williams", slug: "williams", name: "Williams" },
  { constructorId: "aston_martin", slug: "aston-martin", name: "Aston Martin" },
  { constructorId: "cadillac", slug: "cadillac", name: "Cadillac", aliases: ["Cadillac F1 Team"] },
];

export function f1TeamBrand(year: number, constructorId?: string, name?: string) {
  if (year !== 2026) return undefined;
  const key = (constructorId || name || "").trim().toLowerCase();
  return TEAMS_2026.find(team => [team.constructorId, team.name, team.slug, ...(team.aliases || [])].some(value => value.toLowerCase() === key));
}

// Jolpica uses nationality adjectives rather than country codes. SVG flags work on Windows too.
const NATIONALITIES: Record<string, string> = {
  american: "us", argentine: "ar", argentinian: "ar", australian: "au", austrian: "at",
  belgian: "be", brazilian: "br", british: "gb", canadian: "ca", chilean: "cl", chinese: "cn",
  colombian: "co", czech: "cz", danish: "dk", dutch: "nl", "east german": "de",
  finnish: "fi", french: "fr", german: "de", hungarian: "hu", indian: "in", indonesian: "id",
  irish: "ie", italian: "it", japanese: "jp", liechtensteiner: "li", malaysian: "my",
  mexican: "mx", monegasque: "mc", "new zealander": "nz", polish: "pl", portuguese: "pt",
  rhodesian: "zw", russian: "ru", "south african": "za", spanish: "es", swedish: "se",
  swiss: "ch", thai: "th", uruguayan: "uy", venezuelan: "ve",
};

export function nationalityFlag(nationality: string) {
  return NATIONALITIES[nationality.trim().toLowerCase()];
}
