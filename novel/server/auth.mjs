// Sign in on this origin so iOS home-screen apps keep their own session.
const PORTAL = 'https://www.yukino.bond';
const COOKIE = '__Secure-yukino_session';
const WEEK = 7 * 86400;
const json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: {
  'Cache-Control': 'no-store, private', Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff', ...extra,
} });
function cookie(request, token, seconds, remember = true) {
  const domain = new URL(request.url).hostname === 'novel.yukino.bond' ? '; Domain=yukino.bond' : '';
  return `${COOKIE}=${token}${domain}; Path=/${remember ? `; Max-Age=${seconds}` : ''}; HttpOnly; Secure; SameSite=Lax`;
}
async function readBody(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new Error('Invalid body');
  const reader = request.body?.getReader(); if (!reader) throw new Error('Empty body');
  const chunks = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); throw new Error('Body too large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function createNovelAuth({ fetcher = (...args) => fetch(...args), now = () => Date.now() } = {}) {
  const attempts = new Map();
  return async function authenticate(request) {
    const path = new URL(request.url).pathname;
    if (!['/api/auth/login', '/api/auth/logout'].includes(path)) return null;
    if (request.method !== 'POST') return json({ error: '请使用 POST 提交' }, 405, { Allow: 'POST' });
    const origin = request.headers.get('Origin'), site = request.headers.get('Sec-Fetch-Site');
    if (origin !== new URL(request.url).origin || (site && !['same-origin', 'none'].includes(site))) return json({ error: '请从书房页面提交登录或退出请求' }, 403);
    if (path.endsWith('/logout')) return json({ user: null }, 200, { 'Set-Cookie': cookie(request, '', 0) });
    const key = request.headers.get('CF-Connecting-IP') || 'local';
    const time = now(), old = attempts.get(key);
    if (old && old.until > time && old.count >= 10) return json({ error: '登录尝试较多，请十分钟后重试' }, 429, { 'Retry-After': String(Math.ceil((old.until - time) / 1000)) });
    if (attempts.size >= 4096) for (const [ip, value] of attempts) if (value.until <= time) attempts.delete(ip);
    if (attempts.size >= 4096 && !attempts.has(key)) attempts.delete(attempts.keys().next().value);
    attempts.set(key, { count: old && old.until > time ? old.count + 1 : 1, until: old && old.until > time ? old.until : time + 600000 });
    let body;
    try { body = await readBody(request); } catch { return json({ error: '请填写有效的邮箱和密码，请求不可超过 4 KB' }, 400); }
    if (!body || typeof body.email !== 'string' || !body.email.trim() || body.email.length > 254 ||
        typeof body.password !== 'string' || !body.password || body.password.length > 512 ||
        !['mail', 'local'].includes(body.source) || (body.remember !== undefined && typeof body.remember !== 'boolean')) return json({ error: '请填写有效的邮箱、密码和登录方式' }, 400);
    try {
      const response = await fetcher(`${PORTAL}/api/auth/login?action=login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: PORTAL },
        body: JSON.stringify({ email: body.email.trim(), password: body.password, source: body.source }),
        redirect: 'manual', signal: AbortSignal.timeout(20000),
      });
      // Credentials only go to the fixed portal; its bearer token stays HttpOnly.
      if (!response.headers.get('Content-Type')?.includes('application/json')) throw new Error('Invalid identity response');
      const result = await response.json();
      if (!response.ok) return json({ error: typeof result.error === 'string' ? result.error.slice(0, 240) : '登录服务暂不可用' }, [400, 401, 403, 429].includes(response.status) ? response.status : 503);
      if (typeof result.token !== 'string' || result.token.length > 4096 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(result.token)) throw new Error('Invalid session');
      const claims = JSON.parse(atob(result.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const seconds = Math.min(WEEK, claims.exp - Math.floor(now() / 1000)), user = result.user;
      if (!Number.isSafeInteger(claims.exp) || seconds <= 0 || !Number.isSafeInteger(user?.id) || user.id <= 0 || typeof user.name !== 'string' || !['admin', 'user'].includes(user.role)) throw new Error('Invalid session');
      return json({ user: { id: user.id, name: user.name, role: user.role }, expiresAt: new Date(claims.exp * 1000).toISOString() }, 200,
        { 'Set-Cookie': cookie(request, result.token, seconds, body.remember !== false) });
    } catch { return json({ error: '登录服务暂时不可用，请稍后重试；已有会话会保留' }, 503); }
  };
}
