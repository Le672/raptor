import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import News from "../pages/News";
import { NEWS_FEEDS, NewsResponse } from "../lib/news";

const fixture: NewsResponse = {
  fetchedAt: "2026-10-04T04:00:00Z", errors: [],
  sources: [{ key: "ithome", label: "IT之家", available: true, count: 1, fetchedAt: "2026-10-04T04:00:00Z" }, { key: "bbc", label: "BBC News", available: true, count: 1, fetchedAt: "2026-10-04T04:00:00Z" }],
  items: [
    { title: "新的开发工具", link: "https://www.ithome.com/story", pubDate: "2026-10-04T03:00:00Z", source: "ithome", sourceLabel: "IT之家", category: "科技", language: "zh" },
    { title: "World story", link: "https://www.bbc.com/story", pubDate: "2026-10-04T02:00:00Z", source: "bbc", sourceLabel: "BBC News", category: "国际", language: "en" },
  ],
};
beforeEach(() => { localStorage.clear(); vi.stubGlobal("fetch", vi.fn(async () => Response.json(fixture))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("filters headlines by category, source, language and search", async () => {
  render(<MemoryRouter><News /></MemoryRouter>); await screen.findByRole("heading", { name: "World story" });
  fireEvent.click(within(screen.getByLabelText("新闻类别")).getByRole("button", { name: "国际" })); expect(screen.queryByRole("heading", { name: "新的开发工具" })).toBeNull();
  fireEvent.click(within(screen.getByLabelText("新闻类别")).getByRole("button", { name: "全部" })); fireEvent.change(screen.getByRole("combobox", { name: "新闻语言" }), { target: { value: "zh" } }); expect(screen.queryByRole("heading", { name: "World story" })).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "新闻语言" }), { target: { value: "all" } }); fireEvent.change(screen.getByRole("combobox", { name: "新闻来源" }), { target: { value: "bbc" } }); expect(screen.getByRole("heading", { name: "World story" })).toBeVisible();
  fireEvent.change(screen.getByRole("textbox", { name: "搜索新闻" }), { target: { value: "not-found" } }); expect(screen.getByText(/当前筛选下没有新闻/)).toBeVisible();
});
it("retains bookmarks and a clearly dated snapshot after a failed reload", async () => {
  const view = render(<MemoryRouter><News /></MemoryRouter>); await screen.findByRole("heading", { name: "新的开发工具" }); fireEvent.click(screen.getByRole("button", { name: "稍后阅读：新的开发工具" }));
  expect(JSON.parse(localStorage.getItem("yukino.news.saved.v2")!)).toHaveLength(1); view.unmount(); vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
  render(<MemoryRouter><News /></MemoryRouter>); await screen.findByRole("alert"); expect(screen.getByText(/当前展示的是上次保存的资讯快照/)).toBeVisible(); fireEvent.click(screen.getByRole("button", { name: "稍后阅读 1" })); expect(screen.getByRole("heading", { name: "新的开发工具" })).toBeVisible(); expect(screen.queryByRole("heading", { name: "World story" })).toBeNull();
});
it("ignores a damaged local snapshot and provides all subscription sources", async () => {
  localStorage.setItem("yukino.news.snapshot.v2", JSON.stringify({ ...fixture, sources: [null] })); render(<MemoryRouter><News /></MemoryRouter>); await screen.findByRole("heading", { name: "新的开发工具" });
  expect(screen.getByRole("link", { name: "导出 OPML" })).toHaveAttribute("href", expect.stringContaining("format=opml")); const sources = screen.getByRole("region", { name: "新闻源与订阅" }); expect(within(sources).getAllByRole("link", { name: "RSS ↗" })).toHaveLength(NEWS_FEEDS.length);
});
