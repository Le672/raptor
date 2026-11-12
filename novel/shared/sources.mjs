export const SOURCES = [
  { id: 'bili', name: '哔哩轻小说', kind: '译文书库', origin: 'https://www.linovelib.com', search: true, indexSearch: true, note: '通过 lnovel 公开聚合接口读取已索引译文。' },
  { id: 'linovel', name: '轻之文库', kind: '中文原创', origin: 'https://www.linovel.net', search: true, note: '读取公开作品、分卷目录与正文，以源站实际更新日期为准。' },
  { id: 'wenku', name: '轻小说文库', kind: '译文书库', origin: 'https://www.wenku8.net', search: true, indexSearch: true, note: '公开书名索引与源站站点地图交叉核对，支持书名、作者和标签搜索。目录与正文直接读取源站，受限时提供源站入口。' },
  { id: 'kxg', name: '开心果轻小说', kind: '日轻译文', origin: 'https://kxgxs.com', search: true, searchScope: '日本轻小说分区的公开搜索结果', note: '只接入日本轻小说分区，搜索、目录和正文直接读取源站。书目数量为当前列表与本站已发现记录，非全站作品总数。' },
  { id: 'encyclopedia', name: '轻小说百科', kind: '日轻译文', origin: 'https://lnovel.org', search: true, indexSearch: true, searchScope: '全站公开书名索引，已读作品补充作者与标签', note: '按源站公开书名建立索引，支持书名搜索；作者、目录和正文在打开作品时读取。原站搜索未生效时仍可检索书名，列表未标注的更新时间显示未知。' },
  { id: 'rezero', name: 'Re0 中文汉化', kind: '专题译本 · WEB版', origin: 'https://re0zero.top', search: true, indexSearch: true, searchScope: '《Re:从零开始的异世界生活》WEB 汉化版', note: 're-zero-khis 汉化项目，仅收录《Re:从零开始的异世界生活》WEB 中文译本及其已公开章节，分篇章浏览，保留翻译与校对说明。' },
];
export function sourceInfo(id) { return SOURCES.find(item => item.id === id); }
export function bookSource(id) { const prefix=String(id).split('-')[0];return sourceInfo(prefix)?.id || 'bili'; }
export function bookIdValid(id) { const value=String(id);return /^[1-9]\d{0,8}$/.test(value) || /^[a-z]+-[1-9]\d{0,8}$/.test(value) && bookSource(value)!=='bili' && (bookSource(value)!=='rezero'||value==='rezero-1'); }
export function nativeBookId(id) { return String(id).replace(/^[a-z]+-/, ''); }
export function sourceBookUrl(id) {
  if(!bookIdValid(id))return '';
  const native=nativeBookId(id);
  const source=bookSource(id);
  return source==='linovel'?`https://www.linovel.net/book/${native}.html`:source==='wenku'?`https://www.wenku8.net/book/${native}.htm`:source==='kxg'?`https://kxgxs.com/index.php/book/info/${native}`:source==='encyclopedia'?`https://lnovel.org/books-${native}`:source==='rezero'?'https://re0zero.top/mdbook/book/index.html':`https://www.linovelib.com/novel/${native}.html`;
}
export function partIdValid(value) { return /^(?:[1-9]\d{0,15}|v[0-9a-f]{8})$/.test(String(value)); }
export function imageSource(input) {
  try {
    const url = new URL(String(input), 'https://lnovel.animes.garden');
    if (url.username || url.password || url.port || !['https:', 'http:'].includes(url.protocol)) return '';
    const host = url.hostname.toLowerCase(), path = url.pathname;
    const allowed = host === 'lnovel.animes.garden' && /^\/bili\/(?:files\/article\/|img3\/|img\/)/.test(path) && /\.(?:jpe?g|png|webp|gif|avif)$/i.test(path)
      || host === 'rin.linovel.net' && /^\/(?:cover|illust|illustration|upload)\//i.test(path) && /\.(?:jpe?g|png|webp|gif)(?:![a-z\d]+)?$/i.test(path)
      || ['img.wenku8.com', 'img.wenku8.net'].includes(host) && /^\/image\/\d+\/\d+\/\d+[a-z]?\.(?:jpe?g|png)$/i.test(path)
      || ['pic.wenku8.com', 'pic.wenku8.net'].includes(host) && /^\/pictures\/[a-z\d/_-]+\.(?:jpe?g|png)$/i.test(path)
      || host === 'kxgxs.com' && /^\/uploads\/(?:novel-covers|novel-images|novel-content|chapter-images)\/[a-z\d/_.-]+\.(?:jpe?g|png|webp|gif)$/i.test(path)
      || host === 'lnovel.org' && /^\/uploads\/(?:https|http)\/[a-z\d._-]+\/(?:img|image|files)\/[a-z\d/_.-]+\.(?:jpe?g|png|webp|gif)$/i.test(path)
      || host === 're0zero.top' && /^\/mdbook\/book\/res\/imgs\/[a-z\d/_.-]+\.(?:jpe?g|png|webp|gif)$/i.test(path);
    if (!allowed) return '';
    url.protocol = 'https:'; url.hash = ''; return url.href;
  } catch { return ''; }
}
