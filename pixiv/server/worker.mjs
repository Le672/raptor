const ORIGIN = 'https://www.pixiv.net';
const HEADERS = { Referer: ORIGIN + '/', 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', 'Accept-Language': 'zh-CN,zh;q=0.9' };

export class ApiError extends Error {
  constructor(status, message, code = 'UPSTREAM_ERROR') { super(message); this.status = status; this.code = code; }
}

export function numericId(value) {
  if (!/^[1-9]\d{0,11}$/.test(String(value || ''))) throw new ApiError(400, '请输入有效的作品或画师编号。', 'INVALID_ID');
  return String(value);
}

function integer(value, fallback, max) {
  if (value === null || value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(String(value)) || +value < 1 || +value > max) throw new ApiError(400, `页码必须在 1 至 ${max} 之间。`, 'INVALID_PAGE');
  return +value;
}

function option(value, values, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (!values.includes(value)) throw new ApiError(400, '不支持的筛选条件。', 'INVALID_FILTER');
  return value;
}

export function imageSource(value) {
  let url;
  try { url = new URL(value); } catch { throw new ApiError(400, '图片地址无效。', 'INVALID_IMAGE'); }
  if (url.protocol !== 'https:' || url.hostname !== 'i.pximg.net' || url.port || url.username || url.password || url.search || url.hash || /[\\\x00-\x20]/.test(value) || !/^\/(?:c\/|img-master\/|img-original\/|user-profile\/)/.test(url.pathname) || !/\.(?:jpg|jpeg|png|gif|webp)$/i.test(url.pathname)) {
    throw new ApiError(400, '仅支持 Pixiv 的公开图片地址。', 'INVALID_IMAGE');
  }
  return url.href;
}

function safeImage(value) { try { return imageSource(value); } catch { return ''; } }

export function plainText(value) {
  return String(value || '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' })[entity]).slice(0, 12000).trim();
}

export function artworkCard(raw, ranking = false) {
  if (!raw || typeof raw !== 'object') return null;
  if (Number(raw.xRestrict || 0) !== 0 || Number(raw.restrict || 0) !== 0 || raw.isMasked || raw.is_masked || Number(raw.illust_content_type?.sexual || 0) !== 0) return null;
  const id = String(raw.id ?? raw.illust_id ?? ''), image = safeImage(raw.url ?? raw.urls?.small ?? raw.urls?.regular);
  if (!/^[1-9]\d{0,11}$/.test(id) || !image) return null;
  return {
    id, title: String(raw.title || '未命名作品').slice(0, 300),
    userId: String(raw.userId ?? raw.user_id ?? ''), userName: String(raw.userName ?? raw.user_name ?? '').slice(0, 150),
    image, width: Number(raw.width) || 0, height: Number(raw.height) || 0,
    pageCount: Math.max(1, Number(raw.pageCount ?? raw.illust_page_count) || 1),
    type: Number(raw.illustType ?? raw.illust_type) || 0, ai: Number(raw.aiType) === 2,
    tags: (Array.isArray(raw.tags) ? raw.tags : raw.tags?.tags || []).map(t => typeof t === 'string' ? t : t.tag).filter(t => typeof t === 'string').slice(0, 30),
    createdAt: raw.createDate || (raw.illust_upload_timestamp ? new Date(raw.illust_upload_timestamp * 1000).toISOString() : ''),
    ...(ranking ? { rank: Number(raw.rank) || 0 } : {}),
  };
}

async function upstream(path, params = {}, fetcher = fetch) {
  const url = new URL(path, ORIGIN);
  for (const [key, value] of Object.entries({ lang: 'zh', ...params })) if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  let response;
  try {
    // Workers supports manual redirects; non-2xx responses below are rejected.
    response = await fetcher(url.href, { headers: HEADERS, redirect: 'manual', signal: AbortSignal.timeout(18000) });
  } catch { throw new ApiError(502, '暂时无法连接 Pixiv，请稍后重试。', 'UPSTREAM_UNAVAILABLE'); }
  if (!response.ok) throw new ApiError(response.status === 404 ? 404 : 502, response.status === 429 ? 'Pixiv 请求较多，请稍后重试。' : response.status === 403 ? 'Pixiv 暂时限制了访问，请稍后重试或打开原站。' : `Pixiv 返回了 ${response.status}，请稍后重试。`, 'UPSTREAM_HTTP');
  let result;
  try { result = await response.json(); } catch { throw new ApiError(502, 'Pixiv 返回了无法读取的数据，请稍后重试。', 'INVALID_RESPONSE'); }
  if (!result || typeof result !== 'object') throw new ApiError(502, 'Pixiv 返回的数据不完整。', 'INVALID_RESPONSE');
  if (result.error) throw new ApiError(404, '作品不存在、已删除或需要登录 Pixiv 才能查看。', 'NOT_PUBLIC');
  return result.body ?? result;
}

