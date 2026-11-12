import type { Artwork, ArtworkCard } from './api';
export type HistoryItem = { artwork: ArtworkCard; viewedAt: number; page: number };
export type Library = { favorites: ArtworkCard[]; history: HistoryItem[]; searches: string[] };
export const STORAGE_KEY = 'yukino-pixiv-library-v1';
const empty = (): Library => ({ favorites: [], history: [], searches: [] });
const text = (value: unknown, limit: number) => typeof value === 'string' ? value.slice(0, limit) : '';

export function toCard(item: ArtworkCard | Artwork): ArtworkCard {
  return { id: item.id, title: item.title, userId: item.userId, userName: item.userName, image: item.image, width: item.width, height: item.height, pageCount: item.pageCount, type: item.type, ai: item.ai, tags: item.tags.map(tag => typeof tag === 'string' ? tag : tag.name), createdAt: item.createdAt };
}

function validCard(input: unknown): ArtworkCard | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (!/^[1-9]\d{0,11}$/.test(String(raw.id || '')) || typeof raw.title !== 'string') return null;
  let image: URL;
  try { image = new URL(String(raw.image)); } catch { return null; }
  if (image.protocol !== 'https:' || image.hostname !== 'i.pximg.net' || image.username || image.password || image.port || image.search || image.hash || !/\.(?:jpg|jpeg|png|gif|webp)$/i.test(image.pathname)) return null;
  const number = (value: unknown, max: number) => Math.max(0, Math.min(max, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0));
  return { id: String(raw.id), title: text(raw.title, 300), userId: /^[1-9]\d{0,11}$/.test(String(raw.userId || '')) ? String(raw.userId) : '', userName: text(raw.userName, 150), image: image.href, width: number(raw.width, 100000), height: number(raw.height, 100000), pageCount: Math.max(1, number(raw.pageCount, 10000)), type: [0, 1, 2].includes(Number(raw.type)) ? Number(raw.type) : 0, ai: raw.ai === true, tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 30).map(tag => tag.slice(0, 100)) : [], createdAt: text(raw.createdAt, 50) };
}

function sanitize(input: unknown): Library {
  if (!input || typeof input !== 'object') return empty();
  const raw = input as Record<string, unknown>;
  const unique = <T,>(items: T[], id: (item: T) => string) => [...new Map(items.map(item => [id(item), item])).values()];
  const favorites = unique((Array.isArray(raw.favorites) ? raw.favorites : []).slice(0, 2000).map(validCard).filter((item): item is ArtworkCard => !!item), item => item.id).slice(0, 1000);
  const history: HistoryItem[] = [];
  for (const item of (Array.isArray(raw.history) ? raw.history : []).slice(0, 1000)) {
    if (!item || typeof item !== 'object') continue;
    const artwork = validCard(item.artwork);
    if (!artwork || typeof item.viewedAt !== 'number' || !Number.isFinite(item.viewedAt)) continue;
    history.push({ artwork, viewedAt: Math.max(0, Math.min(Date.now(), item.viewedAt)), page: Math.max(0, Math.min(199, artwork.pageCount - 1, Number.isInteger(item.page) ? item.page : 0)) });
  }
  return { favorites, history: unique(history.sort((a, b) => a.viewedAt - b.viewedAt), item => item.artwork.id).sort((a, b) => b.viewedAt - a.viewedAt).slice(0, 120), searches: [...new Set((Array.isArray(raw.searches) ? raw.searches : []).filter((value): value is string => typeof value === 'string').map(value => value.trim().slice(0, 100)).filter(Boolean))].slice(0, 10) };
}

export function readLibrary(): Library {
  try { return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); } catch { return empty(); }
}
export function writeLibrary(value: Library) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { throw new Error('浏览器存储不可用或空间不足，本次记录未保存。'); }
}
export function toggleFavorite(value: Library, item: ArtworkCard | Artwork): Library {
  const exists = value.favorites.some(saved => saved.id === item.id);
  if (!exists && value.favorites.length >= 1000) throw new Error('收藏已达 1000 件，请先导出备份或移除部分收藏。');
  return { ...value, favorites: exists ? value.favorites.filter(saved => saved.id !== item.id) : [toCard(item), ...value.favorites] };
}
export function recordView(value: Library, item: Artwork, page: number): Library {
  return { ...value, history: [{ artwork: toCard(item), page, viewedAt: Date.now() }, ...value.history.filter(saved => saved.artwork.id !== item.id)].slice(0, 120) };
}
export function exportLibrary(value: Library) { return JSON.stringify({ app: 'yukino-pixiv', version: 1, exportedAt: new Date().toISOString(), ...value }, null, 2); }
export function importLibrary(source: string, current: Library): Library {
  if (source.length > 2_000_000) throw new Error('备份文件不能超过 2 MB。');
  let raw;
  try { raw = JSON.parse(source); } catch { throw new Error('备份文件不是有效的 JSON。'); }
  if (raw?.app !== 'yukino-pixiv' || raw.version !== 1 || !Array.isArray(raw.favorites) || !Array.isArray(raw.history)) throw new Error('请选择 Yukino Pixiv 导出的备份文件。');
  const incoming = sanitize(raw);
  if (raw.favorites.length && !incoming.favorites.length) throw new Error('备份文件中的作品数据无效。');
  return sanitize({ favorites: [...current.favorites, ...incoming.favorites], history: [...current.history, ...incoming.history], searches: [...current.searches, ...incoming.searches] });
}
