export const SOURCES = [
  { id: 'bili', name: '哔哩轻小说', kind: '译文书库', origin: 'https://www.linovelib.com', search: true, note: '通过 lnovel 公开聚合接口读取已索引译文。' },
  { id: 'sf', name: '菠萝包 SF', kind: '中文原创', origin: 'https://book.sfacg.com', search: true, note: '读取公开书目和免费章节，VIP 章节在源站订阅阅读。' },
  { id: 'linovel', name: '轻之文库', kind: '中文原创', origin: 'https://www.linovel.net', search: true, note: '读取公开作品、分卷目录与正文，以源站实际更新日期为准。' },
  { id: 'wenku', name: '轻小说文库', kind: '译文书库 · 链接直达', origin: 'https://www.wenku8.net', search: false, note: '支持书籍链接直达；服务器受限时提供源站阅读入口。站内仅搜索已打开的公开书目，完整搜索需在源站登录。' },
];
export function sourceInfo(id) { return SOURCES.find(item => item.id === id); }
export function bookSource(id) { return /^sf-/.test(id) ? 'sf' : /^linovel-/.test(id) ? 'linovel' : /^wenku-/.test(id) ? 'wenku' : 'bili'; }
export function bookIdValid(id) { return /^(?:(?:sf|linovel|wenku)-)?[1-9]\d{0,8}$/.test(String(id)); }
export function nativeBookId(id) { return String(id).replace(/^(?:sf|linovel|wenku)-/, ''); }
export function sourceBookUrl(id) {
  if(!bookIdValid(id))return '';
  const native=nativeBookId(id);
  return bookSource(id)==='sf'?`https://book.sfacg.com/Novel/${native}/`:bookSource(id)==='linovel'?`https://www.linovel.net/book/${native}.html`:bookSource(id)==='wenku'?`https://www.wenku8.net/book/${native}.htm`:`https://www.linovelib.com/novel/${native}.html`;
}
export function partIdValid(value) { return /^(?:[1-9]\d{0,15}|v[0-9a-f]{8})$/.test(String(value)); }
export function imageSource(input) {
  try {
    const url = new URL(String(input), 'https://lnovel.animes.garden');
    if (url.username || url.password || url.port || !['https:', 'http:'].includes(url.protocol)) return '';
    const host = url.hostname.toLowerCase(), path = url.pathname;
    const allowed = host === 'lnovel.animes.garden' && /^\/bili\/(?:files\/article\/|img3\/|img\/)/.test(path) && /\.(?:jpe?g|png|webp|gif|avif)$/i.test(path)
      || ['rs.sfacg.com', 'rss.sfacg.com'].includes(host) && /^\/web\/novel\/images\/(?:NovelCover|UploadPic)\//i.test(path) && /\.(?:jpe?g|png|webp|gif)$/i.test(path)
      || host === 'rin.linovel.net' && /^\/(?:cover|illust|illustration|upload)\//i.test(path) && /\.(?:jpe?g|png|webp|gif)(?:![a-z\d]+)?$/i.test(path)
      || ['img.wenku8.com', 'img.wenku8.net'].includes(host) && /^\/image\/\d+\/\d+\/\d+[a-z]?\.(?:jpe?g|png)$/i.test(path)
      || ['pic.wenku8.com', 'pic.wenku8.net'].includes(host) && /^\/pictures\/[a-z\d/_-]+\.(?:jpe?g|png)$/i.test(path);
    if (!allowed) return '';
    url.protocol = 'https:'; url.hash = ''; return url.href;
  } catch { return ''; }
}
