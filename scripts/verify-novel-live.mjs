import { ProxyAgent, setGlobalDispatcher } from 'undici';
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) setGlobalDispatcher(new ProxyAgent(proxy));
const origin = process.env.NOVEL_ORIGIN || 'https://novel.yukino.bond';
async function get(path) {
  const response = await fetch(origin + path, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response;
}
const index = await get('/'); if (!(await index.text()).includes('Yukino Novel')) throw new Error('Reader shell is missing');
const status = await (await get('/api/status')).json();
if (!status.data?.indexed || !status.data?.persisted || status.meta?.stale) throw new Error('Live persistent catalog has not synchronized');
const search = await (await get('/api/books?q=' + encodeURIComponent('实力'))).json();
if (!search.data?.items?.some(x => x.title.includes('实力'))) throw new Error('Live Chinese search did not return matching novels');
console.log(`Live novel site verified: ${status.data.indexed} indexed books, persistent cache, Chinese search, ${status.meta.checkedAt}`);
