import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES, mediaKind, queryPlan } from '../server/catalog.mjs';
import { normalize, mergeCatalog, publicUrl, plain, splitId } from '../server/sources.mjs';
import {sourceNames,isMediaId} from '../shared/source-names.mjs';
import { cached, catalog, detail, upstream } from '../server/service.mjs';
import { mediaPath, verifyMedia, rewriteManifest, safeFetch, serveMedia } from '../server/media.mjs';
import worker from '../server/worker.mjs';

const source = SOURCES.find(item => item.id === 'bf');
const sample = {
  vod_id: 875,
  type_id: 26,
  type_name: '剧情片',
  vod_name: '测试电影 &amp; 旅程',
  vod_year: '2026',
  vod_time: '2026-10-19 10:00:00',
  vod_remarks: '正片',
  vod_pic: 'https://cdn.cinema.example.com/cover.jpg',
  vod_content: '<p>一个故事 &amp; 旅程</p><script>bad()</script>',
  vod_play_from: 'share$$$bfm3u8',
  vod_play_url: '分享$https://cdn.cinema.example.com/share/1$$$正片$https://cdn.cinema.example.com/video/index.m3u8#预告$https://cdn.cinema.example.com/video/2.mp4#非法$javascript:alert(1)',
};
const site = 'https://cinema.yukino.bond';
const tokenOf = path => new URL(path, site).searchParams.get('token');

test('recognizes movies, series, variety and documentaries for every configured provider', () => {
  const labels = { movie: '剧情片', series: '国产剧', variety: '大陆综艺', doc: '纪录片' };
  for (const provider of SOURCES) {
    for (const [kind, label] of Object.entries(labels)) {
      const type = Object.values(provider.categories[kind])[0];
      const record = { ...sample, type_id: type, type_name: label };
      assert.equal(mediaKind(record, provider), kind, `${provider.id}: ${label}`);
      assert.equal(normalize(record, provider).mediaKind, kind);
    }
  }
});

test('keeps all eight source IDs valid across the server and browser registry',()=>{
  assert.equal(SOURCES.length,8);
  assert.deepEqual(Object.keys(sourceNames),SOURCES.map(source=>source.id));
  for(const provider of SOURCES){
    assert.equal(provider.name,sourceNames[provider.id]);
    assert.equal(splitId(provider.id+'-123').source,provider);
    assert.equal(splitId(provider.id+'-123').native,'123');
    assert(isMediaId(provider.id+'-123'));
  }
  for(const id of ['other-123','hn-0','md-1234567890','../dz-123','jy-1?url=x'])assert.equal(splitId(id),null);
});

test('uses the new providers actual category IDs and reports absent genres without querying another category',()=>{
  const records={jy:[[14,'剧情片','movie'],[20,'内地剧','series'],[36,'大陆综艺','variety'],[16,'记录片','doc']],md:[[15,'剧情片','movie'],[26,'国产剧','series'],[34,'大陆综艺','variety'],[24,'记录片','doc']],hn:[[10,'剧情片','movie'],[12,'国产剧','series'],[39,'大陆综艺','variety'],[19,'纪录片','doc']],dz:[[6,'剧情片','movie'],[13,'国产剧','series'],[3,'综艺','variety'],[24,'纪录片','doc']]};
  for(const [id,cases]of Object.entries(records))for(const [type_id,type_name,expected]of cases)assert.equal(mediaKind({type_id,type_name},SOURCES.find(source=>source.id===id)),expected,id+': '+type_name);
  assert.deepEqual(queryPlan(SOURCES.find(source=>source.id==='dz'),{category:'variety',genre:'cn'}).types,[]);
  assert.deepEqual(queryPlan(SOURCES.find(source=>source.id==='jy'),{category:'movie',genre:'family'}).types,[]);
});

