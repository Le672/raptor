import { setDefaultResultOrder } from 'node:dns';
setDefaultResultOrder('ipv4first');
const base = (process.env.PIXIV_BASE_URL || 'https://pixiv.yukino.bond').replace(/\/$/, '');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function response(path) {
  let last;
  const attempts = path === '/' ? 6 : 3;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { const result = await fetch(base + path, { signal: AbortSignal.timeout(45000) }); if (result.status >= 500 && attempt < attempts - 1) { await result.body?.cancel(); throw new Error(`HTTP ${result.status}`); } return result; }
    catch (error) { last = error; if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1))); }
  }
  throw last;
}
async function json(path) {
  const result = await response(path), data = await result.json();
  assert(result.ok && !data.error, `Pixiv verification failed for ${path.split('?')[0]}: ${data.error || result.status}`);
  return data;
}
const home = await response('/');
assert(home.ok && (await home.text()).includes('Pixiv 画廊'), 'Pixiv document is missing');
const ranking = await json('/api/ranking?mode=daily&page=1');
assert(ranking.items?.length > 0 && /^\d{8}$/.test(ranking.date), 'Live ranking/date missing');
const search = await json('/api/search?' + new URLSearchParams({ q: '風景', page: '1', type: 'illustrations', scope: 's_tag', order: 'date_d' }));
assert(search.items?.length > 0 && search.total > 0, 'Live Pixiv search is empty');
const detail = await json('/api/artworks/' + ranking.items[0].id);
assert(detail.images?.length > 0 && detail.userId, 'Artwork images or artist missing');
const artist = await json('/api/users/' + detail.userId + '?page=1');
assert(artist.items?.length > 0 && artist.user?.id === detail.userId, 'Live artist gallery missing');
const img = await response('/api/image?' + new URLSearchParams({ url: detail.images[0].original, download: '1' }));
assert(img.ok && /^image\//.test(img.headers.get('content-type') || ''), 'Original image proxy failed');
const bytes = new Uint8Array(await img.arrayBuffer());
assert(bytes.length > 1000, 'Original image is empty');
if (img.headers.get('content-type')?.startsWith('image/jpeg')) assert(bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217, 'Original JPEG transfer is incomplete');
for (const path of ['/search?q=風景', '/artworks/' + detail.id, '/users/' + detail.userId, '/favorites', '/settings']) {
  const result = await response(path);
  assert(result.ok && (await result.text()).includes('Pixiv 画廊'), 'Direct navigation failed for ' + path);
}
const rejected = await response('/api/image?url=https%3A%2F%2F127.0.0.1%2Fprivate.jpg');
assert(rejected.status === 400, 'Image proxy accepts an invalid target');
console.log(JSON.stringify({ verified: base, rankingDate: ranking.date, ranked: ranking.items.length, search: search.items.length, total: search.total, artwork: detail.id, images: detail.images.length, artistWorks: artist.items.length, originalImage: img.headers.get('content-type'), deepLinks: true, invalidImageRejected: true }));
