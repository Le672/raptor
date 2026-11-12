import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Ip from "../pages/Ip";
import { VisitorNetwork } from "../components/VisitorNetwork";
import { assessIp, type IpSource } from "../lib/ip";
import { loadVisitorNetwork, queryIp } from "../lib/ip-client";
vi.mock("../lib/ip-client", () => ({ loadVisitorNetwork: vi.fn(), queryIp: vi.fn() }));
const current = { ip: "2606:4700:4700::1111", version: "IPv6" as const, asn: "AS13335", organization: "Cloudflare", country: "AU", city: "", source: "Cloudflare" as const, checkedAt: "2026-10-11T00:00:00Z" };
const sources: IpSource[] = [
  { id: "one", name: "IPQuery", href: "https://ipquery.io/", kind: "reputation", status: "ok", detail: "risk result", risk: 80, signals: { vpn: true }, checkedAt: current.checkedAt, asn: "AS13335" },
  { id: "two", name: "proxycheck.io", href: "https://proxycheck.io/api/", kind: "reputation", status: "error", detail: "数据源今日额度受限", risk: null, signals: {}, checkedAt: current.checkedAt },
];
beforeEach(() => { vi.clearAllMocks(); vi.mocked(loadVisitorNetwork).mockResolvedValue(current); vi.mocked(queryIp).mockResolvedValue({ ip: current.ip, version: "IPv6", checkedAt: current.checkedAt, model: "yukino-ip-v1", sources, assessment: assessIp(sources) }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const mount = (view: React.ReactNode) => render(<MemoryRouter>{view}</MemoryRouter>);

describe("IP visitor and purity UI", () => {
  it("shows the current visitor IP and ASN without launching reputation lookups", async () => {
    mount(<VisitorNetwork />); expect(await screen.findByText(current.ip)).toBeVisible(); expect(screen.getByText("AS13335")).toBeVisible();
    expect(screen.getByRole("link", { name: "IP 纯净度" })).toHaveAttribute("href", "/ip"); expect(queryIp).not.toHaveBeenCalled();
  });
  it("fills the current IPv6 address and retains successful evidence when another source fails", async () => {
    mount(<Ip />); await waitFor(() => expect(screen.getByLabelText("要查询的公网 IP")).toHaveValue(current.ip));
    fireEvent.click(screen.getByRole("button", { name: "查询纯净度" }));
    expect(await screen.findByRole("img", { name: "综合纯净度 20 分" })).toBeVisible();
    expect(screen.getByText("数据源今日额度受限")).toBeVisible(); expect(screen.getByText("结果需交叉核对")).toBeVisible();
    expect(queryIp).toHaveBeenCalledWith(current.ip, expect.any(AbortSignal));
  });
  it("keeps invalid input local and lets the visitor select an IPv4 example", async () => {
    mount(<Ip />); await screen.findByRole("button", { name: "使用我的 IP" });
    fireEvent.change(screen.getByLabelText("要查询的公网 IP"), { target: { value: "192.168.1.1" } }); fireEvent.click(screen.getByRole("button", { name: "查询纯净度" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("不支持内网地址"); expect(queryIp).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "IPv4 示例" })); expect(screen.getByLabelText("要查询的公网 IP")).toHaveValue("1.1.1.1");
  });
  it("shows all AI risk cards after one lookup without sending platform probes", async () => {
    mount(<Ip />); await waitFor(() => expect(screen.getByLabelText("要查询的公网 IP")).toHaveValue(current.ip));
    expect(screen.queryByTestId("ai-risk-chatgpt")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查询纯净度" }));
    const ai = await screen.findByTestId("ai-risk-chatgpt");
    expect(within(ai).getAllByText("网络风险较高").length).toBeGreaterThan(0);
    expect(within(ai).getByText("位置未提供")).toBeVisible();
    for (const id of ["claude", "gemini", "copilot", "perplexity", "grok", "deepseek", "qwen", "mistral", "poe"]) expect(screen.getByTestId(`ai-risk-${id}`)).toBeVisible();
    expect(queryIp).toHaveBeenCalledTimes(1);
  });
  it("labels regional restrictions for the queried target while retaining the visitor identity", async () => {
    const targetSources = sources.map((source, index) => ({ ...source, status: "ok" as const, risk: 0, signals: { vpn: false, proxy: false, tor: false, hosting: false }, country: "China", countryCode: "CN", id: `cn-${index}` }));
    vi.mocked(queryIp).mockResolvedValue({ ip: "1.1.1.1", version: "IPv4", checkedAt: current.checkedAt, model: "yukino-ip-v1", sources: targetSources, assessment: assessIp(targetSources) });
    mount(<Ip />); await waitFor(() => expect(screen.getByLabelText("要查询的公网 IP")).toHaveValue(current.ip));
    fireEvent.click(screen.getByRole("button", { name: "IPv4 示例" })); fireEvent.click(screen.getByRole("button", { name: "查询纯净度" }));
    const ai = await screen.findByTestId("ai-risk-chatgpt");
    expect(within(ai).getByText("地区访问风险较高")).toBeVisible();
    expect(within(ai).getByText("网络风险较低")).toBeVisible();
    expect(within(screen.getByTestId("ai-risk-gemini")).getByText("个人版名单外")).toBeVisible();
    expect(screen.getByTestId("ip-ai-risk")).toHaveTextContent("核对地址 1.1.1.1");
    expect(screen.getByLabelText("当前访问者连接")).toHaveTextContent(current.ip);
  });
  it("does not turn a total service failure into a score and permits another query", async () => {
    vi.mocked(queryIp).mockRejectedValueOnce(new Error("本次查询超时")); mount(<Ip />);
    await waitFor(() => expect(screen.getByLabelText("要查询的公网 IP")).toHaveValue(current.ip)); fireEvent.click(screen.getByRole("button", { name: "查询纯净度" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("本次查询超时"); expect(screen.getByRole("img", { name: "尚无可用的纯净度评分" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "查询纯净度" })); expect(await screen.findByRole("img", { name: "综合纯净度 20 分" })).toBeVisible();
  });
  it("expands service-specific analysis and filters without launching another lookup", async () => {
    mount(<Ip />); await waitFor(() => expect(screen.getByLabelText("要查询的公网 IP")).toHaveValue(current.ip));
    fireEvent.click(screen.getByRole("button", { name: "查询纯净度" }));
    const poe = await screen.findByTestId("ai-risk-poe");
    expect(within(poe).getAllByText("未检测")).toHaveLength(2);
    fireEvent.click(within(poe).getByText("查看账号、功能与排查建议"));
    expect(within(poe).getByText(/不同机器人消耗不同点数/)).toBeVisible();
    fireEvent.click(within(screen.getByRole("group", { name: "筛选 AI 风险" })).getByRole("button", { name: /网络线索较低/ }));
    expect(screen.queryByTestId("ai-risk-poe")).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "筛选 AI 风险" })).getByRole("button", { name: /全部服务/ }));
    expect(screen.getByTestId("ai-risk-poe")).toBeVisible(); expect(queryIp).toHaveBeenCalledTimes(1);
  });
  it("filters failed sources and uses the queried target in manual review links", async () => {
    vi.mocked(queryIp).mockResolvedValue({ ip: "1.1.1.1", version: "IPv4", checkedAt: current.checkedAt, model: "yukino-ip-v2", sources, assessment: assessIp(sources) });
    mount(<Ip />); await waitFor(() => expect(screen.getByLabelText("要查询的公网 IP")).toHaveValue(current.ip));
    fireEvent.click(screen.getByRole("button", { name: "IPv4 示例" })); fireEvent.click(screen.getByRole("button", { name: "查询纯净度" }));
    await screen.findByTestId("ip-source-one");
    expect(screen.getByRole("link", { name: /Scamalytics/ })).toHaveAttribute("href", "https://scamalytics.com/ip/1.1.1.1");
    expect(screen.getByRole("link", { name: /AbuseIPDB.*近期滥用报告/ })).toHaveAttribute("href", "https://www.abuseipdb.com/check/1.1.1.1");
    fireEvent.click(within(screen.getByRole("group", { name: "筛选数据来源" })).getByRole("button", { name: /缺失与限制/ }));
    expect(screen.queryByTestId("ip-source-one")).not.toBeInTheDocument(); expect(screen.getByTestId("ip-source-two")).toBeVisible();
    expect(queryIp).toHaveBeenCalledTimes(1);
  });
});
