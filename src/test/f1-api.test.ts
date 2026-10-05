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
  it("enforces the subscription boundary on dashboard details even when called directly", async () => {
    const now = Date.now(), session = { session_key: 9876502, date_start: new Date(now - 60000).toISOString(), date_end: new Date(now + 60000).toISOString() };
    const fetcher = vi.fn(async () => Response.json([session])); vi.stubGlobal("fetch", fetcher);
    const value = await (await call("action=dashboard&year=2026&session=9876502")).json();
    expect(value.restricted).toBe(true); expect(value.laps).toEqual([]); expect(value.available.pits).toBe(false); expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await call("action=dashboard&session=latest")).status).toBe(400);
  });
  it("retains lap and radio records when the pit feed fails and marks the failed panel unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async (address: string) => {
      if (address.includes("/sessions?")) return Response.json([{ session_key: 9876503, date_start: "2025-01-01T10:00:00Z", date_end: "2025-01-01T12:00:00Z" }]);
      if (address.includes("/pit?")) return new Response("{}", { status: 429 });
      if (address.includes("/laps?")) return Response.json([{ driver_number: 1, lap_number: 2, lap_duration: 90 }]);
      return Response.json([{ driver_number: 1, date: "2025-01-01T11:00:00Z", recording_url: "https://livetiming.formula1.com/radio.mp3" }]);
    }));
    const response = await call("action=dashboard&year=2025&session=9876503"), value = await response.json();
    expect(response.status).toBe(200); expect(value.laps).toHaveLength(1); expect(value.radio).toHaveLength(1); expect(value.pits).toEqual([]);
    expect(value.available).toEqual({ laps: true, pits: false, radio: true }); expect(value.errors.join("")).toContain("频率受限");
  });
  it("uses recorded weather after an early race finish instead of the scheduled end time window", async () => {
    const fetcher = vi.fn(async (address: string) => {
      const url = new URL(address);
      if (url.pathname.endsWith("/sessions")) return Response.json([{ session_key: 9876504, date_start: "2025-01-01T10:00:00Z", date_end: "2025-01-01T12:00:00Z" }]);
      if (url.pathname.endsWith("/drivers")) return Response.json([{ driver_number: 1, full_name: "Max Verstappen" }]);
      if (url.pathname.endsWith("/session_result")) return Response.json([{ driver_number: 1, position: 1, number_of_laps: 58 }]);
      if (url.pathname.endsWith("/weather")) {
        expect(url.searchParams.has("date>")).toBe(false);
        return Response.json([{ date: "2025-01-01T11:25:00Z", air_temperature: 28 }]);
      }
      return Response.json([]);
    }); vi.stubGlobal("fetch", fetcher);
    const value = await (await call("action=live&year=2025&session=9876504")).json();
    expect(value.weather.air_temperature).toBe(28); expect(value.rows[0].laps).toBe(58);
    expect(fetcher.mock.calls.some(([url]) => url.includes("/intervals?"))).toBe(false);
  });
});
