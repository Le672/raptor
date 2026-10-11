import { describe, expect, it } from "vitest";
import { AI_SITE_POLICIES } from "../data/ai-access-policies";
import { assessIp, type IpReport, type IpSource } from "../lib/ip";
import { assessAiSites, getIpCountries } from "../lib/ip-ai-risk";

const time = "2026-10-11T12:00:00Z";
const source = (id: string, extra: Partial<IpSource> = {}): IpSource => ({
  id, name: id, href: `https://${id}.example`, kind: "reputation", status: "ok", detail: "", risk: 0,
  signals: { vpn: false, proxy: false, tor: false, hosting: false }, country: "United States", countryCode: "US", checkedAt: time, ...extra,
});
const report = (sources: IpSource[], ip = "8.8.8.8"): IpReport => ({ ip, version: "IPv4", checkedAt: time, model: "yukino-ip-v1", sources, assessment: assessIp(sources) });
const forSite = (result: ReturnType<typeof assessAiSites>, id: string) => result.sites.find(item => item.policy.id === id)!;

describe("AI website risk with independent network and region evidence", () => {
  it("keeps low network risk separate from unpublished regional eligibility", () => {
    const result = assessAiSites(report([source("first"), source("second")]));
    expect(result.sites).toHaveLength(6);
    expect(result.network.level).toBe("low");
    for (const id of ["chatgpt", "claude", "gemini"]) expect(forSite(result, id)).toMatchObject({ level: "low", region: { status: "listed" } });
    for (const id of ["copilot", "perplexity", "grok"]) expect(forSite(result, id)).toMatchObject({ level: "unknown", region: { status: "unknown" } });
  });
  it("flags known mainland China restrictions even with perfect reputation scores", () => {
    const result = assessAiSites(report([source("first", { country: "China", countryCode: "CN" }), source("second", { country: "China", countryCode: "CN" })]));
    expect(result.network.level).toBe("low");
    for (const id of ["chatgpt", "claude", "gemini", "copilot"]) expect(forSite(result, id)).toMatchObject({ level: "high", region: { status: "restricted" } });
    expect(forSite(result, "gemini").region.detail).toContain("Workspace");
    expect(forSite(result, "grok").region.status).toBe("unknown");
  });
  it("does not apply mainland restrictions to Hong Kong or infer global availability", () => {
    const result = assessAiSites(report([source("first", { country: "Hong Kong", countryCode: "HK" }), source("second", { country: "Hong Kong", countryCode: "HK" })]));
    expect(forSite(result, "chatgpt").region.status).toBe("restricted");
    expect(forSite(result, "claude").region.status).toBe("restricted");
    expect(forSite(result, "gemini").region.status).toBe("listed");
    expect(forSite(result, "copilot").region.status).toBe("unknown");
  });
  it("recognizes less common supported countries and keeps vague territory descriptions conditional", () => {
    const caboVerde = assessAiSites(report([source("first", { country: "Cabo Verde", countryCode: undefined }), source("second", { country: "Cape Verde", countryCode: "CV" })]));
    expect(caboVerde.countries).toHaveLength(1);
    for (const id of ["chatgpt", "claude", "gemini"]) expect(forSite(caboVerde, id).region.status).toBe("listed");
    const islands = assessAiSites(report([source("first", { country: "Northern Mariana Islands", countryCode: "MP" })]));
    expect(forSite(islands, "claude").region.status).toBe("unknown");
    const ukraine = assessAiSites(report([source("first", { country: "Ukraine", countryCode: "UA" })]));
    expect(forSite(ukraine, "chatgpt").region.status).toBe("unknown");
  });
  it("retains cross-provider and within-provider country conflicts without choosing one", () => {
    for (const sources of [
      [source("first"), source("second", { country: "China", countryCode: "CN" })],
      [source("first", { country: "China", countryCode: "US" }), source("second")],
    ]) {
      const result = assessAiSites(report(sources));
      expect(result.countries).toHaveLength(2);
      expect(result.sites.every(site => site.region.status === "conflict")).toBe(true);
      expect(result.sites.every(site => site.level === "unknown")).toBe(true);
    }
  });
  it("does not treat missing or invalid geography as an unsupported country", () => {
    const result = assessAiSites(report([source("first", { country: "Unknown", countryCode: "ZZ" }), source("second", { country: undefined, countryCode: undefined })]));
    expect(result.countries).toHaveLength(0);
    expect(result.sites.every(site => site.region.status === "unknown")).toBe(true);
    expect(getIpCountries([source("failed", { status: "error", country: "China", countryCode: "CN" })])).toHaveLength(0);
  });
  it("withholds low-risk claims for a single database, missing signals or contradictory scores", () => {
    for (const sources of [
      [source("first")],
      [source("first", { signals: {} }), source("second", { signals: {} })],
      [source("first"), source("second", { risk: 40 })],
      [source("first", { risk: null, status: "error" }), source("second", { risk: null, status: "error" })],
    ]) expect(assessAiSites(report(sources)).network.level).toBe("unknown");
  });
  it("retains explicit adverse evidence even when broad scoring is unavailable", () => {
    const blocked = assessAiSites(report([source("list", { kind: "threat-list", risk: null, signals: { drop: true } })]));
    expect(blocked.network.level).toBe("high");
    expect(blocked.network.reasons.join(" ")).toContain("list");
    expect(blocked.network.reasons.join(" ")).toContain("未给出完整分数");
    const failed = assessAiSites(report([source("list", { kind: "threat-list", status: "error", risk: null, signals: { drop: true } })]));
    expect(failed.network.level).toBe("unknown");
  });
  it("keeps limitations visible even when the result already warrants a warning", () => {
    const conflicting = assessAiSites(report([source("first"), source("second", { risk: 80 })]));
    expect(conflicting.network.level).toBe("caution");
    expect(conflicting.network.reasons.join(" ")).toContain("有分歧");
    const partial = assessAiSites(report([source("first", { risk: 80 })]));
    expect(partial.network.level).toBe("high");
    expect(partial.network.reasons.join(" ")).toContain("不足两家");
  });
  it("warns about hosting despite high purity without inventing a ban probability", () => {
    const result = assessAiSites(report([source("first", { signals: { hosting: true } }), source("second", { signals: { hosting: true } })]));
    expect(result.network.level).toBe("caution");
    expect(result.network.reasons.join(" ")).toContain("机房 / 托管");
    expect(result.network.reasons.join(" ")).toContain("80 / 100");
  });
  it("keeps target-country inference independent of the page visitor and maintains official references", () => {
    const result = assessAiSites(report([source("target", { country: "Japan", countryCode: "JP" }), source("other", { country: "Japan", countryCode: "JP" })], "1.1.1.1"));
    expect(result.countries.map(item => item.code)).toEqual(["JP"]);
    expect(forSite(result, "chatgpt").region.status).toBe("listed");
    for (const policy of AI_SITE_POLICIES) {
      expect(policy.links.length).toBeGreaterThan(0);
      expect(policy.links.every(link => link.href.startsWith("https://"))).toBe(true);
    }
  });
});