test('rejects anime, restricted material, unsupported categories and conflicting category labels', () => {
  for (const type_name of ['日韩动漫', '国产动画', '里番', '伦理片', '理论片', '成人写真', '电影解说', '体育赛事', '短剧']) {
    assert.equal(normalize({ ...sample, type_name }, source), null, type_name);
  }
  assert.equal(normalize({ ...sample, type_id: 999, type_name: '未知分类' }, source), null);
  assert.equal(normalize({ ...sample, type_name: '国产剧' }, source), null, 'a movie ID must not absorb a series label');
  assert.equal(normalize({ ...sample, type_id: 31, type_name: '剧情片' }, source), null, 'a series ID must not absorb a movie label');
  assert.equal(normalize({ ...sample, type_id: 28, type_name: '大陆综艺' }, source), null, 'a documentary ID must not absorb a variety label');
  assert.equal(normalize({ ...sample, vod_id: 'bad' }, source), null);
});

test('normalizes text and playable lines while preserving original line and episode identifiers', () => {
  const media = normalize(sample, source);
  assert.equal(media.title, '测试电影 & 旅程');
  assert.equal(media.description, '一个故事 & 旅程');
  assert.equal(media.updatedAt, '2026-10-19T10:00:00+08:00');
  assert.equal(media.completed, true);
  assert.equal(media.lines.length, 1);
  assert.equal(media.lines[0].id, '1');
  assert.deepEqual(media.lines[0].episodes.map(({ id, kind }) => ({ id, kind })), [{ id: '0', kind: 'hls' }, { id: '1', kind: 'mp4' }]);
  assert.equal(plain('<style>bad</style><p>good &lt; text</p>'), 'good < text');
});

test('rotates at most three categories per request and visits every genre before advancing the native page', () => {
  for (const provider of SOURCES) {
    for (const [category, genres] of Object.entries(provider.categories)) {
      const expected = [...new Set(Object.values(genres))];
      const groups = Math.ceil(expected.length / 3);
      const visited = [];
      for (let page = 1; page <= groups * 2; page++) {
        const plan = queryPlan(provider, { category, page });
        assert(plan.types.length >= 1 && plan.types.length <= 3, `${provider.id}: ${category} page ${page}`);
        assert.equal(plan.nativePage, page <= groups ? 1 : 2);
        assert.equal(plan.hasNextGroup, (page - 1) % groups < groups - 1);
        assert.deepEqual(plan.types, expected.slice(((page - 1) % groups) * 3, ((page - 1) % groups) * 3 + 3));
        if (page <= groups) visited.push(...plan.types);
      }
      assert.deepEqual(visited, expected, `${provider.id}: ${category} covers all genres exactly once`);
    }
  }
});

test('keeps explicit genre pagination native and bounds the all-category discovery plan', () => {
  for (const provider of SOURCES) {
    assert.deepEqual(queryPlan(provider, { category: 'movie', genre: 'action', page: 4 }), {
      types: [provider.categories.movie.action], nativePage: 4, hasNextGroup: false,
    });
    assert.deepEqual(queryPlan(provider, { category: 'all', q: 'search', page: 3 }), { types: [undefined], nativePage: 3, hasNextGroup: false });
    assert.deepEqual(queryPlan(provider, { category: 'movie', q: 'search', page: 3 }), { types: [undefined], nativePage: 3, hasNextGroup: false });
    assert.deepEqual(queryPlan(provider, { category: 'all', page: 2 }).types, [undefined, provider.categories.movie.drama, provider.categories.series.cn]);
    assert.deepEqual(queryPlan(provider, { category: 'missing' }).types, []);
    assert.deepEqual(queryPlan(provider, { category: 'movie', genre: 'missing' }).types, []);
  }
});

test('deduplicates repeated provider rows and cross-provider variants without merging a same-name movie and series', () => {
  const movie = normalize(sample, source);
  const alternate = { ...movie, id: 'ff-25', source: 'ff', sourceName: '非凡', updatedAt: '2026-10-19T11:00:00+08:00' };
  const series = { ...movie, id: 'bf-876', mediaKind: 'series', category: '国产剧' };
  const merged = mergeCatalog([movie, movie, alternate, alternate, series]);
  assert.equal(merged.length, 2);
  const mergedMovie = merged.find(item => item.mediaKind === 'movie');
  assert.deepEqual(mergedMovie.variants.map(item => item.id), ['bf-875', 'ff-25']);
  assert.equal(mergedMovie.updatedAt, alternate.updatedAt);
  assert.equal(merged.find(item => item.mediaKind === 'series').variants.length, 1);
  for (const record of merged) {
    assert(!('lines' in record));
    assert(!('imageUrl' in record));
    assert(!JSON.stringify(record).includes('cdn.cinema.example.com'));
  }
});

