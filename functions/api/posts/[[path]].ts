import { getCurrentUser, jsonResponse, errorResponse } from "../../_utils/auth";
import { canonicalSlug, positiveId, validatePostInput } from "../../../src/lib/content";

import type { PortalDatabase } from "../../_utils/db";
interface Env { DB: PortalDatabase }
type Context = { request: Request; env: Env };
async function requireAdmin(context: Context) {
  const user = await getCurrentUser(context.request, context.env);
  return !user ? errorResponse("未登录", 401) : user.role !== "admin" ? errorResponse("权限不足", 403) : user;
}
const select = "SELECT p.*, u.name AS author_name FROM posts p JOIN users u ON p.author_id = u.id";
export async function onRequestGet(context: Context) {
  const params = new URL(context.request.url).searchParams;
  const slug = params.get("slug"), rawId = params.get("id");
  try {
    if (params.get("admin") === "1") {
      const user = await requireAdmin(context);
      if (user instanceof Response) return user;
      const { results } = await context.env.DB.prepare("SELECT p.id, p.title, p.slug, p.summary, p.tag, p.published, p.created_at, p.updated_at, u.name AS author_name FROM posts p JOIN users u ON p.author_id = u.id ORDER BY p.created_at DESC, p.id DESC").all();
      return jsonResponse({ posts: results ?? [] });
    }
    if (slug || rawId) {
      let condition = "p.slug = ? AND p.published = 1", value: string | number = canonicalSlug(slug ?? "");
      if (rawId) {
        const id = positiveId(rawId);
        if (!id) return errorResponse("文章 ID 无效", 400);
        const user = await requireAdmin(context);
        if (user instanceof Response) return user;
        condition = "p.id = ?"; value = id;
      }
      const post = await context.env.DB.prepare(`${select} WHERE ${condition}`).bind(value).first();
      return post ? jsonResponse({ post }) : errorResponse("文章不存在或尚未发布", 404);
    }
    const { results } = await context.env.DB.prepare("SELECT p.id, p.title, p.slug, p.summary, p.tag, p.published, p.created_at, p.updated_at, u.name AS author_name FROM posts p JOIN users u ON p.author_id = u.id WHERE p.published = 1 ORDER BY p.created_at DESC, p.id DESC").all();
    return jsonResponse({ posts: results ?? [] });
  } catch { return errorResponse("文章服务暂时不可用", 503); }
}
async function save(context: Context, update: boolean) {
  const user = await requireAdmin(context);
  if (user instanceof Response) return user;
  const id = positiveId(new URL(context.request.url).searchParams.get("id"));
  if (update && !id) return errorResponse("文章 ID 无效", 400);
  let input;
  try { input = validatePostInput(await context.request.json()); }
  catch (error) { return errorResponse(error instanceof Error ? error.message : "请求格式错误", 400); }
  try {
    if (update && !await context.env.DB.prepare("SELECT id FROM posts WHERE id = ?").bind(id).first()) return errorResponse("文章不存在", 404);
    const existing = await context.env.DB.prepare("SELECT id FROM posts WHERE slug = ? AND id != ?").bind(input.slug, id ?? -1).first();
    if (existing) return errorResponse("该 slug 已被使用", 409);
    const { title, slug, summary, content, tag, published } = input;
    if (update) {
      await context.env.DB.prepare("UPDATE posts SET title = ?, slug = ?, summary = ?, content = ?, tag = ?, published = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(title, slug, summary, content, tag, published ? 1 : 0, id).run();
      return jsonResponse({ message: "更新成功" });
    }
    const result = await context.env.DB.prepare("INSERT INTO posts (title, slug, summary, content, tag, author_id, published) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(title, slug, summary, content, tag, user.userId, published ? 1 : 0).run();
    return jsonResponse({ id: result.meta.last_row_id, message: "创建成功" }, 201);
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) return errorResponse("该 slug 已被使用", 409);
    return errorResponse("保存失败，请稍后重试", 503);
  }
}
export const onRequestPost = (context: Context) => save(context, false);
export const onRequestPut = (context: Context) => save(context, true);
export async function onRequestDelete(context: Context) {
  const user = await requireAdmin(context);
  if (user instanceof Response) return user;
  const id = positiveId(new URL(context.request.url).searchParams.get("id"));
  if (!id) return errorResponse("文章 ID 无效", 400);
  try {
    const result = await context.env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
    return result.meta.changes ? jsonResponse({ message: "删除成功" }) : errorResponse("文章不存在", 404);
  } catch { return errorResponse("删除失败，请稍后重试", 503); }
}
