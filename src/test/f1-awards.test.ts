import { describe, expect, it } from "vitest";
import { loadDriverOfTheDay, parseDriverOfTheDay } from "../../functions/_utils/f1-driver-of-the-day";
import { awardRaceKey } from "@/lib/f1-awards";

describe("F1 official Driver of the Day", () => {
  it("extracts winner names and skips flags, responsive codes and expandable vote rows", () => {
    const html = `<h1>2026 Salesforce Driver of the Day AWARD</h1>
      <table><thead><tr><th>Grand Prix</th><th>Winner</th></tr></thead><tbody>
      <tr><td><a href="/en/results/2026/races/1279/australia/race-result"><svg><title>Flag of Australia</title></svg>Australia</a></td>
      <td><span>Max</span>&nbsp;<span>Verstappen</span><span class="md:hidden">VER</span></td><td></td></tr>
      <tr><td colspan="3">30%</td></tr></tbody></table>`;
    expect(parseDriverOfTheDay(html, 2026)).toEqual([{
      race: "Australia", driver: "Max Verstappen",
      raceUrl: "https://www.formula1.com/en/results/2026/races/1279/australia/race-result",
    }]);
    expect(() => parseDriverOfTheDay(html, 2025)).toThrow();
  });

  it("includes the first award season and a complete 2025 season", async () => {
    expect((await loadDriverOfTheDay(2016)).rows).toHaveLength(21);
    expect((await loadDriverOfTheDay(2025)).rows).toHaveLength(24);
  });

  it("distinguishes Barcelona and Spain while matching alternate Grand Prix names", () => {
    expect(awardRaceKey("Barcelona-Catalunya")).toBe(awardRaceKey("Barcelona Grand Prix"));
    expect(awardRaceKey("Barcelona-Catalunya")).not.toBe(awardRaceKey("Spanish Grand Prix"));
    expect(awardRaceKey("Brazil")).toBe(awardRaceKey("São Paulo Grand Prix"));
  });
});
