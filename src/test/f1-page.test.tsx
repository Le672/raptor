import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import F1 from "../pages/F1";
import { StreamPlayer } from "../components/f1/F1Live";

const driver = { driverId: "antonelli", givenName: "Andrea Kimi", familyName: "Antonelli", code: "ANT", permanentNumber: "12", nationality: "Italian", dateOfBirth: "2006-08-25" };
const team = { constructorId: "mercedes", name: "Mercedes", nationality: "German" };
const race = { season: "2026", round: "18", raceName: "Singapore Grand Prix", date: "2026-10-11", time: "12:00:00Z", Circuit: { circuitId: "marina_bay", circuitName: "Marina Bay Street Circuit", Location: { locality: "Singapore", country: "Singapore", lat: "1.29", long: "103.86" } }, Qualifying: { date: "2026-10-10", time: "13:00:00Z" } };
const meta = { fetchedAt: "2026-10-05T01:00:00Z", errors: [], source: "Jolpica F1" };
beforeEach(() => {
  localStorage.clear(); vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal("fetch", vi.fn(async (address: string) => {
    const action = new URL(address, "https://f1.yukino.bond").searchParams.get("action");
    if (action === "season") return Response.json({ ...meta, year: 2026, races: [race], drivers: [{ position: "1", points: "320", wins: "8", Driver: driver, Constructors: [team] }], teams: [{ position: "1", points: "556", wins: "11", Constructor: team }], standingsRound: "16", teamStandingsRound: "16" });
    if (action === "weekend") return Response.json({ ...meta, meetings: [], sessions: [] });
    if (action === "news") return Response.json({ ...meta, items: [] });
    if (action === "live") return Response.json({ ...meta, session: { session_name: "Race", location: "Singapore", circuit_short_name: "Marina Bay", date_start: "2026-10-11T12:00:00Z" }, state: "upcoming", restricted: false, liveAccess: false, rows: [], control: [] });
    return Response.json({ ...meta, kind: "results", race, results: [] });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function open(query = "") { return render(<MemoryRouter initialEntries={[`/f1?year=2026${query}`]}><F1/></MemoryRouter>); }
describe("Yukino F1 interactions", () => {
  it("opens the real season data and shares navigable calendar/results state", async () => {
    open(); await screen.findByLabelText("Andrea Kimi Antonelli");
    fireEvent.click(screen.getByRole("button", { name: "赛历与赛道" }));
    expect(await screen.findByRole("heading", { name: "新加坡大奖赛" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "搜索赛历" }), { target: { value: "Monza" } }); expect(screen.getByText("没有符合筛选的赛事。")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "搜索赛历" }), { target: { value: "" } });
    fireEvent.click(within(screen.getByRole("heading", { name: "新加坡大奖赛" }).closest("article")!).getByRole("button", { name: "比赛成绩" }));
    expect(await screen.findByText("该场次尚无已公布成绩，或这一站没有冲刺赛。")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "大奖赛" })).toHaveValue("18");
  });
  it("saves and filters followed drivers in the current browser", async () => {
    open("&tab=paddock"); const button = await screen.findByRole("button", { name: "关注Andrea Kimi Antonelli" }); fireEvent.click(button);
    await waitFor(() => expect(JSON.parse(localStorage.getItem("yukino-f1-favorites")!)).toEqual(["antonelli"]));
    fireEvent.click(screen.getByRole("button", { name: "只看关注" })); expect(screen.getByRole("heading", { name: "Andrea Kimi Antonelli" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "取消关注Andrea Kimi Antonelli" })); expect(screen.getByText(/没有符合筛选的车手/)).toBeInTheDocument();
  });
  it("shows an upcoming event without labeling it as streaming and rejects unsafe playback URLs", async () => {
    open("&tab=live"); expect(await screen.findByText("尚未开始")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /官方实时计时/ })).toHaveAttribute("href", "https://www.formula1.com/en/timing/f1-live");
    expect(screen.getByRole("link", { name: /F1 TV/ })).toHaveAttribute("href", "https://f1tv.formula1.com/");
    fireEvent.change(screen.getByRole("textbox", { name: "直播源地址" }), { target: { value: "http://example.com/stream.m3u8" } });
    fireEvent.submit(screen.getByRole("textbox", { name: "直播源地址" }).closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("请输入有效的 HTTPS 播放地址");
    expect(document.querySelector("video")).toBeNull();
  });
  it("labels 2026 rule changes and lets readers find the fastest-lap scoring change", async () => {
    await act(async () => { open("&tab=guide"); }); fireEvent.change(screen.getByRole("textbox", { name: "搜索 F1 术语" }), { target: { value: "最快圈" } });
    expect(screen.getByRole("heading", { name: "最快圈不再加分" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "排位赛" })).not.toBeInTheDocument();
  });
  it("does not show a connected live indicator when the timing subscription is missing", async () => {
    const otherRequests = fetch;
    vi.stubGlobal("fetch", vi.fn(async (address: string, options?: RequestInit) => {
      if (new URL(address, "https://f1.yukino.bond").searchParams.get("action") === "live") return Response.json({ ...meta, state: "live", restricted: true, liveAccess: false, rows: [], control: [], errors: ["需要订阅凭据"] });
      return otherRequests(address, options);
    }));
    open("&tab=live"); expect(await screen.findByText("计时暂不可用")).toBeInTheDocument();
    expect(screen.queryByText("计时更新中")).not.toBeInTheDocument(); expect(document.querySelector(".f1-live-label.is-live")).toBeNull();
  });
  it("uses the HLS engine when native capability claims support and releases it on exit", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("maybe");
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    const loadSource = vi.fn(), attachMedia = vi.fn(), destroy = vi.fn();
    const FakeHls = vi.fn(function () { return { loadSource, attachMedia, destroy, on: vi.fn() }; });
    Object.assign(FakeHls, { isSupported: () => true, Events: { ERROR: "hlsError" } });
    vi.stubGlobal("Hls", FakeHls);
    const page = render(<StreamPlayer/>);
    fireEvent.change(screen.getByRole("textbox", { name: "直播源地址" }), { target: { value: "https://example.com/stream.m3u8" } });
    fireEvent.submit(screen.getByRole("textbox", { name: "直播源地址" }).closest("form")!);
    await waitFor(() => expect(loadSource).toHaveBeenCalledWith("https://example.com/stream.m3u8"));
    expect(attachMedia).toHaveBeenCalledWith(document.querySelector("video"));
    expect(document.querySelector("video")).not.toHaveAttribute("src");
    page.unmount(); expect(destroy).toHaveBeenCalledOnce();
  });
});
