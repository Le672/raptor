export type NewsCategory = "科技" | "开发" | "科学" | "国际";
export type FeedSource = { key: string; label: string; url: string; fallbackUrls?: string[]; website: string; category: NewsCategory; language: "zh" | "en" };
export const NEWS_FEEDS: FeedSource[] = [
  { key: "ithome", label: "IT之家", url: "https://www.ithome.com/rss/", website: "https://www.ithome.com/", category: "科技", language: "zh" },
  { key: "ruanyifeng", label: "阮一峰的网络日志", url: "https://www.ruanyifeng.com/blog/atom.xml", website: "https://www.ruanyifeng.com/blog/", category: "开发", language: "zh" },
  { key: "sspai", label: "少数派", url: "https://sspai.com/feed", website: "https://sspai.com/", category: "科技", language: "zh" },
  { key: "solidot", label: "Solidot", url: "https://www.solidot.org/index.rss", website: "https://www.solidot.org/", category: "科技", language: "zh" },
  { key: "hn", label: "Hacker News", url: "https://hnrss.org/frontpage", fallbackUrls: ["https://news.ycombinator.com/rss"], website: "https://news.ycombinator.com/", category: "开发", language: "en" },
  { key: "verge", label: "The Verge", url: "https://www.theverge.com/rss/index.xml", website: "https://www.theverge.com/", category: "科技", language: "en" },
  { key: "ars", label: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", website: "https://arstechnica.com/", category: "科技", language: "en" },
  { key: "github", label: "GitHub Blog", url: "https://github.blog/feed/", website: "https://github.blog/", category: "开发", language: "en" },
  { key: "cloudflare", label: "Cloudflare Blog", url: "https://blog.cloudflare.com/rss/", website: "https://blog.cloudflare.com/", category: "开发", language: "en" },
  { key: "mozilla", label: "Mozilla Hacks", url: "https://hacks.mozilla.org/feed/", website: "https://hacks.mozilla.org/", category: "开发", language: "en" },
  { key: "nasa", label: "NASA", url: "https://www.nasa.gov/feed/", website: "https://www.nasa.gov/", category: "科学", language: "en" },
  { key: "bbc", label: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", website: "https://www.bbc.com/news/world", category: "国际", language: "en" },
  { key: "nyt", label: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", website: "https://www.nytimes.com/section/world", category: "国际", language: "en" },
  { key: "guardian", label: "The Guardian", url: "https://www.theguardian.com/world/rss", website: "https://www.theguardian.com/world", category: "国际", language: "en" },
];
export type NewsItem = { title: string; link: string; pubDate: string; source: string; sourceLabel: string; category: NewsCategory; language: "zh" | "en" };
export type NewsSourceStatus = { key: string; label: string; count: number; available: boolean; fetchedAt: string };
export type NewsResponse = { items: NewsItem[]; errors: { source: string; label: string; error: string }[]; sources: NewsSourceStatus[]; fetchedAt: string };
export function isNewsItem(value: unknown): value is NewsItem {
  if (!value || typeof value !== "object") return false;
  const item = value as NewsItem;
  return typeof item.title === "string" && !!item.title.trim() && item.title.length <= 500 && typeof item.link === "string" && /^https?:\/\//i.test(item.link) && item.link.length <= 2048 && typeof item.pubDate === "string" && item.pubDate.length <= 50 && NEWS_FEEDS.some((feed) => feed.key === item.source && feed.category === item.category && feed.language === item.language) && typeof item.sourceLabel === "string" && item.sourceLabel.length <= 80;
}
export const isNewsList = (value: unknown): value is NewsItem[] => Array.isArray(value) && value.length <= 200 && value.every(isNewsItem);
export function feedsToOpml(feeds = NEWS_FEEDS) {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0"><head><title>Yukino 新闻订阅源</title></head><body>${feeds.map((feed) => `<outline type="rss" text="${escape(feed.label)}" title="${escape(feed.label)}" xmlUrl="${escape(feed.url)}" htmlUrl="${escape(feed.website)}"/>`).join("\n")}</body></opml>`;
}
