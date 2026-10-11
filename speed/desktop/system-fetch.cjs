function isHttpAddress(address) {
  try { const url = new URL(address); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
// A dedicated main-process session honors system / PAC proxies and carries no browser cookies.
// Guard every outgoing request, including redirects, before local/custom protocols can load.
function createSystemFetch(network) {
  network.webRequest?.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => callback({ cancel: !isHttpAddress(details.url) }));
  return async function systemFetch(address, options = {}) {
    if (!isHttpAddress(address)) throw new Error('仅支持不含账号密码的 HTTP / HTTPS 地址');
    return network.fetch(new URL(address).href, {
      ...options, redirect: 'follow', credentials: 'omit', cache: 'no-store', bypassCustomProtocolHandlers: true,
      headers: { 'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache', ...options.headers },
    });
  };
}
module.exports = { createSystemFetch };