test('retains successful genres from one source when another genre fails and reports partial status', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input);
    assert.equal(url.hostname, 'bfzyapi.com');
    calls.push({ type: url.searchParams.get('t'), page: url.searchParams.get('pg') });
    if (url.searchParams.get('t') === '21') return new Response('offline', { status: 503 });
    const comedy = url.searchParams.get('t') === '22';
    return Response.json({ code: 1, pagecount: 1, list: [{ ...sample, vod_id: comedy ? 8881 : 8880, vod_name: comedy ? '成功的喜剧' : '成功的剧情', type_id: comedy ? 22 : 26, type_name: comedy ? '喜剧片' : '剧情片' }] });
  });
  const result = await catalog({}, new URLSearchParams('source=bf&category=movie'));
  assert.deepEqual(calls.map(item => item.type).sort(), ['21', '22', '26']);
  assert(calls.every(item => item.page === '1'));
  assert.equal(result.data.length, 2);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].state, 'partial');
  assert.equal(result.sources[0].count, 2);
  assert.match(result.sources[0].reason, /HTTP 503/);
  assert.equal(result.meta.stale, false);
  assert.equal(result.hasMore, true, 'remaining genre groups stay reachable');
});

test('keeps usable providers when other providers fail and removes irrelevant results from a category', async t => {
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input);
    if (url.hostname !== 'bfzyapi.com') throw Error('offline');
    return Response.json({ code: 1, pagecount: 2, list: [sample, { ...sample, vod_id: 8883, type_id: 31, type_name: '国产剧' }] });
  });
  const result = await catalog({}, new URLSearchParams('category=movie&genre=drama&q=partial-provider-test'));
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].mediaKind, 'movie');
  assert.equal(result.sources.find(item => item.id === 'bf').state, 'ok');
  assert.equal(result.sources.find(item => item.id === 'ff').state, 'error');
  assert.match(result.sources.find(item => item.id === 'ff').reason, /连接失败/);
  assert.equal(result.hasMore, true);
});

test('searches every genre and filters cached mixed-kind results separately for each selected category',async t=>{
  const calls=[];
  t.mock.method(globalThis,'fetch',async input=>{
    const url=new URL(input);calls.push(url);assert.equal(url.searchParams.get('t'),null,'a movie search must include science fiction outside the first genre group');
    return Response.json({code:1,pagecount:1,list:[{...sample,vod_id:8991,type_id:24,type_name:'科幻片'},{...sample,vod_id:8992,type_id:31,type_name:'国产剧'}]});
  });
  const base='source=bf&q=mixed-kind-cache-search';
  const movies=await catalog({},new URLSearchParams(base+'&category=movie'));
  const series=await catalog({},new URLSearchParams(base+'&category=series'));
  const all=await catalog({},new URLSearchParams(base));
  assert.deepEqual(movies.data.map(item=>item.id),['bf-8991']);
  assert.deepEqual(series.data.map(item=>item.id),['bf-8992']);
  assert.equal(all.data.length,2,'the first filtered request must not remove other kinds from shared cache');
  assert.equal(calls.length,1,'all three views can share one unfiltered provider response');
});

test('retains the original timestamp of a successful cache after an upstream failure', async () => {
  const old = { time: Date.now() - 600000, value: { items: ['saved'] } };
  let writes = 0;
  const env = { CINEMA_CACHE: { get: async () => old, put: async () => { writes++; } } };
  const result = await cached(env, 'cinema-stale-test', async () => { throw Error('upstream offline'); });
  assert.equal(result.stale, true);
  assert.deepEqual(result.value.items, ['saved']);
  assert.equal(result.checkedAt, new Date(old.time).toISOString());
  assert.equal(result.reason, 'upstream offline');
  assert.equal(writes, 0, 'a failed refresh cannot renew stale cache lifetime');
});

