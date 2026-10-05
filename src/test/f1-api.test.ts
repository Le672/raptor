import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../../functions/api/f1";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const call = (query: string) => onRequestGet({ request: new Request(`https://f1.yukino.bond/api/f1?${query}`) });
describe("F1 public API", () => {
  it("rejects hostile or unbounded queries before making any upstream request", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    for (const query of ["action=proxy&url=http://localhost", "year=../2026", "year=1949", "action=laps&session=1&drivers=1,2,3", "action=live&session=https://localhost", "action=results&round=9999", "action=laps&session=latest&drivers=1"]) expect((await call(query)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("retains the race schedule when one standings feed is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async (address: string) => {
      if (address.includes("constructorStandings")) return new Response("{}", { status: 503 });
      if (address.includes("driverStandings")) return Response.json({ MRData: { StandingsTable: { StandingsLists: [{ round: "1", DriverStandings: [{ points: "25", position: "1" }] }] } } });
      return Response.json({ MRData: { RaceTable: { Races: [{ round: "1", raceName: "Australian Grand Prix" }] } } });
    }));
    const response = await call("action=season&year=2024"), value = await response.json();
    expect(response.status).toBe(200); expect(value.races).toHaveLength(1); expect(value.drivers).toHaveLength(1); expect(value.teams).toEqual([]); expect(value.errors[0]).toContain("Jolpica");
  });
  it("does not treat an unpublished future calendar as a source failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ MRData: { RaceTable: { Races: [] }, StandingsTable: { StandingsLists: [] } } })));
    const response = await call(`action=season&year=${new Date().getUTCFullYear() + 1}`); expect(response.status).toBe(200); expect((await response.json()).errors).toEqual([]);
  });
  it("does not query or fabricate restricted live timing without a subscription", async () => {
    const now = Date.now(), session = { session_key: 9876501, year: new Date().getUTCFullYear(), date_start: new Date(now - 60000).toISOString(), date_end: new Date(now + 60000).toISOString(), session_name: "Race", session_type: "Race", location: "Test circuit" };
    const fetcher = vi.fn(async () => Response.json([session])); vi.stubGlobal("fetch", fetcher);
    const response = await call("action=live&session=9876501"), value = await response.json();
    expect(value.restricted).toBe(true); expect(value.liveAccess).toBe(false); expect(value.rows).toEqual([]); expect(value.errors.join("")).toContain("订阅"); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(value)).not.toContain("Bearer");
  });
  it("keeps malformed upstream JSON out of successful responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ unexpected: true })));
    const response = await call("action=results&year=2023&round=1"); expect(response.status).toBe(503); expect((await response.json()).error).toContain("格式异常");
  });
});
