export type PostInput = { title: string; slug: string; summary: string; content: string; tag: string; published: boolean };
export type Post = Omit<PostInput, "published"> & { id: number; published: boolean | number; created_at: string; updated_at: string; author_name: string };
export type PostSummary = Omit<Post, "content">;
export type BoxInput = { title: string; description: string; url: string; category: string; size: string; sort_order: number };
export type BoxItem = BoxInput & { id: number; created_at: string; updated_at: string };

const aliases: Record<string, string> = { "personal-domain": "domain-portal", "resource-box": "box-vs-download", "personal-pages": "essential-pages" };
export const canonicalSlug = (slug: string) => aliases[slug] ?? slug;
export const postHref = (slug: string) => `/blog?post=${encodeURIComponent(canonicalSlug(slug))}`;
export function contentDate(value: string) {
  const normalized = /^\d{4}-\d\d-\d\d \d\d:/.test(value) ? value.replace(" ", "T") + "Z" : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? "日期未提供" : date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}
export function safeHttpUrl(value: string): string | null {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
function text(value: unknown, max: number, fallback = ""): string {
  if (value == null) return fallback;
  if (typeof value !== "string" || value.length > max) throw new Error(`文本格式错误或超过 ${max} 字`);
  return value.trim();
}
export function validatePostInput(value: unknown): PostInput {
  if (!value || typeof value !== "object") throw new Error("请求格式错误");
  const input = value as Record<string, unknown>;
  const title = text(input.title, 200), slug = text(input.slug, 160), content = text(input.content, 100000);
  if (!title || !slug || !content) throw new Error("标题、slug 和正文不能为空");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("slug 请使用小写英文、数字和单个连字符");
  if (typeof input.published !== "boolean") throw new Error("请选择文章发布状态");
  return { title, slug, content, summary: text(input.summary, 1000), tag: text(input.tag, 40, "随笔") || "随笔", published: input.published };
}
export function validateBoxInput(value: unknown): BoxInput {
  if (!value || typeof value !== "object") throw new Error("请求格式错误");
  const input = value as Record<string, unknown>;
  const title = text(input.title, 200), url = safeHttpUrl(text(input.url, 2000));
  if (!title || !url) throw new Error("请填写标题和有效的 http / https 链接");
  const category = text(input.category, 40, "other") || "other";
  if (!["software", "document", "media", "other"].includes(category)) throw new Error("资源分类无效");
  const order = input.sort_order ?? 0;
  if (!Number.isSafeInteger(order) || Math.abs(Number(order)) > 1000000) throw new Error("排序值必须是 -1000000 到 1000000 的整数");
  return { title, url, category, description: text(input.description, 2000), size: text(input.size, 100), sort_order: Number(order) };
}
export function positiveId(value: string | null) { return value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null; }
