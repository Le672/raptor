export const STATUS_TARGETS = [
  { name: "主站", url: "https://www.yukino.bond/" },
  { name: "根域名跳转", url: "https://yukino.bond/" },
  ...["mail", "dev", "box", "blog", "links", "about", "uses", "changelog", "friends", "rss", "lab", "status", "news", "games", "focus", "cr", "f1", "jm"].map(id => ({ name: `${id}.yukino.bond`, url: `https://${id}.yukino.bond/` })),
];
export type ServiceCheck = { name: string; url: string; state: "reachable" | "error" | "unknown"; code: number | null; latency: number; checkedAt: string; detail: string };
export type StatusReport = { services: ServiceCheck[]; checkedAt: string };
export function httpState(code: number): ServiceCheck["state"] { return code >= 200 && code < 400 ? "reachable" : code === 403 || code === 429 ? "unknown" : "error"; }
