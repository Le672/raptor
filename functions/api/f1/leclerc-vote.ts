import { errorResponse, getCurrentUser, jsonResponse } from "../../_utils/auth";
import { ensureF1Schema } from "../../_utils/f1-schema";
import { jolpica } from "../f1";
import type { F1Race } from "../../../src/lib/f1";
import type { P4Poll } from "../../../src/lib/f1-community";

type Context = { request: Request; env: { DB: any; JWT_SECRET?: string } };

export async function nextGrandPrix(now = Date.now()): Promise<P4Poll["poll"]> {
  const year = new Date(now).getUTCFullYear();
  for (const season of [year, year + 1]) {
    const value = await jolpica(String(season));
    const races = value?.MRData?.RaceTable?.Races;
    if (!Array.isArray(races)) throw new Error("赛历格式异常");
    const upcoming = races.map((race: F1Race) => ({ race, start: Date.parse(`${race.date}T${race.time || "00:00:00Z"}`) }))
      .filter(({ race, start }) => Number(race.season) === season && /^[1-9]\d?$/.test(race.round) && Number.isFinite(start) && start > now)
      .sort((a, b) => a.start - b.start)[0];
    if (upcoming) return { key: `${upcoming.race.season}:${upcoming.race.round}`, race: upcoming.race, closesAt: new Date(upcoming.start).toISOString() };
  }
  return null;
}

async function readPoll(context: Context, poll: P4Poll["poll"], user: Awaited<ReturnType<typeof getCurrentUser>>): Promise<P4Poll> {
  const counts = { yes: 0, no: 0, total: 0 };
  let myVote: P4Poll["myVote"] = null;
  if (poll) {
    const rows = await context.env.DB.prepare("SELECT choice, COUNT(*) AS n FROM f1_leclerc_votes WHERE poll_key = ? GROUP BY choice").bind(poll.key).all();
    for (const row of rows.results) if (row.choice === "yes" || row.choice === "no") counts[row.choice] = Number(row.n);
    counts.total = counts.yes + counts.no;
    if (user) myVote = (await context.env.DB.prepare("SELECT choice FROM f1_leclerc_votes WHERE poll_key = ? AND user_id = ?").bind(poll.key, user.userId).first())?.choice ?? null;
  }
  return { poll, counts, myVote, authenticated: !!user, serverTime: new Date().toISOString() };
}

export async function onRequestGet(context: Context) {
  try {
    const [poll, user] = await Promise.all([nextGrandPrix(), getCurrentUser(context.request, context.env)]);
    await ensureF1Schema(context.env.DB);
    return jsonResponse(await readPoll(context, poll, user));
  } catch { return errorResponse("暂时无法读取下场大奖赛投票，请稍后重试", 503); }
}

export async function onRequestPost(context: Context) {
  try {
    const user = await getCurrentUser(context.request, context.env);
    if (!user) return errorResponse("请先登录后再投票", 401);
    const origin = context.request.headers.get("Origin");
    if (origin && origin !== new URL(context.request.url).origin && !context.request.headers.get("Authorization")?.startsWith("Bearer ")) return errorResponse("投票请求来源不正确", 403);
    let body: any;
    try {
      const raw = await context.request.text();
      if (raw.length > 1024) return errorResponse("投票内容过大", 413);
      body = JSON.parse(raw);
    } catch { return errorResponse("投票格式不正确"); }
    if (!body || !["yes", "no"].includes(body.choice) || typeof body.pollKey !== "string") return errorResponse("请选择能或不能拿第四");
    const poll = await nextGrandPrix();
    if (!poll || poll.key !== body.pollKey || Date.now() >= Date.parse(poll.closesAt)) return errorResponse("这场投票已经截止或赛事已更新，请刷新后参与下场投票", 409);
    await ensureF1Schema(context.env.DB);
    await context.env.DB.prepare(`INSERT INTO f1_leclerc_votes (poll_key, user_id, choice, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (poll_key, user_id) DO UPDATE SET choice = excluded.choice, updated_at = excluded.updated_at`)
      .bind(poll.key, user.userId, body.choice, new Date().toISOString()).run();
    return jsonResponse(await readPoll(context, poll, user));
  } catch { return errorResponse("投票未保存，请稍后重试", 503); }
}

export function onRequestOptions() { return new Response(null, { status: 204, headers: {
  "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization",
} }); }
