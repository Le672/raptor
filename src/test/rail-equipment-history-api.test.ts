import { afterEach, describe, expect, it, vi } from "vitest";
import { createPortalDb } from "./fixtures/portal-db";
import type { PortalDatabase } from "../../functions/_utils/db";
import { historicalEquipment, recordOfficialEquipment } from "../../functions/_utils/rail-equipment-history";

const at = Date.parse("2026-10-18T10:00:00+08:00");
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("persistent official model history", () => {
  it("persists dated official records only and matches full route identity before avoiding a third-party request", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(at);
    const fixture = createPortalDb(), db = fixture as unknown as PortalDatabase;
    const route = { from: "广州南", to: "深圳北", trainNo: "6i0000G12300" };
    const dated = { model: "CR400AF-A", date: "2026-10-16", checkedAt: at, source: "12306" as const, scope: "dated" as const, owner: null, operator: null, number: "2194" };
    const fetchMock = vi.fn().mockResolvedValue(Response.json([])); vi.stubGlobal("fetch", fetchMock);
    try {
      await recordOfficialEquipment(db, "G123", route, { ...dated, scope: "reference" });
      await recordOfficialEquipment(db, "G123", route, { ...dated, scope: "inferred" });
      expect(fixture.sqlite.prepare("SELECT name FROM sqlite_master WHERE name='rail_equipment_observations'").get()).toBeUndefined();
      await recordOfficialEquipment(db, "G123", route, dated);
      await recordOfficialEquipment(db, "G123", route, { ...dated, date: "2026-10-20", model: "CRH380A" });
      expect(await historicalEquipment(db, "G123", "2026-10-18", route)).toMatchObject({ model: "CR400AF-A", history: { source: "12306", lastSeen: "2026-10-16" } });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(await historicalEquipment(db, "G123", "2026-10-18", { ...route, to: "香港西九龙" })).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally { fixture.sqlite.close(); }
  });
  it("returns inferred equipment only when the date-scoped official model is missing, with coalesced history fetches", async () => {
    vi.resetModules(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(at);
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("train/search")) return Response.json({ status: true, data: [{ station_train_code: "G3762(广州南-成都东)", train_no: "6i000G376200" }] });
      if (url.pathname.endsWith("getCarDetail") || url.pathname.endsWith("getDeptByTrainCode")) return Response.json({ status: -1 });
      if (url.hostname === "api.rail.re") return Response.json([
        { train_no: "G3762", date: "2026-10-16 20:54", emu_no: "CRH380A2810" },
        { train_no: "G3762", date: "2026-10-08 20:54", emu_no: "CR400AFS1103" },
      ]);
      throw new Error(`Unexpected request ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { onRequestGet } = await import("../../functions/api/rail");
    const request = () => onRequestGet({ request: new Request("https://cr.yukino.bond/api/rail?mode=equipment&date=2026-10-18&train=G3762") });
    const replies = await Promise.all([request(), request()]);
    const first = await replies[0].json();
    expect(first).toMatchObject({ model: "CRH380A", train: "G3762", date: "2026-10-18", source: "rail.re", scope: "inferred", number: null,
      history: { lastSeen: "2026-10-16", samples: 1, changed: true } });
    expect(await replies[1].json()).toEqual(first);
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("api.rail.re"))).toHaveLength(1);
  });
});
