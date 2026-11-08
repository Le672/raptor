function isHttpAddress(address) {
  try { const url = new URL(address); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
// A dedicated main-process session honors system / PAC proxies and carries no browser cookies.
// Guard every outgoing request, including redirects, before local/custom protocols can load.
function createSystemFetch(network) {
  const sourcePages = new Map(), requests = new Map(), filter = { urls: ['<all_urls>'] };
  const nativeHeaders = !!network.webRequest?.onBeforeSendHeaders;
  const key = address => { const url = new URL(address); url.hash = ''; return url.href; };
  network.webRequest?.onBeforeRequest(filter, (details, callback) => {
    const allowed = isHttpAddress(details.url), source = allowed && sourcePages.get(key(details.url));
    if (source && !requests.has(details.id)) requests.set(details.id, source.referrer);
    callback({ cancel: !allowed });
  });
  if (nativeHeaders) {
    network.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
      const headers = { ...details.requestHeaders }, referrer = requests.get(details.id);
      if (referrer) {
        for (const name of Object.keys(headers)) if (name.toLowerCase() === 'referer') delete headers[name];
        headers.Referer = referrer;
      }
      callback({ requestHeaders: headers });
    });
    const finished = details => requests.delete(details.id);
    network.webRequest.onCompleted?.(filter, finished);
    network.webRequest.onErrorOccurred?.(filter, finished);
  }
  return async function systemFetch(address, options = {}) {
    if (!isHttpAddress(address)) throw new Error('仅支持不含账号密码的 HTTP / HTTPS 地址');
    const headers = new Headers({ 'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache', ...options.headers });
    const referrer = headers.get('referer'), addressKey = key(address);
    if (referrer && !isHttpAddress(referrer)) throw new Error('无效的下载来源页');
    if (nativeHeaders) {
      const existing = sourcePages.get(addressKey);
      if (existing && existing.referrer !== referrer) throw new Error('同一下载地址的并发来源页冲突');
      sourcePages.set(addressKey, { referrer, count: (existing?.count || 0) + 1 });
      // Chromium rejects Referer in fetch options. Apply it through the native request event.
      headers.delete('referer');
    }
    try { return await network.fetch(new URL(address).href, {
      ...options, redirect: 'follow', credentials: 'omit', cache: 'no-store', bypassCustomProtocolHandlers: true,
      headers: Object.fromEntries(headers),
    }); } finally {
      if (nativeHeaders) {
        const source = sourcePages.get(addressKey);
        if (source && --source.count === 0) sourcePages.delete(addressKey);
      }
    }
  };
}
module.exports = { createSystemFetch };
