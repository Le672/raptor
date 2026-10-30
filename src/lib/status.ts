export type StatusTarget = { name: string; url: string; jsonKeys?: string[]; expectedStatus?: number };
export const STATUS_TARGETS: StatusTarget[] = [
  { name: "主站", url: "https://www.yukino.bond/" },
  { name: "根域名跳转", url: "https://yukino.bond/" },
  ...["mail", "dev", "box", "blog", "links", "about", "uses", "changelog", "friends", "rss", "lab", "status", "news", "games", "focus", "cr", "f1", "speed", "jm", "novel", "comic", "cinema", "pixiv", "ip", "drop", "draw", "tools"].map(id => ({ name: `${id}.yukino.bond`, url: `https://${id}.yukino.bond/` })),
  { name: "主站登录接口", url: "https://www.yukino.bond/api/auth/access", jsonKeys: ["error"], expectedStatus: 401 },
  { name: "主站文章接口", url: "https://www.yukino.bond/api/posts", jsonKeys: ["posts"] },
  { name: "测速统计接口", url: "https://speed.yukino.bond/api/speed/totals", jsonKeys: ["bytes", "sessions"] },
  { name: "影视目录接口", url: "https://cinema.yukino.bond/api/sources", jsonKeys: ["data"] },
  { name: "番剧目录接口", url: "https://comic.yukino.bond/api/sources", jsonKeys: ["data"] },
  { name: "轻小说目录接口", url: "https://novel.yukino.bond/api/books", jsonKeys: ["data"] },
];
export type ServiceCheck = { name: string; url: string; state: "reachable" | "error" | "unknown"; code: number | null; latency: number; checkedAt: string; detail: string };
export type StatusReport = { services: ServiceCheck[]; checkedAt: string };
export function httpState(code: number): ServiceCheck["state"] { return code >= 200 && code < 400 ? "reachable" : code === 403 || code === 429 ? "unknown" : "error"; }
