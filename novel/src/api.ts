import type { SourceInfo, SourceId } from '../shared/sources.mjs';
export type SourceStatus = SourceInfo & { count: number; state: 'ok' | 'stale' | 'error' | 'restricted' | 'limited'; checkedAt: string | null; stale: boolean; reason: string };
export type SourceStatusData = { indexed: number; source: string; sources: SourceStatus[]; scheduledMinutes: number; cacheMinutes: number; persisted: boolean; persistence?: { mode: string; scheduledWritesPerDay: number; lastPersistedAt: string | null; state: string; reason: string }; newestUpdate: string | null };
export type Book = { id: string; title: string; author: string; illustrator: string; description: string; cover: string; tags: string[]; status: 'ongoing' | 'completed' | 'unknown'; updatedAt: string | null; sourceFetchedAt: string | null; sourceUrl: string; source?: SourceId; sourceName?: string };
export type VolumeInfo = { id: string; title: string; cover: string };
export type BookDetail = Book & { volumes: VolumeInfo[] };
export type Volume = { id: string; bookId: string; title: string; chapters: { id: string; title: string; restricted?: boolean; sourceUrl?: string }[] };
export type Chapter = { id: string; bookId: string; volumeId: string; title: string; sourceUrl: string; blocks: ({ type: 'text'; text: string } | { type: 'image'; src: string; alt: string })[] };
export type Meta = { checkedAt: string | null; stale: boolean; reason: string; provider: string; refreshMinutes: number; offline?: boolean };
export type Envelope<T> = { data: T; meta: Meta };
export type SearchPage = { items: Book[]; total: number; page: number; pages: number; indexed: number; tags: string[]; sources?: SourceStatus[]; scope?: string };
export const READING_CACHE = 'yukino-novel-data-v1';
export type Access = { user: { id: number; name: string; role: string } | null; loginUrl: string; limits?: Record<string, unknown> };
export function loginUrlForPage() {
  const current = new URL(location.href || '/', 'https://novel.yukino.bond');
  const target = new URL('https://novel.yukino.bond'); target.pathname=current.pathname;target.search=current.search;target.hash=current.hash;
  const login = new URL('https://www.yukino.bond/login'); login.searchParams.set('returnTo', target.href); return login.href;
}
export const isLoginRequired = (error: unknown) => (error as { status?: number })?.status === 401;
export async function access(signal?: AbortSignal): Promise<Access> {
  const response = await fetch('/api/access', { signal, cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Error('暂时无法检查登录状态');
  return response.json();
}

export async function request<T>(path: string, signal?: AbortSignal): Promise<Envelope<T>> {
  const key = new URL(path, location.origin); key.searchParams.delete('refresh');
  const protectedChapter = /^\/api\/book\/[^/]+\/chapter\/[^/]+\/?$/.test(key.pathname);
  const explicitRefresh = new URL(path, location.origin).searchParams.get('refresh') === '1';
  let cache: Cache | undefined;
  // Reading requires a current server session; old offline bodies cannot bypass it.
  if (!protectedChapter) try { cache = await caches.open(READING_CACHE); } catch { /* Private modes may disable cache storage. */ }
  try {
    const response = await fetch(path, { signal, cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({})), loginUrl = response.status === 401 ? loginUrlForPage() : '';
      if (response.status === 401) window.dispatchEvent(new CustomEvent('novel-login-required', { detail: { loginUrl } }));
      throw Object.assign(new Error(error.error || `请求失败（${response.status}）`), { status: response.status, code: error.code, loginUrl });
    }
    const data = await response.json();
    if (!data || !data.meta || data.data == null) throw new Error('服务器返回了不完整的数据');
    if (cache && !data.meta.stale) {
      try {
        await cache.put(key.href, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
        const keys = await cache.keys();
        if (keys.length > 180) await cache.delete(keys[0]);
      } catch { /* Cache failure must not prevent reading. */ }
    }
    return data;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (protectedChapter || explicitRefresh) throw error;
    if ([400, 401, 403, 404].includes((error as { status?: number })?.status || 0)) throw error;
    const old = await cache?.match(key.href).catch(() => undefined);
    if (old) { const result = await old.json(); return { ...result, meta: { ...result.meta, stale: true, offline: true, reason: `正在使用此浏览器的阅读缓存：${error instanceof Error ? error.message : '网络不可用'}` } }; }
    throw error;
  }
}
export function dateLabel(value?: string | null, time = false) {
  return value ? new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}), timeZone: 'Asia/Shanghai' }) : '时间未知';
}
export function relativeDate(value?: string | null) {
  if (!value) return '更新时间未知';
  const hours = (Date.now() - Date.parse(value)) / 3600000;
  if (hours < 0) return dateLabel(value);
  if (hours < 1) return '刚刚更新';
  if (hours < 24) return `${Math.floor(hours)} 小时前更新`;
  if (hours < 24 * 7) return `${Math.floor(hours / 24)} 天前更新`;
  return `${dateLabel(value)} 更新`;
}
export function directId(value: string) {
  const text = value.trim();
  if (/^(?:sf|linovel|wenku)-[1-9]\d{0,8}$/.test(text)) return text;
  if (/^[1-9]\d{0,7}$/.test(text)) return text;
  try {
    const url = new URL(text); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    if (/^(?:www\.|w\.)?(?:linovelib|bilinovel)\.com$/.test(url.hostname)) return url.pathname.match(/^\/novel\/([1-9]\d{0,7})(?:\.html|\/)/)?.[1] || '';
    if (url.hostname === 'book.sfacg.com') { const id=url.pathname.match(/^\/Novel\/([1-9]\d{0,8})(?:\/|$)/i)?.[1]; return id ? `sf-${id}` : ''; }
    if (['www.linovel.net','linovel.net'].includes(url.hostname)) { const id=url.pathname.match(/^\/book\/([1-9]\d{0,8})\.html/)?.[1]; return id ? `linovel-${id}` : ''; }
    if (/^(?:www\.)?wenku8\.(?:net|com|cc)$/.test(url.hostname)) { const id=url.pathname.match(/^\/book\/([1-9]\d{0,8})\.htm/)?.[1]; return id ? `wenku-${id}` : ''; }
  } catch { /* Normal search text. */ }
  return '';
}
