import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { F1LeclercVote } from "../components/f1/F1LeclercVote";
import { F1RadioText } from "../components/f1/F1RadioText";
import { api } from "../lib/api";
import { useAuthStore } from "../hooks/useAuthStore";
import type { P4Poll, RadioText } from "../lib/f1-community";

vi.mock("../lib/api", () => ({ api: { getLeclercPoll:vi.fn(), voteLeclerc:vi.fn(), transcribeRadio:vi.fn(), getRadioText:vi.fn() } }));
const entry = {session:9839,driver:1,date:"2025-12-07T14:00:00Z"};
const radio: RadioText = {status:"ready",transcript:"Box, box. Switch to hard tyres.",translation:"进站，进站。换上硬胎。",language:"en",error:""};
let poll: P4Poll;
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); useAuthStore.getState().logout();
  poll = { poll:{key:"2026:17",closesAt:new Date(Date.now()+86400000).toISOString(),race:{season:"2026",round:"17",raceName:"Singapore Grand Prix",date:"2026-10-18",time:"07:00:00Z",Circuit:{circuitId:"marina_bay",circuitName:"Marina Bay",Location:{country:"Singapore",locality:"Singapore",lat:"1",long:"103"}}}},counts:{yes:2,no:1,total:3},myVote:null,authenticated:false,serverTime:new Date().toISOString() };
  vi.mocked(api.getLeclercPoll).mockResolvedValue(poll);
  vi.mocked(api.transcribeRadio).mockResolvedValue(radio);
});
afterEach(() => { cleanup(); useAuthStore.getState().logout(); vi.restoreAllMocks(); });

describe("P4 prediction ballot", () => {
  it("shows real public counts, keeps guest choices disabled, and returns to the ballot after login", async () => {
    render(<F1LeclercVote timezone="UTC"/>);
    await screen.findByText("3 人参与");
    expect(screen.getByRole("button",{name:/能，P4 见/})).toBeDisabled();
    expect(screen.getByRole("button",{name:/不能，换个名次/})).toBeDisabled();
    const login = screen.getByRole("link",{name:"登录后投票"});
    expect(decodeURIComponent(login.getAttribute("href")!)).toContain("/login?next=/f1?tab=leclerc#leclerc-next-race-vote");
    fireEvent.click(screen.getByRole("button",{name:/能，P4 见/})); expect(api.voteLeclerc).not.toHaveBeenCalled();
  });
  it("saves a signed-in choice and updates counts from the server, then allows a change", async () => {
    poll = {...poll,authenticated:true}; useAuthStore.getState().setToken("unit-test-session");
    vi.mocked(api.getLeclercPoll).mockResolvedValue(poll);
    vi.mocked(api.voteLeclerc).mockResolvedValueOnce({...poll,counts:{yes:3,no:1,total:4},myVote:"yes"}).mockResolvedValueOnce({...poll,counts:{yes:2,no:2,total:4},myVote:"no"});
    render(<F1LeclercVote timezone="UTC"/>); await screen.findByText("3 人参与");
    fireEvent.click(screen.getByRole("button",{name:/能，P4 见/})); await screen.findByText("已记录你的预测：能拿第四。");
    expect(api.voteLeclerc).toHaveBeenLastCalledWith("2026:17","yes");
    expect(screen.getByRole("button",{name:/能，P4 见/})).toHaveAttribute("aria-pressed","true");
    fireEvent.click(screen.getByRole("button",{name:/不能，换个名次/})); await screen.findByText("已更新你的预测：不能拿第四。");
    expect(api.voteLeclerc).toHaveBeenLastCalledWith("2026:17","no");
    expect(screen.getByText(/4 人参与/)).toBeInTheDocument();
  });
  it("requires server-verified authentication even when a local token exists", async () => {
    useAuthStore.getState().setToken("unverified"); render(<F1LeclercVote timezone="UTC"/>);
    await screen.findByText("3 人参与");
    expect(screen.getByRole("button",{name:/能，P4 见/})).toBeDisabled();
    expect(screen.getByRole("link",{name:"登录后投票"})).toBeInTheDocument();
  });
  it("does not claim zero voters when a source fails, and recovers using refresh", async () => {
    vi.mocked(api.getLeclercPoll).mockRejectedValueOnce(new Error("投票数据暂不可用"));
    render(<F1LeclercVote timezone="UTC"/>); expect(await screen.findByRole("alert")).toHaveTextContent("暂不可用");
    expect(screen.queryByText("0 人参与")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"刷新投票"})); await screen.findByText("3 人参与");
  });
  it("disables an expired race and never turns a failed save into success", async () => {
    poll = {...poll,authenticated:true}; vi.mocked(api.getLeclercPoll).mockResolvedValue(poll);
    vi.mocked(api.voteLeclerc).mockRejectedValueOnce(new Error("这场投票已经截止，请刷新"));
    render(<F1LeclercVote timezone="UTC"/>); await screen.findByText("3 人参与");
    fireEvent.click(screen.getByRole("button",{name:/能，P4 见/})); expect(await screen.findByRole("alert")).toHaveTextContent("已经截止");
    expect(screen.queryByText(/已记录你的预测/)).not.toBeInTheDocument();
  });
});

describe("team radio original text and Chinese translation", () => {
  it("generates real response text on demand and lets the reader collapse and reopen it without another request", async () => {
    render(<F1RadioText entry={entry}/>);
    expect(api.transcribeRadio).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"转写与中文翻译"}));
    await screen.findByText(radio.transcript); expect(screen.getByText(radio.translation)).toBeInTheDocument();
    expect(api.transcribeRadio).toHaveBeenCalledWith(entry);
    fireEvent.click(screen.getByRole("button",{name:"收起原文与译文"})); expect(screen.queryByText(radio.transcript)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"查看原文与译文"})); expect(screen.getByText(radio.transcript)).toBeInTheDocument();
    expect(api.transcribeRadio).toHaveBeenCalledTimes(1);
  });
  it("keeps a partial original and retries translation, with no invented translated text", async () => {
    vi.mocked(api.transcribeRadio).mockResolvedValueOnce({...radio,translation:"",error:"中文翻译暂未完成，已保留原文"}).mockResolvedValueOnce(radio);
    render(<F1RadioText entry={entry}/>); fireEvent.click(screen.getByRole("button",{name:"转写与中文翻译"}));
    await screen.findByText(radio.transcript); expect(screen.queryByText(radio.translation)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"重试中文翻译"})); await screen.findByText(radio.translation);
  });
  it("shows service failure clearly and allows a retry", async () => {
    vi.mocked(api.transcribeRadio).mockRejectedValueOnce(new Error("语音转写服务暂不可用"));
    render(<F1RadioText entry={entry}/>); fireEvent.click(screen.getByRole("button",{name:"转写与中文翻译"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("暂不可用");
    expect(screen.queryByText("中文翻译",{exact:true})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"重试转写与翻译"})); await screen.findByText(radio.translation);
  });
  it("never applies a preceding recording's late result to a newly selected recording", async () => {
    let resolve!: (data:RadioText)=>void;
    vi.mocked(api.transcribeRadio).mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
    const view = render(<F1RadioText entry={entry}/>); fireEvent.click(screen.getByRole("button",{name:"转写与中文翻译"}));
    view.rerender(<F1RadioText entry={{...entry,session:9840}}/>);
    await act(async()=>{resolve(radio);});
    expect(screen.queryByText(radio.transcript)).not.toBeInTheDocument(); expect(screen.getByRole("button",{name:"转写与中文翻译"})).toBeEnabled();
  });
});
