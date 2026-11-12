import { feedsToOpml, NEWS_FEEDS, NewsItem, NewsResponse } from "../../src/lib/news";
import { parseFeed } from "../_utils/news-feed";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" };
export async function onRequestGet(context: { request: Request; waitUntil?: (promise: Promise<unknown>) => void }) {
  const url = new URL(context.request.url); const sourceKey = url.searchParams.get("source");
  const targets = sourceKey ? NEWS_FEEDS.filter((f) => f.key === sourceKey) : NEWS_FEEDS;
  if (!targets.length) return new Response(JSON.stringify({ error: "未知新闻源" }), { status: 400, headers: jsonHeaders });
  if (url.searchParams.get("format") === "opml") return new Response(feedsToOpml(targets), { headers: { "Content-Type": "text/x-opml; charset=utf-8", "Content-Disposition": 'attachment; filename="yukino-news.opml"', "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" } });
  const cache = typeof caches !== "undefined" ? (caches as CacheStorage & { default?: Cache }).default : undefined;
  const cacheUrl = new URL(url.origin + url.pathname); cacheUrl.searchParams.set("version", "3"); cacheUrl.searchParams.set("feeds", NEWS_FEEDS.map((feed) => feed.key).join(",")); cacheUrl.searchParams.set("source", sourceKey || "all");
  const cacheKey = new Request(cacheUrl, { method: "GET" });
  if (url.searchParams.get("refresh") !== "1") {
    try { const cached = await cache?.match(cacheKey); if (cached) return cached; } catch { /* Caching is optional. */ }
  }
  const fetchedAt = new Date().toISOString();
  const results = await Promise.allSettled(targets.map(async (feed) => {
    const addresses = [feed.url, ...(feed.fallbackUrls ?? [])];
    let failure = new Error("暂时无法连接订阅源");
    for (const address of addresses) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000 / addresses.length);
      try {
        const response = await fetch(address, { signal: controller.signal, headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9", "User-Agent": "Yukino-News/2.0 (+https://www.yukino.bond/news)" } });
        if (!response.ok) throw new Error(`请求失败（HTTP ${response.status}）`);
        const xml = await response.text(); if (xml.length > 1_500_000) throw new Error("订阅源内容过大");
        const items = parseFeed(xml, { ...feed, url: address }); if (!items.length) throw new Error("订阅源暂未返回有效条目");
        return items;
      } catch (error) {
        failure = controller.signal.aborted ? new Error("连接超时，请稍后重试") : error instanceof Error && /^(请求失败|订阅源)/.test(error.message) ? error : new Error("暂时无法连接订阅源");
      } finally { clearTimeout(timer); }
    }
    throw failure;
  }));
  const payload: NewsResponse = { items: [], errors: [], sources: [], fetchedAt };
  results.forEach((result, index) => {
    const source = targets[index]; const available = result.status === "fulfilled";
    payload.sources.push({ key: source.key, label: source.label, count: available ? result.value.length : 0, available, fetchedAt });
    if (result.status === "fulfilled") payload.items.push(...result.value);
    else payload.errors.push({ source: source.key, label: source.label, error: result.reason instanceof Error ? result.reason.message : "暂时无法读取" });
  });
  payload.items.sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
  const seen = new Set<string>(); payload.items = payload.items.filter((item: NewsItem) => { if (seen.has(item.link)) return false; seen.add(item.link); return true; });
  const response = new Response(JSON.stringify(payload), { status: payload.items.length ? 200 : 503, headers: { ...jsonHeaders, "Cache-Control": payload.items.length ? "public, max-age=300, stale-while-revalidate=600" : "no-store" } });
  if (payload.items.length && cache) {
    const saving = cache.put(cacheKey, response.clone()).catch(() => {});
    if (context.waitUntil) context.waitUntil(saving); else await saving;
  }
  return response;
}
