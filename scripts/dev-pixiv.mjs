import http from 'node:http';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import worker from '../pixiv/server/worker.mjs';
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY || process.env.HTTP_PROXY));
const vite = await createServer({ configFile: resolve('pixiv/vite.config.ts'), server: { middlewareMode: true }, appType: 'spa' });
const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/api/')) { vite.middlewares(req, res); return; }
  try {
    const response = await worker.fetch(new Request('http://127.0.0.1:5188' + req.url, { method: req.method, headers: req.headers }), {}, { waitUntil: p => p.catch(() => {}) });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) for await (const chunk of response.body) if (!res.write(Buffer.from(chunk))) await new Promise(r => res.once('drain', r));
    res.end();
  } catch { if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: '本地预览连接失败。' })); }
});
server.listen(5188, '127.0.0.1', () => console.log('Yukino Pixiv local preview: http://127.0.0.1:5188'));
process.on('SIGINT', () => { server.close(); void vite.close().then(() => process.exit(0)); });
