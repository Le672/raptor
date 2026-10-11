import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assessIp, ipInCidr, isPublicIp, normalizeIp, type IpSource } from "../lib/ip";

const source = (id: string, risk: number | null, extra: Partial<IpSource> = {}): IpSource => ({ id, name: id, href: `https://${id}.example/`, kind: "reputation", status: "ok", detail: "", risk, signals: {}, checkedAt: "2026-10-11T01:00:00Z", ...extra });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("public target addresses", () => {
  it("canonicalizes IPv6 and mapped IPv4 without treating URL syntax as an address", () => {
    expect(normalizeIp(" 2606:4700:4700:0000:0000:0000:0000:1111 ")).toEqual({ ip: "2606:4700:4700::1111", version: "IPv6" });
    expect(normalizeIp("::ffff:8.8.8.8")).toEqual({ ip: "8.8.8.8", version: "IPv4" });
    for (const bad of ["https://8.8.8.8/", "8.8.8.8:443", "[::1]", "example.com", "1.2.3.256", "1.2.03.4", "1.1.1.1,8.8.8.8", "1.1.1.1/24", "fe80::1%eth0", "1::2::3"]) expect(normalizeIp(bad)).toBeNull();
  });
  it("rejects private, CGNAT, multicast, documentation and mapped private addresses", () => {
    for (const ip of ["0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.1.1", "172.16.0.1", "192.168.1.1", "192.0.2.1", "198.18.1.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "255.255.255.255", "::", "::1", "fe80::1", "fc00::1", "ff02::1", "2001:db8::1", "2001:2::1", "3fff:1::1", "::ffff:192.168.1.1"]) expect(isPublicIp(ip), ip).toBe(false);
    for (const ip of ["8.8.8.8", "1.1.1.1", "100.63.255.254", "100.128.0.1", "172.32.0.1", "2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8"]) expect(isPublicIp(ip), ip).toBe(true);
  });
  it("matches CIDR boundaries for both address families and rejects malformed networks", () => {
    expect(ipInCidr("1.10.31.255", "1.10.16.0/20")).toBe(true);
    expect(ipInCidr("1.10.32.0", "1.10.16.0/20")).toBe(false);
    expect(ipInCidr("2001:678:254::ffff", "2001:678:254::/48")).toBe(true);
    expect(ipInCidr("2001:678:255::1", "2001:678:254::/48")).toBe(false);
    expect(ipInCidr("1.1.1.1", "0.0.0.0/0")).toBe(true);
    for (const bad of ["1.1.1.1", "1.1.1.1/33", "1.1.1.1/-1", "1.1.1.1/24/0", "::/129", "::/48"]) expect(ipInCidr("1.1.1.1", bad)).toBe(false);
  });
});

describe("explainable purity score", () => {
  it("does not dilute broad reputation evidence with clean narrow lists or missing sources", () => {
    const result = assessIp([source("one", 80), source("two", null, { status: "error" }), source("tor", null, { kind: "exit-list", signals: { tor: false } }), source("geo", null, { kind: "geolocation" })]);
    expect(result).toMatchObject({ purity: 20, risk: 80, baselineRisk: 80, scoredSources: 1, confidence: "limited" });
  });
  it("withholds a purity score when broad databases fail even when lists have no hits", () => {
    const result = assessIp([source("one", null, { status: "error" }), source("tor", null, { kind: "exit-list", signals: { tor: false } }), source("geo", null, { kind: "geolocation" })]);
    expect(result).toMatchObject({ purity: null, risk: null, confidence: "insufficient" });
    expect(result.signals.find(s => s.signal === "vpn")?.detected).toBeNull();
  });
  it("keeps upstream score disagreement and contradictory boolean detections visible", () => {
    const result = assessIp([source("one", 20, { signals: { hosting: true } }), source("two", 100, { signals: { hosting: false } })]);
    expect(result).toMatchObject({ purity: 40, baselineRisk: 60, riskRange: [20, 100], disagreement: true, confidence: "limited" });
    expect(result.signals.find(s => s.signal === "hosting")).toMatchObject({ detected: true, disagreement: true, positive: ["one"], negative: ["two"] });
  });
  it("uses the highest applicable floor once and retains the positive source evidence", () => {
    const result = assessIp([source("one", 0, { signals: { vpn: true, hosting: true } }), source("two", 0, { signals: { vpn: true } }), source("drop", null, { kind: "threat-list", signals: { drop: true } })]);
    expect(result).toMatchObject({ purity: 5, risk: 95, baselineRisk: 0 });
    expect(result.reasons.find(r => r.signal === "vpn")?.sources).toEqual(["one", "two"]);
    expect(result.reasons.filter(r => r.signal === "vpn")).toHaveLength(1);
  });
});

describe("visitor identity and multi-source service", () => {
  beforeEach(() => { vi.resetModules(); });
  function fakeSources(overrides: Record<string, Response | Error> = {}) {
    return vi.fn(async (address: string, options?: RequestInit) => {
      if (options?.redirect !== "manual") throw new TypeError("Unsupported Workers redirect mode");
      const url = new URL(address), ip = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) || "");
      const override = overrides[url.hostname]; if (override instanceof Error) throw override; if (override) return override.clone();
      const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
      if (url.hostname === "api.ipquery.io") return json({ ip, isp: { asn: "AS13335", org: "Cloudflare" }, location: { country: "Australia" }, risk: { risk_score: 10, is_proxy: false, is_vpn: false, is_tor: false, is_datacenter: false } });
      if (url.hostname === "proxycheck.io") return json({ status: "ok", [ip]: { network: { asn: "AS13335", provider: "Cloudflare" }, detections: { risk: 20, proxy: false, vpn: false, hosting: false, tor: false } } });
      if (url.hostname === "ipwho.is") return json({ success: true, ip, connection: { asn: 13335, isp: "Cloudflare" } });
      if (url.hostname === "check.torproject.org") return new Response("# exit list\n1.2.3.4\n", { headers: { "content-type": "text/plain" } });
      if (url.hostname === "www.spamhaus.org") return new Response(JSON.stringify({ cidr: "1.10.16.0/20", sblid: "SBL-test" }) + "\n" + JSON.stringify({ type: "metadata", timestamp: Math.floor(Date.now() / 1000), copyright: "(c) The Spamhaus Project SLU" }), { headers: { "content-type": "application/json" } });
      if (url.hostname === "feodotracker.abuse.ch") return json([]);
      throw new Error("Unexpected host");
    });
  }
  it("returns distinct identities for two visitors with no-store and ignores forwarded header guesses", async () => {
    const { onRequest } = await import("../../functions/api/ip/visitor");
    const request = (ip: string, asn: number, asOrganization: string) => Object.assign(new Request("https://www.yukino.bond/api/ip/visitor", { headers: { "CF-Connecting-IP": ip, "X-Forwarded-For": "6.6.6.6" } }), { cf: { asn, asOrganization } });
    const a = onRequest({ request: request("1.1.1.1", 13335, "Cloudflare") }), b = onRequest({ request: request("8.8.8.8", 15169, "Google") });
    expect(await a.json()).toMatchObject({ ip: "1.1.1.1", asn: "AS13335", organization: "Cloudflare" });
    expect(await b.json()).toMatchObject({ ip: "8.8.8.8", asn: "AS15169", organization: "Google" });
    for (const response of [a, b]) { expect(response.headers.get("cache-control")).toContain("no-store"); expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("no-store"); }
    const missing = onRequest({ request: new Request("https://test/api/ip/visitor", { headers: { "X-Forwarded-For": "1.1.1.1" } }) });
    expect(await missing.json()).toMatchObject({ ip: null, asn: null });
    const privateIp = onRequest({ request: request("127.0.0.1", 1, "local") }); expect((await privateIp.json()).ip).toBeNull();
  });
  it("combines actual supported schemas and retains feed copyright and observation dates", async () => {
    vi.stubGlobal("fetch", fakeSources()); const { inspectIp } = await import("../../functions/_utils/ip-service");
    const report = await inspectIp("1.1.1.1");
    expect(report.sources).toHaveLength(6); expect(report.assessment).toMatchObject({ purity: 85, baselineRisk: 15, scoredSources: 2, availableSources: 6, confidence: "good" });
    expect(report.sources.find(s => s.id === "spamhaus")).toMatchObject({ attribution: "(c) The Spamhaus Project SLU", signals: { drop: false } });
    expect(report.sources.find(s => s.id === "spamhaus")?.updatedAt).toBeTruthy();
  });
  it("retains completed sources when one is rate limited and coalesces repeated target requests", async () => {
    const fetcher = fakeSources({ "proxycheck.io": new Response("{}", { status: 429 }) }); vi.stubGlobal("fetch", fetcher);
    const { inspectIp } = await import("../../functions/_utils/ip-service");
    const [one, two] = await Promise.all([inspectIp("1.1.1.1"), inspectIp("1.1.1.1")]);
    expect(one.assessment).toMatchObject({ purity: 90, scoredSources: 1, confidence: "limited" });
    expect(one.sources.find(s => s.id === "proxycheck")).toMatchObject({ status: "error", risk: null, signals: {} });
    expect(two.ip).toBe("1.1.1.1"); expect(fetcher).toHaveBeenCalledTimes(6);
    await inspectIp("1.1.1.1"); expect(fetcher.mock.calls.filter(call => String(call[0]).includes("api.ipquery.io"))).toHaveLength(1);
  });
  it("rejects wrong-target responses and does not fabricate security data from a geolocation service", async () => {
    const wrong = new Response(JSON.stringify({ ip: "8.8.8.8", risk: { risk_score: 0 } }), { headers: { "content-type": "application/json" } });
    vi.stubGlobal("fetch", fakeSources({ "api.ipquery.io": wrong, "proxycheck.io": new Error("offline") })); const { inspectIp } = await import("../../functions/_utils/ip-service");
    const report = await inspectIp("1.1.1.1"); expect(report.assessment.purity).toBeNull();
    expect(report.sources.find(s => s.id === "ipwhois")).toMatchObject({ risk: null, signals: {}, status: "ok" });
  });
  it("does not disclose malformed provider response content or discard the other sources", async () => {
    const malformed = new Response("private-provider-diagnostic: invalid JSON", { headers: { "content-type": "application/json" } });
    vi.stubGlobal("fetch", fakeSources({ "api.ipquery.io": malformed })); const { inspectIp } = await import("../../functions/_utils/ip-service");
    const report = await inspectIp("1.1.1.1");
    expect(report.assessment).toMatchObject({ purity: 80, scoredSources: 1, confidence: "limited" });
    expect(report.sources.find(s => s.id === "ipquery")).toMatchObject({ status: "error", risk: null, detail: "数据源返回的数据格式异常，未纳入判断" });
    expect(JSON.stringify(report)).not.toContain("private-provider-diagnostic");
  });
  it("uses Workers-compatible manual mode and rejects an unexpected provider redirect", async () => {
    const moved = new Response(null, { status: 302, headers: { location: "https://unexpected.example/" } });
    const fetcher = fakeSources({ "api.ipquery.io": moved }); vi.stubGlobal("fetch", fetcher);
    const { inspectIp } = await import("../../functions/_utils/ip-service"); const report = await inspectIp("1.1.1.1");
    expect(report.assessment).toMatchObject({ purity: 80, scoredSources: 1 });
    expect(report.sources.find(s => s.id === "ipquery")).toMatchObject({ status: "error", detail: "数据源发生意外跳转，未纳入判断" });
    expect(fetcher.mock.calls.every(([, options]) => options?.redirect === "manual")).toBe(true);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("unexpected.example"))).toBe(false);
  });
  it("does not label unsupported IPv6 lists as clean and correctly matches a listed IPv6 subnet", async () => {
    const drop = new Response(JSON.stringify({ cidr: "2001:678:254::/48", sblid: "SBL-test" }) + "\n" + JSON.stringify({ type: "metadata", timestamp: Math.floor(Date.now() / 1000), copyright: "(c) Spamhaus" }), { headers: { "content-type": "application/json" } });
    const fetcher = fakeSources({ "www.spamhaus.org": drop }); vi.stubGlobal("fetch", fetcher); const { inspectIp } = await import("../../functions/_utils/ip-service");
    const report = await inspectIp("2001:678:254::123"); expect(report.assessment).toMatchObject({ purity: 5, risk: 95 });
    expect(report.sources.find(s => s.id === "tor")).toMatchObject({ status: "unsupported", signals: {} });
    expect(report.sources.find(s => s.id === "feodo")).toMatchObject({ status: "unsupported", signals: {} });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("does not turn an obsolete C2 feed into a clean result", async () => {
    const old = new Response(JSON.stringify([{ ip_address: "1.1.1.1", status: "online", last_online: "2010-01-01" }]), { headers: { "content-type": "application/json" } });
    vi.stubGlobal("fetch", fakeSources({ "feodotracker.abuse.ch": old })); const { inspectIp } = await import("../../functions/_utils/ip-service");
    const report = await inspectIp("1.1.1.1"); expect(report.sources.find(s => s.id === "feodo")).toMatchObject({ status: "error", signals: {} });
  });
  it("uses a shared fresh D1 feed without any additional feed downloads", async () => {
    const fetcher = fakeSources(); vi.stubGlobal("fetch", fetcher);
    const feedBodies = { tor: "1.2.3.4\n", spamhaus: JSON.stringify({ cidr: "1.10.16.0/20" }) + "\n" + JSON.stringify({ type: "metadata", timestamp: Math.floor(Date.now() / 1000), copyright: "(c) Spamhaus" }), feodo: "[]" };
    const DB = { prepare: vi.fn((sql: string) => ({ run: async () => ({ meta: { changes: 1 } }), bind: (url: string) => ({ first: async () => ({ body: url.includes("torproject") ? feedBodies.tor : url.includes("spamhaus") ? feedBodies.spamhaus : feedBodies.feodo, fetched_at: Date.now(), next_fetch_at: Date.now() + 3600000, updated_at: null }) }) })) };
    const { inspectIp } = await import("../../functions/_utils/ip-service"); const report = await inspectIp("1.1.1.1", { DB });
    expect(fetcher).toHaveBeenCalledTimes(3); expect(report.sources.filter(s => ["tor", "spamhaus", "feodo"].includes(s.id)).every(s => s.cached)).toBe(true);
    expect(report.assessment.purity).toBe(85);
  });
  it("does not refetch a feed when another edge location holds the shared refresh lease", async () => {
    const fetcher = fakeSources(); vi.stubGlobal("fetch", fetcher);
    const DB = { prepare: vi.fn((sql: string) => ({ run: async () => ({ meta: { changes: 1 } }), bind: () => ({ first: async () => null, run: async () => ({ meta: { changes: 0 } }) }) })) };
    const { inspectIp } = await import("../../functions/_utils/ip-service"); const report = await inspectIp("1.1.1.1", { DB });
    expect(fetcher).toHaveBeenCalledTimes(3); expect(report.sources.find(s => s.id === "spamhaus")).toMatchObject({ status: "error", signals: {} });
  });
  it("rejects private targets and unsupported methods before contacting an upstream", async () => {
    const fetcher = fakeSources(); vi.stubGlobal("fetch", fetcher); const { onRequest } = await import("../../functions/api/ip/check");
    const wrongMethod = await onRequest({ request: new Request("https://test/api/ip/check") }); expect(wrongMethod.status).toBe(405);
    const privateRequest = await onRequest({ request: new Request("https://test/api/ip/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ip: "::ffff:127.0.0.1" }) }) }); expect(privateRequest.status).toBe(400);
    const tooLarge = await onRequest({ request: new Request("https://test/api/ip/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ip: "1.1.1.1", padding: "x".repeat(1100) }) }) }); expect(tooLarge.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("returns a retry interval for a saturated visitor budget", async () => {
    const { allowIpQuery } = await import("../../functions/_utils/ip-service");
    const request = new Request("https://test/api/ip/check", { headers: { "CF-Connecting-IP": "1.1.1.1" } });
    for (let n = 0; n < 12; n++) expect(allowIpQuery(request)).toBe(true);
    const { onRequest } = await import("../../functions/api/ip/check"); const response = await onRequest({ request: new Request(request, { method: "POST", headers: { "CF-Connecting-IP": "1.1.1.1", "content-type": "application/json" }, body: JSON.stringify({ ip: "1.1.1.1" }) }) });
    expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("60");
  });
});
