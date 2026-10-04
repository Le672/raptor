import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { TopNav } from "../components/TopNav";
import GameMemory from "../components/games/GameMemory";
import Focus from "../pages/Focus";
import { ignoreGameKey } from "../lib/game-keyboard";

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe("flat site navigation", () => {
  it("exposes every route and mail in one navigation, without any disclosure menu", () => {
    render(<MemoryRouter><TopNav /></MemoryRouter>); const navigation = screen.getByRole("navigation", { name: "主导航" });
    expect(within(navigation).getAllByRole("link")).toHaveLength(18);
    for (const label of ["游戏", "新闻", "设备", "实验", "友链", "订阅", "状态", "日志", "专注"]) expect(within(navigation).getByRole("link", { name: label })).toBeVisible();
    expect(screen.queryByText("更多")).not.toBeInTheDocument(); expect(document.querySelector("details")).toBeNull();
  });
  it("does not steal game keys while users type or use a browser shortcut", () => {
    const input = document.createElement("input"); document.body.append(input); const event = new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }); input.dispatchEvent(event); expect(ignoreGameKey(event)).toBe(true); input.remove(); expect(ignoreGameKey(new KeyboardEvent("keydown", { key: "ArrowUp", ctrlKey: true }))).toBe(true);
  });
});
describe("memory game repairs", () => {
  it("uses eight distinct pairs, counts time, and clears pending flips on reset", () => {
    vi.useFakeTimers(); vi.spyOn(Math, "random").mockReturnValue(.999); render(<GameMemory />);
    fireEvent.click(screen.getByRole("button", { name: "卡片 1，未翻开" })); fireEvent.click(screen.getByRole("button", { name: "卡片 2，未翻开" }));
    expect(screen.getByRole("button", { name: "卡片 1，🐱" })).toBeVisible(); expect(screen.getByRole("button", { name: "卡片 2，🐶" })).toBeVisible();
    act(() => { vi.advanceTimersByTime(2000); }); expect(screen.getByText("2s")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "卡片 3，未翻开" })); fireEvent.click(screen.getByRole("button", { name: "卡片 4，未翻开" })); fireEvent.click(screen.getByRole("button", { name: "新游戏" })); act(() => { vi.advanceTimersByTime(1000); }); expect(screen.getAllByRole("button", { name: /未翻开/ })).toHaveLength(16); expect(screen.getByText("0s")).toBeVisible();
  });
  it("records fewer moves as a better result", () => {
    vi.useFakeTimers(); vi.spyOn(Math, "random").mockReturnValue(.999); localStorage.setItem("yukino.game.best.memory", "16"); render(<GameMemory />);
    for (let i = 1; i <= 8; i++) { fireEvent.click(screen.getByRole("button", { name: `卡片 ${i}，未翻开` })); fireEvent.click(screen.getByRole("button", { name: `卡片 ${i + 8}，未翻开` })); act(() => { vi.advanceTimersByTime(450); }); }
    expect(screen.getByText(/恭喜通关/)).toBeVisible(); expect(localStorage.getItem("yukino.game.best.memory")).toBe("8");
  });
});
describe("focus tools", () => {
  it("persists tasks and notes and allows deleted tasks to be restored", () => {
    render(<MemoryRouter><Focus /></MemoryRouter>);
    fireEvent.change(screen.getByRole("textbox", { name: "新任务" }), { target: { value: "验证待办" } }); fireEvent.click(screen.getByRole("button", { name: "添加任务" })); fireEvent.change(screen.getByRole("textbox", { name: "随手记" }), { target: { value: "留下一个想法" } });
    expect(JSON.parse(localStorage.getItem("yukino.focus.tasks")!)[0].text).toBe("验证待办"); expect(JSON.parse(localStorage.getItem("yukino.focus.notes")!)).toBe("留下一个想法");
    fireEvent.click(screen.getByRole("button", { name: "删除任务：验证待办" })); expect(screen.queryByRole("checkbox", { name: "验证待办" })).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "撤销删除" })); expect(screen.getByRole("checkbox", { name: "验证待办" })).toBeVisible();
  });
  it("continues an existing timer after remounting and logs its completion once", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-04T02:00:00Z"));
    const view = render(<MemoryRouter><Focus /></MemoryRouter>); fireEvent.change(screen.getByRole("spinbutton", { name: "专注 / 分钟" }), { target: { value: "1" } }); fireEvent.click(screen.getByRole("button", { name: "开始" })); act(() => { vi.advanceTimersByTime(10000); }); expect(screen.getByRole("timer")).toHaveTextContent("00:50");
    view.unmount(); act(() => { vi.advanceTimersByTime(30000); }); render(<MemoryRouter><Focus /></MemoryRouter>); expect(screen.getByRole("timer")).toHaveTextContent("00:20"); act(() => { vi.advanceTimersByTime(25000); });
    expect(screen.getByText(/专注完成，已记入今日记录/)).toBeVisible(); const logs = JSON.parse(localStorage.getItem("yukino.focus.logs")!); expect(logs).toHaveLength(1); expect(logs[0]).toMatchObject({ date: "2026-10-04", seconds: 60 });
  });
});
