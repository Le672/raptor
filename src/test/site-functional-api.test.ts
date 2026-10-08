// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createPortalDb } from "./fixtures/portal-db";
import { signJWT } from "../../functions/_utils/auth";
import * as posts from "../../functions/api/posts/[[path]]";
import * as box from "../../functions/api/box/[[path]]";
import { onRequestGet as feed, renderSiteFeed } from "../../functions/api/feed";
import { checkService } from "../../functions/api/status";
import { md5, base64, timestampDate, textCases, hexRgb, rgbHex, rgbHsl, hslRgb } from "../lib/dev-tools";
import { parseFocusBackup, restoreDeletedTasks } from "../lib/focus-data";
import { randomSnakeFood, stepSnake } from "../lib/snake";
import { dailyGameKey } from "../lib/daily-game";
import { SUBSCRIPTIONS, subscriptionsOpml } from "../lib/rss-catalog";
import { canonicalSlug, postHref } from "../lib/content";

let db: ReturnType<typeof createPortalDb>, env: any, admin: string, reader: string;
const article = { title: "测试笔记", slug: "test-note", summary: "摘要", content: "## 正文\n\n不要丢失这段正文", tag: "新分类", published: false };
const resource = { title: "工具", description: "官方链接", url: "https://example.com/", category: "software", size: "在线", sort_order: 1 };
beforeEach(async () => {
  db = createPortalDb(); env = { DB: db, JWT_SECRET: "a-private-test-signing-secret-for-the-portal" };
  db.sqlite.exec(`CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, summary TEXT DEFAULT '', content TEXT NOT NULL, tag TEXT DEFAULT '随笔', author_id INTEGER, published INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE box_items (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT DEFAULT '', url TEXT NOT NULL, category TEXT DEFAULT 'other', size TEXT DEFAULT '', sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    INSERT INTO users(email,password_hash,name,role) VALUES ('admin@example.com','test-only','管理员','admin'),('reader@example.com','test-only','读者','user');`);
  admin = await signJWT({ userId: 1, email: "admin@example.com", name: "管理员", role: "admin" }, env);
  reader = await signJWT({ userId: 2, email: "reader@example.com", name: "读者", role: "user" }, env);
});
afterEach(() => { db.sqlite.close(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const context = (path: string, method = "GET", body?: unknown, token?: string) => ({ request: new Request("https://www.yukino.bond/api/" + path, { method, headers: token ? { Authorization: "Bearer " + token } : {}, body: body === undefined ? undefined : JSON.stringify(body) }), env });
describe("published content and administrator editing", () => {
  it("keeps drafts private, lists them for admins, loads full content and publishes the same record", async () => {
    const created = await posts.onRequestPost(context("posts", "POST", article, admin)); expect(created.status).toBe(201);
    const { id } = await created.json();
    expect((await posts.onRequestGet(context("posts?id=" + id))).status).toBe(401);
    expect((await posts.onRequestGet(context("posts?id=" + id, "GET", undefined, reader))).status).toBe(403);
    expect((await posts.onRequestGet(context("posts?slug=test-note"))).status).toBe(404);
    expect((await (await posts.onRequestGet(context("posts"))).json()).posts).toEqual([]);
    const list = await (await posts.onRequestGet(context("posts?admin=1", "GET", undefined, admin))).json(); expect(list.posts[0].published).toBe(0);
    expect((await (await posts.onRequestGet(context("posts?id=" + id, "GET", undefined, admin))).json()).post.content).toBe(article.content);
    expect((await posts.onRequestPut(context("posts?id=" + id, "PUT", { ...article, published: true }, admin))).status).toBe(200);
    expect((await (await posts.onRequestGet(context("posts?slug=test-note"))).json()).post.content).toBe(article.content);
    const xml = await (await feed(context("feed"))).text(); expect(xml).toContain("测试笔记"); expect(xml).toContain("yukino-post-" + id);
  });
  it("requires current server roles and validates writes, unique slugs and missing records", async () => {
    expect((await posts.onRequestPost(context("posts", "POST", article))).status).toBe(401);
    expect((await posts.onRequestPost(context("posts", "POST", article, reader))).status).toBe(403);
    expect((await posts.onRequestGet(context("posts?admin=1", "GET", undefined, reader))).status).toBe(403);
    expect((await posts.onRequestPost(context("posts", "POST", { ...article, slug: "bad/slug" }, admin))).status).toBe(400);
    expect((await posts.onRequestPost(context("posts", "POST", { ...article, content: " " }, admin))).status).toBe(400);
    await posts.onRequestPost(context("posts", "POST", article, admin));
    await posts.onRequestPost(context("posts", "POST", { ...article, slug: "other-note" }, admin));
    expect((await posts.onRequestPut(context("posts?id=2", "PUT", article, admin))).status).toBe(409);
    expect((await posts.onRequestPut(context("posts?id=999", "PUT", article, admin))).status).toBe(404);
    expect((await posts.onRequestDelete(context("posts?id=NaN", "DELETE", undefined, admin))).status).toBe(400);
    expect((await posts.onRequestDelete(context("posts?id=999", "DELETE", undefined, admin))).status).toBe(404);
    db.sqlite.exec("UPDATE users SET role='user' WHERE id=1");
    expect((await posts.onRequestDelete(context("posts?id=1", "DELETE", undefined, admin))).status).toBe(403);
  });
  it("maintains old article URLs and prevents private articles entering RSS", async () => {
    await posts.onRequestPost(context("posts", "POST", { ...article, slug: "domain-structure", published: true }, admin));
    await posts.onRequestPost(context("posts", "POST", { ...article, title: "私密草稿", slug: "private" }, admin));
    expect((await (await posts.onRequestGet(context("posts?slug=personal-domain"))).json()).post.slug).toBe("domain-structure");
    const xml = await (await feed(context("feed"))).text(); expect(xml).not.toContain("私密草稿"); expect(xml).toContain("post=domain-structure");
    const escaped = renderSiteFeed([{ ...article, id: 3, published: true, title: "<script>&标题", created_at: "2026-10-08 01:00:00", updated_at: "2026-10-08 02:00:00", author_name: "Yukino" }]);
    expect(escaped).toContain("&lt;script&gt;&amp;标题"); expect(escaped).toContain("Thu, 08 Oct 2026 01:00:00 GMT");
    expect(subscriptionsOpml().match(/<outline /g)).toHaveLength(SUBSCRIPTIONS.length);
  });
  it.each([
    ["personal-domain", "domain-structure"],
    ["domain-portal", "domain-structure"],
    ["developer-tools", "dev-tools-design"],
    ["resource-box", "box-vs-download"],
    ["personal-pages", "essential-pages"],
  ])("resolves legacy %s to the existing published slug %s", async (legacy, canonical) => {
    await posts.onRequestPost(context("posts", "POST", { ...article, slug: canonical, published: true }, admin));
    const response = await posts.onRequestGet(context("posts?slug=" + legacy));
    expect(response.status).toBe(200);
    expect((await response.json()).post).toMatchObject({ slug: canonical, content: article.content });
    const direct = await posts.onRequestGet(context("posts?slug=" + canonical));
    expect(direct.status).toBe(200);
    expect(canonicalSlug(legacy)).toBe(canonical);
    expect(postHref(legacy)).toBe("/blog?post=" + canonical);
  });
  it("accepts real resource edits and rejects unsafe links, invalid ordering and unauthorized users", async () => {
    expect((await box.onRequestPost(context("box", "POST", resource, reader))).status).toBe(403);
    for (const url of ["javascript:alert(1)", "https://user:password@example.com", "not-a-url"]) expect((await box.onRequestPost(context("box", "POST", { ...resource, url }, admin))).status).toBe(400);
    expect((await box.onRequestPost(context("box", "POST", { ...resource, sort_order: 1.5 }, admin))).status).toBe(400);
    const { id } = await (await box.onRequestPost(context("box", "POST", resource, admin))).json();
    expect((await box.onRequestPut(context("box?id=" + id, "PUT", { ...resource, title: "已更新" }, admin))).status).toBe(200);
    expect((await (await box.onRequestGet(context("box"))).json()).items[0].title).toBe("已更新");
    expect((await box.onRequestDelete(context("box?id=" + id, "DELETE", undefined, admin))).status).toBe(200);
    expect((await (await box.onRequestGet(context("box"))).json()).items).toEqual([]);
    expect((await box.onRequestPut(context("box?id=" + id, "PUT", resource, admin))).status).toBe(404);
  });
});
describe("correct local tools and backups", () => {
  it.each(["", "a", "abc", "message digest", "中文🌸", " ", "a".repeat(120)])("matches independent MD5 for %s", value => expect(md5(value)).toBe(createHash("md5").update(value, "utf8").digest("hex")));
  it.each(["你好🌸", " ", "line\nline", "a\tb"])("preserves UTF-8 and whitespace through Base64: %s", value => expect(base64(base64(value, false), true)).toBe(value));
  it("rejects extreme timestamps and handles negative, decimal and explicit millisecond values", () => {
    expect(() => timestampDate("999999999999999999999999999999" )).toThrow();
    expect(() => timestampDate("not-number")).toThrow();
    expect(timestampDate("-1", "seconds").toISOString()).toBe("1969-12-31T23:59:59.000Z");
    expect(timestampDate("1.5", "seconds").getTime()).toBe(1500); expect(timestampDate("1234", "milliseconds").getTime()).toBe(1234);
  });
  it("converts camel case, acronyms, Unicode and all color representations", () => {
    expect(textCases("HTTPServer helloWorld 中文 文本").snake).toBe("http_server_hello_world_中文_文本");
    expect(hexRgb("#f00")).toEqual({ r: 255, g: 0, b: 0 }); expect(hexRgb("#GGG")).toBeNull();
    expect(rgbHex({ r: 12.5, g: 300, b: -2 })).toBe("#0DFF00");
    expect(hslRgb({ h: 120, s: 100, l: 50 })).toEqual({ r: 0, g: 255, b: 0 }); expect(rgbHsl({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 100, l: 50 });
  });
  it("restores a validated backup and preserves new tasks when undoing deletion", () => {
    const one = { id: "old", text: "原有任务", done: false }, two = { id: "new", text: "新任务", done: false };
    expect(restoreDeletedTasks([two], [one])).toEqual([two, one]);
    const data = { version: 1, tasks: [one], notes: "笔记", logs: [], settings: { focus: 25, short: 5, long: 15 } };
    expect(parseFocusBackup(JSON.stringify(data))).toEqual(data);
    for (const invalid of [{ ...data, version: 2 }, { ...data, tasks: [one, one] }, { ...data, logs: [{ id: "bad-date", date: "2026-02-30", seconds: 60 }] }, { ...data, settings: { focus: -1 } }]) expect(() => parseFocusBackup(JSON.stringify(invalid))).toThrow();
  });
  it("handles a full snake board and movement into a departing tail without freezing", () => {
    expect(randomSnakeFood(Array.from({ length: 400 }, (_, id) => ({ x: id % 20, y: Math.floor(id / 20) })))).toBeNull();
    expect(stepSnake([{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 }, { x: 0, y: 1 }], "left", { x: 5, y: 5 }).over).toBe(false);
    expect(stepSnake([{ x: 0, y: 0 }], "left", null).over).toBe(true);
    expect(dailyGameKey("2026-02-30")).toBeNull(); expect(dailyGameKey("2026-10-08")).toBe("2026-10-08");
  });
});
describe("honest HTTP service checks", () => {
  it.each([[200, "reachable"], [522, "error"], [403, "unknown"], [429, "unknown"]])("reports HTTP %i accurately", async (code, state) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: Number(code) })));
    expect(await checkService({ name: "测试", url: "https://example.com" })).toMatchObject({ code, state });
  });
  it("reports connection errors as unconfirmed and supports HEAD fallback", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await checkService({ name: "测试", url: "https://example.com" })).toMatchObject({ code: null, state: "unknown" });
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 405 })).mockResolvedValueOnce(new Response("ok")); vi.stubGlobal("fetch", fetcher);
    expect((await checkService({ name: "测试", url: "https://example.com" })).state).toBe("reachable"); expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("focus subdomain deployment guard", () => {
  async function deployment(domains: unknown[], records: unknown[] = []) {
    const actions: { url: string; method: string; body?: any }[] = [], warnings: string[] = [];
    const source = readFileSync(new URL("../../scripts/ensure-focus-domain.mjs", import.meta.url), "utf8").replace(/^import .*;\r?\n/m, "");
    await runInNewContext(`(async () => { ${source} })()`, {
      process: { env: { CLOUDFLARE_ACCOUNT_ID: "test-account", CLOUDFLARE_API_TOKEN: "test-only-token" } },
      console: { log: () => {}, warn: (message: string) => warnings.push(message) },
      AbortSignal, appendFile: async () => {},
      fetch: async (url: string, options: any) => {
        actions.push({ url, method: options.method ?? "GET", body: options.body ? JSON.parse(options.body) : undefined });
        const result = url.includes("dns_records") ? records : url.endsWith("/domains") ? options.method === "POST" ? { name: "focus.yukino.bond", status: "pending", zone_tag: "test-zone" } : domains : { subdomain: "raptor-20g.pages.dev" };
        return { ok: true, status: 200, json: async () => ({ success: true, result }) };
      },
    });
    return { actions, warnings };
  }
  it("preserves the DNS of an active focus domain", async () => {
    const { actions } = await deployment([{ name: "focus.yukino.bond", status: "active" }]);
    expect(actions.every(action => action.method === "GET")).toBe(true);
    expect(actions.some(action => action.url.includes("dns_records"))).toBe(false);
  });
  it("attaches a missing focus domain and creates only its missing CNAME", async () => {
    const { actions } = await deployment([]);
    const writes = actions.filter(action => action.method !== "GET");
    expect(writes).toHaveLength(2);
    expect(writes[0].body).toEqual({ name: "focus.yukino.bond" });
    expect(writes[1].body).toEqual({ type: "CNAME", name: "focus.yukino.bond", content: "raptor-20g.pages.dev", proxied: true });
  });
  it("reports conflicting DNS and does not replace the existing record", async () => {
    const { actions, warnings } = await deployment([{ name: "focus.yukino.bond", status: "pending", zone_tag: "test-zone" }], [{ type: "A", content: "192.0.2.1" }]);
    expect(actions.every(action => action.method === "GET")).toBe(true);
    expect(warnings.join(" ")).toContain("existing records were preserved");
  });
});
