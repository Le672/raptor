import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AdminDashboard from "../pages/AdminDashboard";
import { api } from "../lib/api";

const auth = vi.hoisted(() => ({
  user: { id: 1, email: "admin@yukino.bond", name: "管理员", role: "admin" },
  logout: vi.fn(),
}));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAuthStore", () => ({ useAuthStore: () => auth }));
vi.mock("@/hooks/useSiteNavigate", () => ({ useSiteNavigate: () => navigate }));
vi.mock("@/lib/api", () => ({ api: { logout: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);
const mount = () => render(<MemoryRouter><AdminDashboard /></MemoryRouter>);

it("waits for shared-cookie removal before clearing local authentication", async () => {
  let complete: (result: unknown) => void;
  vi.mocked(api.logout).mockReturnValue(new Promise(resolve => { complete = resolve; }));
  mount();
  fireEvent.click(screen.getByRole("button", { name: "退出登录" }));
  expect(screen.getByRole("button", { name: "退出中…" })).toBeDisabled();
  expect(auth.logout).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  complete!({ message: "已退出登录" });
  await waitFor(() => expect(auth.logout).toHaveBeenCalledOnce());
  expect(navigate).toHaveBeenCalledWith("/");
});

it("reports a failed server logout and retains the authenticated session for retry", async () => {
  vi.mocked(api.logout).mockRejectedValue(new Error("network unavailable"));
  mount();
  fireEvent.click(screen.getByRole("button", { name: "退出登录" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("退出失败，请重试");
  expect(auth.logout).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "退出登录" })).toBeEnabled();
});
