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
});
