const http = require('node:http');
const https = require('node:https');
const agents = { 'http:': new http.Agent({ keepAlive: true, maxSockets: 32 }), 'https:': new https.Agent({ keepAlive: true, maxSockets: 32 }) };
// This bridge is main-process only. TLS verification remains enabled, no browser security settings are changed.
function nativeFetch(address, options = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    const url = new URL(address);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return reject(new Error('仅支持不含账号密码的 HTTP / HTTPS 地址'));
    if (options.signal?.aborted) return reject(new Error('Aborted'));
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method: options.method || 'GET', agent: agents[url.protocol], highWaterMark: 16384,
      headers: { 'User-Agent': 'Yukino-Speed/1.0', 'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache', ...options.headers },
    });
    const abort = () => request.destroy(new Error('Aborted'));
    const detach = () => options.signal?.removeEventListener('abort', abort);
    options.signal?.addEventListener('abort', abort, { once: true });
    request.on('error', error => { detach(); reject(error); });
    request.on('response', response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.destroy(); detach();
        if (redirects >= 5) return reject(new Error('服务器重定向次数过多'));
        return resolve(nativeFetch(new URL(response.headers.location, url).href, options, redirects + 1));
      }
      response.on('end', detach); response.on('close', detach);
      const iterator = response[Symbol.asyncIterator]();
      resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode,
        headers: new Headers(Object.entries(response.headers).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])),
        body: { getReader: () => ({ read: async () => { const result = await iterator.next(); return { done: result.done, value: result.value }; }, cancel: async () => { response.destroy(); request.destroy(); detach(); } }) },
      });
    });
    request.end();
  });
}
function closeAgents() { Object.values(agents).forEach(agent => agent.destroy()); }
module.exports = { nativeFetch, closeAgents };
