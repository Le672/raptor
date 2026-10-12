import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { F1Guide } from "../components/f1/F1Guide";
import { F1_GUIDE_CHAPTERS, F1_GUIDE_ENTRIES, F1_GUIDE_SOURCES } from "../data/f1-guide";

const scroll = vi.fn();
const originalScroll = HTMLElement.prototype.scrollIntoView;
beforeEach(() => {
  window.history.replaceState(null, "", "/"); scroll.mockClear();
  HTMLElement.prototype.scrollIntoView = scroll;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (frame: number) => window.clearTimeout(frame));
});
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); HTMLElement.prototype.scrollIntoView = originalScroll; vi.unstubAllGlobals(); });
const mount = () => render(<MemoryRouter><F1Guide /></MemoryRouter>);
const search = (value: string) => fireEvent.change(screen.getByRole("textbox", { name: "搜索 F1 术语" }), { target: { value } });

describe("detailed F1 encyclopedia", () => {
  it("finds body and table text, trims the query, and expands matching explanations", () => {
    mount(); search(" 三者相加 ");
    const lap = screen.getByRole("article", { name: "单圈、三段与微分段" });
    expect(within(lap).getByText(/把三者相加只是理论组合/)).toBeVisible();
    expect(within(lap).getByRole("button", { name: "收起详细说明" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("article", { name: "排位赛" })).not.toBeInTheDocument();
    search(" 后续可能取消或调整 ");
    expect(screen.getByRole("table", { name: "常见无线电词句 · 按上下文理解" })).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    search("BoX OPPosite");
    expect(screen.getByRole("article", { name: "Plan A、Cover 与 Box opposite" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "清除百科搜索" }));
    expect(screen.getByRole("textbox", { name: "搜索 F1 术语" })).toHaveValue("");
    expect(screen.getByRole("article", { name: "排位赛" })).toBeVisible();
  });

  it("filters chapters, toggles all explanations, and recovers from an empty combined filter", () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: /轮胎与天气/ }));
    expect(screen.getByRole("button", { name: /轮胎与天气/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("article", { name: "积分怎么计算" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开全部详解" }));
    expect(screen.getAllByRole("button", { name: "收起详细说明" })).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "收起全部详解" }));
    expect(screen.getAllByRole("button", { name: "阅读详细说明" })).toHaveLength(8);
    search("没有这个术语xyz"); expect(screen.getByRole("button", { name: "展开全部详解" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "重置百科筛选" }));
    expect(screen.getByRole("button", { name: /全部主题/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("article", { name: "积分怎么计算" })).toBeVisible();
  });

  it("loads a deep link, follows a changed hash, and focuses the expanded article", async () => {
    window.history.replaceState(null, "", "/#f1-guide-radio-phrases"); mount();
    const radio = await screen.findByRole("article", { name: "无线电常用短句：Box、Copy、Push" });
    await waitFor(() => expect(radio).toHaveFocus());
    expect(screen.getByRole("button", { name: /无线电与观赛/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(radio).getByRole("table")).toBeVisible();
    window.history.replaceState(null, "", "/#f1-guide-points"); fireEvent(window, new Event("hashchange"));
    const points = await screen.findByRole("article", { name: "积分怎么计算" });
    await waitFor(() => expect(points).toHaveFocus());
    expect(within(points).getByRole("table", { name: "现行通常计分表" })).toBeVisible();
  });

  it("can revisit the same shortcut after moving focus elsewhere", async () => {
    mount(); fireEvent.click(screen.getByRole("link", { name: /先看比赛怎么计分/ }));
    const points = await screen.findByRole("article", { name: "积分怎么计算" });
    await waitFor(() => expect(points).toHaveFocus());
    fireEvent.click(within(points).getByRole("button", { name: "收起详细说明" }));
    const input = screen.getByRole("textbox", { name: "搜索 F1 术语" }); input.focus();
    fireEvent.click(screen.getByRole("link", { name: /先看比赛怎么计分/ }));
    await waitFor(() => expect(points).toHaveFocus());
    expect(within(points).getByRole("table")).toBeVisible();
  });

  it("keeps entry anchors, referenced sources, and comparison tables valid", () => {
    expect(new Set(F1_GUIDE_ENTRIES.map(entry => entry.id)).size).toBe(F1_GUIDE_ENTRIES.length);
    expect(new Set(F1_GUIDE_CHAPTERS.map(chapter => chapter.id)).size).toBe(F1_GUIDE_CHAPTERS.length);
    for (const entry of F1_GUIDE_ENTRIES) {
      expect(entry.sourceIds.length, entry.id).toBeGreaterThan(0);
      for (const id of entry.sourceIds) expect(F1_GUIDE_SOURCES[id]?.href, `${entry.id}: ${id}`).toMatch(/^https:\/\//);
      for (const row of entry.table?.rows || []) expect(row, entry.id).toHaveLength(entry.table!.columns.length);
    }
    expect(F1_GUIDE_ENTRIES.some(entry => entry.id === "radio-phrases")).toBe(true);
    const points = F1_GUIDE_ENTRIES.find(entry => entry.id === "points")!;
    expect(points.table!.rows.find(row => row[0] === "P4")).toEqual(["P4", "12", "5"]);
  });
});
