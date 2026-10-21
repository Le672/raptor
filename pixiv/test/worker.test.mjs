import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { artworkCard, artworkDetail, handleApi, imageSource, rankingArtworks, searchArtworks, userArtworks } from '../server/worker.mjs';

const image = 'https://i.pximg.net/img-original/img/2026/10/21/00/00/00/123456_p0.jpg';
const card = { id: '123456', title: '公开插画', userId: '456', userName: 'Artist', url: image, xRestrict: 0, restrict: 0, tags: ['風景'], pageCount: 2, width: 1200, height: 800 };
const reply = body => new Response(JSON.stringify({ error: false, body }), { headers: { 'Content-Type': 'application/json' } });
const api = (path, fetcher) => handleApi(new Request('https://pixiv.yukino.bond' + path), fetcher);

test('search forwards keyword, safe mode, type, match scope and pagination', async () => {
  const result = await searchArtworks(new URLSearchParams({ q: '風景', type: 'illustrations', scope: 's_tag_full', order: 'date', page: '2' }), async (address, options) => {
    const url = new URL(address);
    assert.equal(url.hostname, 'www.pixiv.net');
    assert.equal(decodeURIComponent(url.pathname), '/ajax/search/illustrations/風景');
    assert.equal(url.searchParams.get('mode'), 'safe');
    assert.equal(url.searchParams.get('type'), 'illust_and_ugoira');
    assert.equal(url.searchParams.get('p'), '2');
    assert.equal(url.searchParams.get('s_mode'), 's_tag_full');
    assert.equal(url.searchParams.get('order'), 'date');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers.Referer, 'https://www.pixiv.net/');
    assert.equal(options.headers.Cookie, undefined);
    return reply({ illust: { data: [card, { ...card, id: '789', xRestrict: 1 }, { ...card, id: '999', isMasked: true }], total: 200 }, relatedTags: ['背景'] });
  });
  assert.equal(result.items.length, 1); assert.equal(result.page, 2); assert.equal(result.total, 200); assert.equal(result.hasNext, true);
});

test('invalid filters, premium sorting and excessive page counts fail before network calls', async () => {
  let requests = 0;
  for (const query of ['q=', 'q=猫&order=popular_d', 'q=猫&page=101', 'q=猫&page=-1', 'q=猫&type=unsafe', 'q=' + 'a'.repeat(101)]) {
    const response = await api('/api/search?' + query, () => { requests++; throw Error('should not fetch'); });
    assert.equal(response.status, 400);
  }
  assert.equal(requests, 0);
});

test('ranking keeps actual source date and rank after public visibility filtering', async () => {
  const result = await rankingArtworks(new URLSearchParams({ mode: 'weekly' }), async address => {
    assert.equal(new URL(address).searchParams.get('mode'), 'weekly');
    return new Response(JSON.stringify({ date: '20261019', next: 2, rank_total: 500, contents: [{ ...card, rank: 2 }, { ...card, id: '789', is_masked: true }] }));
  });
  assert.equal(result.date, '20261019'); assert.equal(result.items[0].rank, 2); assert.equal(result.items.length, 1); assert.equal(result.hasNext, true);
});

test('details return real multi-image originals and convert author HTML to inert text', async () => {
  const detail = await artworkDetail('123456', async address => address.includes('/pages') ? reply([{ urls: { regular: image, original: image }, width: 1200, height: 800 }, { urls: { regular: image.replace('_p0', '_p1'), original: image.replace('_p0', '_p1') } }]) : reply({ ...card, urls: { small: image }, description: '<p>A &amp; B</p><img onerror="alert(1)"><br>第二行', tags: { tags: [{ tag: '風景', translation: { en: 'scenery' } }] } }));
  assert.equal(detail.images.length, 2); assert.equal(detail.images[1].original.endsWith('_p1.jpg'), true);
  assert.equal(detail.description, 'A & B\n\n第二行'); assert.equal(detail.tags[0].name, '風景'); assert.equal(detail.description.includes('<'), false);
});

test('restricted details are rejected before requesting original images', async () => {
  let calls = 0;
  await assert.rejects(() => artworkDetail('123456', async () => { calls++; return reply({ ...card, xRestrict: 1, urls: { small: image } }); }), error => error.status === 403);
  assert.equal(calls, 1);
  assert.equal(artworkCard({ ...card, restrict: 1 }), null);
});

