const { app, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createSystemFetch } = require('../desktop/system-fetch.cjs');
const destination = path.resolve(process.argv.find(value => value.startsWith('--out='))?.slice(6) || 'qa-output/source-checks.json');
app.whenReady().then(async () => {
  const { SERVERS } = await import(pathToFileURL(path.join(__dirname, '../src/servers.mjs')).href);
  const { requestSpec } = await import(pathToFileURL(path.join(__dirname, '../src/engine.mjs')).href);
  const fetcher = createSystemFetch(session.fromPartition('source-audit', { cache: false }));
  const onlyIds = process.argv.find(value => value.startsWith('--ids='))?.slice(6).split(',');
  const sources = SERVERS.filter(source => source.url && (!onlyIds || onlyIds.includes(source.id))), results = [];
  if (!sources.length) throw new Error('没有匹配的预置源');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  let index = 0;
  const save = () => { fs.writeFileSync(destination + '.tmp', JSON.stringify({ checkedAt: new Date().toISOString(), total: sources.length, completed: results.length, sources: results }, null, 2)); fs.renameSync(destination + '.tmp', destination); };
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (index < sources.length) {
      const source = sources[index++], controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000); let reader;
      try {
        const spec = requestSpec({ ...source, cacheBust: source.cacheBust !== false }, 8192, index);
        const response = await fetcher(spec.url, { headers: spec.headers, signal: controller.signal });
        const mime = response.headers.get('content-type') || '', range = response.headers.get('content-range');
        reader = response.body?.getReader(); let bytes = 0;
        while (reader && bytes < 8192) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.byteLength; }
        results.push({ checkedAt: new Date().toISOString(), id: source.id, name: source.name, url: source.url, status: response.status, bytes, mime, range, ok: response.ok && bytes > 0 && !/text\/html|application\/json|text\/xml/.test(mime) });
      } catch (error) { results.push({ checkedAt: new Date().toISOString(), id: source.id, name: source.name, url: source.url, ok: false, error: error.message }); }
      finally { clearTimeout(timeout); await reader?.cancel().catch(() => {}); controller.abort(); save(); }
    }
  }));
  const passed = results.filter(source => source.ok).length;
  console.log(JSON.stringify({ checked: results.length, passed, failed: results.length - passed, output: destination }));
  app.exit(passed === results.length ? 0 : 1);
}).catch(error => { console.error(error.message); app.exit(1); });
