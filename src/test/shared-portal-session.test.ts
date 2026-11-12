// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPortalDb } from "./fixtures/portal-db";
import { getAuthToken, getCurrentUser, hashPassword, SHARED_SESSION_COOKIE, signJWT } from "../../functions/_utils/auth";
import { onRequestGet, onRequestOptions, onRequestPost } from "../../functions/api/auth/[[path]]";
import { safeAuthReturn } from "../lib/auth-return";
import { createAccessGuard } from "../../shared/content-access.mjs";

const ORIGIN = "https://www.yukino.bond";
let db: ReturnType<typeof createPortalDb>;
let env: { DB: ReturnType<typeof createPortalDb>; JWT_SECRET: string };
let identity: { id: number; email: string; name: string; role: string };
beforeEach(async () => {
  db = createPortalDb(); env = { DB: db, JWT_SECRET: "private-shared-session-test-secret" };
  await db.prepare("INSERT INTO users (email,password_hash,name,role) VALUES (?,?,?,?)").bind("reader@yukino.bond", await hashPassword("test-password"), "读者", "user").run();
  identity = await db.prepare("SELECT id,email,name,role FROM users WHERE email = ?").bind("reader@yukino.bond").first() as typeof identity;
});
afterEach(() => { db.sqlite.close(); vi.restoreAllMocks(); });
const token = () => signJWT({ userId: identity.id, email: identity.email, name: identity.name, role: identity.role }, env);
const get = (path: string, headers: Record<string, string> = {}) => onRequestGet({ request: new Request(`${ORIGIN}/api/auth/${path}`, { headers }), env });
const post = (action: string, headers: Record<string, string> = {}, body?: unknown) => onRequestPost({ request: new Request(`${ORIGIN}/api/auth/me?action=${action}`, { method: "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) }), env });

describe("portal shared HttpOnly session", () => {
  it("issues the existing signed session as a secure shared cookie after login", async () => {
    const response = await post("login", { Origin: ORIGIN, "Sec-Fetch-Site": "same-origin" }, { email: identity.email, password: "test-password", source: "local" });
    expect(response.status).toBe(200);
    const body = await response.json(), cookie = response.headers.get("Set-Cookie")!;
    expect(cookie).toContain(`${SHARED_SESSION_COOKIE}=${body.token};`);
    for (const attr of ["Domain=yukino.bond", "Path=/", "HttpOnly", "Secure", "SameSite=Lax"]) expect(cookie).toContain(attr);
    expect(Number(cookie.match(/Max-Age=(\d+)/)?.[1])).toBeGreaterThanOrEqual(604799);
    expect(Number(cookie.match(/Max-Age=(\d+)/)?.[1])).toBeLessThanOrEqual(604800);
    expect((await get("me", { Cookie: `${SHARED_SESSION_COOKIE}=${body.token}` })).status).toBe(200);
  });

  it("migrates valid Bearer sessions with only their original remaining lifetime", async () => {
    const now = Date.now(); vi.spyOn(Date, "now").mockReturnValue(now);
    const signed = await token(); vi.mocked(Date.now).mockReturnValue(now + 3 * 86400000);
    const response = await get("me", { Authorization: `Bearer ${signed}` });
    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=345600");
    vi.mocked(Date.now).mockReturnValue(now + 8 * 86400000);
    const expired = await get("me", { Authorization: `Bearer ${signed}` });
    expect(expired.status).toBe(401); expect(expired.headers.has("Set-Cookie")).toBe(false);
  });

  it("keeps /access minimal, Bearer-only, based on current D1 role, and never mints a cookie", async () => {
    const signed = await token();
    expect((await get("access", { Cookie: `${SHARED_SESSION_COOKIE}=${signed}` })).status).toBe(401);
    await db.prepare("UPDATE users SET role = ? WHERE id = ?").bind("admin", identity.id).run();
    const response = await get("access", { Authorization: `Bearer ${signed}` });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: { id: identity.id, name: identity.name, role: "admin" } });
    expect(response.headers.has("Set-Cookie")).toBe(false);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects duplicate cookies and gives explicit Bearer headers precedence", async () => {
    const signed = await token(), cookie = `${SHARED_SESSION_COOKIE}=${signed}`;
    expect(getAuthToken(new Request(ORIGIN, { headers: { Cookie: `${cookie}; ${cookie}` } }))).toBeNull();
    expect(getAuthToken(new Request(ORIGIN, { headers: { Cookie: cookie, Authorization: "Bearer other" } }))).toBe("other");
  });

  it("blocks cookie-authenticated cross-origin writes including legacy cookies, preserving explicit Bearer clients", async () => {
    const signed = await token();
    for (const name of [SHARED_SESSION_COOKIE, "auth_token"]) {
      const request = (headers: Record<string, string>) => new Request(`${ORIGIN}/api/uses`, { method: "PUT", headers: { Cookie: `${name}=${signed}`, ...headers } });
      expect(await getCurrentUser(request({ Origin: "https://novel.yukino.bond", "Sec-Fetch-Site": "same-site" }), env)).toBeNull();
      expect(await getCurrentUser(request({}), env)).toBeNull();
      expect((await getCurrentUser(request({ Origin: ORIGIN, "Sec-Fetch-Site": "same-origin" }), env))?.userId).toBe(identity.id);
      expect((await getCurrentUser(request({ Authorization: `Bearer ${signed}` }), env))?.userId).toBe(identity.id);
    }
  });

  it("rejects login/logout from another origin and clears shared and legacy cookies on same-origin logout", async () => {
    for (const action of ["login", "logout"]) {
      const blocked = await post(action, { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site", Authorization: "Bearer invalid" });
      expect(blocked.status).toBe(403); expect(blocked.headers.has("Set-Cookie")).toBe(false);
    }
    const response = await post("logout", { Origin: ORIGIN, "Sec-Fetch-Site": "same-origin" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain(`${SHARED_SESSION_COOKIE}=; Domain=yukino.bond; Path=/; Max-Age=0;`);
    expect(response.headers.get("Set-Cookie")).toContain("auth_token=; Path=/; Max-Age=0;");
  });

  it("preserves cookie-free packaged clients without allowing native headers to authorize browser cookies", async () => {
    const body = { email: identity.email, password: "test-password", source: "local" };
    for (const origin of ["null", "capacitor://localhost", "http://localhost", "https://localhost"]) {
      const response = await post("login", { Origin: origin, "X-Yukino-Native": "1" }, body);
      expect(response.status).toBe(200);
      expect((await response.json()).user.id).toBe(identity.id);
      expect((await post("login", { Origin: origin }, body)).status).toBe(403);
      expect((await post("login", { Origin: origin, "X-Yukino-Native": "1", Cookie: "browser-session=present" }, body)).status).toBe(403);
    }
    expect((await post("login", { Origin: "https://evil.example", "X-Yukino-Native": "1" }, body)).status).toBe(403);
    const response = onRequestOptions();
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("X-Yukino-Native");
    expect(response.headers.has("Access-Control-Allow-Credentials")).toBe(false);
  });

  it("integrates a signed portal token and real D1 check with a content Worker's status and gated requests", async () => {
    const signed = await token();
    const fetcher = vi.fn(async (url: string, init: RequestInit) => onRequestGet({ request: new Request(url, init), env }));
    const guard = createAccessGuard("novel", { fetcher });
    const request = new Request("https://novel.yukino.bond/api/book/1/chapter/1", { headers: { Cookie: `${SHARED_SESSION_COOKIE}=${signed}`, "Sec-Fetch-Site": "same-origin" } });
    const status = await guard.status(request);
    expect(status.status).toBe(200);
    expect((await status.json()).user).toEqual({ id: identity.id, name: identity.name, role: "user" });
    expect(await guard.require(request)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(`${ORIGIN}/api/auth/access`);
    expect(fetcher.mock.calls[0][1].headers).toMatchObject({ Authorization: `Bearer ${signed}` });
    const anonymous = await guard.require(new Request("https://novel.yukino.bond/api/book/1/chapter/1"));
    expect(anonymous?.status).toBe(401);
  });
});

describe("safe content login return", () => {
  it("allows exact public content origins and preserves their path/query without placing a token in the URL", () => {
    for (const name of ["novel", "comic", "cinema"]) expect(safeAuthReturn(`https://${name}.yukino.bond/book/1?tab=2#chapter`)).toBe(`https://${name}.yukino.bond/book/1?tab=2#chapter`);
  });
  it("rejects outside domains, userinfo, ports, relative links and control/backslash ambiguities", () => {
    for (const value of [null, "/", "//novel.yukino.bond", "https:novel.yukino.bond", "http://novel.yukino.bond", "https://novel.yukino.bond.evil.example", "https://mail.yukino.bond/", "https://evil@novel.yukino.bond/", "https://novel.yukino.bond:8443/", "https://novel.yukino.bond\\@evil.example/", "https://novel.yukino.bond/%5cfoo", "https://novel.yukino.bond/%0afoo", "\nhttps://novel.yukino.bond/"]) expect(safeAuthReturn(value)).toBeNull();
  });
});
