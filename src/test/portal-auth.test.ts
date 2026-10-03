// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPortalDb } from "./fixtures/portal-db";
import { getCurrentUser, hashPassword, signJWT, verifyJWT } from "../../functions/_utils/auth";
import { authenticateMail, linkMailAccount } from "../../functions/_utils/mail-auth";
import { onRequestPost } from "../../functions/api/auth/[[path]]";
import { onRequestGet, onRequestPut } from "../../functions/api/uses";
import { DEFAULT_USES } from "../lib/uses";

let db: ReturnType<typeof createPortalDb>;
let env: { DB: ReturnType<typeof createPortalDb>; JWT_SECRET: string };
const fakeMailToken = "mail-session-only-for-unit-tests";
const mailProfile = { userId: 12, email: "reader@yukino.bond", name: "读者", type: 1, role: { name: "user" }, permKeys: [] };
const mailOk = (data: unknown) => new Response(JSON.stringify({ code: 200, data }), { status: 200 });
const setupMail = (profile = mailProfile) => {
  const fetcher = vi.fn().mockResolvedValueOnce(mailOk({ token: fakeMailToken })).mockResolvedValueOnce(mailOk(profile));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
};
const login = (body: unknown) => onRequestPost({
  request: new Request("https://www.yukino.bond/api/auth/me?action=login", { method: "POST", body: JSON.stringify(body) }), env,
});
const putUses = (content: unknown, revision: number, token?: string) => onRequestPut({
  request: new Request("https://www.yukino.bond/api/uses", {
    method: "PUT", headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ content, revision }),
  }), env,
});
async function addUser(role = "user", email = "local@yukino.bond") {
  const password = "local-test-password";
  await db.prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)")
    .bind(email, await hashPassword(password), "本地用户", role).run();
  const user = await db.prepare("SELECT id, email, name, role FROM users WHERE email = ?").bind(email).first() as any;
  const token = await signJWT({ userId: user.id, email, name: user.name, role }, env);
  return { user, token, password };
}
beforeEach(() => { db = createPortalDb(); env = { DB: db, JWT_SECRET: "a-private-test-signing-secret-for-the-portal" }; });
afterEach(() => { db.sqlite.close(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("mail account login and linking", () => {
  it("checks the real identity, links it once, and never returns or stores mailbox credentials", async () => {
    const fetcher = setupMail();
    const response = await login({ email: " Reader@Yukino.Bond ", password: "mail-test-password" });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user).toMatchObject({ email: mailProfile.email, name: "读者", role: "user" });
    expect((await verifyJWT(data.token, env))?.name).toBe("读者");
    expect(JSON.stringify(data)).not.toContain(fakeMailToken);
    expect(fetcher.mock.calls[0][0]).toBe("https://mail.yukino.bond/api/login");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ email: mailProfile.email, password: "mail-test-password" });
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe(fakeMailToken);
    const stored = await db.prepare("SELECT * FROM users WHERE id = ?").bind(data.user.id).first() as any;
    expect(stored.password_hash).toMatch(/^mail:/);
    expect(stored.password_hash).not.toContain("mail-test-password");
    setupMail();
    const again = await (await login({ email: mailProfile.email, password: "mail-test-password" })).json();
    expect(again.user.id).toBe(data.user.id);
    expect((await db.prepare("SELECT COUNT(*) AS n FROM mail_identities").first() as any).n).toBe(1);
  });

  it("only grants mail administrator rights when the provider confirms its super-admin identity", async () => {
    setupMail({ ...mailProfile, type: 0, role: { name: "admin" }, permKeys: ["*"] } as any);
    const admin = await (await login({ email: mailProfile.email, password: "password" })).json();
    expect(admin.user.role).toBe("admin");
    setupMail({ ...mailProfile, role: { name: "admin" } });
    const downgraded = await (await login({ email: mailProfile.email, password: "password" })).json();
    expect(downgraded.user.role).toBe("user");
    // Old administrator sessions now use the current role from D1.
    expect((await getCurrentUser(new Request("https://www.yukino.bond/", { headers: { Authorization: `Bearer ${admin.token}` } }), env))?.role).toBe("user");
  });

  it("retains the permissions and user ID of an existing portal admin after verified email linking", async () => {
    const { user } = await addUser("admin", mailProfile.email);
    setupMail();
    const result = await (await login({ email: mailProfile.email, password: "mail-password" })).json();
    expect(result.user).toMatchObject({ id: user.id, role: "admin" });
  });

  it("does not silently accept an old portal password when mailbox verification fails", async () => {
    const { password } = await addUser("user", mailProfile.email);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 500, message: "Incorrect password" }))));
    const response = await login({ email: mailProfile.email, password });
    expect(response.status).toBe(401);
    expect((await db.prepare("SELECT COUNT(*) AS n FROM users").first() as any).n).toBe(1);
  });

  it("rejects a profile that does not belong to the submitted email", async () => {
    setupMail({ ...mailProfile, email: "another@yukino.bond" });
    expect((await login({ email: mailProfile.email, password: "password" })).status).toBe(401);
    expect((await db.prepare("SELECT COUNT(*) AS n FROM users").first() as any).n).toBe(0);
  });

  it("fails safely when the provider is unavailable or returns HTML", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network unavailable")));
    await expect(authenticateMail(mailProfile.email, "password")).rejects.toMatchObject({ status: 503 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Unavailable</html>")));
    expect((await login({ email: mailProfile.email, password: "password" })).status).toBe(503);
  });

  it("rejects a replacement mailbox identity attempting to reuse an existing linked address", async () => {
    await linkMailAccount(db, { userId: "12", email: mailProfile.email, name: "Reader", isAdmin: false });
    await expect(linkMailAccount(db, { userId: "99", email: mailProfile.email, name: "Replacement", isAdmin: false })).rejects.toMatchObject({ status: 409 });
  });

  it("supports explicit legacy login without contacting the mailbox service", async () => {
    const { user, password } = await addUser("admin");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const response = await login({ email: user.email, password, source: "local" });
    expect(response.status).toBe(200);
    expect((await response.json()).user.role).toBe("admin");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("routes registration to the mailbox and never appoints a first registrant as admin", async () => {
    const response = await onRequestPost({ request: new Request("https://www.yukino.bond/api/auth/me?action=register", { method: "POST", body: "{}" }), env });
    expect(response.status).toBe(403);
    expect((await db.prepare("SELECT COUNT(*) AS n FROM users").first() as any).n).toBe(0);
  });
});

describe("published equipment list and server permissions", () => {
  it("returns the original public list before the first edit", async () => {
    const response = await onRequestGet({ request: new Request("https://www.yukino.bond/api/uses"), env });
    expect(await response.json()).toEqual({ content: DEFAULT_USES, revision: 0, updatedAt: null, canEdit: false });
  });

  it("persists an admin edit, serves it to a fresh visitor, and prevents stale overwrites", async () => {
    const { token } = await addUser("admin");
    const edited = structuredClone(DEFAULT_USES); edited.categories[0].items[0].value = "新主力电脑";
    expect((await putUses(edited, 0, token)).status).toBe(200);
    const publicResponse = await onRequestGet({ request: new Request("https://www.yukino.bond/api/uses"), env });
    const published = await publicResponse.json();
    expect(published.content.categories[0].items[0].value).toBe("新主力电脑");
    expect(published).toMatchObject({ revision: 1, canEdit: false });
    expect((await putUses(DEFAULT_USES, 0, token)).status).toBe(409);
    expect((await putUses(DEFAULT_USES, 1, token)).status).toBe(200);
    expect((await putUses(edited, 1, token)).status).toBe(409);
  });

  it("rejects anonymous writes and users whose token claims stale administrator rights", async () => {
    expect((await putUses(DEFAULT_USES, 0)).status).toBe(401);
    const { user } = await addUser("user");
    const staleAdmin = await signJWT({ userId: user.id, email: user.email, name: user.name, role: "admin" }, env);
    expect((await putUses(DEFAULT_USES, 0, staleAdmin)).status).toBe(403);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'site_content'").get()).toMatchObject({ n: 0 });
  });

  it("refuses unsigned identities, absent signing secrets, expired sessions, and malformed documents", async () => {
    const { token, user } = await addUser("admin");
    expect(await verifyJWT(token + "tampered", env)).toBeNull();
    expect(await verifyJWT(token, { DB: db })).toBeNull();
    await expect(signJWT({ userId: user.id, email: user.email, name: user.name, role: "admin" }, {})).rejects.toThrow("JWT_SECRET");
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 8 * 86400000);
    expect(await verifyJWT(token, env)).toBeNull();
    vi.restoreAllMocks();
    expect((await putUses({ ...DEFAULT_USES, categories: [{ ...DEFAULT_USES.categories[0], icon: "invalid" }] }, 0, token)).status).toBe(400);
    const duplicated = structuredClone(DEFAULT_USES); duplicated.categories[1].id = duplicated.categories[0].id;
    expect((await putUses(duplicated, 0, token)).status).toBe(400);
    expect((await putUses(DEFAULT_USES, -1, token)).status).toBe(400);
  });
});
