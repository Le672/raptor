import assert from "node:assert/strict";
import { test } from "node:test";
import gateway from "./worker.mjs";

test("an unrelated hostname cannot choose an upstream", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("must not fetch"); };
  try { assert.equal((await gateway.fetch(new Request("https://evil.example/?url=https://example.org"))).status, 404); }
  finally { globalThis.fetch = original; }
});

test("streams a protected upload once and returns a canonical share redirect", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options, body: await new Response(options.body).text() });
    return new Response(null, { status: 302, headers: { Location: "https://31.56.233.214:9443/drop/pasta/one?key=test", "Set-Cookie": "session=test; HttpOnly; Secure" } });
  };
  try {
    const result = await gateway.fetch(new Request("https://drop.yukino.bond/upload?x=1", {
      method: "POST", body: "content=sample&uploader_password=sample",
      headers: { Cookie: "session=sample", Host: "drop.yukino.bond", "Content-Type": "application/x-www-form-urlencoded" },
    }));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://31.56.233.214:9443/drop/upload?x=1");
    assert.equal(calls[0].body, "content=sample&uploader_password=sample");
    assert.equal(calls[0].options.headers.get("host"), null);
    assert.equal(calls[0].options.headers.get("cookie"), "session=sample");
    assert.equal(calls[0].options.redirect, "manual");
    assert.equal(result.headers.get("Location"), "https://drop.yukino.bond/pasta/one?key=test");
    assert.equal(result.headers.get("Cache-Control"), "no-store");
    assert.equal(result.headers.get("Set-Cookie"), "session=test; HttpOnly; Secure");
  } finally { globalThis.fetch = original; }
});

test("a network or TLS failure does not retry an uncertain upload", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("TLS verification failed"); };
  try {
    const result = await gateway.fetch(new Request("https://drop.yukino.bond/upload", { method: "POST", body: "sample" }));
    assert.equal(result.status, 503);
    assert.equal(calls, 1);
    assert.match(await result.text(), /先确认结果/);
  } finally { globalThis.fetch = original; }
});

test("a path resembling an authority still uses the fixed tools origin", async () => {
  const original = globalThis.fetch;
  let requested;
  globalThis.fetch = async url => { requested = url; return new Response("tool"); };
  try {
    assert.equal((await gateway.fetch(new Request("https://tools.yukino.bond//example.org/a?b=2"))).status, 200);
    assert.equal(requested, "https://31.56.233.214:9445//example.org/a?b=2");
  } finally { globalThis.fetch = original; }
});