export async function searchArtworks(params, fetcher) {
  const query = String(params.get('q') || '').trim();
  if (!query || query.length > 100) throw new ApiError(400, '请输入 1 至 100 个字符的关键词。', 'INVALID_QUERY');
  const page = integer(params.get('page'), 1, 100);
  const type = option(params.get('type'), ['all', 'illustrations', 'manga'], 'all');
  const order = option(params.get('order'), ['date_d', 'date'], 'date_d');
  const scope = option(params.get('scope'), ['s_tag', 's_tag_full', 's_tc'], 's_tag');
  const data = await upstream(`/ajax/search/${type === 'all' ? 'artworks' : type}/${encodeURIComponent(query)}`, {
    word: query, order, mode: 'safe', p: page, s_mode: scope, type: type === 'illustrations' ? 'illust_and_ugoira' : 'all',
  }, fetcher);
  const group = data.illustManga ?? data.illust ?? data.manga;
  if (!group || !Array.isArray(group.data)) throw new ApiError(502, 'Pixiv 搜索结果不完整。', 'INVALID_RESPONSE');
  return {
    items: group.data.map(item => artworkCard(item)).filter(Boolean), page,
    total: Number(group.total) || 0, hasNext: page < 100 && page * 60 < Number(group.total),
    relatedTags: (Array.isArray(data.relatedTags) ? data.relatedTags : []).filter(tag => typeof tag === 'string').slice(0, 12),
    query, order, type, scope,
  };
}

export async function rankingArtworks(params, fetcher) {
  const mode = option(params.get('mode'), ['daily', 'weekly', 'monthly', 'rookie', 'original'], 'daily');
  const page = integer(params.get('page'), 1, 10);
  const data = await upstream('/ranking.php', { format: 'json', mode, p: page, content: 'illust' }, fetcher);
  if (!Array.isArray(data.contents)) throw new ApiError(502, 'Pixiv 榜单数据不完整。', 'INVALID_RESPONSE');
  return { items: data.contents.map(item => artworkCard(item, true)).filter(Boolean), page, hasNext: !!data.next && page < 10, date: String(data.date || ''), mode, total: Number(data.rank_total) || 0 };
}

export async function artworkDetail(id, fetcher) {
  numericId(id);
  const raw = await upstream(`/ajax/illust/${id}`, {}, fetcher);
  const card = artworkCard({ ...raw, id, url: raw.urls?.small || raw.urls?.regular });
  if (!card) throw new ApiError(403, '这件作品无法匿名查看，请前往 Pixiv 原站。', 'NOT_PUBLIC');
  const pages = await upstream(`/ajax/illust/${id}/pages`, {}, fetcher);
  if (!Array.isArray(pages) || !pages.length) throw new ApiError(502, '作品图片暂时无法读取。', 'INVALID_RESPONSE');
  const images = pages.slice(0, 200).map(page => ({
    regular: safeImage(page.urls?.regular), original: safeImage(page.urls?.original),
    width: Number(page.width) || 0, height: Number(page.height) || 0,
  })).filter(page => page.regular);
  if (!images.length) throw new ApiError(502, '作品没有可用的公开图片。', 'INVALID_RESPONSE');
  return { ...card, description: plainText(raw.description), bookmarkCount: Number(raw.bookmarkCount) || 0, viewCount: Number(raw.viewCount) || 0, images, tags: (raw.tags?.tags || []).map(tag => ({ name: String(tag.tag), translation: String(tag.translation?.en || '') })), sourceUrl: `${ORIGIN}/artworks/${id}` };
}

