import { getCurrentUser, jsonResponse, errorResponse } from "../_utils/auth";
import { ensurePortalSchema } from "../_utils/portal-schema";
import { DEFAULT_USES, validateUsesDocument } from "../../src/lib/uses";

type Context = { request: Request; env: { DB: any; JWT_SECRET?: string } };

export async function onRequestGet({ request, env }: Context) {
  try {
    await ensurePortalSchema(env.DB);
    const row = await env.DB.prepare("SELECT value, revision, updated_at FROM site_content WHERE key = 'uses'").first();
    const user = await getCurrentUser(request, env);
    return jsonResponse({
      content: row ? validateUsesDocument(JSON.parse(row.value)) : DEFAULT_USES,
      revision: row?.revision ?? 0,
      updatedAt: row?.updated_at ?? null,
      canEdit: user?.role === "admin",
    });
  } catch {
    return errorResponse("暂时无法读取设备清单，请稍后重试", 503);
  }
}

export async function onRequestPut({ request, env }: Context) {
  const user = await getCurrentUser(request, env);
  if (!user) return errorResponse("请先登录管理员账号", 401);
  if (user.role !== "admin") return errorResponse("只有管理员可以编辑设备清单", 403);
  let content;
  let revision: number;
  try {
    const raw = await request.text();
    if (raw.length > 100000) return errorResponse("设备清单内容过大", 413);
    const body = JSON.parse(raw);
    if (!Number.isSafeInteger(body.revision) || body.revision < 0) return errorResponse("清单版本不正确");
    revision = body.revision;
    content = validateUsesDocument(body.content);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "清单格式不正确");
  }
  try {
    await ensurePortalSchema(env.DB);
    const now = new Date().toISOString();
    const statement = revision === 0
      ? env.DB.prepare(`INSERT OR IGNORE INTO site_content (key, value, revision, updated_at)
          VALUES ('uses', ?, 1, ?) RETURNING revision, updated_at`).bind(JSON.stringify(content), now)
      : env.DB.prepare(`UPDATE site_content SET value = ?, revision = revision + 1, updated_at = ?
          WHERE key = 'uses' AND revision = ? RETURNING revision, updated_at`).bind(JSON.stringify(content), now, revision);
    const saved = await statement.first();
    if (!saved) return errorResponse("清单已在别处更新，请重新打开页面后再编辑；本次修改尚未保存", 409);
    return jsonResponse({ content, revision: saved.revision, updatedAt: saved.updated_at, canEdit: true });
  } catch {
    return errorResponse("保存失败，请稍后重试；本次修改尚未保存", 503);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  } });
}
