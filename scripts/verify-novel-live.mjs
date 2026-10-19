import { ProxyAgent, setGlobalDispatcher } from 'undici';
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) setGlobalDispatcher(new ProxyAgent(proxy));
const origin = process.env.NOVEL_ORIGIN || 'https://novel.yukino.bond';
async function get(path) {
  let lastError;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const response = await fetch(origin + path, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 5) { console.log(`Waiting for live DNS and API readiness (${attempt + 1}/6)`); await new Promise(resolve => setTimeout(resolve, 10000)); }
    }
  }
  throw lastError;
}
const index = await get('/'); if (!(await index.text()).includes('Yukino Novel')) throw new Error('Reader shell is missing');
const status = await (await get('/api/status?refresh=1')).json();
if (!status.data?.indexed || !status.data?.persisted || status.meta?.stale) throw new Error('Live persistent catalog has not synchronized');
if (status.data.sources?.length !== 4) throw new Error('Four source definitions are missing');
const search = await (await get('/api/books?source=bili&q=' + encodeURIComponent('实力'))).json();
if (!search.data?.items?.some(x => x.title.includes('实力'))) throw new Error('Live Chinese search did not return matching novels');
for (const source of ['sf','linovel']) {
  const results = await (await get(`/api/books?source=${source}&q=${encodeURIComponent('魔女')}`)).json();
  if (!results.data?.items?.some(book=>book.source===source) || ['error','restricted'].includes(results.data.sources?.[0]?.state)) throw new Error(`${source}: live public search unavailable`);
  console.log(`${source}: ${results.data.total} public search results`);
}
for (const id of ['sf-775221','linovel-122429','wenku-1973']) {
  const detail = await (await get(`/api/book/${id}`)).json();
  if (!detail.data?.volumes?.length || !detail.data.title) throw new Error(`${id}: missing source detail or TOC`);
  const volume = await (await get(`/api/book/${id}/volume/${detail.data.volumes[0].id}`)).json();
  const chapter = volume.data?.chapters?.find(item=>!item.restricted && !/KEYWORDS/i.test(item.title));
  if (!chapter) throw new Error(`${id}: no public chapter`);
  const body = await (await get(`/api/book/${id}/chapter/${chapter.id}`)).json();
  if (!body.data?.blocks?.length || body.data.bookId!==id) throw new Error(`${id}: no readable public text`);
  console.log(`${id}: ${detail.data.volumes.length} volumes, ${body.data.blocks.length} public content blocks`);
}
console.log(`Live novel site verified: ${status.data.indexed} discovered records, four sources, persistent cache, ${status.meta.checkedAt}`);
