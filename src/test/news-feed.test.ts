// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalNewsUrl, decodeFeedText, parseFeed } from "../../functions/_utils/news-feed";
import { onRequestGet } from "../../functions/api/news";
import { feedsToOpml, NEWS_FEEDS } from "../lib/news";

const feed = NEWS_FEEDS[0];
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("RSS and Atom reading", () => {
  it("reads RSS with CDATA, HTML titles, dates and duplicate tracking links", () => {
    const xml = `<rss><channel><item id="one"><title><![CDATA[<b>New</b> &amp; fast &#x1F680;]]></title><link><![CDATA[https://example.com/story?utm_source=rss]]></link><pubDate>Sun, 04 Oct 2026 01:00:00 GMT</pubDate></item><item><title>Same article</title><link>https://example.com/story</link></item></channel></rss>`;
    expect(parseFeed(xml, feed)).toEqual([{ title: "New & fast 🚀", link: "https://example.com/story", pubDate: "2026-10-04T01:00:00.000Z", source: feed.key, sourceLabel: feed.label, category: feed.category, language: feed.language }]);
  });
  it("selects Atom alternate links, accepts single quotes and resolves relative URLs", () => {
    const xml = `<feed><entry xml:lang="en"><title type="html">A &lt;em&gt;new&lt;/em&gt; idea</title><link href='https://example.com/self.xml' rel='self'/><link type='text/html' href='/article?a=1&amp;b=2' rel='alternate'/><updated>2026-10-04T03:00:00Z</updated></entry></feed>`;
    expect(parseFeed(xml, feed)[0]).toMatchObject({ title: "A new idea", link: "https://www.ithome.com/article?a=1&b=2", pubDate: "2026-10-04T03:00:00.000Z" });
  });
  it("rejects executable and credential-bearing links and tolerates invalid dates", () => {
    const xml = `<rss><item><title>Unsafe</title><link>javascript:alert(1)</link></item><item><title>Secret</title><link>https://user:pass@example.com/a</link></item><item><title>Valid</title><link>https://example.com/a</link><pubDate>Not a date</pubDate></item></rss>`;
    expect(parseFeed(xml, feed)).toHaveLength(1); expect(parseFeed(xml, feed)[0].pubDate).toBe("");
    expect(canonicalNewsUrl("data:text/html,test", feed.url)).toBeNull();
    expect(decodeFeedText("&#1114112; &#xD800; &nbsp; &#x1F600;")).toBe("😀");
  });
  it("exports all sources as safe OPML", () => { const xml = feedsToOpml(); expect((xml.match(/<outline /g) ?? []).length).toBe(14); expect(xml).toContain('xmlUrl="https://www.nasa.gov/feed/"'); });
});
describe("news endpoint", () => {
  it("rejects unknown sources without making any external requests", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); const response = await onRequestGet({ request: new Request("https://www.yukino.bond/api/news?source=https://example.com") }); expect(response.status).toBe(400); expect(fetcher).not.toHaveBeenCalled();
  });
  it("serves OPML without fetching upstream feeds", async () => { const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); const response = await onRequestGet({ request: new Request("https://www.yukino.bond/api/news?format=opml") }); expect(response.status).toBe(200); expect(response.headers.get("Content-Type")).toContain("opml"); expect(fetcher).not.toHaveBeenCalled(); });
  it("keeps successful sources available when one source fails, with a real timestamp", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { if (url.includes("ithome.com")) throw new Error("Network error"); return new Response(`<rss><item><title>Story</title><link>${url.includes("?") ? url.split("?")[0] : url}story</link><pubDate>2026-10-04</pubDate></item></rss>`); }));
    const response = await onRequestGet({ request: new Request("https://www.yukino.bond/api/news") }); const body = await response.json();
    expect(response.status).toBe(200); expect(body.sources).toHaveLength(14); expect(body.items).toHaveLength(13); expect(body.errors).toEqual([{ source: "ithome", label: "IT之家", error: "暂时无法连接订阅源" }]); expect(Number.isFinite(Date.parse(body.fetchedAt))).toBe(true);
  });
  it("returns a retryable error rather than silently accepting an HTML challenge", async () => { vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Unavailable</html>"))); const response = await onRequestGet({ request: new Request("https://www.yukino.bond/api/news?source=sspai") }); expect(response.status).toBe(503); expect(response.headers.get("Cache-Control")).toBe("no-store"); });
  it("falls back to the official Hacker News feed when the aggregator fails", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("hnrss.org")) return new Response("Unavailable", { status: 503 });
      return new Response('<rss><item><title>Official story</title><link>https://example.com/story</link></item></rss>');
    });
    vi.stubGlobal("fetch", fetcher);
    const response = await onRequestGet({ request: new Request("https://www.yukino.bond/api/news?source=hn") });
    expect(response.status).toBe(200); expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["https://hnrss.org/frontpage", "https://news.ycombinator.com/rss"]);
    const body = await response.json(); expect(body.sources[0]).toMatchObject({ key: "hn", available: true, count: 1 }); expect(body.errors).toEqual([]);
  });
  it("aborts an upstream request after eight seconds", async () => {
    vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(new Error("aborted"))))));
    const pending = onRequestGet({ request: new Request("https://www.yukino.bond/api/news?source=sspai") }); await vi.advanceTimersByTimeAsync(8000); const response = await pending; expect(response.status).toBe(503); expect((await response.json()).errors[0].error).toContain("超时");
  });
});
