import { FeedSource, NewsItem } from "../../src/lib/news";

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”" };
export function decodeFeedText(text: string) {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (original, entity: string) => {
    if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? original;
    const point = parseInt(entity.slice(entity[1].toLowerCase() === "x" ? 2 : 1), entity[1].toLowerCase() === "x" ? 16 : 10);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : "";
  }).trim();
}
function tag(block: string, names: string[]) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`, "i"));
    if (match) return decodeFeedText(match[1]);
  }
  return "";
}
export function canonicalNewsUrl(value: string, base: string) {
  try {
    const url = new URL(decodeFeedText(value), base);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    url.hash = "";
    return url.href.length <= 2048 ? url.href : null;
  } catch { return null; }
}
export function parseFeed(xml: string, source: FeedSource, limit = 25): NewsItem[] {
  const entries = /<(?:[\w-]+:)?(item|entry)\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?\1\s*>/gi;
  const items: NewsItem[] = []; const seen = new Set<string>(); let match: RegExpExecArray | null;
  while ((match = entries.exec(xml)) !== null && items.length < limit) {
    const block = match[2];
    const title = tag(block, ["title", "atom:title"]).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").slice(0, 300);
    let rawLink = tag(block, ["link"]);
    if (!rawLink) {
      const links = block.match(/<(?:atom:)?link\b[^>]*\/?\s*>/gi) ?? [];
      const alternate = links.find((link) => /\brel\s*=\s*["']alternate["']/i.test(link)) ?? links.find((link) => !/\brel\s*=/i.test(link));
      rawLink = alternate?.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2] ?? "";
    }
    if (!title || !rawLink) continue;
    const link = canonicalNewsUrl(rawLink, source.url); if (!link || seen.has(link)) continue;
    const rawDate = tag(block, ["pubDate", "published", "updated", "dc:date", "atom:published", "atom:updated"]);
    const date = Date.parse(rawDate);
    items.push({ title, link, pubDate: Number.isFinite(date) ? new Date(date).toISOString() : "", source: source.key, sourceLabel: source.label, category: source.category, language: source.language });
    seen.add(link);
  }
  return items;
}
