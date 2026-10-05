import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const driver = { driverId: "leclerc", givenName: "Charles", familyName: "Leclerc", nationality: "Monegasque" };
const race = (round = 1, position = "4") => ({ season: "2025", round: String(round), raceName: "British Grand Prix", date: "2025-07-06", Circuit: { circuitId: "silverstone", circuitName: "Silverstone", Location: { locality: "Silverstone", country: "UK" } }, Results: [{ position, Driver: driver, Constructor: { constructorId: "ferrari", name: "Ferrari" } }] });
const response = (races: unknown[], total: number, offset = 0) => Response.json({ MRData: { total: String(total), offset: String(offset), limit: "100", RaceTable: { Races: races } } });
beforeEach(() => vi.resetModules());
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function call() { const { onRequestGet } = await import("../../functions/api/f1"); return onRequestGet({ request: new Request("https://f1.yukino.bond/api/f1?action=leclerc&year=2025") }); }

describe("Leclerc career results API", () => {
  it("reads every page and keeps race and sprint fourth places as separate records", async () => {
    const fetcher = vi.fn(async (address: string) => {
      const url = new URL(address);
      if (url.pathname.includes("/last/")) return response([race(12)], 1);
      if (url.pathname.endsWith("/sprint.json")) return response([{ ...race(12), Results: undefined, SprintResults: race(12).Results }], 1);
      const offset = Number(url.searchParams.get("offset"));
      return offset === 0 ? response(Array.from({ length: 100 }, (_, i) => ({ ...race(i % 24 + 1, "5"), season: String(2018 + Math.floor(i / 24)) })), 101) : response([race(12)], 101, 100);
    }); vi.stubGlobal("fetch", fetcher);
    const result = await call(), data = await result.json();
    expect(result.status).toBe(200); expect(data.available).toEqual({ current: true, results: true, sprint: true });
    expect(data.current.result.position).toBe("4"); expect(data.starts).toEqual({ results: 101, sprint: 1 });
    expect(data.fourths.map((entry: {kind: string}) => entry.kind)).toEqual(["results", "sprint"]);
    expect(data.fourths[0].race.Results).toBeUndefined();
    expect(fetcher.mock.calls.some(([address]) => new URL(address).searchParams.get("offset") === "100")).toBe(true);
  });
  it("retains valid race records but does not call a failed sprint feed complete", async () => {
    vi.stubGlobal("fetch", vi.fn(async (address: string) => address.includes("/sprint.json") ? new Response("{}", { status: 429 }) : response([race()], 1)));
    const result = await call(), data = await result.json();
    expect(result.status).toBe(200); expect(data.fourths).toHaveLength(1); expect(data.available.sprint).toBe(false); expect(data.errors.join(" ")).toContain("频率受限");
  });
  it("rejects an empty continuation instead of silently truncating a driver's career", async () => {
    vi.stubGlobal("fetch", vi.fn(async (address: string) => {
      const url = new URL(address);
      if (url.pathname.includes("/last/")) return response([], 0);
      if (url.pathname.endsWith("/sprint.json")) return response([], 0);
      return url.searchParams.get("offset") === "0" ? response([race()], 2) : response([], 2, 1);
    }));
    const data = await (await call()).json();
    expect(data.available.results).toBe(false); expect(data.current).toBeUndefined(); expect(data.fourths).toEqual([]); expect(data.errors.join(" ")).toContain("不完整");
  });
});
