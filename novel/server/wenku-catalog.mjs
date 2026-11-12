import { imageUrl, plainText } from './service.mjs';
import { dateTime } from './html.mjs';

export const WENKU_SITEMAP = 'https://www.wenku8.net/sitemap.xml';
export const WENKU_CATALOG = 'https://raw.githubusercontent.com/mojimoon/wenku8/main/out/wenku_catalog.json';

export function parseWenkuCatalog(index, sitemap) {
  const valid = new Set();
  for (const match of String(sitemap).matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)) {
    try {
      const url = new URL(match[1].trim()), id = url.pathname.match(/^\/book\/([1-9]\d{0,8})\.htm$/)?.[1];
      if (id && url.origin === 'https://www.wenku8.net' && !url.username && !url.password && !url.search && !url.hash) valid.add(id);
    } catch { /* Ignore malformed or foreign sitemap entries. */ }
  }
  if (!valid.size) throw new Error('文库站点地图未返回有效书号，保留已有索引');
  if (!index?.pages || typeof index.pages !== 'object' || Array.isArray(index.pages)) throw new Error('文库公开书目索引格式变化，保留已有索引');
  const books = new Map(), fetchedAt = new Date().toISOString();
  for (const page of Object.values(index.pages).slice(0, 1000)) {
    if (!Array.isArray(page)) continue;
    for (const raw of page.slice(0, 1000)) {
      const id = String(raw?.aid || ''), title = typeof raw?.title === 'string' ? raw.title.trim().slice(0, 240) : '';
      if (!valid.has(id) || !title || /^(?:登录|出错啦|访问验证)$/.test(title)) continue;
      const value = {
        id: `wenku-${id}`, title, author: typeof raw.author === 'string' ? raw.author.trim().slice(0, 120) : '', illustrator: '',
        description: plainText(typeof raw.description === 'string' ? raw.description : '').slice(0, 1200),
        cover: imageUrl(typeof raw.cover_url === 'string' ? raw.cover_url : ''),
        tags: [...new Set([...(typeof raw.tags === 'string' ? raw.tags.split(/\s+/) : []), ...(typeof raw.publisher === 'string' ? [raw.publisher] : [])])].filter(Boolean).slice(0, 20),
        status: /已完[结結]|完本/.test(raw.status || '') ? 'completed' : /[连連][载載]/.test(raw.status || '') ? 'ongoing' : 'unknown',
        updatedAt: dateTime(raw.update), sourceFetchedAt: fetchedAt, sourceUrl: `https://www.wenku8.net/book/${id}.htm`, source: 'wenku', sourceName: '轻小说文库',
      };
      const old = books.get(value.id);
      // The upstream's refreshed first pages can overlap older pages. Never let
      // an older/incomplete row erase the current title, date or description.
      if (!old || (value.updatedAt || '') > (old.updatedAt || '')) books.set(value.id, { ...old, ...value });
      else if (!old.description && value.description) books.set(value.id, { ...old, description: value.description });
    }
  }
  if (!books.size) throw new Error('公开书名与文库站点地图没有有效匹配，保留已有索引');
  return [...books.values()];
}
