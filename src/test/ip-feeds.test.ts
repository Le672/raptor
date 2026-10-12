import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compactIpsum, parseCins, parseDshield, parseIpsum } from "../../functions/_utils/ip-feeds";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-12T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

describe("public IP feed provenance and scope", () => {
  it("matches DShield /24 ranges including padded IPv4 without attributing a user's behavior", () => {
    const feed = "# updated: 2026-10-12T00:45:42.801641\n001.002.003.000\t001.002.003.255\t24\t331\tTEST\n";
    expect(parseDshield(feed, "1.2.3.23")).toMatchObject({ updatedAt: "2026-10-12T00:45:42.801Z", match: { cidr: "1.2.3.0/24", targets: 331 } });
    expect(parseDshield(feed, "1.2.4.23").match).toBeUndefined();
  });
  it("rejects a missing or obsolete DShield date and a malformed range", () => {
    for (const feed of [
      "1.2.3.0\t1.2.3.255\t24\t1\n",
      "# updated: 2010-01-01T00:00:00\n1.2.3.0\t1.2.3.255\t24\t1\n",
      "# updated: 2026-10-12T00:00:00\n1.2.3.0\t1.2.4.255\t24\t1\n",
      "# updated: 2026-10-12T00:00:00\n<html>error</html>\n",
    ]) expect(() => parseDshield(feed, "1.2.3.23")).toThrow();
  });
  it("requires a recent CINS modification date and valid exact addresses", () => {
    expect(parseCins("1.2.3.4\n2.3.4.5\n", "Mon, 12 Oct 2026 01:04:01 GMT").addresses).toEqual(["1.2.3.4", "2.3.4.5"]);
    for (const [body, date] of [["1.2.3.4", undefined], ["", "2026-10-12"], ["1.2.3.4\nprivate error", "2026-10-12"], ["1.2.3.4", "2026-10-01"]]) expect(() => parseCins(body!, date)).toThrow();
  });
  it("keeps IPsum date and three-list threshold while reducing storage size", () => {
    const body = "# IPsum\n# Last update: Mon, 12 Oct 2026 03:01:06 +0200\n1.2.3.4\t2\n1.2.3.5\t3\n1.2.3.6\t12\n";
    expect(parseIpsum(body)).toEqual({ updatedAt: "2026-10-12T01:01:06.000Z", rows: [{ ip: "1.2.3.5", count: 3 }, { ip: "1.2.3.6", count: 12 }] });
    const compact = compactIpsum(body);
    expect(compact).not.toContain("1.2.3.4"); expect(parseIpsum(compact)).toEqual(parseIpsum(body));
  });
  it("rejects stale, empty or malformed aggregated records instead of claiming a clean result", () => {
    for (const body of ["1.2.3.4\t3", "# Last update: 2010-01-01\n1.2.3.4\t3", "# Last update: 2026-10-12\n", "# Last update: 2026-10-12\n1.2.3.4\trisk=0", "# Last update: 2026-10-12\nnot-an-ip\t3"]) expect(() => parseIpsum(body)).toThrow();
    expect(() => compactIpsum("# Last update: 2026-10-12\n1.2.3.4\t2")).toThrow();
  });
});
