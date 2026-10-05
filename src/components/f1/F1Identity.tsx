import type { F1Driver, F1Team } from "@/lib/f1";
import { f1TeamBrand, nationalityFlag } from "@/data/f1-branding";
import { teamColor } from "@/lib/f1";

export function F1DriverName({ driver, fullName, compact = false }: { driver?: Pick<F1Driver, "driverId" | "givenName" | "familyName">; fullName?: string; compact?: boolean }) {
  const words = (fullName || "").replace(/^Andrea Kimi\b/i, "Kimi").trim().split(/\s+/);
  const givenName = driver ? driver.driverId === "antonelli" ? "Kimi" : driver.givenName : words[0] || "—";
  const familyName = driver?.familyName || words.slice(1).join(" ");
  const label = driver ? `${driver.givenName} ${driver.familyName}` : fullName;
  return <span className={`f1-name-lockup${compact ? " f1-name-lockup-compact" : ""}`} aria-label={label}>
    <span className="f1-name-given">{givenName}</span>{" "}<span className="f1-name-family">{familyName}</span>
  </span>;
}

export function F1CountryFlag({ nationality }: { nationality: string }) {
  const country = nationalityFlag(nationality);
  return country
    ? <img className="f1-country-flag" src={`/f1/flags/${country}.svg`} alt={nationality} title={nationality} width={24} height={24} loading="lazy"/>
    : <span className="f1-country-unknown" title={nationality || "国籍未知"} aria-label={nationality || "国籍未知"}>—</span>;
}

export function F1TeamName({ year, team, name, compact = false }: { year: number; team?: Pick<F1Team, "constructorId" | "name">; name?: string; compact?: boolean }) {
  const brand = f1TeamBrand(year, team?.constructorId, team?.name || name);
  const display = brand?.name || team?.name || name || "—";
  const logo = brand && `/f1/brands/2026/${brand.slug}-logo.webp`;
  return <span className={`f1-team-identity${compact ? " f1-team-identity-compact" : ""}`}>
    {logo && <img className="f1-team-logo" src={logo} alt="" aria-hidden="true" width={45} height={45} loading="lazy" style={{ backgroundColor: teamColor(brand.constructorId) }}/>}
    <span>{display}</span>
  </span>;
}
