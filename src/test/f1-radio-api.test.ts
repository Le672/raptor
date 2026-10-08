// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPortalDb } from "./fixtures/portal-db";
import { ensureF1Schema } from "../../functions/_utils/f1-schema";

let db: ReturnType<typeof createPortalDb>, endpoint: typeof import("../../functions/api/f1/radio-text");
let run: ReturnType<typeof vi.fn>, env: any;
const entry = {session:9839,driver:1,date:"2025-12-07T14:00:00+00:00"};
let address: string, sessionEnd: string;
const post = (body: any = entry) => endpoint.onRequestPost({request:new Request("https://f1.yukino.bond/api/f1/radio-text",{method:"POST",body:JSON.stringify(body)}),env});
const get = () => endpoint.onRequestGet({request:new Request(`https://f1.yukino.bond/api/f1/radio-text?${new URLSearchParams({session:String(entry.session),driver:String(entry.driver),date:entry.date})}`),env});
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers({toFake:["Date"]}); vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
  db = createPortalDb();
  address = "https://livetiming.formula1.com/static/2025/Race/TeamRadio/VER.mp3"; sessionEnd = "2025-12-07T15:00:00Z";
  run = vi.fn(async (model: string) => model.includes("whisper") ? {text:"Box, box. Switch to hard tyres.",transcription_info:{language:"en"}} : {translated_text:"进站，进站。换上硬胎。"});
  env = {DB:db,AI:{run}};
  vi.stubGlobal("fetch",vi.fn(async (url: string) => {
    if (url.includes("/sessions?")) return Response.json([{session_key:entry.session,date_end:sessionEnd}]);
    if (url.includes("/team_radio?")) return Response.json([{driver_number:entry.driver,date:entry.date,recording_url:address}]);
    return new Response(new Uint8Array([73,68,51,1,2,3]),{headers:{"Content-Type":"audio/mpeg"}});
  }));
  endpoint = await import("../../functions/api/f1/radio-text");
});
afterEach(() => { db.sqlite.close(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("verified team radio transcription and translation", () => {
  it("transcribes a verified official recording, translates to Chinese, and reuses persistent cache", async () => {
    const initial = await (await get()).json(); expect(initial.status).toBe("empty");
    const result = await (await post()).json();
    expect(result).toMatchObject({status:"ready",transcript:"Box, box. Switch to hard tyres.",translation:"进站，进站。换上硬胎。",language:"en",error:""});
    expect(run.mock.calls[0][1]).toMatchObject({audio:"SUQzAQID",task:"transcribe"});
    expect(run.mock.calls[1][1]).toMatchObject({source_lang:"en",target_lang:"zh"});
    await post(); expect(run).toHaveBeenCalledTimes(2);
    expect((await (await get()).json()).transcript).toBe(result.transcript);
  });
  it("preserves original text when translation fails and retries only the translation", async () => {
    run.mockImplementation(async (model: string) => { if(model.includes("whisper")) return {text:"Stay out.",transcription_info:{language:"en"}}; throw new Error("private provider diagnostic"); });
    const partial = await (await post()).json();
    expect(partial.transcript).toBe("Stay out."); expect(partial.translation).toBe(""); expect(partial.error).toContain("已保留");
    run.mockImplementation(async () => ({translated_text:"留在赛道上。"}));
    expect((await (await post()).json()).translation).toBe("留在赛道上。");
    expect(run.mock.calls.filter(([model])=>model.includes("whisper"))).toHaveLength(1);
  });
  it("uses a database lease so simultaneous requests cannot duplicate inference", async () => {
    let release!: (value: any) => void, started!: () => void;
    const began = new Promise<void>(resolve=>{started=resolve;});
    run.mockImplementationOnce(() => {started(); return new Promise(resolve=>{release=resolve;});});
    const first = post(); await began;
    const second = await post(); expect(second.status).toBe(202); expect((await second.json()).status).toBe("working");
    release({text:"Push now.",transcription_info:{language:"en"}}); await first;
    expect(run.mock.calls.filter(([model])=>model.includes("whisper"))).toHaveLength(1);
  });
  it("does not transcribe a current session without the existing live-data subscription", async () => {
    sessionEnd = "2026-10-08T13:00:00Z";
    expect((await post()).status).toBe(403); expect(run).not.toHaveBeenCalled();
  });
  it("rejects nonofficial media URLs from the provider and never fetches arbitrary client URLs", async () => {
    address = "https://internal.example.test/private.mp3";
    expect((await post({...entry,recording_url:"http://localhost/private.mp3"})).status).toBe(404);
    expect(run).not.toHaveBeenCalled(); expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes("private.mp3"))).toBe(false);
  });
  it("rejects oversized audio before model inference", async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url: any,init?: any) => String(url).includes("/TeamRadio/") ? new Response("audio",{headers:{"Content-Length":String(4*1024*1024+1)}}) : original(url,init));
    expect((await post()).status).toBe(413); expect(run).not.toHaveBeenCalled();
  });
  it("does not invent text when recognition finds no speech", async () => {
    run.mockResolvedValue({text:""});
    expect((await post()).status).toBe(422); expect((await (await get()).json()).transcript).toBe("");
  });
  it("reports a missing AI binding and protects the daily inference budget", async () => {
    env.AI = undefined; expect((await post()).status).toBe(503);
    env.AI = {run}; await ensureF1Schema(db);
    await db.prepare("INSERT INTO f1_radio_limits (bucket,calls) VALUES ('day:2026-10-08',200)").run();
    expect((await post()).status).toBe(429); expect(run).not.toHaveBeenCalled();
  });
  it("rejects malformed identities and credential-bearing or redirected media addresses", async () => {
    expect((await post({...entry,session:true})).status).toBe(400);
    expect(endpoint.trustedRadioUrl("https://name:password@livetiming.formula1.com/audio.mp3")).toBeNull();
    expect(endpoint.trustedRadioUrl("https://livetiming.formula1.com.evil.test/audio.mp3")).toBeNull();
  });
});
