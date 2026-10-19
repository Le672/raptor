export const SOURCE = 'https://lnovel.animes.garden';
export const CATALOG_TTL = 5 * 60 * 1000;
const inflight = new Map();
const memory = new Map();
const entityNames = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', emsp: '　', ensp: ' ', hellip: '…', mdash: '—', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’' };

export function decodeEntities(input = '') {
  return String(input).replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, code) => {
    if (!code.startsWith('#')) return entityNames[code.toLowerCase()] ?? all;
    const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
  });
}
export function plainText(html = '') {
  return decodeEntities(String(html).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<br\s*\/?\s*>|<\/p\s*>/gi, '\n').replace(/<[^>]*>/g, '')).replace(/\r/g, '').trim();
}
export function imageSource(input) {
  try {
    const url = new URL(String(input), SOURCE);
    if (url.origin !== SOURCE || url.username || url.password || !/^\/bili\/(?:files\/article\/|img3\/|img\/)/.test(url.pathname)) return '';
    if (!/\.(?:jpe?g|png|webp|gif|avif)$/i.test(url.pathname)) return '';
    url.hash = '';
    return url.href;
  } catch { return ''; }
}
export function imageUrl(input) { const src = imageSource(input); return src ? `/api/image?src=${encodeURIComponent(src)}` : ''; }
export function validId(input) { return /^[1-9]\d{0,8}$/.test(String(input)); }
function timestamp(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }

