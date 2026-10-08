// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPortalDb } from "./fixtures/portal-db";
import { signJWT } from "../../functions/_utils/auth";

let db: ReturnType<typeof createPortalDb>;
let env: { DB: typeof db; JWT_SECRET: string };
let endpoint: typeof import("../../functions/api/f1/leclerc-vote");
const race = (season = "2026", round = "17", date = "2026-10-18", time = "07:00:00Z") => ({ season, round, date, time, raceName: "Singapore Grand Prix", Circuit: { circuitId: "marina_bay", circuitName: "Marina Bay", Location: { country: "Singapore" } } });
let races: ReturnType<typeof race>[];
const get = (token?: string) => endpoint.onRequestGet({ request: new Request("https://f1.yukino.bond/api/f1/leclerc-vote", { headers: token ? {Authorization:`Bearer ${token}`} : {} }), env });
const vote = (token?: string, choice = "yes", pollKey = "2026:17", extra: object = {}) => endpoint.onRequestPost({ request: new Request("https://f1.yukino.bond/api/f1/leclerc-vote", { method:"POST", headers: token ? {Authorization:`Bearer ${token}`} : {}, body:JSON.stringify({choice,pollKey,...extra}) }), env });
async function user(name = "reader") {
  await db.prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?, 'unused', ?, 'user')").bind(`${name}@example.test`, name).run();
  const row = await db.prepare("SELECT id FROM users WHERE email = ?").bind(`${name}@example.test`).first() as any;
  return { id: row.id, token: await signJWT({userId:row.id,email:`${name}@example.test`,name,role:"user"},env) };
}
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers({toFake:["Date"]}); vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
  db = createPortalDb(); env = { DB:db, JWT_SECRET:"f1-vote-tests-only-private-signing-value" };
  races = [race("2026","16","2026-10-04"),race(),race("2026","18","2026-11-01")];
  vi.stubGlobal("fetch",vi.fn(async (address: string) => Response.json({MRData:{RaceTable:{Races:address.includes("/2027.") ? [] : races}}})));
  endpoint = await import("../../functions/api/f1/leclerc-vote");
});
afterEach(() => { db.sqlite.close(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Leclerc next Grand Prix authenticated voting", () => {
  it("allows public counts but rejects anonymous and forged-token voting before writing", async () => {
    const response = await get(), data = await response.json();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(data).toMatchObject({poll:{key:"2026:17"},counts:{yes:0,no:0,total:0},myVote:null,authenticated:false});
    expect((await vote()).status).toBe(401); expect((await vote("forged-token")).status).toBe(401);
    expect((await db.prepare("SELECT COUNT(*) AS n FROM f1_leclerc_votes").first() as any).n).toBe(0);
  });
  it("persists one vote per actual account and changes an existing vote instead of incrementing it", async () => {
    const first = await user(), second = await user("second");
    expect((await (await vote(first.token)).json()).counts).toEqual({yes:1,no:0,total:1});
    expect((await (await vote(first.token)).json()).counts.total).toBe(1);
    const switched = await (await vote(first.token,"no")).json();
    expect(switched).toMatchObject({counts:{yes:0,no:1,total:1},myVote:"no"});
    const combined = await (await vote(second.token,"yes","2026:17",{userId:first.id})).json();
    expect(combined.counts).toEqual({yes:1,no:1,total:2});
    expect((await (await get(first.token)).json()).myVote).toBe("no");
    expect((await (await get()).json()).myVote).toBeNull();
  });
  it("rejects a stale race and stops accepting the preceding race exactly at its scheduled start", async () => {
    const account = await user();
    expect((await vote(account.token,"yes","2026:16")).status).toBe(409);
    vi.setSystemTime(new Date("2026-10-18T07:00:00Z"));
    expect((await vote(account.token)).status).toBe(401); // The original seven-day session has expired.
    const refreshed = await signJWT({userId:account.id,email:"reader@example.test",name:"reader",role:"user"},env);
    expect((await vote(refreshed)).status).toBe(409);
    expect((await (await get()).json()).poll.key).toBe("2026:18");
  });
  it("uses the next season when the current calendar has no future race", async () => {
    vi.stubGlobal("fetch",vi.fn(async (address: string) => Response.json({MRData:{RaceTable:{Races:address.includes("/2027.") ? [race("2027","1","2027-03-07")] : []}}})));
    expect((await (await get()).json()).poll.key).toBe("2027:1");
  });
  it("does not invent an open poll when both published calendars are empty", async () => {
    races = [];
    expect((await (await get()).json()).poll).toBeNull();
    expect((await vote((await user()).token)).status).toBe(409);
  });
  it("reports unavailable data instead of zero voters when the calendar provider fails", async () => {
    vi.stubGlobal("fetch",vi.fn(async () => new Response("unavailable",{status:503})));
    expect((await get()).status).toBe(503);
  });
  it("rejects deleted accounts and invalid choices", async () => {
    const account = await user();
    expect((await vote(account.token,"fourth")).status).toBe(400);
    await db.prepare("DELETE FROM users WHERE id = ?").bind(account.id).run();
    expect((await vote(account.token)).status).toBe(401);
  });
});
