import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { F1Leclerc } from "../components/f1/F1Leclerc";
import { F1DriverName } from "../components/f1/F1Identity";
import { driverPortrait } from "../data/f1-portraits";
import type { F1Race, LeclercData } from "../lib/f1";

const driver = { driverId: "leclerc", givenName: "Charles", familyName: "Leclerc", nationality: "Monegasque" };
const race: F1Race = { season: "2026", round: "16", raceName: "British Grand Prix", date: "2026-07-05", time: "14:00:00Z", Circuit: { circuitId: "silverstone", circuitName: "Silverstone", Location: { locality: "Silverstone", country: "UK", lat: "52", long: "-1" } } };
const result = { position: "4", Driver: driver, Constructor: { constructorId: "ferrari", name: "Ferrari", nationality: "Italian" }, points: "12", status: "Finished" };
const data: LeclercData = { fetchedAt: "2026-10-05T12:00:00Z", source: "Jolpica F1", errors: [], year: 2026, current: {race, result}, available: { current: true, results: true, sprint: true }, starts: { results: 189, sprint: 29 }, fourths: [
  { race: {...race,season:"2025"}, result, kind: "results" },
  { race: {...race,season:"2025"}, result, kind: "sprint" },
  { race: {...race,season:"2024",round:"8",raceName:"Monaco Grand Prix"}, result, kind: "results" },
] };
beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => Response.json(data))));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const open = (onResult = vi.fn()) => render(<F1Leclerc year={2026} timezone="UTC" onResult={onResult}/>);

describe("Leclerc P4 club", () => {
  it("shows YES from the latest final result and filters the full career by session and season", async () => {
    const navigate = vi.fn(); open(navigate);
    expect(await screen.findByText("YES", {exact:true})).toBeInTheDocument();
    const table = screen.getByRole("table"); expect(within(table).getAllByRole("row")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", {name:"冲刺赛 P4",exact:true})); expect(within(table).getAllByRole("row")).toHaveLength(2);
    fireEvent.click(within(table).getByRole("button", {name:"成绩",exact:true})); expect(navigate).toHaveBeenCalledWith({tab:"results",year:"2025",round:"16",kind:"sprint"});
    fireEvent.change(screen.getByRole("combobox", {name:"历史赛季"}), {target:{value:"2024"}});
    expect(screen.getByText("这个筛选下，Charles 没有拿过第四。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name:"正赛 P4",exact:true})); expect(screen.getByRole("cell", {name:/摩纳哥大奖赛/})).toBeInTheDocument();
  });
  it("shows NO for another known final placing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({...data,current:{race,result:{...result,position:"3"}}})));
    open(); expect(await screen.findByText("NO", {exact:true})).toBeInTheDocument(); expect(screen.getByText(/这次是 P3/)).toBeInTheDocument();
  });
  it("does not turn missing results into NO or claim an incomplete career is complete", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({...data,current:undefined,available:{...data.available,current:false,sprint:false},errors:["Jolpica 请求频率受限"]})));
    open(); await screen.findByText(/部分记录暂不可用/);
    expect(screen.getByText("WAIT", {exact:true})).toBeInTheDocument(); expect(screen.queryByText("NO", {exact:true})).not.toBeInTheDocument(); expect(screen.queryByText(/已完整读取职业生涯/)).not.toBeInTheDocument();
  });
});

describe("driver portraits", () => {
  it("matches exact identities and does not put a 2026 uniform on a historical entry", () => {
    expect(driverPortrait(2026, driver)).toBe("/f1/portraits/2026/charles-leclerc.webp");
    expect(driverPortrait(2026, undefined, "Andrea Kimi Antonelli")).toContain("kimi-antonelli");
    expect(driverPortrait(2026, undefined, "Jos Verstappen")).toBeUndefined(); expect(driverPortrait(2019, driver)).toBeUndefined();
  });
  it("keeps the driver's accessible name and layout when a photograph fails to load", () => {
    const view = render(<F1DriverName driver={driver} year={2026} compact/>);
    const photo = view.container.querySelector("img")!; expect(photo).toHaveAttribute("src", "/f1/portraits/2026/charles-leclerc.webp");
    fireEvent.error(photo); expect(view.container.querySelector("img")).toBeNull(); expect(screen.getByLabelText("Charles Leclerc")).toBeInTheDocument();
  });
});