test('retains old timestamps when stale catalog rows seed the detail cache', async t => {
  const old = { time: Date.now() - 600000, value: { items: [normalize({ ...sample, vod_id: 8884 }, source)], pagecount: 1 } };
  const env = { CINEMA_CACHE: { get: async key => key==='home:v1:bf' ? {parts:['all',26,31].map(type=>({key:`catalog:v1:bf:${type}:1:`,entry:old}))} : null, put: async () => assert.fail('failed refresh must not write') } };
  t.mock.method(globalThis, 'fetch', async () => { throw Error('offline'); });
  const result = await catalog(env, new URLSearchParams('source=bf'));
  assert.equal(result.sources[0].state, 'stale');
  assert.equal(result.sources[0].checkedAt, new Date(old.time).toISOString());
  assert.equal(result.meta.checkedAt, new Date(old.time).toISOString());
  assert.equal(result.meta.stale, true);
  const record = await detail(env, 'bf-8884');
  assert.equal(record.stale, true);
  assert.equal(record.checkedAt, new Date(old.time).toISOString());
  assert.equal(record.value.id, 'bf-8884');
});

test('rejects invalid catalog filters before fetching upstream', async t => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('invalid filters must not reach a provider'));
  for (const query of ['category=anime', 'category=series&genre=action', 'source=unknown']) {
    await assert.rejects(catalog({}, new URLSearchParams(query)), { status: 400 });
  }
});

test('uses the Workers-compatible manual redirect mode and rejects provider redirects', async t => {
  let mode;
  t.mock.method(globalThis, 'fetch', async (_input, options) => {
    mode = options.redirect;
    return new Response('', { status: 302, headers: { Location: 'https://other.example.com/' } });
  });
  await assert.rejects(upstream(source, { ac: 'detail', t: 26 }), /HTTP 302/);
  assert.equal(mode, 'manual');
});

test('follows validated media redirects manually and refuses redirects to private addresses', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input);
    calls.push(url.href);
    assert.equal(options.redirect, 'manual');
    if (url.pathname === '/first.m3u8') return new Response('', { status: 302, headers: { Location: '/last.m3u8' } });
    if (url.pathname === '/private.m3u8') return new Response('', { status: 307, headers: { Location: 'http://127.0.0.1/secret' } });
    return new Response('#EXTM3U\n#EXT-X-ENDLIST');
  });
  const result = await safeFetch('https://cdn.example.com/first.m3u8');
  assert.equal(result.url, 'https://cdn.example.com/last.m3u8');
  assert.equal(result.response.status, 200);
  await assert.rejects(safeFetch('https://cdn.example.com/private.m3u8'), /不支持的地址/);
  assert(!calls.some(url => url.includes('127.0.0.1')));
});

test('refuses private addresses, unsupported schemes, credentials and unapproved ports', () => {
  for (const url of ['http://127.0.0.1/x', 'http://0x7f000001/x', 'http://[::1]/', 'http://localhost/', 'http://service.internal/x', 'file:///x', 'javascript:alert(1)', 'https://user:pass@cdn.example.com/a', 'https://cdn.example.com:8080/a']) {
    assert.equal(publicUrl(url), null, url);
  }
  assert(publicUrl('https://cdn.example.com/a.m3u8'));
  assert(publicUrl('https://kkzycdn.com:65/video/part.ts'));
  assert(publicUrl('https://hnts.ymuuy.com:65/hls/video/part.ts'));
  assert.equal(publicUrl('http://hnts.ymuuy.com:65/part.ts'),null);
  assert.equal(publicUrl('https://other.ymuuy.com:65/part.ts'),null);
  assert(publicUrl('https://c.baisiweiting.com:18443/hls/video/part.ts'));
  assert.equal(publicUrl('https://other.baisiweiting.com:18443/part.ts'),null);
  assert.equal(publicUrl('https://c.baisiweiting.com:18444/part.ts'),null);
  assert.equal(publicUrl('https://other.example.com:65/part.ts'), null);
});

