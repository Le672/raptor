export type Book = { id: string; title: string; author: string; illustrator: string; description: string; cover: string; tags: string[]; status: 'ongoing' | 'completed' | 'unknown'; updatedAt: string | null; sourceFetchedAt: string | null; sourceUrl: string };
export type VolumeInfo = { id: string; title: string; cover: string };
export type BookDetail = Book & { volumes: VolumeInfo[] };
export type Volume = { id: string; bookId: string; title: string; chapters: { id: string; title: string }[] };
export type Chapter = { id: string; bookId: string; volumeId: string; title: string; sourceUrl: string; blocks: ({ type: 'text'; text: string } | { type: 'image'; src: string; alt: string })[] };
export type Meta = { checkedAt: string; stale: boolean; reason: string; provider: string; refreshMinutes: number; offline?: boolean };
export type Envelope<T> = { data: T; meta: Meta };
export type SearchPage = { items: Book[]; total: number; page: number; pages: number; indexed: number; tags: string[] };
export const READING_CACHE = 'yukino-novel-data-v1';

export async function request<T>(path: string, signal?: AbortSignal): Promise<Envelope<T>> {
  const key = new URL(path, location.origin); key.searchParams.delete('refresh');
  let cache: Cache | undefined;
  try { cache = await caches.open(READING_CACHE); } catch { /* Private modes may disable cache storage. */ }
  try {
    const response = await fetch(path, { signal, cache: 'no-store' });
    if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.error || `请求失败（${response.status}）`); }
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
  if (/^[1-9]\d{0,7}$/.test(text)) return text;
  try { const url = new URL(text); if (/^(?:www\.|w\.)?(?:linovelib|bilinovel)\.com$/.test(url.hostname)) return url.pathname.match(/^\/novel\/([1-9]\d{0,7})(?:\.html|\/)/)?.[1] || ''; } catch { /* Normal search text. */ }
  return '';
}
