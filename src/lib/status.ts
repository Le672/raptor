export type StatusTarget = { name: string; url: string; jsonKeys?: string[]; expectedStatus?: number; probe?: 'weather' | 'novel-detail' | 'novel-catalog' | 'jm-detail' | 'media-detail' | 'pixiv-detail' | 'news' | 'f1-season'; timeoutMs?: number };
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
  { name: "天气预报读取", url: "https://www.yukino.bond/api/weather?provider=auto&lat=23.13&lon=113.26&name=Guangzhou&region=Guangdong&country=CN&tz=Asia%2FShanghai", probe: 'weather' },
  ...(['open-meteo', 'met-no'] as const).map(provider => ({ name: `天气预报 · ${provider}`, url: `https://www.yukino.bond/api/weather?provider=${provider}&lat=23.13&lon=113.26&name=Guangzhou&region=Guangdong&country=CN&tz=Asia%2FShanghai`, probe: 'weather' as const })),
  { name: "小说详情与目录 · 哔哩轻小说", url: "https://novel.yukino.bond/api/books?source=bili", probe: 'novel-catalog', timeoutMs: 25000 },
  ...Object.entries({ '轻之文库': 'linovel-122429', '轻小说文库': 'wenku-1973', '开心果轻小说': 'kxg-7604', '轻小说百科': 'encyclopedia-3163', 'Re0 中文汉化': 'rezero-1' }).map(([name,id]) => ({ name: `小说详情与目录 · ${name}`, url: `https://novel.yukino.bond/api/book/${id}`, probe: 'novel-detail' as const, timeoutMs: 25000 })),
  { name: "姬漫搜索、详情和章节", url: "https://jm-api-yukino.3584643854.workers.dev/v1/search?q=love&page=1&category=0&order=mr&time=a", probe: 'jm-detail', timeoutMs: 25000 },
  { name: "影视目录及详情", url: "https://cinema.yukino.bond/api/catalog?category=series&genre=cn", probe: 'media-detail', timeoutMs: 25000 },
  { name: "番剧目录及详情", url: "https://comic.yukino.bond/api/catalog?category=jp", probe: 'media-detail', timeoutMs: 25000 },
  { name: "Pixiv 排行和作品详情", url: "https://pixiv.yukino.bond/api/ranking?mode=daily&page=1", probe: 'pixiv-detail', timeoutMs: 25000 },
  { name: "新闻内容读取", url: "https://www.yukino.bond/api/news", probe: 'news', timeoutMs: 20000 },
  { name: "F1 赛历和积分", url: "https://www.yukino.bond/api/f1?action=season", probe: 'f1-season', timeoutMs: 20000 },
];
export type ServiceCheck = { name: string; url: string; state: "reachable" | "error" | "unknown"; code: number | null; latency: number; checkedAt: string; detail: string };
export type StatusReport = { services: ServiceCheck[]; checkedAt: string };
export function httpState(code: number): ServiceCheck["state"] { return code >= 200 && code < 400 ? "reachable" : code === 403 || code === 429 ? "unknown" : "error"; }