test('authenticates playback links and rejects payload tampering, wrong keys and invalid lifetimes', async () => {
  const env = { CINEMA_MEDIA_SECRET: 'a-long-cinema-test-key' };
  const target = 'https://cdn.example.com/video/index.m3u8';
  const token = tokenOf(await mediaPath(env, target));
  assert.equal((await verifyMedia(env, token)).u, target);
  const [data, signature] = token.split('.');
  const altered = JSON.parse(Buffer.from(data, 'base64url').toString());
  altered.u = 'https://other.example.com/other.m3u8';
  const tampered = Buffer.from(JSON.stringify(altered)).toString('base64url') + '.' + signature;
  await assert.rejects(verifyMedia(env, tampered), { status: 403 });
  await assert.rejects(verifyMedia({ CINEMA_MEDIA_SECRET: 'another-key' }, token), { status: 403 });
  await assert.rejects(verifyMedia(env, token + '.extra'), { status: 403 });
  await assert.rejects(verifyMedia(env, tokenOf(await mediaPath(env, target, Date.now() - 1000))), { status: 403 });
  await assert.rejects(verifyMedia(env, tokenOf(await mediaPath(env, target, Date.now() + 14 * 3600000))), { status: 403 });
  await assert.rejects(mediaPath({}, target), { status: 503 });
});

test('rewrites HLS segments, subplaylists, keys and map URIs to signed same-origin media requests', async () => {
  const env = { CINEMA_MEDIA_SECRET: 'manifest-test-key' };
  const manifest = await rewriteManifest('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXT-X-MAP:URI="init.mp4"\n#EXT-X-STREAM-INF:BANDWIDTH=100\nlevel/index.m3u8\n#EXTINF:6,\n../part.ts\n', 'https://cdn.example.com/video/index.m3u8', env, Date.now() + 60000);
  const signed = [...manifest.matchAll(/(?:URI="|^)(\/api\/media\?token=[^"\s]+)/gm)].map(match => match[1]);
  assert.equal(signed.length, 4);
  const targets = await Promise.all(signed.map(async path => (await verifyMedia(env, tokenOf(path))).u));
  assert.deepEqual(targets, ['https://cdn.example.com/video/key.bin', 'https://cdn.example.com/video/init.mp4', 'https://cdn.example.com/video/level/index.m3u8', 'https://cdn.example.com/part.ts']);
  await assert.rejects(rewriteManifest('<html>no video</html>', 'https://cdn.example.com/a', env, Date.now() + 60000));
  await assert.rejects(rewriteManifest('#EXTM3U\nhttp://127.0.0.1/secret', 'https://cdn.example.com/a', env, Date.now() + 60000));
});

test('streams direct MP4 and M4V movies larger than 50 MB without buffering the upstream body', async t => {
  const env = { CINEMA_MEDIA_SECRET: 'large-movie-test-key' };
  const length = 300 * 1024 * 1024;
  const prefix = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);
  let pulls = 0;
  let cancellations = 0;
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    assert.match(String(input), /movie\.(?:mp4|m4v)$/);
    assert.equal(options.redirect, 'manual');
    const body = new ReadableStream({
      pull(controller) { pulls++; controller.enqueue(prefix); },
      cancel() { cancellations++; },
    }, { highWaterMark: 0 });
    const response = new Response(body, { headers: { 'Content-Type': String(input).endsWith('.m4v') ? 'video/x-m4v' : 'video/mp4', 'Content-Length': String(length), 'Accept-Ranges': 'bytes' } });
    response.text = () => assert.fail('a movie must not be buffered as text');
    response.arrayBuffer = () => assert.fail('a movie must not be buffered as an array');
    return response;
  });
  for (const extension of ['mp4', 'm4v']) {
    const path = await mediaPath(env, `https://cdn.example.com/movie.${extension}`);
    assert.equal((await verifyMedia(env, tokenOf(path))).file, true);
    const before = pulls;
    const response = await serveMedia(new Request(new URL(path, site)), env, new URL(path, site));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Length'), String(length));
    assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
    assert.equal(pulls, before, 'serving headers must not consume movie bytes');
    const reader = response.body.getReader();
    assert.deepEqual((await reader.read()).value, prefix);
    assert.equal(pulls, before + 1);
    await reader.cancel();
  }
  assert.equal(cancellations, 2);
});

