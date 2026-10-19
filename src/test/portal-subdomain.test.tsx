// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://focus.yukino.bond/focus"}
import { render, screen, within, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { TopNav } from "../components/TopNav";
afterEach(cleanup);
it("returns to the real main homepage and opens each section on its own canonical domain", () => {
  render(<MemoryRouter initialEntries={["/focus"]}><TopNav /></MemoryRouter>);
  const navigation = within(screen.getByRole("navigation", { name: "主导航" }));
  expect(navigation.getByRole("link", { name: "首页" })).toHaveAttribute("href", "https://www.yukino.bond/");
  expect(navigation.getByRole("link", { name: "工具" })).toHaveAttribute("href", "https://dev.yukino.bond/dev");
  expect(navigation.getAllByRole("link")).toHaveLength(23);
  expect(navigation.getByRole("link", { name: "姬漫" })).toHaveAttribute("href", "https://jm.yukino.bond/");
  expect(navigation.getByRole("link", { name: "轻小说" })).toHaveAttribute("href", "https://novel.yukino.bond/");
  expect(navigation.getByRole("link", { name: "IP" })).toHaveAttribute("href", "https://ip.yukino.bond/ip");
  expect(navigation.getByRole("link", { name: "测速" })).toHaveAttribute("href", "https://speed.yukino.bond/");
  expect(navigation.queryByRole("button", { name: /更多/ })).toBeNull();
});