test('artist galleries send numeric first-page flags and exact public work IDs', async () => {
  const result = await userArtworks('456', new URLSearchParams(), async address => {
    const url = new URL(address);
    if (url.pathname.endsWith('/profile/all')) return reply({ illusts: { '123456': null }, manga: {} });
    if (url.pathname.endsWith('/profile/illusts')) { assert.equal(url.searchParams.get('is_first_page'), '1'); assert.deepEqual(url.searchParams.getAll('ids[]'), ['123456']); return reply({ works: { '123456': card } }); }
    return reply({ name: 'Artist', comment: '<p>Hello</p>', imageBig: image });
  });
  assert.equal(result.items.length, 1); assert.equal(result.user.name, 'Artist'); assert.equal(result.total, 1); assert.equal(result.hasNext, false);
});

test('image proxy refuses private, arbitrary, deceptive, redirector and non-image targets', () => {
  assert.equal(imageSource(image), image);
  for (const source of ['http://i.pximg.net/img-original/a.jpg', 'https://127.0.0.1/a.jpg', 'https://i.pximg.net.evil.test/img-original/a.jpg', 'https://evil@i.pximg.net/img-original/a.jpg', 'https://i.pximg.net:8443/img-original/a.jpg', 'https://i.pximg.net/img-original/a.svg', 'https://i.pximg.net/redirect.jpg', image + '?next=https://evil.test', image + '#x', 'file:///a.jpg']) assert.throws(() => imageSource(source));
});

test('image proxy preserves image content and downloadable filename with redirect disabled', async () => {
  const response = await api('/api/image?' + new URLSearchParams({ url: image, download: '1' }), async (address, options) => {
    assert.equal(address, image); assert.equal(options.redirect, 'manual'); assert.equal(options.headers.Cookie, undefined);
    return new Response(new Uint8Array([255, 216, 255, 217]), { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '4' } });
  });
  assert.equal(response.status, 200); assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(response.headers.get('Content-Length'), '4');
  assert.match(response.headers.get('Content-Disposition'), /attachment; filename="pixiv-123456_p0.jpg"/);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [255, 216, 255, 217]);
});

test('HTML masquerading as a picture and invalid upstream JSON cannot look like success', async () => {
  const picture = await api('/api/image?' + new URLSearchParams({ url: image }), async () => new Response('<html>blocked</html>', { headers: { 'Content-Type': 'text/html' } }));
  assert.equal(picture.status, 502);
  const search = await api('/api/search?q=猫', async () => new Response('<html>blocked</html>'));
  assert.equal(search.status, 502); assert.equal((await search.json()).code, 'INVALID_RESPONSE');
});

test('Workers-compatible manual fetch refuses upstream redirects without following their destinations', async () => {
  let calls = 0;
  const redirect = async (_address, options) => {
    calls++; assert.equal(options.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: 'https://example.com/private' } });
  };
  const search = await api('/api/search?q=猫', redirect);
  const picture = await api('/api/image?' + new URLSearchParams({ url: image }), redirect);
  assert.equal(search.status, 502); assert.equal(picture.status, 502); assert.equal(calls, 2);
});

test('image connection interruption retries once without turning permanent failures into loops', async () => {
  let calls = 0;
  const response = await api('/api/image?' + new URLSearchParams({ url: image }), async () => {
    calls++; if (calls === 1) throw Error('temporary reset');
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } });
  });
  assert.equal(response.status, 200); assert.equal(calls, 2);
  calls = 0;
  const unavailable = await api('/api/image?' + new URLSearchParams({ url: image }), async () => { calls++; throw Error('offline'); });
  assert.equal(unavailable.status, 502); assert.equal(calls, 2);
});

test('deleted artwork and unavailable upstream produce honest errors without caching failures', async () => {
  const missing = await api('/api/artworks/123456', async () => new Response(JSON.stringify({ error: true, message: 'sensitive diagnostic' })));
  assert.equal(missing.status, 404); assert.equal(missing.headers.get('Cache-Control'), 'no-store');
  const failed = await api('/api/search?q=猫', async () => { throw Error('private connection detail'); });
  assert.equal(failed.status, 502); assert.equal((await failed.text()).includes('private connection detail'), false);
});

test('unknown routes and mutation requests are rejected', async () => {
  assert.equal((await api('/api/not-a-route')).status, 404);
  assert.equal((await handleApi(new Request('https://pixiv.yukino.bond/api/search?q=cat', { method: 'POST' }))).status, 405);
});

test('page responses include same-origin content and frame protections', async () => {
  const response = await worker.fetch(new Request('https://pixiv.yukino.bond/artworks/123456'), { ASSETS: { fetch: async () => new Response('<html>app</html>', { headers: { 'Content-Type': 'text/html' } }) } }, {});
  assert.equal(response.status, 200); assert.match(response.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/); assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
});
