import { describe, expect, it } from "vitest";
import { calendarIcs, gapTime, latestByDriver, lapTime, formatRaceDate, sessionState, safeF1Url } from "../lib/f1";
import type { F1Race, F1Session } from "../lib/f1";

const race: F1Race = { season: "2026", round: "2", raceName: "Chinese Grand Prix", date: "2026-03-15", time: "07:00:00Z", Circuit: { circuitId: "shanghai", circuitName: "Shanghai International Circuit", Location: { locality: "Shanghai", country: "China", lat: "31.3389", long: "121.22" } }, FirstPractice: { date: "2026-03-13", time: "03:30:00Z" }, Sprint: { date: "2026-03-14", time: "03:00:00Z" } };
const session = { session_key: 100, meeting_key: 10, session_name: "Race", session_type: "Race", date_start: "2026-03-15T07:00:00Z", date_end: "2026-03-15T09:00:00Z", year: 2026, location: "Shanghai", country_name: "China", circuit_short_name: "Shanghai" } satisfies F1Session;
describe("F1 data presentation", () => {
  it("separates scheduled, running, finished, cancelled and unknown session times", () => {
    expect(sessionState(session, Date.parse("2026-03-15T06:00:00Z"))).toBe("upcoming");
    expect(sessionState(session, Date.parse("2026-03-15T08:00:00Z"))).toBe("live");
    expect(sessionState(session, Date.parse("2026-03-15T10:00:00Z"))).toBe("finished");
    expect(sessionState({ ...session, is_cancelled: true })).toBe("cancelled");
    expect(sessionState({ ...session, date_end: "" })).toBe("unavailable");
  });
  it("preserves unknown timing and qualifying arrays instead of reporting zero seconds", () => {
    expect(lapTime(null)).toBe("—"); expect(lapTime(0)).toBe("—"); expect(lapTime(NaN)).toBe("—");
    expect(lapTime([79.25, 78.9, 78.456])).toBe("1:18.456");
    expect(gapTime([0.23, null])).toBe("+0.230"); expect(gapTime("+1 LAP")).toBe("+1 LAP"); expect(gapTime(undefined)).toBe("—");
    expect(formatRaceDate({ date: "2026-03-15" }, "UTC")).toContain("时间待公布");
  });
  it("keeps the newest record even when upstream rows arrive out of order", () => {
    const rows = [{ driver_number: 44, position: 2, date: "2026-03-15T08:03:00Z" }, { driver_number: 44, position: 1, date: "2026-03-15T08:02:00Z" }];
    expect(latestByDriver(rows).get(44)?.position).toBe(2);
  });
  it("exports UTC sessions and unknown start times as RFC 5545 all-day events", () => {
    const ics = calendarIcs([race, { ...race, round: "3", raceName: "测试,分号;换行\n".repeat(15), time: undefined }], new Date("2026-10-05T00:00:00Z"));
    expect(ics).toContain("DTSTART:20260315T070000Z\r\n"); expect(ics).toContain("DTSTART;VALUE=DATE:20260315");
    expect(ics).toContain("DTEND;VALUE=DATE:20260316"); expect(ics).toContain("DTSTAMP:20261005T000000Z");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(6);
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
  it("rejects executable or credential-bearing external links", () => {
    expect(safeF1Url("javascript:alert(1)")).toBeUndefined(); expect(safeF1Url("https://user:password@example.com/")).toBeUndefined();
    expect(safeF1Url("http://example.com/race")).toBe("https://example.com/race");
  });
});
