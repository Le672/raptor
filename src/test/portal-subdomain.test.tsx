// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://focus.yukino.bond/focus"}
import { render, screen, within, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { TopNav } from "../components/TopNav";
afterEach(cleanup);
it("returns to the real main homepage from a portal subdomain and keeps all section links flat", () => {
  render(<MemoryRouter initialEntries={["/focus"]}><TopNav /></MemoryRouter>);
  const navigation = within(screen.getByRole("navigation", { name: "主导航" }));
  expect(navigation.getByRole("link", { name: "首页" })).toHaveAttribute("href", "https://www.yukino.bond/");
  expect(navigation.getByRole("link", { name: "工具" })).toHaveAttribute("href", "/dev");
  expect(navigation.getAllByRole("link")).toHaveLength(19);
  expect(navigation.queryByRole("button", { name: /更多/ })).toBeNull();
});