test('clears the direct-file connection timeout after headers so a movie can keep streaming after 25 seconds', async t => {
  const env = { CINEMA_MEDIA_SECRET: 'long-stream-test-key' };
  const path = await mediaPath(env, 'https://cdn.example.com/movie.mp4');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  t.mock.method(globalThis, 'fetch', async (_input, options) => {
    signal = options.signal;
    assert(!Object.hasOwn(options, 'headersOnlyTimeout'), 'proxy-specific options cannot reach Workers fetch');
    const body = new ReadableStream({
      start(controller) { signal.addEventListener('abort', () => controller.error(Error('stream aborted')), { once: true }); },
      pull(controller) { controller.enqueue(new Uint8Array([7, 8, 9])); controller.close(); },
    }, { highWaterMark: 0 });
    return new Response(body, { headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(300 * 1024 * 1024) } });
  });
  const response = await serveMedia(new Request(new URL(path, site)), env, new URL(path, site));
  t.mock.timers.tick(30000);
  assert.equal(signal.aborted, false, 'the connection deadline must not become a movie-duration deadline');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([7, 8, 9]));
});

test('still aborts a direct-file connection if no upstream headers arrive within 25 seconds', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  t.mock.method(globalThis, 'fetch', async (_input, options) => {
    signal = options.signal;
    assert(!Object.hasOwn(options, 'headersOnlyTimeout'));
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  });
  const attempt = safeFetch('https://cdn.example.com/movie.mp4', {}, { headersOnlyTimeout: true });
  const rejected = assert.rejects(attempt, /视频线路连接失败/);
  t.mock.timers.tick(24999);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(1);
  await rejected;
  assert.equal(signal.aborted, true);
});

test('forwards movie byte ranges and preserves partial-response headers for large ranges and suffix seeks', async t => {
  const env = { CINEMA_MEDIA_SECRET: 'range-movie-test-key' };
  const path = await mediaPath(env, 'https://cdn.example.com/movie.mp4');
  const total = 300 * 1024 * 1024;
  const cases = [
    { range: 'bytes=0-', length: total, contentRange: `bytes 0-${total - 1}/${total}` },
    { range: 'bytes=1048576-', length: total - 1048576, contentRange: `bytes 1048576-${total - 1}/${total}` },
    { range: 'bytes=1024-2047', length: 1024, contentRange: `bytes 1024-2047/${total}` },
    { range: 'bytes=-512', length: 512, contentRange: `bytes ${total - 512}-${total - 1}/${total}` },
  ];
  let current;
  t.mock.method(globalThis, 'fetch', async (_input, options) => {
    assert.equal(options.headers.Range, current.range);
    return new Response(new Uint8Array([42]), { status: 206, headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(current.length), 'Content-Range': current.contentRange, 'Accept-Ranges': 'bytes' } });
  });
  for (current of cases) {
    const request = new Request(new URL(path, site), { headers: { Range: current.range } });
    const response = await serveMedia(request, env, new URL(path, site));
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('Content-Range'), current.contentRange);
    assert.equal(response.headers.get('Content-Length'), String(current.length));
    assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([42]));
  }
});

