import { NEWS_FEEDS } from "./news";
export const SITE_FEED = "https://www.yukino.bond/api/feed";
export type Subscription = { title: string; url: string; feedUrl: string; category: string; desc: string };
const extras: Subscription[] = [
  { title: "Yukino 的笔记", url: "https://www.yukino.bond/notes", feedUrl: SITE_FEED, category: "本站", desc: "本站已发布的开发笔记与生活记录。" },
  { title: "GitHub Trending", url: "https://github.com/trending", feedUrl: "https://mshibanami.github.io/GitHubTrendingRSS/daily/all.xml", category: "开发", desc: "社区维护的 GitHub 每日热门项目订阅源。" },
  { title: "Dev.to", url: "https://dev.to", feedUrl: "https://dev.to/feed", category: "开发", desc: "开发者社区的最新文章。" },
  { title: "CSS-Tricks", url: "https://css-tricks.com", feedUrl: "https://css-tricks.com/feed/", category: "前端", desc: "CSS 技巧与前端开发。" },
  { title: "Smashing Magazine", url: "https://www.smashingmagazine.com", feedUrl: "https://www.smashingmagazine.com/feed/", category: "设计", desc: "Web 设计与前端开发文章。" },
];
export const SUBSCRIPTIONS: Subscription[] = [...extras, ...NEWS_FEEDS.map(source => ({ title: source.label, url: source.website, feedUrl: source.key === "hn" ? "https://news.ycombinator.com/rss" : source.url, category: source.category, desc: `${source.category}资讯 · ${source.language === "zh" ? "中文" : "English"}` }))];
export const xmlEscape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
export function subscriptionsOpml(items = SUBSCRIPTIONS) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0"><head><title>Yukino 订阅源</title></head><body>${items.map(feed => `<outline type="rss" text="${xmlEscape(feed.title)}" title="${xmlEscape(feed.title)}" xmlUrl="${xmlEscape(feed.feedUrl)}" htmlUrl="${xmlEscape(feed.url)}"/>`).join("\n")}</body></opml>`;
}
