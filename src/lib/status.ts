import { APPS } from '../../shared/pwa/sites.mjs';
import { SOURCES as LIGHT_SOURCES } from '../../novel/shared/sources.mjs';
import { SOURCES as FICTION_SOURCES } from '../../fiction/shared/sources.mjs';
import { yukinoServices } from '../data/services';

export type StatusTarget = { name: string; url: string; jsonKeys?: string[]; contentType?: string; expectedStatus?: number; probe?: 'weather' | 'reader-catalog' | 'reader-source' | 'jm-detail' | 'media-detail' | 'pixiv-detail' | 'news' | 'f1-season'; timeoutMs?: number; statusOnly?: boolean };

const readers = [
  { host: 'ln.yukino.bond', name: '轻小说', sources: LIGHT_SOURCES },
  { host: 'novel.yukino.bond', name: '普通小说', sources: FICTION_SOURCES },
];

export const STATUS_TARGETS: StatusTarget[] = [
  { name: "主站", url: "https://www.yukino.bond/" },
  { name: "根域名跳转", url: "https://yukino.bond/" },
  { name: "主站登录接口", url: "https://www.yukino.bond/api/auth/access", jsonKeys: ["error"], expectedStatus: 401 },
  { name: "主站文章接口", url: "https://www.yukino.bond/api/posts", jsonKeys: ["posts"] },
  { name: "测速统计接口", url: "https://speed.yukino.bond/api/speed/totals", jsonKeys: ["bytes", "sessions"] },
  { name: "影视目录接口", url: "https://cinema.yukino.bond/api/sources", jsonKeys: ["data"] },
  { name: "番剧目录接口", url: "https://comic.yukino.bond/api/sources", jsonKeys: ["data"] },
  ...readers.map(({ host, name }) => ({ name: `${name}目录接口`, url: `https://${host}/api/books`, probe: 'reader-catalog' as const, timeoutMs: 27000 })),
  { name: "资源箱索引", url: "https://box.yukino.bond/api/box", jsonKeys: ["items"] },
  { name: "设备清单数据", url: "https://uses.yukino.bond/api/uses", jsonKeys: ["content", "revision"] },
  { name: "访客网络查询", url: "https://ip.yukino.bond/api/ip/visitor", jsonKeys: ["ip"] },
  { name: "博客 RSS 订阅", url: "https://www.yukino.bond/api/feed", contentType: "application/rss+xml" },
  { name: "铁路车站索引", url: "https://cr.yukino.bond/api/rail?mode=stations&schema=city-v2", jsonKeys: ["stations"], timeoutMs: 27000, statusOnly: true },
  { name: "实验室服务与存储", url: "https://tools.yukino.bond/lab/api/health", jsonKeys: ["status", "version"] },
  { name: "邮箱登录页面", url: "https://mail.yukino.bond/login", contentType: "text/html" },
  ...[yukinoServices.radar, yukinoServices.hooks, yukinoServices.shortlinks].map(service => ({
    name: service.title, url: service.href, contentType: "text/html",
  })),
  { name: "天气预报读取", url: "https://www.yukino.bond/api/weather?provider=auto&lat=23.13&lon=113.26&name=Guangzhou&region=Guangdong&country=CN&tz=Asia%2FShanghai", probe: 'weather' },
  ...(['open-meteo', 'met-no'] as const).map(provider => ({ name: `天气预报 · ${provider}`, url: `https://www.yukino.bond/api/weather?provider=${provider}&lat=23.13&lon=113.26&name=Guangzhou&region=Guangdong&country=CN&tz=Asia%2FShanghai`, probe: 'weather' as const, statusOnly: true })),
  ...readers.flatMap(({ host, name, sources }) => sources.map(source => ({
    name: `${name}详情与章节 · ${source.name}`,
    url: `https://${host}/api/books?source=${source.id}&sort=updated`,
    probe: 'reader-source' as const, timeoutMs: 27000, statusOnly: true,
  }))),
  { name: "姬漫搜索、详情和章节", url: "https://jm-api-yukino.3584643854.workers.dev/v1/search?q=love&page=1&category=0&order=mr&time=a", probe: 'jm-detail', timeoutMs: 25000 },
  { name: "影视目录及详情", url: "https://cinema.yukino.bond/api/catalog?category=series&genre=cn", probe: 'media-detail', timeoutMs: 25000 },
  { name: "番剧目录及详情", url: "https://comic.yukino.bond/api/catalog?category=jp", probe: 'media-detail', timeoutMs: 25000 },
  { name: "Pixiv 排行和作品详情", url: "https://pixiv.yukino.bond/api/ranking?mode=daily&page=1", probe: 'pixiv-detail', timeoutMs: 25000 },
  { name: "新闻内容读取", url: "https://news.yukino.bond/api/news", probe: 'news', timeoutMs: 20000 },
  { name: "F1 赛历和积分", url: "https://f1.yukino.bond/api/f1?action=season", probe: 'f1-season', timeoutMs: 20000 },
  ...APPS.filter(app => app.id !== 'www').map(app => ({ name: app.host, url: `https://${app.host}/` })),
];
export type ServiceCheck = { name: string; url: string; state: "reachable" | "error" | "unknown"; code: number | null; latency: number; checkedAt: string; detail: string; statusOnly?: boolean };
export type StatusReport = { services: ServiceCheck[]; checkedAt: string };
export function httpState(code: number): ServiceCheck["state"] { return code >= 200 && code < 400 ? "reachable" : code === 403 || code === 429 ? "unknown" : "error"; }
