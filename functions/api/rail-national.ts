const SNAPSHOT = "https://raw.githubusercontent.com/Le672/raptor/rail-national-data/schedule.json";
const MAX_BYTES = 16 * 1024 * 1024;

export async function onRequestGet() {
  try {
    const source = await fetch(SNAPSHOT, {
      signal: AbortSignal.timeout(15000),
      cf: { cacheEverything: true, cacheTtlByStatus: { "200-299": 120, "400-599": 0 } },
    } as RequestInit);
    if (!source.ok || !source.body || Number(source.headers.get("content-length")) > MAX_BYTES) throw new Error("snapshot unavailable");
    return new Response(source.body, { headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=120, stale-if-error=3600",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return Response.json({ error: "全国时刻表暂不可用，请稍后重试。" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