export function normalizeBook(raw) {
  if (!raw || !validId(raw.nid) || typeof (raw.name ?? raw.title) !== 'string' || raw.isDeleted) return null;
  const tags = Array.isArray(raw.labels) ? raw.labels.filter(x => typeof x === 'string').slice(0, 24) : [];
  return {
    id: String(raw.nid), title: plainText(raw.name ?? raw.title).slice(0, 240),
    author: Array.isArray(raw.authors) ? raw.authors.filter(x => x?.position === 'author').map(x => plainText(x.name)).join(' / ') : plainText(raw.author || ''),
    illustrator: Array.isArray(raw.authors) ? raw.authors.filter(x => x?.position === 'illustrator').map(x => plainText(x.name)).join(' / ') : '',
    description: plainText(raw.description || '').slice(0, 2400), cover: imageUrl(raw.cover), tags,
    status: tags.some(x => /^(?:已)?完[结結]$/.test(x)) ? 'completed' : tags.includes('连载') || tags.includes('連載') ? 'ongoing' : 'unknown',
    updatedAt: timestamp(raw.updatedAt), sourceFetchedAt: timestamp(raw.fetchedAt),
    sourceUrl: `https://www.linovelib.com/novel/${raw.nid}.html`,
  };
}
export function parseContent(html) {
  const safe = String(html || '').replace(/<(script|style|iframe|object|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const blocks = []; let text = '';
  const flush = () => { const value = decodeEntities(text).replace(/[\t\r]/g, '').trim(); if (value) blocks.push({ type: 'text', text: value }); text = ''; };
  for (const match of safe.matchAll(/<img\b[^>]*>|<br\s*\/?\s*>|<\/(?:p|div|h[1-6])\s*>|<[^>]*>|[^<]+/gi)) {
    const token = match[0];
    if (/^<img\b/i.test(token)) {
      flush();
      const src = token.match(/\b(?:data-src|src)\s*=\s*["']([^"']+)["']/i)?.[1];
      const url = imageUrl(decodeEntities(src || ''));
      if (url) blocks.push({ type: 'image', src: url, alt: plainText(token.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] || '小说插图') });
    } else if (/^<(?:br|\/)/i.test(token)) flush();
    else if (!token.startsWith('<')) text += token;
  }
  flush();
  if (!blocks.length) throw new Error('书源未返回可阅读内容，可能正在整理或暂不可用');
  return blocks;
}

export async function upstream(path, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(`${SOURCE}/api/bili/${path}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'YukinoNovel/1.0 (+https://novel.yukino.bond)', 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(22000), redirect: 'error', cache: 'no-store',
    });
  } catch (error) { throw new Error(error?.name === 'TimeoutError' ? '书源连接超时，请稍后重试' : '书源连接失败，请稍后重试'); }
  if (!response.ok) throw new Error(`书源暂不可用（HTTP ${response.status}）`);
  if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('书源返回了非 JSON 页面，可能需要登录或正在维护');
  const result = await response.json();
  if (result.ok !== true || result.data == null) throw new Error('书源没有返回有效数据');
  return result.data;
}

async function stored(env, key) {
  if (env.NOVEL_CACHE) return env.NOVEL_CACHE.get(key, { type: 'json' });
  return memory.get(key) || null;
}
async function persist(env, key, value, ttl) {
  if (env.NOVEL_CACHE) await env.NOVEL_CACHE.put(key, JSON.stringify(value), { expirationTtl: ttl });
  else { if (memory.size > 500) memory.delete(memory.keys().next().value); memory.set(key, value); }
}
async function refresh(env, key, producer, retention) {
  if (inflight.has(key)) return inflight.get(key);
  const task = (async () => {
    const data = await producer();
    const result = { data, checkedAt: new Date().toISOString() };
    await persist(env, key, result, retention);
    return result;
  })();
  inflight.set(key, task);
  try { return await task; } finally { inflight.delete(key); }
}
export async function cached(env, ctx, key, producer, ttl, { force = false, background = false, retention = 30 * 86400 } = {}) {
  let old; try { old = await stored(env, key); } catch { old = memory.get(key) || null; }
  const age = old ? Date.now() - Date.parse(old.checkedAt) : Infinity;
  const meta = (record, stale, reason = '') => ({ ...record, meta: { checkedAt: record.checkedAt, stale, reason, provider: 'lnovel · 哔哩轻小说', refreshMinutes: Math.round(ttl / 60000) } });
  if (old && age < (force ? 60000 : ttl)) return meta(old, false);
  const task = () => refresh(env, key, producer, retention);
  if (old && background && !force) {
    ctx.waitUntil(task().catch(() => {}));
    return meta(old, true, '正在后台同步，当前显示上次成功获取的数据');
  }
  try { return meta(await task(), false); }
  catch (error) { if (old) return meta(old, true, error instanceof Error ? error.message : '书源连接失败'); throw error; }
}

export async function catalog(env, ctx, options = {}, fetcher = fetch) {
  return cached(env, ctx, 'catalog:v1', async () => {
    const data = await upstream('novels', fetcher);
    if (!Array.isArray(data)) throw new Error('书源索引格式变化，暂时保留上次结果');
    const books = [...new Map(data.map(normalizeBook).filter(Boolean).map(x => [x.id, x])).values()];
    if (!books.length) throw new Error('书源返回空索引，暂时保留上次结果');
    return books;
  }, CATALOG_TTL, { background: true, ...options });
}
export async function book(env, ctx, id, force = false) {
  return cached(env, ctx, `book:v1:${id}`, async () => {
    const raw = await upstream(`novel/${id}`);
    const value = normalizeBook(raw);
    if (!value || value.id !== String(id)) throw new Error('书源没有这本书或暂不可用');
    const volumes = (Array.isArray(raw.volumes) ? raw.volumes : []).filter(x => validId(x.vid) && String(x.nid) === String(id)).map(x => ({ id: String(x.vid), title: plainText(x.title || '未命名分卷'), cover: imageUrl(x.cover) }));
    return { ...value, volumes };
  }, 5 * 60000, { force, background: true });
}
export async function volume(env, ctx, id, vid, force = false) {
  return cached(env, ctx, `volume:v1:${id}:${vid}`, async () => {
    const raw = await upstream(`novel/${id}/vol/${vid}`);
    if (String(raw.nid) !== id || String(raw.vid) !== vid) throw new Error('分卷与书籍不匹配');
    return { id: vid, bookId: id, title: plainText(raw.name || raw.title || ''), chapters: (Array.isArray(raw.chapters) ? raw.chapters : []).filter(x => validId(x.cid) && String(x.nid) === id && String(x.vid) === vid).map(x => ({ id: String(x.cid), title: plainText(x.title || '未命名章节') })) };
  }, 5 * 60000, { force, background: true });
}
export async function chapter(env, ctx, id, cid, force = false) {
  return cached(env, ctx, `chapter:v1:${id}:${cid}`, async () => {
    const raw = await upstream(`novel/${id}/chapter/${cid}`);
    if (String(raw.nid) !== id || String(raw.cid) !== cid || !validId(raw.vid)) throw new Error('章节与书籍不匹配');
    return { id: cid, bookId: id, volumeId: String(raw.vid), title: plainText(raw.title || '未命名章节'), blocks: parseContent(raw.content), sourceUrl: `https://www.linovelib.com/novel/${id}/${cid}.html` };
  }, 15 * 60000, { force, background: true, retention: 7 * 86400 });
}

export function searchBooks(books, params) {
  const query = (params.get('q') || '').normalize('NFKC').toLocaleLowerCase().trim().slice(0, 120);
  const tag = params.get('tag') || '', status = params.get('status') || '';
  const sort = params.get('sort') || 'updated';
  const terms = query.split(/\s+/).filter(Boolean);
  const compact = text => text.replace(/[的\s\p{P}]/gu, '');
  const all = books.filter(x => {
    const haystack = `${x.title} ${x.author} ${x.tags.join(' ')}`.normalize('NFKC').toLocaleLowerCase();
    return (!tag || x.tags.includes(tag)) && (!status || x.status === status) && terms.every(term => haystack.includes(term) || (compact(term).length >= 2 && compact(haystack).includes(compact(term))));
  });
  all.sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, 'zh-CN') : sort === 'new' ? Number(b.id) - Number(a.id) : (b.updatedAt || '').localeCompare(a.updatedAt || '') || Number(b.id) - Number(a.id));
  const total = all.length, pages = Math.max(1, Math.ceil(total / 24));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(params.get('page')) || 1)));
  const tags = [...new Map(books.flatMap(x => x.tags).map(t => [t, 0])).keys()].filter(t => !['连载', '連載', '完结', '完結', '已完结'].includes(t));
  return { items: all.slice((page - 1) * 24, page * 24), total, page, pages, indexed: books.length, tags };
}