test('preserves an unsatisfiable movie range response and does not forward malformed multipart ranges', async t => {
  const env = { CINEMA_MEDIA_SECRET: 'invalid-range-test-key' };
  const path = await mediaPath(env, 'https://cdn.example.com/movie.m4v');
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (_input, options) => {
    calls.push(options.headers.Range);
    if (options.headers.Range) return new Response('range error', { status: 416, headers: { 'Content-Range': 'bytes */1000', 'Accept-Ranges': 'bytes' } });
    return new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'video/x-m4v' } });
  });
  const response = await serveMedia(new Request(new URL(path, site), { headers: { Range: 'bytes=1001-' } }), env, new URL(path, site));
  assert.equal(response.status, 416);
  assert.equal(response.headers.get('Content-Range'), 'bytes */1000');
  assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(await response.text(), '');
  const malformed = await serveMedia(new Request(new URL(path, site), { headers: { Range: 'bytes=0-1,3-4' } }), env, new URL(path, site));
  assert.equal(malformed.status, 200);
  assert.deepEqual(calls, ['bytes=1001-', undefined]);
});

test('retains the 50 MB HLS segment limit even when a signed playlist resource ends in MP4', async t => {
  const env = { CINEMA_MEDIA_SECRET: 'segment-limit-test-key' };
  const manifest = await rewriteManifest('#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6,\nsegment.mp4\n#EXTINF:6,\nsegment.ts\n', 'https://cdn.example.com/video/index.m3u8', env, Date.now() + 60000);
  const signed = [...manifest.matchAll(/(?:URI="|^)(\/api\/media\?token=[^"\s]+)/gm)].map(match => match[1]);
  assert.equal(signed.length, 3);
  t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(51 * 1024 * 1024) } }));
  for (const path of signed) {
    assert.equal((await verifyMedia(env, tokenOf(path))).file, undefined, 'HLS resources cannot receive direct-file privileges');
    await assert.rejects(serveMedia(new Request(new URL(path, site)), env, new URL(path, site)), /视频分片超过大小限制/);
  }
  const [data, signature] = tokenOf(signed[1]).split('.');
  const altered = { ...JSON.parse(Buffer.from(data, 'base64url').toString()), file: true };
  await assert.rejects(verifyMedia(env, Buffer.from(JSON.stringify(altered)).toString('base64url') + '.' + signature), { status: 403 });
});

test('serves deep routes with HTTP 200, preserves missing asset errors and protects API methods', async () => {
  const requests = [];
  const env = { ASSETS: { fetch: async request => {
    requests.push(new URL(request.url).pathname);
    return new URL(request.url).pathname === '/' ? new Response('<div id="root"></div>', { headers: { 'Content-Type': 'text/html' } }) : new Response('not found', { status: 404 });
  } } };
  for (const path of ['/watch/bf-875/1/0', '/title/bf-875', '/library']) {
    const response = await worker.fetch(new Request(site + path), env, {});
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), /id="root"/);
    assert.equal(response.headers.get('Cache-Control'), 'no-cache');
    assert.match(response.headers.get('Content-Security-Policy'), /media-src 'self' blob:/);
  }
  const before = requests.length;
  assert.equal((await worker.fetch(new Request(site + '/missing.js'), env, {})).status, 404);
  assert.equal(requests.length, before + 1, 'a missing asset cannot receive the SPA HTML');
  assert.equal((await worker.fetch(new Request(site + '/api/catalog', { method: 'POST' }), env, {})).status, 405);
  const blocked = await worker.fetch(new Request(site + '/api/media?url=https://localhost/x'), env, {});
  assert.equal(blocked.status, 401);
  assert.equal((await blocked.json()).code, 'LOGIN_REQUIRED');
});

