import { ProxyAgent, setGlobalDispatcher } from 'undici';
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) setGlobalDispatcher(new ProxyAgent(proxy));
const origin = process.env.NOVEL_ORIGIN || 'https://novel.yukino.bond';
async function get(path, ready = async () => true, allowedStatuses = []) {
  let lastError;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const response = await fetch(origin + path, { signal: AbortSignal.timeout(45000) });
      if (!response.ok && !allowedStatuses.includes(response.status)) throw new Error(`${path}: HTTP ${response.status}`);
      if (!await ready(response.clone())) throw new Error(`${path.split('?')[0]}: source data not ready`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 5) { console.log(`Retrying live verification (${attempt + 1}/6): ${error.message}`); await new Promise(resolve => setTimeout(resolve, 10000)); }
    }
  }
  throw lastError;
}
const getJson = async (path, valid = () => true, allowedStatuses = []) => (await get(path,async response=>valid(await response.json()),allowedStatuses)).json();
const index = await get('/'); if (!(await index.text()).includes('Yukino Novel')) throw new Error('Reader shell is missing');
const deepLink = await get('/sources',async response=>response.url.endsWith('/sources')); if (!(await deepLink.text()).includes('Yukino Novel')) throw new Error('Deep link app shell is missing');
const status = await getJson('/api/status?refresh=1',result=>result.data?.sources?.length===4&&result.data?.indexed&&result.data?.persisted&&!result.meta?.stale);
if (!status.data?.indexed || !status.data?.persisted || status.meta?.stale) throw new Error('Live persistent catalog has not synchronized');
if (status.data.sources?.length !== 4) throw new Error('Four source definitions are missing');
const search = await (await get('/api/books?source=bili&q=' + encodeURIComponent('实力'))).json();
if (!search.data?.items?.some(x => x.title.includes('实力'))) throw new Error('Live Chinese search did not return matching novels');
for (const source of ['sf','linovel']) {
  const results = await getJson(`/api/books?source=${source}&q=${encodeURIComponent('魔女')}`,result=>result.data?.items?.some(book=>book.source===source)&&result.data?.sources?.[0]?.state==='ok');
  if (!results.data?.items?.some(book=>book.source===source) || ['error','restricted'].includes(results.data.sources?.[0]?.state)) throw new Error(`${source}: live public search unavailable`);
  console.log(`${source}: ${results.data.total} public search results`);
}
for (const id of ['sf-775221','linovel-122429']) {
  const detail = await getJson(`/api/book/${id}`,result=>result.data?.volumes?.length&&!result.meta?.stale);
  if (!detail.data?.volumes?.length || !detail.data.title) throw new Error(`${id}: missing source detail or TOC`);
  const volume = await (await get(`/api/book/${id}/volume/${detail.data.volumes[0].id}`)).json();
  const chapter = volume.data?.chapters?.find(item=>!item.restricted && !/KEYWORDS/i.test(item.title));
  if (!chapter) throw new Error(`${id}: no public chapter`);
  const body = await getJson(`/api/book/${id}/chapter/${chapter.id}`,result=>result.data?.blocks?.length&&!result.meta?.stale);
  if (!body.data?.blocks?.length || body.data.bookId!==id) throw new Error(`${id}: no readable public text`);
  console.log(`${id}: ${detail.data.volumes.length} volumes, ${body.data.blocks.length} public content blocks`);
}
const wenku=await getJson('/api/book/wenku-1973',result=>result.data?.volumes?.length||result.sourceUrl==='https://www.wenku8.net/book/1973.htm',[403]);
if(wenku.error)console.log('wenku: source restricts server access; explicit restriction and external reading entry verified');
else console.log(`wenku: ${wenku.data.volumes.length} public volumes; full anonymous search remains limited`);
console.log(`Live novel site verified: ${status.data.indexed} discovered records, four sources, persistent cache, ${status.meta.checkedAt}`);
