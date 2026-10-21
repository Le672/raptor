// Cloudflare Pages Function: GET /api/auth/me - Get current user info
// POST /api/auth/login - Login
// POST /api/auth/register - Register
// POST /api/auth/logout - Logout

import {
  getCurrentUser,
  verifyPassword,
  signJWT,
  jsonResponse,
  errorResponse,
  attachSharedSession,
  clearSharedSession,
  sameOriginMutation,
} from "../../_utils/auth";
import { authenticateMail, linkMailAccount, MailAuthError } from "../../_utils/mail-auth";

interface Env {
  DB: any;
  JWT_SECRET?: string;
}

export function onRequestOptions() {
  const response = jsonResponse(null);
  return new Response(null, { status: 204, headers: response.headers });
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const access = new URL(context.request.url).pathname.replace(/\/+$/, "").endsWith("/access");
  if (access && !context.request.headers.get("Authorization")?.startsWith("Bearer ")) return errorResponse("未登录", 401);
  const user = await getCurrentUser(context.request, context.env);
  if (!user) return errorResponse("未登录", 401);
  if (access) return jsonResponse({ user: { id: user.userId, name: user.name, role: user.role } });

  const { results } = await context.env.DB.prepare(
    "SELECT id, email, name, role, avatar_url, created_at FROM users WHERE id = ?",
  )
    .bind(user.userId)
    .all();

  if (!results || results.length === 0) return errorResponse("用户不存在", 404);

  const response = jsonResponse({ user: results[0] });
  const bearer = context.request.headers.get("Authorization");
  return bearer?.startsWith("Bearer ") ? attachSharedSession(response, context.request, bearer.slice(7), context.env) : response;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const url = new URL(context.request.url);
  const action = url.searchParams.get("action");
  if (!sameOriginMutation(context.request)) return errorResponse("请从本站提交登录或退出请求", 403);

  if (action === "login") return handleLogin(context);
  if (action === "register") return handleRegister(context);
  if (action === "logout") return handleLogout(context);

  return errorResponse("未知操作", 400);
}

async function handleLogin(context: { request: Request; env: Env }) {
  let body: any;
  try {
    const raw = await context.request.text();
    if (raw.length > 4096) return errorResponse("登录请求过大", 413);
    body = JSON.parse(raw);
  } catch { return errorResponse("请求格式错误", 400); }
  if (!body || typeof body.email !== "string" || typeof body.password !== "string" ||
      !body.email.trim() || !body.password || body.email.length > 254 || body.password.length > 512) {
    return errorResponse("请填写有效的邮箱和密码");
  }
  const email = body.email.trim().toLowerCase();
  const password = body.password;
  const source = body.source ?? "mail";
  if (!["mail", "local"].includes(source)) return errorResponse("请选择有效的登录方式");
  try {
    let user: any;
    if (source === "mail") {
      const profile = await authenticateMail(email, password);
      user = await linkMailAccount(context.env.DB, profile);
    } else {
      user = await context.env.DB.prepare(
        "SELECT id, email, name, role, password_hash FROM users WHERE lower(email) = ?",
      ).bind(email).first();
      if (!user || !await verifyPassword(password, user.password_hash)) {
        return errorResponse("邮箱或密码错误", 401);
      }
    }

    const token = await signJWT(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      context.env,
    );

    const response = jsonResponse({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
    return attachSharedSession(response, context.request, token, context.env);
  } catch (error) {
    if (error instanceof MailAuthError) return errorResponse(error.message, error.status);
    return errorResponse("主站登录服务暂时不可用，请稍后再试", 503);
  }
}

async function handleRegister(context: { request: Request; env: Env }) {
  return errorResponse("请在 mail.yukino.bond 注册邮箱账号，再回到主站登录", 403);
}

async function handleLogout(context: { request: Request; env: Env }) {
  // JWT is stateless, so logout is client-side (delete token)
  // We can optionally add the token to a blacklist table
  return clearSharedSession(jsonResponse({ message: "已退出登录" }), context.request);
}
