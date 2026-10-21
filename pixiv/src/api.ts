export type ArtworkCard = {
  id: string; title: string; userId: string; userName: string; image: string;
  width: number; height: number; pageCount: number; type: number; ai: boolean;
  tags: string[]; createdAt: string; rank?: number;
};
export type Artwork = Omit<ArtworkCard, 'tags'> & {
  description: string; bookmarkCount: number; viewCount: number;
  tags: { name: string; translation: string }[];
  images: { regular: string; original: string; width: number; height: number }[];
};
export type ArtworkPage = {
  items: ArtworkCard[]; page: number; total: number; hasNext: boolean;
  fetchedAt: string; date?: string; relatedTags?: string[];
  user?: { id: string; name: string; image: string; comment: string };
};

export async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  const payload = await response.json().catch(() => ({ error: '服务返回的数据无法读取。' }));
  if (!response.ok || payload.error) throw new Error(payload.error || `请求失败（${response.status}）。`);
  return payload as T;
}

export function imageUrl(source: string, download = false) {
  return '/api/image?' + new URLSearchParams({ url: source, ...(download ? { download: '1' } : {}) });
}

export function directDestination(input: string): string | null {
  const value = input.trim();
  if (/^[1-9]\d{0,11}$/.test(value)) return '/artworks/' + value;
  if (/^(?:PID\s*[:：]?\s*)[1-9]\d{0,11}$/i.test(value)) return '/artworks/' + value.replace(/^PID\s*[:：]?\s*/i, '');
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || !['pixiv.net', 'www.pixiv.net'].includes(url.hostname)) return null;
    const match = url.pathname.match(/^\/(?:[a-z]{2}\/)?(artworks|users)\/([1-9]\d{0,11})\/?$/);
    if (match) return `/${match[1]}/${match[2]}`;
    if (url.pathname === '/member_illust.php' && /^[1-9]\d{0,11}$/.test(url.searchParams.get('illust_id') || '')) return '/artworks/' + url.searchParams.get('illust_id');
  } catch { /* Treat plain text as a search term. */ }
  return null;
}
