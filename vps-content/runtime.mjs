import http from 'node:http';
import { lookup } from 'node:dns';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { readFile, stat, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { ContentStorage } from './storage.mjs';
import { Agent, setGlobalDispatcher } from 'undici';

export function publicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b)) ||
      (a === 198 && [18, 19].includes(b)));
  }
  // Outbound DNS is resolved to IPv4 below. Reject all other literal forms,
  // including IPv4-mapped IPv6, rather than accidentally reaching a LAN service.
  return false;
}
export function installPublicNetwork() {
  const agent = new Agent({ connect: { autoSelectFamily: false, lookup(host, options, callback) {
    lookup(host, { family: 4, all: true }, (error, addresses) => {
      if (error) return callback(error);
      if (!addresses.length || addresses.some(item => !publicAddress(item.address))) return callback(new Error('Private upstream address rejected'));
      if (options.all) callback(null, addresses);
      else callback(null, addresses[0].address, 4);
    });
  } }, connections: 16, headersTimeout: 30000, bodyTimeout: 60000 });
  setGlobalDispatcher(agent);
  // Literal addresses do not use a DNS lookup. Validate these before fetch too.
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, options) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (!['https:', 'http:'].includes(url.protocol) || (isIP(host) && !publicAddress(host))) return Promise.reject(new Error('Private upstream address rejected'));
    return nativeFetch(input, options);
  };
}

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

export function assets(directory) {
  const root = resolve(directory);
  return { async fetch(request) {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url).pathname); } catch { return new Response(null, { status: 400 }); }
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) return new Response(null, { status: 404 });
    const name = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!name.startsWith(root + sep) || !mime[extname(name)]) return new Response(null, { status: 404 });
    try {
      const actual = await realpath(name);
      if (!actual.startsWith(root + sep)) return new Response(null, { status: 404 });
      const info = await stat(actual);
      if (!info.isFile()) return new Response(null, { status: 404 });
      return new Response(request.method === 'HEAD' ? null : await readFile(actual), { headers: {
        'Content-Type': mime[extname(name)], 'Content-Length': String(info.size),
        'Cache-Control': /^\/yukino-app-sw-/.test(pathname) ? 'no-store, no-cache, must-revalidate' : pathname.startsWith('/assets/') || pathname.startsWith('/yukino-app-assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
        ...(/^\/yukino-app-sw-/.test(pathname) ? { 'CDN-Cache-Control': 'no-store', 'Cloudflare-CDN-Cache-Control': 'no-store', 'Service-Worker-Allowed': '/' } : {}),
      } });
    } catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) return new Response(null, { status: 404 }); throw error; }
  } };
}

