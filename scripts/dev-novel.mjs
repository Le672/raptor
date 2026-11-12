import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
const ordinary=process.argv.includes('--fiction');
const worker=(await import(ordinary?'../fiction/server/worker.mjs':'../novel/server/worker.mjs')).default;
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) setGlobalDispatcher(new ProxyAgent(proxy));
const cacheRoot = resolve(ordinary?'.novel-work/local-fiction-kv':'.novel-work/local-kv'); await mkdir(cacheRoot, { recursive: true });
const NOVEL_CACHE = {
  async get(key) { try { return JSON.parse(await readFile(resolve(cacheRoot, encodeURIComponent(key) + '.json'), 'utf8')); } catch { return null; } },
  async put(key, value) { await writeFile(resolve(cacheRoot, encodeURIComponent(key) + '.json'), value); },
};
const vite = await createServer({ configFile: resolve('novel/vite.config.ts'), plugins:[{name:'reader-kind',transformIndexHtml:html=>html.replace('</head>',`<meta name="reader-kind" content="${ordinary?'fiction':'light'}"/></head>`)}], server: { middlewareMode: true, proxy: {} }, appType: 'spa' });
const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/api/')) { vite.middlewares(req, res); return; }
  try {
    const request = new Request(`http://127.0.0.1:5186${req.url}`, { method: req.method, headers: req.headers, ...(req.method === 'POST' ? { body: req, duplex: 'half' } : {}) });
    const response = await worker.fetch(request, { NOVEL_CACHE }, { waitUntil: promise => promise.catch(error => console.error(error.message)) });
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: error.message })); }
});
server.listen(5186, '127.0.0.1', () => console.log('Yukino Novel local preview: http://127.0.0.1:5186'));
process.on('SIGINT', () => { server.close(); void vite.close().then(() => process.exit(0)); });