export async function userArtworks(id, params, fetcher) {
  numericId(id);
  const page = integer(params.get('page'), 1, 100);
  const [user, profile] = await Promise.all([upstream(`/ajax/user/${id}`, { full: 1 }, fetcher), upstream(`/ajax/user/${id}/profile/all`, {}, fetcher)]);
  const ids = [...new Set([...Object.keys(profile.illusts || {}), ...Object.keys(profile.manga || {})])].filter(value => /^[1-9]\d{0,11}$/.test(value)).sort((a, b) => Number(b) - Number(a));
  const selected = ids.slice((page - 1) * 48, page * 48);
  let items = [];
  if (selected.length) {
    const query = new URLSearchParams({ work_category: 'illustManga', is_first_page: page === 1 ? '1' : '0', lang: 'zh' });
    selected.forEach(value => query.append('ids[]', value));
    const works = await upstream(`/ajax/user/${id}/profile/illusts?${query}`, {}, fetcher);
    items = Object.values(works.works || {}).map(item => artworkCard(item)).filter(Boolean).sort((a, b) => Number(b.id) - Number(a.id));
  }
  return { user: { id, name: String(user.name || ''), image: safeImage(user.imageBig || user.image), comment: plainText(user.comment) }, items, page, total: ids.length, hasNext: page < 100 && page * 48 < ids.length };
}

function json(value, status = 200, ttl = 0) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': ttl ? `public, max-age=60, s-maxage=${ttl}` : 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

async function imageResponse(url, fetcher = fetch) {
  const source = imageSource(url.searchParams.get('url') || '');
  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetcher(source, { headers: { Referer: ORIGIN + '/', 'User-Agent': HEADERS['User-Agent'] }, redirect: 'manual', signal: AbortSignal.timeout(60000) });
      if (response.status >= 500 && attempt === 0) { await response.body?.cancel(); continue; }
      break;
    } catch { if (attempt === 1) throw new ApiError(502, '图片连接失败，请重试。', 'IMAGE_UNAVAILABLE'); }
  }
  if (!response.ok) throw new ApiError(response.status === 404 ? 404 : 502, 'Pixiv 图片暂时不可用，请重试或查看原站。', 'IMAGE_UNAVAILABLE');
  const type = response.headers.get('Content-Type')?.split(';')[0] || '';
  if (!/^image\/(?:jpeg|png|gif|webp)$/.test(type)) throw new ApiError(502, '图片格式无效。', 'INVALID_IMAGE_RESPONSE');
  const headers = { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' };
  const length = response.headers.get('Content-Length');
  if (length && /^\d+$/.test(length) && !response.headers.get('Content-Encoding')) headers['Content-Length'] = length;
  if (url.searchParams.get('download') === '1') headers['Content-Disposition'] = `attachment; filename="pixiv-${new URL(source).pathname.split('/').pop().replace(/[^a-zA-Z0-9_.-]/g, '_')}"`;
  return new Response(response.body, { headers });
}

export async function handleApi(request, fetcher = fetch) {
  const url = new URL(request.url), path = url.pathname;
  if (request.method !== 'GET') return json({ error: '此接口仅接受读取请求。', code: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    if (path === '/api/image') return await imageResponse(url, fetcher);
    let data, ttl = 300;
    if (path === '/api/search') data = await searchArtworks(url.searchParams, fetcher);
    else if (path === '/api/ranking') data = await rankingArtworks(url.searchParams, fetcher);
    else if (/^\/api\/artworks\/[^/]+$/.test(path)) { data = await artworkDetail(path.split('/').pop(), fetcher); ttl = 1800; }
    else if (/^\/api\/users\/[^/]+$/.test(path)) data = await userArtworks(path.split('/').pop(), url.searchParams, fetcher);
    else return json({ error: '接口不存在。', code: 'NOT_FOUND' }, 404);
    return json({ ...data, fetchedAt: new Date().toISOString(), source: 'pixiv' }, 200, ttl);
  } catch (error) { return json({ error: error instanceof ApiError ? error.message : '服务暂时不可用，请稍后重试。', code: error instanceof ApiError ? error.code : 'INTERNAL_ERROR' }, error instanceof ApiError ? error.status : 500); }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (request.method !== 'GET') return handleApi(request);
      const cache = globalThis.caches?.default;
      const key = new Request(url.href);
      const hit = cache ? await cache.match(key) : null;
      if (hit) return hit;
      const response = await handleApi(request);
      if (response.ok && cache) ctx.waitUntil(cache.put(key, response.clone()).catch(() => {}));
      return response;
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'no-referrer');
    headers.set('Content-Security-Policy', "default-src 'self'; img-src 'self' blob: data:; script-src 'self'; style-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    return new Response(response.body, { status: response.status, headers });
  },
};
