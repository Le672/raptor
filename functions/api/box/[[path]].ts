// Cloudflare Pages Function: Box items API
// GET /api/box - List all box items
// POST /api/box - Create box item (admin)
// PUT /api/box/:id - Update box item (admin)
// DELETE /api/box/:id - Delete box item (admin)

import { getCurrentUser, jsonResponse, errorResponse } from "../../_utils/auth";

interface Env {
  DB: D1Database;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { results } = await context.env.DB.prepare(
    "SELECT * FROM box_items ORDER BY sort_order ASC, created_at DESC",
  ).all();

  return jsonResponse({ items: results || [] });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const user = await getCurrentUser(context.request, context.env);
  if (!user) return errorResponse("未登录", 401);
  if (user.role !== "admin") return errorResponse("权限不足", 403);

  try {
    const body = await context.request.json();
    const { title, description, url, category, size, sort_order } = body;

    if (!title || !url) return errorResponse("标题和链接不能为空");

    const result = await context.env.DB.prepare(
      `INSERT INTO box_items (title, description, url, category, size, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(title, description || "", url, category || "other", size || "", sort_order || 0)
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
    if (!id) return errorResponse("缺少 ID", 400);

    const body = await context.request.json();
    const { title, description, url: itemUrl, category, size, sort_order } = body;

    await context.env.DB.prepare(
      `UPDATE box_items SET title = ?, description = ?, url = ?, category = ?, size = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(title, description || "", itemUrl, category || "other", size || "", sort_order || 0, Number(id))
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
  if (!id) return errorResponse("缺少 ID", 400);

  await context.env.DB.prepare("DELETE FROM box_items WHERE id = ?")
    .bind(Number(id))
    .run();

  return jsonResponse({ message: "删除成功" });
}