export async function start({ root, data, port = 18780, schedule = true, network = true } = {}) {
  if (network) installPublicNetwork();
  const configurations = [['cinema', 'CINEMA_CACHE', 0], ['comic', 'COMIC_CACHE', 20], ['novel', 'NOVEL_CACHE', 40], ['speed', 'DB', null], ['status', 'STATUS_STORAGE', null]];
  const sites = new Map(), waiting = new Set(), jobs = new Map();
  const ctx = { waitUntil(promise) {
    const work = Promise.resolve(promise).catch(error => console.error('Background task failed', error.name)).finally(() => waiting.delete(work));
    waiting.add(work);
  } };
  for (const [name, binding, minute] of configurations) {
    const storage = new ContentStorage(resolve(data, name));
    const worker = (await import(pathToFileURL(resolve(root, name, 'worker.mjs')))).default;
    const env = { [binding]: name === 'speed' ? storage.databaseBinding() : storage, ASSETS: assets(resolve(root, name, 'dist')) };
    if (['cinema','comic'].includes(name) && !await storage.get('private:media-key')) await storage.put('private:media-key', crypto.randomUUID() + crypto.randomUUID());
    sites.set(`${name}.yukino.bond`, { name, storage, worker, env, minute });
  }
  globalThis.caches = { default: {
    async match(request) { return sites.get(new URL(request.url).hostname)?.storage.match(request); },
    async put(request, response) { return sites.get(new URL(request.url).hostname)?.storage.cachePut(request, response); },
  } };
  const server = http.createServer(async (req, res) => {
    const site = sites.get((req.headers.host || '').split(':')[0].toLowerCase());
    if (!site) { res.writeHead(404); res.end(); return; }
    const controller = new AbortController();
    res.once('close', () => { if (!res.writableFinished) controller.abort(); });
    try {
      const url = new URL(req.url, `https://${site.name}.yukino.bond`);
      if (url.hostname !== `${site.name}.yukino.bond` || !req.url.startsWith('/') || req.url.startsWith('//')) { res.writeHead(400); res.end(); return; }
      let result;
      const speedApi = site.name === 'speed' && /^\/api\/speed(?:\/|$)/.test(url.pathname);
      const novelAuth = ['novel', 'cinema', 'comic'].includes(site.name) && /^\/api\/auth\/(?:login|logout)$/.test(url.pathname) && req.method === 'POST';
      if (!['GET', 'HEAD'].includes(req.method) && !(speedApi && ['POST', 'OPTIONS'].includes(req.method)) && !novelAuth) result = new Response(null, { status: 405 });
      else if (url.pathname === '/__health') result = Response.json({ origin: 'yukino-vps-content', site: site.name, storage: 'local-sqlite',
        ...site.storage.stats(), job: jobs.get(site.name) || null }, { headers: { 'Cache-Control': 'no-store' } });
      // Do not allow hidden source files to receive a SPA fallback.
      else if (url.pathname.split('/').some(part => part.startsWith('.')) || /(?:storage\.sqlite|\.env|worker\.mjs|runtime\.mjs)$/.test(url.pathname)) result = new Response(null, { status: 404 });
      else if (Number(req.headers['content-length']) > 4096) result = new Response(null, { status: 413 });
      else result = await site.worker.fetch(new Request(url, { method: req.method, headers: req.headers, signal: controller.signal,
        ...(req.method === 'POST' ? { body: Readable.toWeb(req), duplex: 'half' } : {}) }), site.env, ctx);
      const headers = new Headers(result.headers);
      headers.set('X-Yukino-Origin', 'vps-content');
      headers.set('X-Content-Type-Options', 'nosniff');
      res.writeHead(result.status, Object.fromEntries(headers));
      if (req.method === 'HEAD' || !result.body) { await result.body?.cancel(); res.end(); }
      else await pipeline(Readable.fromWeb(result.body), res);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Request failed', site.name, error.name);
      if (!res.headersSent) res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: '服务暂时不可用，请稍后重试' }));
    }
  });
  server.headersTimeout = 20000;
  server.requestTimeout = 30000;
  async function refresh(site) {
    if (jobs.get(site.name)?.running) return;
    const job = { running: true, startedAt: new Date().toISOString() }; jobs.set(site.name, job);
    const promises = [];
    try {
      await site.worker.scheduled({ scheduledTime: Date.now(), cron: `${site.minute} * * * *` }, site.env, { waitUntil: task => promises.push(task) });
      await Promise.all(promises); job.completedAt = new Date().toISOString();
    } catch (error) { job.error = error.name; }
    finally { job.running = false; site.storage.prune(); }
  }
  const timers = [];
  if (schedule) {
    for (const site of sites.values()) if (site.minute !== null) timers.push(setTimeout(() => void refresh(site), 1000 + site.minute * 500));
    let lastMinute = -1;
    timers.push(setInterval(() => {
      const now = new Date(), minute = Math.floor(now.getTime() / 60000);
      if (minute === lastMinute) return;
      lastMinute = minute;
      for (const site of sites.values()) if (now.getUTCMinutes() === site.minute) void refresh(site);
    }, 10000));
  }
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
  console.log(`Yukino VPS content listening on 127.0.0.1:${server.address().port}`);
  return { server, sites, async close() {
    for (const timer of timers) { clearInterval(timer); clearTimeout(timer); }
    server.closeAllConnections(); await new Promise(done => server.close(done));
    await Promise.allSettled([...waiting]);
    for (const site of sites.values()) site.storage.close();
  } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const app = await start({ root, data: process.env.CONTENT_DATA || '/var/lib/yukino-content', port: Number(process.env.PORT || 18780) });
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void app.close().then(() => process.exit(0)); });
}
