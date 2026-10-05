import { useState } from "react";
import { UserRound } from "lucide-react";
import type { F1Driver, F1Team } from "@/lib/f1";
import { f1TeamBrand, nationalityFlag } from "@/data/f1-branding";
import { driverPortrait } from "@/data/f1-portraits";
import { safeF1Url, teamColor } from "@/lib/f1";

type DriverIdentity = { driver?: Pick<F1Driver, "driverId" | "givenName" | "familyName">; fullName?: string; year?: number; portraitUrl?: string };
export function F1DriverPortrait({ driver, fullName, year = new Date().getFullYear(), portraitUrl }: DriverIdentity) {
  const official = driverPortrait(year, driver, fullName), source = official || safeF1Url(portraitUrl);
  const [failed, setFailed] = useState<string>();
  return <span className={`f1-driver-photo${official ? " official-portrait" : " session-portrait"}`} aria-hidden="true" title={source && failed !== source ? `${year} 车手资料照` : "暂无对应赛季照片"}>
    {source && failed !== source ? <img key={source} src={source} alt="" loading="lazy" decoding="async" onError={() => setFailed(source)}/> : <UserRound size={22}/>}
  </span>;
}

export function F1DriverName({ driver, fullName, compact = false, year, portraitUrl, withPhoto = true }: DriverIdentity & { compact?: boolean; withPhoto?: boolean }) {
  const words = (fullName || "").replace(/^Andrea Kimi\b/i, "Kimi").trim().split(/\s+/);
  const givenName = driver ? driver.driverId === "antonelli" ? "Kimi" : driver.givenName : words[0] || "—";
  const familyName = driver?.familyName || words.slice(1).join(" ");
  const label = driver ? `${driver.givenName} ${driver.familyName}` : fullName;
  return <span className={`f1-driver-identity${compact ? " f1-driver-identity-compact" : ""}`}>
    {withPhoto && <F1DriverPortrait driver={driver} fullName={fullName} year={year} portraitUrl={portraitUrl}/>}
    <span className={`f1-name-lockup${compact ? " f1-name-lockup-compact" : ""}`} aria-label={label}>
    <span className="f1-name-given">{givenName}</span>{" "}<span className="f1-name-family">{familyName}</span>
    </span>
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