test('returns episode metadata without upstream addresses and serves signed playback manifests', async t => {
  const env = { CINEMA_MEDIA_SECRET: 'worker-test-key' };
  const session = `e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.cinema`;
  const headers = {Cookie:`__Secure-yukino_session=${session}`};
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input);
    if (url.hostname === 'www.yukino.bond') { assert.equal(url.pathname, '/api/auth/access'); return Response.json({user:{id:101,name:'Cinema Viewer',role:'user'}}); }
    if (url.hostname === 'bfzyapi.com') return Response.json({ code: 1, list: [{ ...sample, vod_id: 8885 }] });
    assert.equal(url.hostname, 'cdn.cinema.example.com');
    assert(url.pathname.endsWith('.m3u8'));
    return new Response('#EXTM3U\n#EXTINF:6,\nchunk.ts\n#EXT-X-ENDLIST', { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } });
  });
  const response = await worker.fetch(new Request(site + '/api/title/bf-8885'), env, {});
  assert.equal(response.status, 200);
  const text = await response.text();
  assert(!text.includes('cdn.cinema.example.com'));
  const record = JSON.parse(text);
  assert.equal(record.data.lines[0].id, '1');
  assert.equal(record.data.lines[0].episodes[0].title, '正片');
  assert(!('url' in record.data.lines[0].episodes[0]));
  assert(!('imageUrl' in record.data));
  const guest = await worker.fetch(new Request(site + '/api/title/bf-8885/play?line=1&episode=0'), env, {});
  assert.equal(guest.status, 401);
  assert.equal((await guest.json()).code, 'LOGIN_REQUIRED');
  assert.equal((await worker.fetch(new Request(site + '/api/media?url=https://localhost/x',{headers}), env, {})).status,403);
  const invalid = await worker.fetch(new Request(site + '/api/title/bf-8885/play?line=missing&episode=0',{headers}), env, {});
  assert.equal(invalid.status, 404);
  const playback = await worker.fetch(new Request(site + '/api/title/bf-8885/play?line=1&episode=0',{headers}), env, {});
  assert.equal(playback.status, 200);
  const play = await playback.json();
  assert(play.data.url.startsWith('/api/media?token='));
  assert.equal((await verifyMedia(env, tokenOf(play.data.url))).u, sample.vod_play_url.split('$$$')[1].split('#')[0].split('$')[1]);
  const manifest = await worker.fetch(new Request(new URL(play.data.url, site),{headers}), env, {});
  assert.equal(manifest.status, 200);
  assert.equal(manifest.headers.get('Cache-Control'), 'private, no-store');
  assert.match(manifest.headers.get('Content-Type'), /mpegurl/);
  const rewritten = await manifest.text();
  const chunk = rewritten.split('\n').find(line => line.startsWith('/api/media?token='));
  assert.equal((await verifyMedia(env, tokenOf(chunk))).u, 'https://cdn.cinema.example.com/video/chunk.ts');
});

test('requires a portal session for signed media while retaining authenticated byte-range streaming',async t=>{
  const env={CINEMA_MEDIA_SECRET:'authenticated-range-test-key'};
  const path=await mediaPath(env,'https://cdn.cinema.example.com/authenticated.mp4');
  const session=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.cinemaRange`;
  let upstreamCalls=0,identityCalls=0;
  t.mock.method(globalThis,'fetch',async(input,options)=>{
    if(new URL(input).hostname==='www.yukino.bond'){
      identityCalls++;assert.equal(options.headers.Authorization,`Bearer ${session}`);
      return Response.json({user:{id:103,name:'Range viewer',role:'user'}});
    }
    upstreamCalls++;assert.equal(options.headers.Range,'bytes=1024-2047');
    assert.equal(options.headers.Authorization,undefined);
    return new Response(new Uint8Array([42]),{status:206,headers:{'Content-Type':'video/mp4','Content-Range':'bytes 1024-2047/4096','Content-Length':'1024','Accept-Ranges':'bytes'}});
  });
  const url=new URL(path,site);
  assert.equal((await worker.fetch(new Request(url),env,{})).status,401);
  assert.equal(upstreamCalls,0,'a valid media signature alone must not authorize a guest');
  const response=await worker.fetch(new Request(url,{headers:{Cookie:`__Secure-yukino_session=${session}`,Range:'bytes=1024-2047'}}),env,{});
  assert.equal(response.status,206);assert.equal(response.headers.get('Content-Range'),'bytes 1024-2047/4096');
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Vary'),'Cookie, Authorization');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()),new Uint8Array([42]));
  assert.equal(identityCalls,1);assert.equal(upstreamCalls,1);
});
