export class SourceError extends Error {
  constructor(message, status = 503, state = 'error') { super(message); this.status = status; this.state = state; }
}
export async function fetchHtml(url, encoding = 'utf-8', fetcher = fetch) {
  let response;
  try { response = await fetcher(url, { headers: { Accept: 'text/html', 'User-Agent': 'YukinoNovel/1.1 (+https://novel.yukino.bond)', 'Accept-Language': 'zh-CN,zh;q=0.9' }, redirect: 'manual', signal: AbortSignal.timeout(14000) }); }
  catch (error) { throw new SourceError(error?.name === 'TimeoutError' ? '书源响应超时' : '书源连接失败'); }
  if ([401, 403].includes(response.status) || response.headers.get('cf-mitigated') === 'challenge') throw new SourceError('书源要求登录或访问验证，请在源站查看', 403, 'restricted');
  if (!response.ok) throw new SourceError(`书源暂不可用（HTTP ${response.status}）`);
  if (Number(response.headers.get('content-length')) > 4 * 1024 * 1024) throw new SourceError('书源页面超过大小限制');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 4 * 1024 * 1024) throw new SourceError('书源页面超过大小限制');
  const html = new TextDecoder(encoding).decode(bytes);
  if (/<title>\s*(?:Just a moment|Attention Required|访问验证|用户登录|会员登录|登录|Login)/i.test(html)) throw new SourceError('书源要求登录或访问验证，请在源站查看', 403, 'restricted');
  return html;
}
