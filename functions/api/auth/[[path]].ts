// Cloudflare Pages Function: GET /api/auth/me - Get current user info
// POST /api/auth/login - Login
// POST /api/auth/register - Register
// POST /api/auth/logout - Logout

import {
  getCurrentUser,
  hashPassword,
  verifyPassword,
  signJWT,
  jsonResponse,
  errorResponse,
} from "../../_utils/auth";

interface Env {
  DB: D1Database;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const user = await getCurrentUser(context.request, context.env);
  if (!user) return errorResponse("未登录", 401);

  const { results } = await context.env.DB.prepare(
    "SELECT id, email, name, role, avatar_url, created_at FROM users WHERE id = ?",
  )
    .bind(user.userId)
    .all();

  if (!results || results.length === 0) return errorResponse("用户不存在", 404);

  return jsonResponse({ user: results[0] });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const url = new URL(context.request.url);
  const action = url.searchParams.get("action");

  if (action === "login") return handleLogin(context);
  if (action === "register") return handleRegister(context);
  if (action === "logout") return handleLogout(context);

  return errorResponse("未知操作", 400);
}

async function handleLogin(context: { request: Request; env: Env }) {
  try {
    const body = await context.request.json();
    const { email, password } = body;

    if (!email || !password) return errorResponse("邮箱和密码不能为空");

    const { results } = await context.env.DB.prepare(
      "SELECT id, email, name, role, password_hash FROM users WHERE email = ?",
    )
      .bind(email)
      .all();

    if (!results || results.length === 0)
      return errorResponse("邮箱或密码错误", 401);

    const user = results[0];
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return errorResponse("邮箱或密码错误", 401);

    const token = await signJWT(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      context.env,
    );

    return jsonResponse({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch {
    return errorResponse("请求格式错误", 400);
  }
}

async function handleRegister(context: { request: Request; env: Env }) {
  try {
    const body = await context.request.json();
    const { email, password, name } = body;

    if (!email || !password || !name)
      return errorResponse("邮箱、密码和昵称不能为空");

    if (password.length < 6) return errorResponse("密码至少 6 位");

    // Check if email already exists
    const existing = await context.env.DB.prepare(
      "SELECT id FROM users WHERE email = ?",
    )
      .bind(email)
      .all();

    if (existing.results && existing.results.length > 0)
      return errorResponse("该邮箱已被注册", 409);

    const passwordHash = await hashPassword(password);

    // Check if this is the first user -> make them admin
    const userCount = await context.env.DB.prepare(
      "SELECT COUNT(*) as count FROM users",
    ).all();

    const isFirstUser =
      userCount.results &&
      (userCount.results[0] as any).count === 0;

    const role = isFirstUser ? "admin" : "user";

    const result = await context.env.DB.prepare(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)",
    )
      .bind(email, passwordHash, name, role)
      .run();

    const userId = result.meta.last_row_id;

    const token = await signJWT(
      {
        userId,
        email,
        role,
        name,
      },
      context.env,
    );

    return jsonResponse(
      {
        token,
        user: { id: userId, email, name, role },
      },
      201,
    );
  } catch {
    return errorResponse("请求格式错误", 400);
  }
}

async function handleLogout(_context: { request: Request; env: Env }) {
  // JWT is stateless, so logout is client-side (delete token)
  // We can optionally add the token to a blacklist table
  return jsonResponse({ message: "已退出登录" });
}
