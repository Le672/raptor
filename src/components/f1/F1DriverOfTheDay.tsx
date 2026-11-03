import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import { useF1Data } from "@/hooks/useF1Data";
import { raceName, type F1Race } from "@/lib/f1";
import { awardRaceName, driverOfTheDaySource, type DriverOfTheDayData } from "@/lib/f1-awards";
import { DataStatus, Empty, External } from "./F1Common";

export function F1DriverOfTheDay({ year, races, timezone }: { year: number; races: F1Race[]; timezone: string }) {
  const awards = useF1Data<DriverOfTheDayData>(year >= 2016 ? `action=dotd&year=${year}` : null, 600);
  const rows = awards.data?.year === year ? awards.data.rows : [];
  const totals = new Map<string, number>();
  for (const { driver } of rows) totals.set(driver, (totals.get(driver) ?? 0) + 1);
  const ranking = [...totals].sort(([nameA, countA], [nameB, countB]) => countB - countA || nameA.localeCompare(nameB));
  const latest = rows.at(-1);

  return <section className="f1-section">
    <div className="f1-section-heading">
      <div><p className="f1-eyebrow">DRIVER OF THE DAY · {year}</p><h1 className="f1-section-title">今日最佳车手</h1></div>
      <External href={driverOfTheDaySource(year)}>F1 官方榜单</External>
    </div>
    <p className="f1-footnote">由观众在大奖赛正赛期间投票选出，赛后公布。获奖不计入锦标赛积分。</p>
    {year < 2016 ? <Empty>这项奖项自 2016 赛季开始，请切换至 2016 年或之后的赛季。</Empty> : <>
      <DataStatus {...awards} timezone={timezone}/>
      {latest && <div className="f1-result-heading">
        <div><p className="f1-eyebrow"><Trophy size={14}/> 最新公布 · {raceName(awardRaceName(latest, races))}</p><h3>{latest.driver}</h3></div>
        <span className="f1-footnote">{rows.length} 站已公布 · {ranking.length} 位获奖车手</span>
      </div>}
      {rows.length ? <div className="f1-overview-grid">
        <section>
          <h2>每站获奖者</h2>
          <div className="f1-table-wrap"><table className="f1-table">
            <thead><tr><th scope="col">大奖赛</th><th scope="col">获奖车手</th></tr></thead>
            <tbody>{[...rows].reverse().map(award => {
              const name = awardRaceName(award, races);
              const race = races.find(race => race.raceName === name);
              return <tr key={award.raceUrl ?? award.race}>
                <td>{race ? <Link className="f1-text-button" to={`?tab=results&year=${year}&round=${race.round}&kind=results`}>{raceName(name)}</Link>
                  : award.raceUrl ? <External href={award.raceUrl}>{raceName(name)}</External> : raceName(name)}</td>
                <td>{award.driver}</td>
              </tr>;
            })}</tbody>
          </table></div>
        </section>
        <section>
          <h2>赛季获奖次数</h2>
          <div className="f1-table-wrap"><table className="f1-table">
            <thead><tr><th scope="col">车手</th><th scope="col">获奖次数</th></tr></thead>
            <tbody>{ranking.map(([driver, count]) => <tr key={driver}><td>{driver}</td><td className="f1-points">{count}</td></tr>)}</tbody>
          </table></div>
        </section>
      </div> : !awards.loading && !awards.error && awards.data && <Empty>该赛季暂无已公布的获奖记录。</Empty>}
    </>}
  </section>;
}
