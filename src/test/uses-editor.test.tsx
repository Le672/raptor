import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Uses from "../pages/Uses";
import { api, ApiError } from "../lib/api";
import { DEFAULT_USES } from "../lib/uses";

const auth = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("@/hooks/useAuthStore", () => ({ useAuthStore: (selector: any) => selector(auth) }));
vi.mock("@/lib/api", async (original) => {
  const module = await original<typeof import("../lib/api")>();
  return { ...module, api: { ...module.api, getUses: vi.fn(), updateUses: vi.fn() } };
});
const response = (canEdit = false) => ({ content: structuredClone(DEFAULT_USES), revision: 0, updatedAt: null, canEdit });
beforeEach(() => { auth.token = null; vi.mocked(api.getUses).mockResolvedValue(response()); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const mount = () => render(<MemoryRouter><Uses /></MemoryRouter>);

it("keeps the list readable and hides editing from visitors and ordinary logged-in users", async () => {
  const view = mount();
  await screen.findByText("自组装 PC");
  expect(screen.queryByRole("button", { name: "编辑清单" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "管理员登录" })).toHaveAttribute("href", "/login?next=/uses");
  auth.token = "ordinary-user-session";
  view.rerender(<MemoryRouter><Uses /></MemoryRouter>);
  await waitFor(() => expect(api.getUses).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("button", { name: "编辑清单" })).not.toBeInTheDocument();
});

it("lets a verified admin edit and publish content, then shows the saved public view", async () => {
  auth.token = "admin-session";
  vi.mocked(api.getUses).mockResolvedValue(response(true));
  vi.mocked(api.updateUses).mockImplementation(async (content) => ({ content, revision: 1, updatedAt: "2026-10-03T05:00:00Z", canEdit: true }));
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "编辑清单" }));
  fireEvent.change(screen.getByLabelText("页面介绍"), { target: { value: "我的真实设备清单" } });
  fireEvent.change(screen.getAllByLabelText("设备或软件名称")[0], { target: { value: "更新后的台式机" } });
  fireEvent.click(screen.getByRole("button", { name: "保存清单" }));
  await screen.findByText("已保存，访客现在可以看到最新清单。");
  expect(api.updateUses).toHaveBeenCalledWith(expect.objectContaining({ description: "我的真实设备清单" }), 0);
  expect(screen.getByText("更新后的台式机")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "保存清单" })).not.toBeInTheDocument();
});

it("supports removing categories and discarding a draft without publishing it", async () => {
  auth.token = "admin-session"; vi.mocked(api.getUses).mockResolvedValue(response(true));
  mount(); fireEvent.click(await screen.findByRole("button", { name: "编辑清单" }));
  fireEvent.click(screen.getByRole("button", { name: "删除分类 主力设备" }));
  expect(screen.queryByDisplayValue("自组装 PC")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "添加分类" }));
  expect(screen.getAllByLabelText("分类名称")).toHaveLength(5);
  fireEvent.click(screen.getByRole("button", { name: "取消编辑" }));
  expect(screen.getByText("自组装 PC")).toBeInTheDocument();
  expect(api.updateUses).not.toHaveBeenCalled();
});

it("keeps the draft when saving fails and never claims an unsuccessful edit was published", async () => {
  auth.token = "admin-session"; vi.mocked(api.getUses).mockResolvedValue(response(true));
  vi.mocked(api.updateUses).mockRejectedValue(new ApiError("清单已在别处更新", 409));
  mount(); fireEvent.click(await screen.findByRole("button", { name: "编辑清单" }));
  fireEvent.change(screen.getByLabelText("页面介绍"), { target: { value: "未保存的介绍" } });
  fireEvent.click(screen.getByRole("button", { name: "保存清单" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("页面介绍")).toHaveValue("未保存的介绍");
  expect(screen.queryByText("已保存，访客现在可以看到最新清单。")).not.toBeInTheDocument();
});
