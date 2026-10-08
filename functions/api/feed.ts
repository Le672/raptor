import { postHref, type PostSummary } from "../../src/lib/content";
import { SITE_FEED, subscriptionsOpml, xmlEscape } from "../../src/lib/rss-catalog";
import type { PortalDatabase } from "../_utils/db";
const xmlHeaders = { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=60", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff" };
const rssDate = (value: string) => {
  const date = new Date(/^\d{4}-\d\d-\d\d /.test(value) ? value.replace(" ", "T") + "Z" : value);
  return Number.isFinite(date.getTime()) ? date.toUTCString() : null;
};
export function renderSiteFeed(posts: PostSummary[]) {
  const published = posts.filter(post => Boolean(post.published));
  const dates = published.map(post => rssDate(post.updated_at)).filter((value): value is string => !!value).sort((a, b) => Date.parse(b) - Date.parse(a));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Yukino 的笔记</title><link>https://www.yukino.bond/notes</link><description>写代码，也写字。开发记录、随笔与生活切片。</description><language>zh-CN</language><atom:link href="${SITE_FEED}" rel="self" type="application/rss+xml"/>${dates[0] ? `<lastBuildDate>${dates[0]}</lastBuildDate>` : ""}${published.map(post => {
    const link = xmlEscape(`https://www.yukino.bond${postHref(post.slug)}`), date = rssDate(post.created_at);
    return `<item><title>${xmlEscape(post.title)}</title><link>${link}</link><guid isPermaLink="false">yukino-post-${post.id}</guid><description>${xmlEscape(post.summary)}</description><category>${xmlEscape(post.tag)}</category>${date ? `<pubDate>${date}</pubDate>` : ""}</item>`;
  }).join("\n")}</channel></rss>`;
}
export async function onRequestGet({ request, env }: { request: Request; env: { DB: PortalDatabase } }) {
  if (new URL(request.url).searchParams.get("format") === "opml") return new Response(subscriptionsOpml(), { headers: { ...xmlHeaders, "Content-Type": "text/x-opml; charset=utf-8", "Content-Disposition": 'attachment; filename="yukino-subscriptions.opml"' } });
  try {
    const { results } = await env.DB.prepare("SELECT id, title, slug, summary, tag, published, created_at, updated_at FROM posts WHERE published = 1 ORDER BY created_at DESC, id DESC LIMIT 100").all<PostSummary>();
    return new Response(renderSiteFeed(results ?? []), { headers: xmlHeaders });
  } catch { return new Response("订阅服务暂时不可用，请稍后重试", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }); }
}
