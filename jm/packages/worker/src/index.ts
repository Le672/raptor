import CryptoJS from 'crypto-js';

type Env = { JM_API_DOMAIN?: string };
type Session = { origin: URL; imageOrigin: URL; version: string; cookie: string; expires: number };
type SearchEntry = { id: string; title: string; creator: string };

const directoryUrls = [
  'https://rup4a04-c01.tos-ap-southeast-1.bytepluses.com/newsvr-2025.txt',
  'https://rup4a04-c02.tos-cn-hongkong.bytepluses.com/newsvr-2025.txt',
];

// These values are public parts of the upstream wire protocol, not application credentials.
const wire = {
  app: '18comicAPP',
  content: '18comicAPPContent',
  response: '185Hcomic3PAPP7R',
  directory: 'diosfjckwpqpdfjkvnqQjsik',
  initialVersion: '2.0.16',
};

let liveSession: Session | undefined;
let sessionRequest: Promise<Session> | undefined;
let imageOriginsRequest: Promise<URL[]> | undefined;
let imageOriginsUntil = 0;

function md5(input: string): string {
  return CryptoJS.MD5(input).toString(CryptoJS.enc.Hex);
}

function unpackCiphertext(ciphertext: string, key: string): unknown {
  const words = CryptoJS.AES.decrypt(ciphertext, CryptoJS.enc.Utf8.parse(key), {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.NoPadding,
  });
  const bytes = new Uint8Array(words.sigBytes);
  for (let offset = 0; offset < bytes.length; offset++) {
    bytes[offset] = (words.words[offset >>> 2] >>> (24 - (offset % 4) * 8)) & 255;
  }
  const padding = bytes.at(-1) ?? 0;
  const end = padding > 0 && padding <= 16 ? bytes.length - padding : bytes.length;
  return JSON.parse(new TextDecoder().decode(bytes.subarray(0, end)));
}

function safeHttpOrigin(candidate: string): URL {
  const url = new URL(candidate.startsWith('http') ? candidate : `https://${candidate}`);
  if (url.protocol !== 'https:' || !/^[a-z0-9.-]+$/i.test(url.hostname)) {
    throw new Error('Invalid upstream host');
  }
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
    throw new Error('Private upstream host rejected');
  }
  return url;
}

async function discoverHosts(env: Env): Promise<URL[]> {
  if (env.JM_API_DOMAIN) return [safeHttpOrigin(env.JM_API_DOMAIN)];
  for (const directoryUrl of directoryUrls) {
    try {
      const response = await fetch(directoryUrl, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) continue;
      const decoded = unpackCiphertext((await response.text()).trim(), md5(wire.directory)) as { Server?: unknown };
      if (!Array.isArray(decoded.Server)) continue;
      const hosts: URL[] = [];
      for (const value of decoded.Server) {
        if (typeof value !== 'string') continue;
        try { hosts.push(safeHttpOrigin(value)); } catch { /* skip malformed hosts */ }
      }
      if (hosts.length) return hosts;
    } catch { /* try the other directory */ }
  }
  throw new Error('No upstream domains available');
}

function tokenHeaders(timestamp: number, version: string, secret = wire.app, cookie = ''): Headers {
  const headers = new Headers({
    token: md5(`${timestamp}${secret}`),
    tokenparam: `${timestamp},${version}`,
    'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36',
  });
  if (cookie) headers.set('Cookie', cookie);
  return headers;
}

async function readEncryptedJson(response: Response, timestamp: number): Promise<Record<string, unknown>> {
  if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
  const envelope = await response.json() as { data?: unknown };
  if (typeof envelope.data !== 'string') throw new Error('Unexpected upstream response');
  const payload = unpackCiphertext(envelope.data, md5(`${timestamp}${wire.response}`));
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid upstream JSON');
  return payload as Record<string, unknown>;
}

function cookiesFrom(response: Response): string {
  const values = response.headers.getSetCookie?.() ?? [];
  return values.map(value => value.split(';', 1)[0]).filter(Boolean).join('; ');
}

