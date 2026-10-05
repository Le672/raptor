import { Heart } from "lucide-react";
import type { DriverStanding, TeamStanding } from "@/lib/f1";
import { driverName, teamColor } from "@/lib/f1";
import { f1TeamBrand } from "@/data/f1-branding";
import { F1DriverNumber } from "./F1DriverNumber";
import { F1CountryFlag, F1DriverName, F1TeamName } from "./F1Identity";
import { Empty, External } from "./F1Common";

export function F1PaddockContent({ year, drivers, shownDrivers, teams, teamFilter, favorites, toggleFavorite, loading, standingsRound }: {
  year: number; drivers: DriverStanding[]; shownDrivers: DriverStanding[]; teams: TeamStanding[];
  teamFilter: string; favorites: string[]; toggleFavorite: (id: string) => void; loading: boolean; standingsRound?: string;
}) {
  return <>
    <div className="f1-driver-grid">
      {shownDrivers.map(row => <article key={row.Driver.driverId} style={{ borderTopColor: teamColor(row.Constructors[0]?.constructorId) }}>
        <div className="f1-driver-card-top">
          <F1DriverNumber year={year} driverId={row.Driver.driverId} code={row.Driver.code} number={row.Driver.permanentNumber} color={teamColor(row.Constructors[0]?.constructorId)}/>
          <button aria-label={`${favorites.includes(row.Driver.driverId) ? "取消关注" : "关注"}${driverName(row.Driver)}`} aria-pressed={favorites.includes(row.Driver.driverId)} onClick={() => toggleFavorite(row.Driver.driverId)}><Heart size={18} fill={favorites.includes(row.Driver.driverId) ? "currentColor" : "none"}/></button>
        </div>
        <div className="f1-driver-teams">{row.Constructors.map(team => <F1TeamName key={team.constructorId} year={year} team={team} compact/>)}</div>
        <h2><F1DriverName year={year} driver={row.Driver}/></h2>
        <div className="f1-driver-nationality"><F1CountryFlag nationality={row.Driver.nationality}/>{row.Driver.dateOfBirth && <span>{row.Driver.dateOfBirth}</span>}</div>
        <div className="f1-driver-stats"><span><strong>P{row.position}</strong>赛季排名</span><span><strong>{row.points}</strong>积分</span><span><strong>{row.wins}</strong>胜场</span></div>
        <External href={row.Driver.url}>车手资料</External>
      </article>)}
    </div>
    {!shownDrivers.length && !loading && <Empty>没有符合筛选的车手；关注列表保存在当前浏览器。</Empty>}
    <h2 className="f1-subheading">车队故事</h2>
    <div className="f1-team-grid">
      {teams.filter(row => teamFilter === "all" || row.Constructor.constructorId === teamFilter).map(row => {
        const brand = f1TeamBrand(year, row.Constructor.constructorId);
        const roster = drivers.filter(driver => driver.Constructors.some(team => team.constructorId === row.Constructor.constructorId));
        return <article key={row.Constructor.constructorId} style={{ borderTopColor: teamColor(row.Constructor.constructorId) }}>
          <div className="f1-team-card-heading">
            <div><div className="f1-team-nationality"><F1CountryFlag nationality={row.Constructor.nationality}/><span>P{row.position}</span></div><h3><F1TeamName year={year} team={row.Constructor}/></h3></div>
            <strong className="f1-team-card-points">{row.points}<small>PTS</small></strong>
          </div>
          {brand && <img className="f1-team-car" src={`/f1/brands/2026/${brand.slug}-car.webp`} alt={`${year} ${brand.name} 赛车`} loading="lazy" width={700} height={224}/>}
          <div className="f1-team-roster">{roster.length ? roster.map(driver => <F1DriverName key={driver.Driver.driverId} year={year} driver={driver.Driver} compact/>) : <span>车手资料待更新</span>}</div>
          <External href={row.Constructor.url}>车队资料</External>
        </article>;
      })}
    </div>
    <p className="f1-footnote">名单依据本赛季截至第 {standingsRound || "—"} 站的积分记录，可能包括替补车手与转队记录。姓名字形、车号与车队素材参考 <External href="https://www.formula1.com/en/drivers">F1 官方车手页面</External>及 <External href="https://www.formula1.com/en/teams">车队页面</External>。</p>
  </>;
}
