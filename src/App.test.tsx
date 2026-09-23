import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { postPreviews } from "@/data/site";
import { useSiteStore } from "@/hooks/useSiteStore";
afterEach(() => {
  cleanup();
  useSiteStore.getState().setNoteFilter("全部");
  useSiteStore.getState().closeMobileMenu();
});
vi.stubGlobal("scrollTo", vi.fn());
describe("Yukino reading and navigation", () => {
  it("links every homepage note to its corresponding existing article", () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Yukino",
    );
    for (const post of postPreviews)
      expect(
        screen.getByRole("link", { name: new RegExp(post.title) }),
      ).toHaveAttribute("href", post.href);
  });
  it("filters notes and opens the selected article", () => {
    window.history.pushState({}, "", "/notes");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "随笔" }));
    expect(screen.getByText("1 篇笔记")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: postPreviews[0].title }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("link", { name: new RegExp(postPreviews[2].title) }),
    );
    expect(
      screen.getByRole("heading", { name: "命名的考量" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "工具分类" }),
    ).not.toBeInTheDocument();
  });
  it("opens an article directly and handles an unknown article", () => {
    window.history.pushState({}, "", postPreviews[1].href);
    const first = render(<App />);
    expect(
      screen.getByRole("heading", { name: "工具分类" }),
    ).toBeInTheDocument();
    first.unmount();
    window.history.pushState({}, "", "/blog?post=missing");
    render(<App />);
    expect(screen.getByText(/没有找到这篇笔记/)).toBeInTheDocument();
  });
  it("closes the mobile menu after navigation and Escape", () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "打开菜单" }));
    expect(screen.getByRole("button", { name: "关闭菜单" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.queryByRole("navigation", { name: "移动导航" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "打开菜单" }));
    fireEvent.click(
      screen
        .getByRole("navigation", { name: "移动导航" })
        .querySelector('a[href="/games"]')!,
    );
    expect(
      screen.queryByRole("navigation", { name: "移动导航" }),
    ).not.toBeInTheDocument();
  });
});
