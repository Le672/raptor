import { ensurePortalSchema } from "./portal-schema";

const MAIL_API = "https://mail.yukino.bond/api";
export class MailAuthError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export type MailProfile = {
  userId: string;
  email: string;
  name: string;
  isAdmin: boolean;
};

async function mailRequest(path: string, init: RequestInit): Promise<any> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    response = await fetch(`${MAIL_API}${path}`, {
      ...init,
      redirect: "manual",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = /1042|same.?zone|workers? route/i.test(message) ? "worker-route"
      : /abort|timeout/i.test(message) ? "timeout"
      : /redirect/i.test(message) ? "redirect"
      : /implement|not a function/i.test(message) ? "runtime" : "network";
    throw new MailAuthError(`邮箱登录服务暂时无法连接，请稍后再试（${code}）`, 503);
  } finally {
    clearTimeout(timeout);
  }
  let result: any;
  try { result = await response.json(); } catch {
    throw new MailAuthError("邮箱登录服务暂时不可用，请稍后再试", 503);
  }
  if (response.status === 429 || result?.code === 429) {
    throw new MailAuthError("登录尝试过于频繁，请稍后再试", 429);
  }
  // Cloud Mail returns application errors in JSON even when HTTP is 200.
  if (!response.ok || result?.code !== 200) {
    if (response.status >= 500 || [502, 503, 504].includes(result?.code)) {
      throw new MailAuthError("邮箱登录服务暂时不可用，请稍后再试", 503);
    }
    throw new MailAuthError("邮箱账号或密码错误，或该账号暂不可用", 401);
  }
  return result.data;
}

export async function authenticateMail(email: string, password: string): Promise<MailProfile> {
  const login = await mailRequest("/login", { method: "POST", body: JSON.stringify({ email, password }) });
  if (typeof login?.token !== "string" || !login.token || login.token.length > 8192) {
    throw new MailAuthError("邮箱登录服务返回了无效身份，请稍后再试", 503);
  }
  // The mailbox token stays on the server; the browser receives a portal token.
  const profile = await mailRequest("/my/loginUserInfo", {
    method: "GET", headers: { Authorization: login.token },
  });
  if (!Number.isSafeInteger(profile?.userId) || profile.userId <= 0 ||
      typeof profile.email !== "string" || profile.email.toLowerCase() !== email ||
      typeof profile.name !== "string") {
    throw new MailAuthError("邮箱账号身份验证失败，请重新登录", 401);
  }
  return {
    userId: String(profile.userId),
    email: profile.email.toLowerCase(),
    name: profile.name.slice(0, 80) || email.split("@")[0],
    isAdmin: profile.type === 0 && profile.role?.name === "admin" &&
      Array.isArray(profile.permKeys) && profile.permKeys.includes("*"),
  };
}

export async function linkMailAccount(db: any, profile: MailProfile): Promise<any> {
  await ensurePortalSchema(db);
  const linked = await db.prepare(`SELECT u.id, u.email, u.name, u.role
    FROM mail_identities m JOIN users u ON u.id = m.user_id WHERE m.mail_user_id = ?`)
    .bind(profile.userId).first();
  let user = linked || await db.prepare("SELECT id, email, name, role FROM users WHERE lower(email) = ?")
    .bind(profile.email).first();
  const existed = Boolean(user);
  if (!user) {
    // This is deliberately not a hash of the mailbox password. New linked
    // accounts have no legacy portal password and use mailbox verification.
    await db.prepare("INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)")
      .bind(profile.email, `mail:${crypto.randomUUID()}`, profile.name, "user").run();
    user = await db.prepare("SELECT id, email, name, role FROM users WHERE lower(email) = ?")
      .bind(profile.email).first();
  }
  if (!user) throw new Error("Unable to link mailbox identity");
  const previous = await db.prepare("SELECT mail_user_id, portal_role FROM mail_identities WHERE user_id = ?")
    .bind(user.id).first();
  if (previous && previous.mail_user_id !== profile.userId) {
    throw new MailAuthError("该邮箱已关联另一账号，请联系管理员处理", 409);
  }
  const portalRole = previous?.portal_role ?? (existed ? user.role : "user");
  await db.batch([
    db.prepare(`INSERT INTO mail_identities (mail_user_id, user_id, portal_role) VALUES (?, ?, ?)
      ON CONFLICT(mail_user_id) DO NOTHING`).bind(profile.userId, user.id, portalRole),
    db.prepare(`UPDATE users SET email = ?, name = ?, role = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(profile.email, profile.name, profile.isAdmin || portalRole === "admin" ? "admin" : "user", user.id),
  ]);
  return db.prepare("SELECT id, email, name, role FROM users WHERE id = ?").bind(user.id).first();
}
