import { getCurrentUser, jsonResponse, errorResponse } from "../../_utils/auth";
import { positiveId, validateBoxInput } from "../../../src/lib/content";
import type { PortalDatabase } from "../../_utils/db";
interface Env { DB: PortalDatabase }
type Context = { request: Request; env: Env };
async function requireAdmin(context: Context) {
  const user = await getCurrentUser(context.request, context.env);
  return !user ? errorResponse("未登录", 401) : user.role !== "admin" ? errorResponse("权限不足", 403) : user;
}
export async function onRequestGet(context: Context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM box_items ORDER BY sort_order ASC, created_at DESC, id DESC").all();
    return jsonResponse({ items: results ?? [] });
  } catch { return errorResponse("资源服务暂时不可用", 503); }
}
async function save(context: Context, update: boolean) {
  const user = await requireAdmin(context);
  if (user instanceof Response) return user;
  const id = positiveId(new URL(context.request.url).searchParams.get("id"));
  if (update && !id) return errorResponse("资源 ID 无效", 400);
  let input;
  try { input = validateBoxInput(await context.request.json()); }
  catch (error) { return errorResponse(error instanceof Error ? error.message : "请求格式错误", 400); }
  const { title, description, url, category, size, sort_order } = input;
  try {
    if (update) {
      const result = await context.env.DB.prepare("UPDATE box_items SET title = ?, description = ?, url = ?, category = ?, size = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(title, description, url, category, size, sort_order, id).run();
      return result.meta.changes ? jsonResponse({ message: "更新成功" }) : errorResponse("资源不存在", 404);
    }
    const result = await context.env.DB.prepare("INSERT INTO box_items (title, description, url, category, size, sort_order) VALUES (?, ?, ?, ?, ?, ?)").bind(title, description, url, category, size, sort_order).run();
    return jsonResponse({ id: result.meta.last_row_id, message: "创建成功" }, 201);
  } catch { return errorResponse("保存失败，请稍后重试", 503); }
}
export const onRequestPost = (context: Context) => save(context, false);
export const onRequestPut = (context: Context) => save(context, true);
export async function onRequestDelete(context: Context) {
  const user = await requireAdmin(context);
  if (user instanceof Response) return user;
  const id = positiveId(new URL(context.request.url).searchParams.get("id"));
  if (!id) return errorResponse("资源 ID 无效", 400);
  try {
    const result = await context.env.DB.prepare("DELETE FROM box_items WHERE id = ?").bind(id).run();
    return result.meta.changes ? jsonResponse({ message: "删除成功" }) : errorResponse("资源不存在", 404);
  } catch { return errorResponse("删除失败，请稍后重试", 503); }
}
