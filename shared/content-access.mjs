// Content Workers validate the portal session without copying its signing secret
// or writing a counter/session for every chapter or video segment to Workers KV.
const PORTAL = 'https://www.yukino.bond';
const COOKIE = '__Secure-yukino_session';
export const ACCESS_LIMITS = Object.freeze({ actionsPerMinute: 120, refreshesPerMinute: 30, dailyLimit: null, mediaSegmentsCounted: false });
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Cookie, Authorization' };
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...headers, ...extra } });

export function contentLoginUrl(site, returnPath = '/') {
  const safePath = returnPath.startsWith('/') && !returnPath.startsWith('//') && !/[\\\u0000-\u0020\u007f]/.test(returnPath) ? returnPath : '/';
  const target = new URL(safePath, `https://${site}.yukino.bond`);
  const login = new URL('/login', PORTAL);
  login.searchParams.set('returnTo', target.href);
  return login.href;
}

function tokenFrom(request) {
  const authorization = request.headers.get('Authorization');
  if (authorization) return authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  const matches = (request.headers.get('Cookie') || '').split(';').map(x => x.trim()).filter(x => x.startsWith(`${COOKIE}=`));
  return matches.length === 1 ? matches[0].slice(COOKIE.length + 1) : null;
}

function expiry(token) {
  try {
    if (!token || token.length > 4096 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return 0;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return Number.isSafeInteger(payload.exp) ? payload.exp * 1000 : 0;
  } catch { return 0; }
}

export function createAccessGuard(site, { fetcher = (...args) => fetch(...args), now = () => Date.now() } = {}) {
  const sessions = new Map(), pending = new Map(), buckets = new Map();
  function trim(map, maximum) {
    for (const [key, value] of map) if (value.until <= now()) map.delete(key);
    while (map.size >= maximum) map.delete(map.keys().next().value);
  }
  async function identity(request) {
    const token = tokenFrom(request), expires = expiry(token);
    if (expires <= now()) return { user: null };
    const cached = sessions.get(token);
    if (cached?.until > now()) return cached;
    if (pending.has(token)) return pending.get(token);
    if (pending.size >= 128) return { unavailable: true };
    const work = (async () => {
      try {
        const response = await fetcher(`${PORTAL}/api/auth/access`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          redirect: 'error', signal: AbortSignal.timeout(8000), cache: 'no-store',
        });
        if (response.status === 401 || response.status === 403) {
          const result = { user: null, until: now() + 20000 };
          trim(sessions, 1024); sessions.set(token, result); return result;
        }
        if (!response.ok) return { unavailable: true };
        const value = await response.json(), user = value?.user;
        if (!Number.isSafeInteger(user?.id) || user.id <= 0 || typeof user.name !== 'string' || !['admin', 'user'].includes(user.role)) return { unavailable: true };
        const result = { user: { id: user.id, name: user.name, role: user.role }, until: Math.min(expires, now() + 5 * 60000) };
        trim(sessions, 1024); sessions.set(token, result); return result;
      } catch { return { unavailable: true }; }
    })();
    pending.set(token, work);
    try { return await work; } finally { pending.delete(token); }
  }
  function checkBurst(user, refresh) {
    const key = `${user.id}:${refresh ? 'refresh' : 'action'}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.until <= now()) {
      trim(buckets, 4096); bucket = { until: now() + 60000, count: 0 }; buckets.set(key, bucket);
    }
    const limit = refresh ? ACCESS_LIMITS.refreshesPerMinute : ACCESS_LIMITS.actionsPerMinute;
    return ++bucket.count > limit ? Math.max(1, Math.ceil((bucket.until - now()) / 1000)) : 0;
  }
  return {
    async status(request) {
      const result = await identity(request);
      if (result.unavailable) return json({ error: '登录服务暂时不可用，请稍后再试', code: 'AUTH_UNAVAILABLE' }, 503);
      return json({ user: result.user, loginUrl: contentLoginUrl(site), limits: ACCESS_LIMITS });
    },
    async require(request, { media = false, refresh = false } = {}) {
      // Browser cookies must not authorize expensive requests initiated by a
      // foreign site. Explicit Bearer clients do not rely on ambient cookies.
      if (!request.headers.has('Authorization')) {
        const origin = request.headers.get('Origin');
        if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
          return json({ error: '请从本站打开此功能', code: 'ORIGIN_REQUIRED' }, 403);
        }
      }
      const result = await identity(request);
      if (result.unavailable) return json({ error: '登录服务暂时不可用，请稍后再试', code: 'AUTH_UNAVAILABLE' }, 503);
      if (!result.user) return json({ error: '登录后即可播放、阅读正文和手动刷新，目录与详情仍可直接浏览。', code: 'LOGIN_REQUIRED', loginUrl: contentLoginUrl(site) }, 401);
      // Manifests, AES keys, range requests and video segments never consume
      // action quotas. Normal continuous viewing has no daily ceiling.
      const retry = media ? 0 : checkBurst(result.user, refresh);
      if (retry) return json({ error: '操作有些频繁，请稍等片刻再试，不影响已开始的播放。', code: 'TOO_MANY_ACTIONS' }, 429, { 'Retry-After': String(retry) });
      return null;
    },
  };
}

export function privateMedia(response) {
  const result = new Response(response.body, response);
  result.headers.set('Cache-Control', 'private, no-store');
  result.headers.set('Vary', 'Cookie, Authorization');
  return result;
}
