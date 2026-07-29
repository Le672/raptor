// Cloudflare Pages Function: News aggregator
// GET /api/news - 聚合多个 RSS 源，返回 JSON
// GET /api/news?source=ithome - 单个源

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sourceLabel: string;
}

interface FeedSource {
  key: string;
  label: string;
  url: string;
}

const FEEDS: FeedSource[] = [
  { key: "ithome", label: "IT之家", url: "https://www.ithome.com/rss/" },
  { key: "kr36", label: "36氪", url: "https://36kr.com/feed" },
  { key: "hn", label: "Hacker News", url: "https://hnrss.org/frontpage" },
  { key: "verge", label: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
];

// 从 RSS 2.0 / Atom XML 提取条目
function parseFeed(xml: string, source: FeedSource): NewsItem[] {
  const items: NewsItem[] = [];
  // RSS 2.0: <item>...</item>
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
    const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1]?.trim()
      || block.match(/<link[^>]*href="([^"]+)"/)?.[1]?.trim();
    const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/)?.[1]?.trim()
      || block.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/)?.[1]?.trim()
      || "";
    if (title && link) {
      items.push({
        title: decodeEntities(title),
        link: decodeEntities(link),
        pubDate,
        source: source.key,
        sourceLabel: source.label,
      });
    }
    if (items.length >= 15) break;
  }
  // Atom: <entry>...</entry>
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    while ((m = entryRegex.exec(xml)) !== null) {
      const block = m[1];
      const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
      const link = block.match(/<link[^>]*href="([^"]+)"/)?.[1]?.trim();
      const pubDate = block.match(/<published[^>]*>([\s\S]*?)<\/published>/)?.[1]?.trim()
        || block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/)?.[1]?.trim()
        || "";
      if (title && link) {
        items.push({
          title: decodeEntities(title),
          link,
          pubDate,
          source: source.key,
          sourceLabel: source.label,
        });
      }
      if (items.length >= 15) break;
    }
  }
  return items;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export async function onRequestGet(context: { request: Request }) {
  const url = new URL(context.request.url);
  const sourceKey = url.searchParams.get("source");

  const targets = sourceKey
    ? FEEDS.filter((f) => f.key === sourceKey)
    : FEEDS;

  if (targets.length === 0) {
    return new Response(JSON.stringify({ error: "未知源" }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const results = await Promise.allSettled(
    targets.map(async (feed) => {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; yukino-news/1.0)" },
      });
      if (!res.ok) throw new Error(`${feed.label} HTTP ${res.status}`);
      const xml = await res.text();
      return parseFeed(xml, feed);
    }),
  );

  const items: NewsItem[] = [];
  const errors: { source: string; error: string }[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") items.push(...r.value);
    else errors.push({ source: targets[i].label, error: String(r.reason) });
  });

  // 按时间倒序（粗略：有的源无 pubDate 则保持原序）
  items.sort((a, b) => {
    const ta = a.pubDate ? Date.parse(a.pubDate) : 0;
    const tb = b.pubDate ? Date.parse(b.pubDate) : 0;
    return tb - ta;
  });

  return new Response(JSON.stringify({ items, errors }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}