async function establishSession(env: Env): Promise<Session> {
  let lastError: unknown;
  const hosts = await discoverHosts(env);
  for (const origin of hosts.slice(0, 12)) {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const setting = await fetch(new URL('/setting', origin), {
        headers: tokenHeaders(timestamp, wire.initialVersion),
        signal: AbortSignal.timeout(7000),
      });
      const cookie = cookiesFrom(setting);
      const data = await readEncryptedJson(setting, timestamp);
      if (typeof data.version !== 'string' || typeof data.img_host !== 'string') {
        throw new Error('Setting response is incomplete');
      }
      return {
        origin,
        imageOrigin: safeHttpOrigin(data.img_host),
        version: data.version,
        cookie,
        expires: Date.now() + 10 * 60_000,
      };
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error('Unable to connect to upstream');
}

async function getSession(env: Env): Promise<Session> {
  if (liveSession && liveSession.expires > Date.now()) return liveSession;
  sessionRequest ??= establishSession(env).then(value => {
    liveSession = value;
    return value;
  }).finally(() => { sessionRequest = undefined; });
  return sessionRequest;
}

async function alternateImageOrigins(env: Env, session: Session): Promise<URL[]> {
  if (imageOriginsRequest && imageOriginsUntil > Date.now()) return imageOriginsRequest;
  imageOriginsUntil = Date.now() + 10 * 60_000;
  imageOriginsRequest = (async () => {
    const hosts = await discoverHosts(env);
    const candidates = hosts.filter(host => host.origin !== session.origin.origin).slice(0, 7);
    const results = await Promise.all(candidates.map(async origin => {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const response = await fetch(new URL('/setting', origin), {
          headers: tokenHeaders(timestamp, wire.initialVersion),
          signal: AbortSignal.timeout(7000),
        });
        const data = await readEncryptedJson(response, timestamp);
        return typeof data.img_host === 'string' ? safeHttpOrigin(data.img_host) : null;
      } catch { return null; }
    }));
    return results.filter((origin): origin is URL => origin !== null && origin.origin !== session.imageOrigin.origin);
  })();
  return imageOriginsRequest;
}

async function fetchImageSource(env: Env, path: string): Promise<Response> {
  const session = await getSession(env);
  const failures: string[] = [];
  const attempt = async (origin: URL): Promise<Response | null> => {
    try {
      const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15_000) });
      if (response.ok && response.body) return response;
      failures.push(`${origin.hostname}: ${response.status}`);
    } catch (error) {
      failures.push(`${origin.hostname}: ${error instanceof Error ? error.message : 'network error'}`);
    }
    return null;
  };
  const primary = await attempt(session.imageOrigin);
  if (primary) return primary;
  for (const origin of await alternateImageOrigins(env, session)) {
    const response = await attempt(origin);
    if (response) return response;
  }
  throw new Error(`Image sources unavailable (${failures.join(', ')})`);
}

async function upstreamJson(env: Env, pathname: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const session = await getSession(env);
  const url = new URL(pathname, session.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const timestamp = Math.floor(Date.now() / 1000);
  const response = await fetch(url, {
    headers: tokenHeaders(timestamp, session.version, wire.app, session.cookie),
    signal: AbortSignal.timeout(12_000),
  });
  try { return await readEncryptedJson(response, timestamp); }
  catch (error) { liveSession = undefined; throw error; }
}

function asString(value: unknown): string { return value == null ? '' : String(value); }
function asList(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
function json(data: unknown, cacheSeconds = 0, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': cacheSeconds ? `public, max-age=${cacheSeconds}` : 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function search(env: Env, url: URL): Promise<Response> {
  const q = (url.searchParams.get('q') ?? '').trim();
  if (!q || q.length > 120) return json({ error: 'Search term must contain 1–120 characters' }, 0, 400);
  const page = Math.max(1, Math.min(1000, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1));
  const category = ['0', '1', '2', '3', '4'].includes(url.searchParams.get('category') ?? '') ? url.searchParams.get('category')! : '0';
  const order = ['mr', 'mv', 'mp', 'tf'].includes(url.searchParams.get('order') ?? '') ? url.searchParams.get('order')! : 'mr';
  const time = ['a', 't', 'w', 'm'].includes(url.searchParams.get('time') ?? '') ? url.searchParams.get('time')! : 'a';
  const raw = await upstreamJson(env, '/search', { search_query: q, main_tag: category, o: order, t: time, page: String(page) });
  const items: SearchEntry[] = Array.isArray(raw.content) ? raw.content.flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const entry = value as Record<string, unknown>;
    return [{ id: asString(entry.id), title: asString(entry.name), creator: asString(entry.author) }];
  }).filter(entry => entry.id && entry.title) : [];
  return json({ page, pageSize: 80, total: Number(raw.total) || 0, directId: asString(raw.redirect_aid) || null, items }, 30);
}

async function book(env: Env, id: string): Promise<Response> {
  const raw = await upstreamJson(env, '/album', { id });
  if (!raw.name) return json({ error: 'Book not found' }, 0, 404);
  const chapters = Array.isArray(raw.series) ? raw.series.flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const entry = value as Record<string, unknown>;
    return [{ id: asString(entry.id), title: asString(entry.name), order: Number(entry.sort) || 0 }];
  }).filter(entry => entry.id) : [];
  if (!chapters.length) chapters.push({ id, title: asString(raw.name), order: 0 });
  return json({
    id,
    title: asString(raw.name),
    creators: asList(raw.author),
    description: asString(raw.description),
    tags: asList(raw.tags),
    works: asList(raw.works),
    characters: asList(raw.actors),
    views: Number(raw.total_views) || 0,
    likes: Number(raw.likes) || 0,
    chapters: chapters.sort((a, b) => a.order - b.order),
  }, 1800);
}

