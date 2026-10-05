import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { F1RaceDashboard } from "../components/f1/F1RaceDashboard";
import { average, lapSummary, pitLaneTime, stintRange, trackStatus } from "../lib/f1-dashboard";
import type { F1Lap, F1Session, LiveData, RaceDashboardData } from "../lib/f1";

const session: F1Session = { session_key: 9839, meeting_key: 1276, session_name: "Race", session_type: "Race", date_start: "2025-12-07T13:00:00Z", date_end: "2025-12-07T15:00:00Z", year: 2025, location: "Abu Dhabi", country_name: "UAE", circuit_short_name: "Yas Marina" };
const meta = { fetchedAt: "2026-10-05T01:00:00Z", source: "OpenF1", errors: [] };
const live: LiveData = { ...meta, session, state: "finished", liveAccess: false, restricted: false, partial: false, rows: [
  { driver_number: 1, full_name: "Max Verstappen", name_acronym: "VER", team_name: "Red Bull Racing", position: 1, laps: 5, compound: "HARD", duration: 500 },
  { driver_number: 4, full_name: "Lando Norris", name_acronym: "NOR", team_name: "McLaren", position: 2, laps: 5, compound: "MEDIUM" },
], stints: [{ driver_number: 1, stint_number: 1, compound: "SOFT", lap_start: 1, lap_end: 2, tyre_age_at_start: 0 }, { driver_number: 1, stint_number: 2, compound: "HARD", lap_start: 3, lap_end: 5, tyre_age_at_start: 2 }, { driver_number: 4, stint_number: 1, compound: "INTERMEDIATE", lap_start: 2, lap_end: 1 }], control: [
  { date: "2025-12-07T14:00:00Z", flag: "BLUE", scope: "Driver", driver_number: 4, message: "BLUE FLAG FOR CAR 4" },
  { date: "2025-12-07T14:01:00Z", message: "CAR 1 INCIDENT UNDER INVESTIGATION" },
] };
const detail: RaceDashboardData = { ...meta, session: 9839, restricted: false, available: { laps: true, pits: true, radio: true }, laps: [
  { driver_number: 1, lap_number: 1, lap_duration: 91, duration_sector_1: 29, duration_sector_2: 31, duration_sector_3: 31 },
  { driver_number: 1, lap_number: 5, lap_duration: 90, duration_sector_1: 28, duration_sector_2: 30, duration_sector_3: 32, st_speed: 310 },
  { driver_number: 4, lap_number: 5, lap_duration: 91, duration_sector_1: 29, duration_sector_2: 31, duration_sector_3: 31 },
], pits: [{ driver_number: 1, date: "2025-12-07T14:00:00Z", lap_number: 2, lane_duration: 22.215, stop_duration: null }], radio: [{ driver_number: 1, date: "2025-12-07T14:01:00Z", recording_url: "https://livetiming.formula1.com/recording.mp3" }] };
beforeEach(() => { localStorage.clear(); vi.stubGlobal("fetch", vi.fn(async () => Response.json(detail))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("F1 race dashboard data semantics", () => {
  it("keeps a partial current lap separate from the last complete lap and ignores out laps for best time", () => {
    const laps: F1Lap[] = [
      { driver_number: 1, lap_number: 3, lap_duration: null, duration_sector_1: 28 },
      { driver_number: 1, lap_number: 1, lap_duration: 80, is_pit_out_lap: true },
      { driver_number: 1, lap_number: 2, lap_duration: 91, date_start: "2025-01-01T10:01:00Z" },
      { driver_number: 1, lap_number: 2, lap_duration: 90, date_start: "2025-01-01T10:02:00Z" },
      { driver_number: 4, lap_number: 5, lap_duration: 70 },
      { driver_number: 1, lap_number: 0, lap_duration: 1 },
    ];
    const summary = lapSummary(laps, 1);
    expect(summary.latest?.lap_number).toBe(3); expect(summary.last?.lap_number).toBe(2);
    expect(summary.best?.lap_duration).toBe(90); expect(summary.completed).toBe(2); expect(summary.ordered).toHaveLength(3);
  });
  it("calculates tyre age from the provider's used tyre age without making missing values zero", () => {
    expect(stintRange({ driver_number: 1, stint_number: 2, lap_start: 21, lap_end: 25, tyre_age_at_start: 3 })).toEqual({ start: 21, end: 25, length: 5, age: 8 });
    expect(stintRange({ driver_number: 1, stint_number: 2, lap_start: 21, tyre_age_at_start: null }, 25).age).toBeUndefined();
    expect(stintRange({ driver_number: 1, stint_number: 2, lap_start: 21, lap_end: 20 }).length).toBeUndefined();
  });
  it("keeps missing stationary service time out of averages and supports the historical pit field", () => {
    expect(pitLaneTime({ driver_number: 1, date: "", pit_duration: 22.3 })).toBe(22.3);
    expect(average([null, undefined, 0, NaN])).toBeUndefined(); expect(average([2.2, null, 2.4])).toBeCloseTo(2.3);
  });
  it("does not treat a driver or sector clearance as the end of a safety car", () => {
    const control = [ { date: "01", message: "SAFETY CAR DEPLOYED" }, { date: "02", flag: "CLEAR", scope: "Sector", sector: 2, message: "CLEAR IN SECTOR 2" }, { date: "03", flag: "YELLOW", scope: "Driver", driver_number: 1, message: "YELLOW" } ];
    expect(trackStatus(control).label).toBe("安全车 · SC");
    expect(trackStatus([...control, { date: "04", message: "SAFETY CAR IN THIS LAP" }]).tone).toBe("yellow");
    expect(trackStatus([...control, { date: "05", flag: "GREEN", scope: "Track", message: "TRACK CLEAR" }]).tone).toBe("green");
  });
});
describe("F1 race dashboard interactions", () => {
  const open = (value = live) => render(<F1RaceDashboard live={value} session={value.session} meetings={[]} year={2025} timezone="UTC" loading={false}/>);
  it("switches between real lap, sector and tyre records, filters race control and saves panel choices", async () => {
    open(); await screen.findByRole("cell", { name: /1:30.000/ });
    expect(screen.getByLabelText("Max Verstappen车队无线电")).toHaveAttribute("preload", "none");
    expect(screen.queryByText("0.00s")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "分段" })); expect(screen.getByRole("cell", { name: "28.000" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "轮胎策略" })); expect(screen.getByRole("cell", { name: /1 PIT.*5 圈胎龄/ })).toBeInTheDocument();
    expect(screen.queryByText("2–1")).not.toBeInTheDocument();
    expect(screen.getByTitle("半雨胎 · — 圈")).toHaveTextContent("—");
    expect(screen.queryByText("BLUE FLAG FOR CAR 4")).not.toBeInTheDocument(); fireEvent.click(screen.getByRole("checkbox", { name: "显示蓝旗" })); expect(screen.getByText("BLUE FLAG FOR CAR 4")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "赛事控制筛选" }), { target: { value: "incidents" } }); expect(screen.queryByText("BLUE FLAG FOR CAR 4")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "赛道布局" })); expect(screen.queryByRole("heading", { name: "赛道布局" })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("yukino-f1-panels")!).track).toBe(false);
  });
  it("shows a failed pit source as unavailable instead of zero stops", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ...detail, pits: [], available: { ...detail.available, pits: false }, errors: ["OpenF1 请求频率受限"] })));
    open(); expect(await screen.findByText("进站数据暂不可用，请刷新详细面板。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "轮胎策略" })); expect(screen.queryByRole("cell", { name: /0 PIT/ })).not.toBeInTheDocument();
  });
  it("does not request restricted details or retain another session's chart when switching", async () => {
    const view = open(); await screen.findByRole("cell", { name: /1:30.000/ });
    const restricted = { ...live, session: { ...session, session_key: 9999 }, state: "unavailable" as const, restricted: true, rows: [], stints: [] };
    view.rerender(<F1RaceDashboard live={restricted} session={restricted.session} meetings={[]} year={2025} timezone="UTC" loading={false}/>);
    await waitFor(() => expect(screen.queryByRole("img", { name: /圈速比较/ })).not.toBeInTheDocument());
    expect(fetch).toHaveBeenCalledTimes(1); expect(within(screen.getByRole("tabpanel")).queryByText("1:30.000")).not.toBeInTheDocument();
  });
});
