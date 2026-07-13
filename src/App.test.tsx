import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "@/App";

describe("Yukino portal routes", () => {
  it("renders the homepage hero content", () => {
    window.history.pushState({}, "", "/");
    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Yukino" }),
    ).toBeInTheDocument();
    expect(screen.getByText("一个更像博客聚合页的首页")).toBeInTheDocument();
    expect(screen.getByText("博客之外的小部件")).toBeInTheDocument();
  });

  it("renders the notes page on direct navigation", () => {
    window.history.pushState({}, "", "/notes");
    render(<App />);

    expect(screen.getByText("短文、折腾记录与内容预览")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开发" })).toBeInTheDocument();
  });
});
