// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://cr.yukino.bond/"}
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
describe("rail subdomain routes", () => {
  it("keeps the homepage clean and uses stable feature paths without restarting the monitor", async () => {
    vi.stubGlobal("scrollTo", vi.fn()); vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
    window.history.replaceState({}, "", "/"); render(<App />);
    await screen.findByRole("heading", { name: /余票提醒/ }, { timeout: 10000 });
    expect(window.location.hostname).toBe("cr.yukino.bond"); expect(window.location.pathname).toBe("/");
    fireEvent.change(screen.getByLabelText("车次"), { target: { value: "G1039" } });
    const requests = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("mode=stations")).length;
    for (const [name, pathname] of [["余票查询与监控", "/ticket"], ["中转行程", "/transfer"], ["列车位置与下一站", "/live"], ["车站大屏", "/arrivalinfo"]]) {
      fireEvent.click(screen.getByRole("button", { name }));
      await waitFor(() => expect(window.location.pathname).toBe(pathname));
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true"); expect(window.location.search).toBe("");
    }
    act(() => window.history.back());
    await waitFor(() => expect(screen.getByRole("button", { name: "列车位置与下一站" })).toHaveAttribute("aria-pressed", "true"));
    expect(window.location.pathname).toBe("/live");
    fireEvent.click(screen.getByRole("button", { name: "余票查询与监控" })); expect(screen.getByLabelText("车次")).toHaveValue("G1039");
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("mode=stations"))).toHaveLength(requests);
  }, 15000);
  it("migrates a legacy board URL while retaining the selected station", async () => {
    vi.stubGlobal("scrollTo", vi.fn()); vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
    window.history.replaceState({}, "", "/cr?view=board&station=IZQ"); render(<App />);
    await screen.findByRole("button", { name: "车站大屏" }, { timeout: 10000 });
    await waitFor(() => expect(window.location.pathname).toBe("/arrivalinfo"));
    expect(window.location.search).toBe("?station=IZQ"); expect(screen.getByRole("button", { name: "车站大屏" })).toHaveAttribute("aria-pressed", "true");
  }, 15000);
  it("opens a board train at /live and automatically queries its origin day, including refreshable links", async () => {
    const date = "2026-10-05", originDate = "2026-10-04", now = Date.parse(`${date}T09:00:00+08:00`);
    vi.stubGlobal("scrollTo", vi.fn());
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input), "https://cr.yukino.bond"), mode = url.searchParams.get("mode");
      if (mode === "stations") return Response.json({ stations: [{ name: "广州南", code: "IZQ", pinyin: "guangzhounan" }] });
      if (mode === "board") return Response.json({ source: "12306", station: "广州南", stationCode: "IZQ", date, checkedAt: Date.now(), rows: [
        { id: "NO0/2026-10-04/K123", train: "K123", trainNo: "NO0", originDate, from: "上海松江", to: "十堰", fromCode: "IMH", toCode: "SNN",
          arrival: "10:00", departure: "10:04", arrivalAt: now + 3600000, departureAt: now + 3840000, dwellMinutes: 4, model: null },
      ] });
      return Response.json({ error: "Test endpoint unavailable" }, { status: 502 });
    });
    vi.stubGlobal("fetch", fetchMock); window.history.replaceState({}, "", "/arrivalinfo?date=2026-10-05");
    render(<App/>); fireEvent.click(await screen.findByLabelText("近期车次", {}, { timeout: 10000 }));
    fireEvent.click(await screen.findByRole("button", { name: "查看 K123 的实时位置" }));
    await waitFor(() => expect(window.location.pathname).toBe("/live"));
    expect(screen.getByLabelText("定位车次")).toHaveValue("K123"); expect(screen.getByLabelText("始发日期")).toHaveValue(originDate);
    expect(new URLSearchParams(window.location.search).get("date")).toBe(originDate);
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => {
      const url = new URL(String(input), "https://cr.yukino.bond");
      return url.searchParams.get("mode") === "journey" && url.searchParams.get("train") === "K123" && url.searchParams.get("date") === originDate;
    })).toBe(true));
  }, 15000);
});
