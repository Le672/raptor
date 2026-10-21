const CONTENT_HOSTS = new Set(["cinema.yukino.bond", "comic.yukino.bond", "novel.yukino.bond"]);
/** Only public content sites may receive the browser after portal login. */
export function safeAuthReturn(value: string | null): string | null {
  if (!value || !/^https:\/\//i.test(value) || value.length > 4096 || /[\\\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    if (/[\\\u0000-\u0020\u007f]/.test(decodeURIComponent(value))) return null;
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port || url.username || url.password || !CONTENT_HOSTS.has(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
