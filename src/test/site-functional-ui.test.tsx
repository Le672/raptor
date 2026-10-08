import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Home from "../pages/Home";
import Notes from "../pages/Notes";
import Blog from "../pages/Blog";
import Box from "../pages/Box";
import Dev from "../pages/Dev";
import Lab from "../pages/Lab";
import Focus from "../pages/Focus";
import Links from "../pages/Links";
import Friends from "../pages/Friends";
import RSS from "../pages/RSS";
import Changelog from "../pages/Changelog";
import Games from "../pages/Games";
import AdminPosts from "../pages/AdminPosts";
import AdminBox from "../pages/AdminBox";
import GameMinesweeper from "../components/games/GameMinesweeper";
import GameTicTacToe from "../components/games/GameTicTacToe";
import GameSimon from "../components/games/GameSimon";
import GameTetris from "../components/games/GameTetris";
import { QuickSearch } from "../components/QuickSearch";
import { Markdown } from "../components/Markdown";
import { useAuthStore } from "../hooks/useAuthStore";
import { api } from "../lib/api";
import { gameCatalog } from "../data/games";
import { seededRandom } from "../lib/game-engines";
import { useRailMonitor } from "../hooks/useRailMonitor";

const article = { id: 91, title: "云端新增笔记", slug: "cloud-note", summary: "更新内容立即公开", content: "## 第一部分\n\n你好，读者。\n\n## 第二部分\n\n```js\nconst n = 1;\n```", tag: "新分类", published: 1, created_at: "2026-10-08 01:00:00", updated_at: "2026-10-08 02:00:00", author_name: "Yukino" };
beforeEach(() => {
  localStorage.clear(); useAuthStore.setState({ user: null, token: null, isLoading: false });
  vi.stubGlobal("scrollTo", vi.fn()); vi.stubGlobal("crypto", webcrypto);
  vi.spyOn(api, "getPosts").mockResolvedValue({ posts: [article] });
  vi.spyOn(api, "getPost").mockResolvedValue({ post: article });
  vi.spyOn(api, "getBoxItems").mockResolvedValue({ items: [{ id: 9, title: "云端新资源", description: "管理台保存的说明", url: "https://example.com/", category: "software", size: "在线", sort_order: 0, created_at: "2026-10-08", updated_at: "2026-10-08" }] });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const mount = (component: React.ReactNode, path = "/") => render(<MemoryRouter initialEntries={[path]}>{component}</MemoryRouter>);

describe("cloud content on public and admin pages", () => {
  it("shows the same newly published article on home, notes, blog and search", async () => {
    const home = mount(<Home />); expect(await screen.findByRole("heading", { name: article.title })).toBeVisible(); home.unmount();
    const notes = mount(<Notes />, "/notes"); await screen.findByRole("heading", { name: article.title });
    fireEvent.click(screen.getByRole("button", { name: "新分类" })); expect(screen.getByRole("link", { name: /云端新增笔记/ })).toHaveAttribute("href", "/blog?post=cloud-note");
    fireEvent.change(screen.getByRole("textbox", { name: "搜索笔记标题或摘要" }), { target: { value: " 云端 " } }); expect(screen.getByRole("heading", { name: article.title })).toBeVisible(); notes.unmount();
    const blog = mount(<Blog />, "/blog?post=personal-domain"); await screen.findByRole("heading", { name: article.title }); expect(api.getPost).toHaveBeenCalledWith("domain-structure");
    expect(screen.getByRole("navigation", { name: "文章目录" })).toBeVisible(); expect(screen.getByText("const n = 1;")).toBeVisible(); blog.unmount();
    mount(<QuickSearch open onClose={vi.fn()} />); fireEvent.change(screen.getByRole("combobox", { name: "搜索内容" }), { target: { value: "云端" } }); expect(await screen.findByRole("option", { name: /云端新增笔记/ })).toBeVisible();
  });
  it("respects empty cloud data instead of repopulating deleted resources or posts", async () => {
    vi.mocked(api.getPosts).mockResolvedValue({ posts: [] }); vi.mocked(api.getBoxItems).mockResolvedValue({ items: [] });
    const box = mount(<Box />); expect(await screen.findByText("暂时没有公开资源")).toBeVisible(); expect(screen.queryByText("Visual Studio Code")).toBeNull(); box.unmount();
    mount(<Notes />); expect(await screen.findByText("暂时没有公开笔记。")).toBeVisible();
  });
  it("filters real cloud resources using trimmed search and resets no-match filters", async () => {
    mount(<Box />); await screen.findByText("云端新资源"); fireEvent.change(screen.getByRole("textbox", { name: "搜索资源" }), { target: { value: " 云端 " } }); expect(screen.getByText("云端新资源")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "文档" })); expect(screen.getByText("没有找到匹配的资源")).toBeVisible(); fireEvent.click(screen.getByRole("button", { name: "重置筛选" })); expect(screen.getByText("云端新资源")).toBeVisible();
  });
  it("loads draft body before editing and saves the original body when only the title changes", async () => {
    useAuthStore.setState({ user: { id: 1, name: "管理员", email: "admin@example.com", role: "admin" }, token: "test-session" });
    vi.spyOn(api, "getAdminPosts").mockResolvedValue({ posts: [{ ...article, published: 0 }] }); vi.spyOn(api, "getPostById").mockResolvedValue({ post: { ...article, published: 0 } }); vi.spyOn(api, "updatePost").mockResolvedValue({ message: "更新成功" });
    mount(<AdminPosts />); await screen.findByText("草稿"); fireEvent.click(screen.getByRole("button", { name: "编辑文章 " + article.title }));
    const body = await screen.findByLabelText("正文（支持 Markdown）"); expect(body).toHaveValue(article.content);
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "仅改标题" } }); fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(api.updatePost).toHaveBeenCalledWith(article.id, expect.objectContaining({ title: "仅改标题", content: article.content, published: false })));
  });
  it("keeps injected HTML and unsafe Markdown links inert", () => {
    const { container } = mount(<Markdown content={'<script>alert(1)</script>\n\n[坏链接](javascript:alert)\n\n[文档](https://example.com)'} />);
    expect(container.querySelector("script")).toBeNull(); expect(screen.queryByRole("link", { name: "坏链接" })).toBeNull(); expect(screen.getByRole("link", { name: "文档" })).toHaveAttribute("href", "https://example.com/");
  });
  it("does not misreport a failed admin resource request as an empty list and supports retry", async () => {
    useAuthStore.setState({ user: { id: 1, name: "管理员", email: "admin@example.com", role: "admin" }, token: "test-session" });
    vi.mocked(api.getBoxItems).mockRejectedValueOnce(new Error("资源服务暂时不可用"));
    mount(<AdminBox />);
    expect(await screen.findByRole("alert")).toHaveTextContent("资源服务暂时不可用");
    expect(screen.queryByText("还没有资源，点击上方按钮添加")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "重新加载资源" }));
    expect(await screen.findByRole("heading", { name: "云端新资源" })).toBeVisible();
  });
});
describe("tools and small experiments", () => {
  it("keeps rail queries usable when storage is blocked or stored settings are damaged", async () => {
    const request = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(String(url).includes("mode=stations") ? { stations: [] } : { checkedAt: "2026-10-08T01:00:00Z", date: "2026-10-08", from: "北京南", to: "上海虹桥", trains: [] }), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", request);
    localStorage.setItem("yukino-rail-monitor-v1", JSON.stringify({ queryMode: "train", train: 42, intervalMinutes: "oops", date: {}, seat: null, enabled: true }));
    const damaged = renderHook(() => useRailMonitor());
    expect(damaged.result.current.settings).toMatchObject({ train: "", intervalMinutes: 5, seat: "任意席别" }); damaged.unmount();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("storage blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage blocked"); });
    const view = renderHook(() => useRailMonitor());
    expect(view.result.current.storageError).toBe(true);
    act(() => view.result.current.update({ train: "G101" }));
    await act(async () => { await view.result.current.runCheck(false); });
    expect(view.result.current.result?.from).toBe("北京南");
    expect(view.result.current.error).toBeNull();
    expect(request.mock.calls.some(call => String(call[0]).includes("train=G101"))).toBe(true);
  });
  it("keeps inputs across tool switches and reports extreme timestamps without crashing", async () => {
    mount(<Dev />); const base = screen.getByRole("tabpanel"); fireEvent.change(within(base).getByLabelText("原始文本"), { target: { value: " " } }); expect(within(base).getByLabelText("Base64 结果")).toHaveValue("IA==");
    fireEvent.click(screen.getByRole("tab", { name: "时间戳" })); fireEvent.change(screen.getByLabelText("时间戳输入"), { target: { value: "999999999999999999999999999999999" } }); expect(await screen.findByText("时间戳超出有效日期范围")).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Base64" })); expect(within(screen.getByRole("tabpanel")).getByLabelText("原始文本")).toHaveValue(" ");
    fireEvent.click(screen.getByRole("tab", { name: "哈希" })); fireEvent.change(screen.getByLabelText("哈希算法"), { target: { value: "MD5" } }); expect(await screen.findByLabelText("MD5 结果")).toHaveValue("d41d8cd98f00b204e9800998ecf8427e");
  });
  it("counts clicks in a real one-second window, allows empty text and offers gradient copying", () => {
    vi.useFakeTimers(); mount(<Lab />); const count = screen.getByRole("button", { name: "增加点击计数" }); fireEvent.click(count); fireEvent.click(count);
    expect(screen.getByText("2 次/秒")).toBeVisible(); act(() => vi.advanceTimersByTime(1100)); expect(screen.getByText("0 次/秒")).toBeVisible(); expect(document.body.textContent).not.toContain("Infinity");
    fireEvent.click(screen.getByRole("button", { name: "重置计数" })); expect(count).toHaveTextContent("0");
    fireEvent.change(screen.getByLabelText("粒子文字"), { target: { value: "" } }); expect(screen.getByLabelText("粒子文字")).toHaveValue(""); expect(screen.getByRole("button", { name: "复制渐变 CSS" })).toBeEnabled();
  });
  it("preserves tasks added after a deletion when Undo is used", () => {
    mount(<Focus />); const input = screen.getByRole("textbox", { name: "新任务" });
    fireEvent.change(input, { target: { value: "旧任务" } }); fireEvent.click(screen.getByRole("button", { name: "添加任务" })); fireEvent.click(screen.getByRole("button", { name: "删除任务：旧任务" }));
    fireEvent.change(input, { target: { value: "新任务" } }); fireEvent.click(screen.getByRole("button", { name: "添加任务" })); fireEvent.click(screen.getByRole("button", { name: "撤销删除" }));
    expect(screen.getByText("旧任务")).toBeVisible(); expect(screen.getByText("新任务")).toBeVisible(); expect(screen.getByLabelText("导入专注记录")).toBeEnabled();
  });
});
describe("catalogs and global search", () => {
  it("filters navigation, retains local favorites, and exposes bookmark export", () => {
    mount(<Links />); fireEvent.change(screen.getByRole("textbox", { name: "搜索导航名称或说明" }), { target: { value: "Regex101" } });
    fireEvent.click(screen.getByRole("button", { name: "收藏 Regex101" })); expect(JSON.parse(localStorage.getItem("yukino.links.favorites")!)).toContain("https://regex101.com"); expect(screen.getByRole("button", { name: "导出当前书签" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "我的收藏 1" })); expect(screen.getByRole("link", { name: /Regex101/ })).toBeVisible();
  });
  it("searches friends, offers own RSS and filters dated changelog entries", () => {
    const friends = mount(<Friends />); fireEvent.change(screen.getByRole("textbox", { name: "搜索友链或推荐站点" }), { target: { value: "阮一峰" } }); expect(screen.getByText("1 个站点")).toBeVisible(); expect(screen.getByRole("button", { name: "复制本站友链信息" })).toBeEnabled(); friends.unmount();
    const rss = mount(<RSS />); expect(screen.getByRole("button", { name: "复制本站 RSS" })).toBeEnabled(); fireEvent.click(screen.getByRole("button", { name: "本站" })); expect(screen.getByText("1 个订阅源")).toBeVisible(); rss.unmount();
    mount(<Changelog />); fireEvent.change(screen.getByRole("textbox", { name: "搜索日期、版本或改动" }), { target: { value: "MD5" } }); expect(screen.getByRole("heading", { name: "全站功能审查与内容联通" })).toBeVisible(); expect(screen.getByText("1 条记录 · 按实际变更日期排列")).toBeVisible();
  });
  it("places historical September entries before July entries even if they were appended later", () => {
    mount(<Changelog />);
    const september = screen.getByRole("heading", { name: "JM 漫画书房独立重写" });
    const july = screen.getByRole("heading", { name: "新增桌面端与 Android 应用支持" });
    expect(september.compareDocumentPosition(july) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("opens the selected keyboard search result and restores focus after closing", async () => {
    const close = vi.fn(); const trigger = document.createElement("button"); document.body.appendChild(trigger); trigger.focus();
    const view = mount(<Routes><Route path="/" element={<QuickSearch open onClose={close} />} /><Route path="/lab" element={<h1>实验室已打开</h1>} /></Routes>);
    const input = screen.getByRole("combobox", { name: "搜索内容" }); fireEvent.change(input, { target: { value: "工具" } }); fireEvent.keyDown(input, { key: "ArrowDown" }); fireEvent.submit(input.closest("form")!);
    await screen.findByRole("heading", { name: "实验室已打开" }); expect(close).toHaveBeenCalled(); view.unmount(); expect(document.activeElement).toBe(trigger); trigger.remove();
  });
});
describe("all games and repaired timer behavior", () => {
  it.each(gameCatalog)("opens $name while browser storage is unavailable", async game => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); }); vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    mount(<Games />, "/games?game=" + game.id); expect(await screen.findByRole("heading", { level: 1, name: game.name })).toBeVisible();
    await waitFor(() => expect(screen.queryByText("正在加载游戏…")).toBeNull()); expect(screen.queryByRole("alert")).toBeNull(); expect(screen.queryByText(/游戏暂时未能加载/)).toBeNull();
  });
  it("starts minesweeper time and allows a touch-mode flag to be removed", () => {
    vi.useFakeTimers(); vi.spyOn(Math, "random").mockImplementation(seededRandom("mine-test")); mount(<GameMinesweeper />);
    fireEvent.click(screen.getByRole("button", { name: "🚩 标记" })); fireEvent.click(screen.getByRole("button", { name: "扫雷格子 1，未翻开" }));
    fireEvent.click(screen.getByRole("button", { name: "扫雷格子 1，已标记" })); expect(screen.getByRole("button", { name: "扫雷格子 1，未翻开" })).toBeEnabled();
    act(() => vi.advanceTimersByTime(2100)); expect(screen.getByText("2s")).toBeVisible();
  });
  it("cancels an old tic-tac-toe AI move on reset", () => {
    vi.useFakeTimers(); mount(<GameTicTacToe />); fireEvent.click(screen.getByRole("button", { name: "井字棋格子 1" })); fireEvent.click(screen.getByRole("button", { name: "新游戏" })); act(() => vi.advanceTimersByTime(500));
    expect(screen.getAllByRole("button", { name: /^井字棋格子 \d+$/ })).toHaveLength(9); expect(screen.getByText("你的回合 (X)")).toBeVisible();
  });
  it("keeps rotated Tetris blocks visible and scores a completed line", () => {
    vi.useFakeTimers(); vi.spyOn(Math, "random").mockReturnValue(0);
    const view = mount(<GameTetris />); fireEvent.click(screen.getByRole("button", { name: "开始" }));
    const key = (value: string, count = 1) => { for (let index = 0; index < count; index++) fireEvent.keyDown(window, { key: value }); };
    key("ArrowLeft", 4); key(" "); key(" "); key("ArrowUp"); key("ArrowRight", 5); key(" ");
    expect(view.container.querySelectorAll('[class*="bg-cyan-400/70"]').length).toBeGreaterThanOrEqual(12);
    key("ArrowUp"); key("ArrowRight", 4); key(" ");
    expect(within(screen.getByText("分数").parentElement!).getByText("100")).toBeVisible();
  });
  it("restarts Simon cleanly and removes pending playback timers on leaving", () => {
    vi.useFakeTimers(); const view = mount(<GameSimon />); fireEvent.click(screen.getByRole("button", { name: "声音开" })); fireEvent.click(screen.getByRole("button", { name: "开始游戏" })); act(() => vi.advanceTimersByTime(600));
    fireEvent.click(screen.getByRole("button", { name: "重置游戏" })); act(() => vi.advanceTimersByTime(750)); expect(screen.getByText("观察序列…")).toBeVisible();
    act(() => vi.advanceTimersByTime(600)); expect(screen.getByText("你的回合：0 / 1")).toBeVisible(); view.unmount(); expect(vi.getTimerCount()).toBe(0);
  });
});
