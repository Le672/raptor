import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppShell } from "../components/AppShell";
import { useAuthStore } from "../hooks/useAuthStore";
import { api, ApiError } from "../lib/api";

vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/TopNav", () => ({ TopNav: () => null }));
vi.mock("@/components/PageUtilities", () => ({ PageUtilities: () => null }));
vi.mock("@/components/LegacySpeedRecovery", () => ({ LegacySpeedRecovery: () => null }));
vi.mock("@/components/SiteVisits", () => ({ SiteVisitsProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/hooks/useSiteStore", () => ({ useSiteStore: (selector: any) => selector({ closeMobileMenu: () => {} }) }));
vi.mock("@/lib/api", async (original) => {
  const module = await original<typeof import("../lib/api")>();
  return { ...module, api: { ...module.api, getMe: vi.fn() } };
});
const admin = { id: 1, email: "admin@yukino.bond", name: "管理员", role: "admin" as const };
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  useAuthStore.setState({ token: null, user: null, isLoading: true });
});
afterEach(() => { cleanup(); useAuthStore.getState().logout(); vi.restoreAllMocks(); });
function ProtectedAdmin() {
  return useAuthStore(state => state.user)?.role === "admin" ? <p>已恢复管理台</p> : <Navigate to="/login" />;
}
const mount = () => render(<MemoryRouter initialEntries={["/admin"]}><Routes><Route element={<AppShell />}><Route path="/admin" element={<ProtectedAdmin />} /><Route path="/login" element={<p>登录表单</p>} /></Route></Routes></MemoryRouter>);

it("waits for a cookie-only session before entering an administrator page", async () => {
  vi.mocked(api.getMe).mockResolvedValue({ user: admin });
  mount();
  expect(await screen.findByText("已恢复管理台")).toBeInTheDocument();
  expect(screen.queryByText("登录表单")).not.toBeInTheDocument();
  expect(useAuthStore.getState().token).toBeNull();
});

it("retries the shared cookie after an older local Bearer token expires, without an early login redirect", async () => {
  useAuthStore.setState({ token: "expired-origin-local-token", user: null, isLoading: true });
  vi.mocked(api.getMe).mockRejectedValueOnce(new ApiError("未登录", 401)).mockResolvedValueOnce({ user: admin });
  mount();
  expect(await screen.findByText("已恢复管理台")).toBeInTheDocument();
  expect(screen.queryByText("登录表单")).not.toBeInTheDocument();
  expect(api.getMe).toHaveBeenCalledTimes(2);
  expect(useAuthStore.getState().token).toBeNull();
});
