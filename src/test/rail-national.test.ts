import { describe, expect, it } from "vitest";
import { nationalTrainsAt } from "../lib/rail-national";
import type { NationalTimetable } from "../lib/rail-national";
import { canonicalPageUrl } from "../../speed/src/site-routing.mjs";
import { railFeatureFromLocation } from "../lib/rail-navigation";

const data: NationalTimetable = {
  schema: 1, feedDate: "2026-11-26",
  feedUrl: "https://github.com/wensimehrp/chinese-railway-gtfs/releases/tag/gtfs-20261126-120000",
  days: [["2026-11-26", 1, 1], ["2026-11-27", 1, null]],
  stations: [["AAA", "始发", 110, 30], ["BBB", "中间", 112, 30], ["CCC", "终到", 113, 30]],
  trains: [
    ["K123", 1, [[0, 23 * 3600, 23 * 3600], [1, 25 * 3600, 25 * 3600 + 600], [2, 26 * 3600, 26 * 3600]], [0, -1]],
    ["G101", 2, [[1, 3600, 3600], [2, 7200, 7200]], []],
  ],
  paths: [[[1100000, 300000], [1110000, 310000], [1120000, 300000]]],
};

const at = (clock: string) => Date.parse("2026-11-27T" + clock + "+08:00");

describe("nationwide timetable positions", () => {
  it("keeps the map on its direct railway subdomain route", () => {
    expect(canonicalPageUrl("https://www.yukino.bond/national")).toBe("https://cr.yukino.bond/national");
    expect(railFeatureFromLocation({ pathname: "/national", search: "" })).toBe("national");
  });

  it("keeps the actual origin date across midnight and follows the path when present", () => {
    const [train] = nationalTrainsAt(data, at("00:00:00"));
    expect(train).toMatchObject({ code: "K123", date: "2026-11-26", previous: "始发", next: "中间", nextAt: at("01:00:00") });
    expect(train.point?.[1]).toBeCloseTo(31, 1);
  });

  it("distinguishes intermediate dwell, departure and finished services", () => {
    const [overnight, morning] = nationalTrainsAt(data, at("01:05:00"));
    expect(overnight).toMatchObject({ stopped: true, point: [112, 30], previous: "中间", next: "终到" });
    expect(morning).toMatchObject({ code: "G101", stopped: false, path: null });
    expect(nationalTrainsAt(data, at("01:10:00"))[0]).toMatchObject({ stopped: false, previous: "中间", path: null });
    expect(nationalTrainsAt(data, at("02:00:00"))).toEqual([]);
  });

  it("does not reuse an expired calendar on a later date", () => {
    expect(nationalTrainsAt(data, Date.parse("2026-11-28T00:00:00+08:00"))).toEqual([]);
  });
});
