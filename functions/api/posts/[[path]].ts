// Cloudflare Pages Function: Blog posts API
// GET /api/posts - List posts
// GET /api/posts/:slug - Get single post
// POST /api/posts - Create post (admin)
// PUT /api/posts/:id - Update post (admin)
// DELETE /api/posts/:id - Delete post (admin)

import { getCurrentUser, jsonResponse, errorResponse } from "../../_utils/auth";

interface Env {
  DB: D1Database;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const url = new URL(context.request.url);
  const slug = url.searchParams.get("slug");
  const id = url.searchParams.get("id");

  if (slug) {
    const { results } = await context.env.DB.prepare(
      `SELECT p.*, u.name as author_name FROM posts p JOIN users u ON p.author_id = u.id WHERE p.slug = ? AND p.published = 1`,
    )
      .bind(slug)
      .all();
    if (!results || results.length === 0) return errorResponse("文章不存在", 404);
    return jsonResponse({ post: results[0] });
  }

  if (id) {
    const { results } = await context.env.DB.prepare(
      `SELECT p.*, u.name as author_name FROM posts p JOIN users u ON p.author_id = u.id WHERE p.id = ?`,
    )
      .bind(Number(id))
      .all();
    if (!results || results.length === 0) return errorResponse("文章不存在", 404);
    return jsonResponse({ post: results[0] });
  }

  // List published posts
  const { results } = await context.env.DB.prepare(
    `SELECT p.id, p.title, p.slug, p.summary, p.tag, p.created_at, p.updated_at, u.name as author_name FROM posts p JOIN users u ON p.author_id = u.id WHERE p.published = 1 ORDER BY p.created_at DESC`,
  ).all();

  return jsonResponse({ posts: results || [] });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const user = await getCurrentUser(context.request, context.env);
  if (!user) return errorResponse("未登录", 401);
  if (user.role !== "admin") return errorResponse("权限不足", 403);

  try {
    const body = await context.request.json();
    const { title, slug, summary, content, tag, published } = body;

    if (!title || !slug || !content)
      return errorResponse("标题、slug 和正文不能为空");

    // Check slug uniqueness
    const existing = await context.env.DB.prepare(
      "SELECT id FROM posts WHERE slug = ?",
    )
      .bind(slug)
      .all();
    if (existing.results && existing.results.length > 0)
      return errorResponse("该 slug 已被使用", 409);

    const result = await context.env.DB.prepare(
      `INSERT INTO posts (title, slug, summary, content, tag, author_id, published) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(title, slug, summary || "", content, tag || "随笔", user.userId, published ? 1 : 0)
      .run();

    return jsonResponse({ id: result.meta.last_row_id, message: "创建成功" }, 201);
  } catch {
    return errorResponse("请求格式错误", 400);
  }
}

export async function onRequestPut(context: { request: Request; env: Env }) {
  const user = await getCurrentUser(context.request, context.env);
  if (!user) return errorResponse("未登录", 401);
  if (user.role !== "admin") return errorResponse("权限不足", 403);

  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");
    if (!id) return errorResponse("缺少文章 ID", 400);

    const body = await context.request.json();
    const { title, slug, summary, content, tag, published } = body;

    await context.env.DB.prepare(
      `UPDATE posts SET title = ?, slug = ?, summary = ?, content = ?, tag = ?, published = ?, updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(title, slug, summary || "", content, tag || "随笔", published ? 1 : 0, Number(id))
      .run();

    return jsonResponse({ message: "更新成功" });
  } catch {
    return errorResponse("请求格式错误", 400);
  }
}

export async function onRequestDelete(context: { request: Request; env: Env }) {
  const user = await getCurrentUser(context.request, context.env);
  if (!user) return errorResponse("未登录", 401);
  if (user.role !== "admin") return errorResponse("权限不足", 403);

  const url = new URL(context.request.url);
  const id = url.searchParams.get("id");
  if (!id) return errorResponse("缺少文章 ID", 400);

  await context.env.DB.prepare("DELETE FROM posts WHERE id = ?")
    .bind(Number(id))
    .run();

  return jsonResponse({ message: "删除成功" });
}