async function chapter(env: Env, id: string): Promise<Response> {
  const session = await getSession(env);
  const raw = await upstreamJson(env, '/chapter', { id });
  const images = asList(raw.images).map(name => ({ name, url: `/v1/image/${id}/${encodeURIComponent(name)}` }));
  const viewUrl = new URL('/chapter_view_template', session.origin);
  for (const [key, value] of Object.entries({ id, mode: 'vertical', page: '0', app_img_shunt: '1', express: 'off', v: String(Math.floor(Date.now() / 1000)) })) {
    viewUrl.searchParams.set(key, value);
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const view = await fetch(viewUrl, { headers: tokenHeaders(timestamp, session.version, wire.content, session.cookie), signal: AbortSignal.timeout(12_000) });
  if (!view.ok) throw new Error(`Chapter view returned ${view.status}`);
  const match = (await view.text()).match(/scramble_id\s*=\s*(\d+)/);
  if (!match) throw new Error('Chapter image key is unavailable');
  return json({ id, title: asString(raw.name), images, scramble: Number(match[1]) }, 1800);
}

async function image(env: Env, id: string, encodedName: string): Promise<Response> {
  const name = decodeURIComponent(encodedName);
  if (!/^[^/\\]+\.(?:jpe?g|png|gif|webp)$/i.test(name)) return json({ error: 'Invalid image name' }, 0, 400);
  const source = await fetchImageSource(env, `/media/photos/${id}/${encodeURIComponent(name)}`);
  return new Response(source.body, {
    status: 200,
    headers: {
      'Content-Type': source.headers.get('content-type') ?? 'image/jpeg',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function cover(env: Env, id: string): Promise<Response> {
  const response = await fetchImageSource(env, `/media/albums/${id}_3x4.jpg`);
  return new Response(response.body, {
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'image/jpeg',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function translate(request: Request): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const endpoint = asString(body.endpoint);
  const apiKey = asString(body.apiKey);
  const model = asString(body.model).trim();
  const language = asString(body.language).trim().slice(0, 40) || '简体中文';
  const text = asString(body.text).trim();
  if (!endpoint || !apiKey || !model || !text || text.length > 12000) return json({ error: '翻译设置或文字无效' }, 0, 400);
  let target: URL;
  try {
    target = new URL(endpoint);
    safeHttpOrigin(target.origin);
  } catch { return json({ error: '请输入公开的 HTTPS API 地址' }, 0, 400); }
  if (target.username || target.password || target.port || target.hash || target.search || !target.pathname.endsWith('/chat/completions')) {
    return json({ error: 'API 地址必须指向 chat/completions' }, 0, 400);
  }
  const response = await fetch(target, {
    method: 'POST',
    redirect: 'error',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0.2, messages: [
      { role: 'system', content: `Translate the following comic dialogue into ${language}. Keep the line order. Return only the translation.` },
      { role: 'user', content: text },
    ] }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) return json({ error: `翻译服务返回 ${response.status}` }, 0, 502);
  const result = await response.json() as { choices?: { message?: { content?: unknown } }[] };
  const translated = result.choices?.[0]?.message?.content;
  return typeof translated === 'string' && translated.trim() ? json({ text: translated.trim() }) : json({ error: '翻译服务没有返回文字' }, 0, 502);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    }
    const url = new URL(request.url);
    const pathname = url.pathname;
    try {
      if (request.method === 'POST' && pathname === '/v1/translate') return await translate(request);
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 0, 405);
      if (pathname === '/v1/health') return json({ status: 'ok', service: 'yukino-jm' }, 0);
      if (pathname === '/v1/search') return await search(env, url);
      const coverMatch = pathname.match(/^\/v1\/covers\/(\d+)$/);
      if (coverMatch) return await cover(env, coverMatch[1]);
      const bookMatch = pathname.match(/^\/v1\/books\/(\d+)$/);
      if (bookMatch) return await book(env, bookMatch[1]);
      const chapterMatch = pathname.match(/^\/v1\/chapters\/(\d+)$/);
      if (chapterMatch) return await chapter(env, chapterMatch[1]);
      const imageMatch = pathname.match(/^\/v1\/image\/(\d+)\/([^/]+)$/);
      if (imageMatch) return await image(env, imageMatch[1], imageMatch[2]);
      return json({ error: 'Not found' }, 0, 404);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Request failed' }, 0, 502);
    }
  },
};
