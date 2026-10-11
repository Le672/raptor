import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { DownloadRunner, validateConfig } from '../src/engine.mjs';
const { createSystemFetch } = createRequire(import.meta.url)('../desktop/system-fetch.cjs');
const systemFetch = createSystemFetch({ fetch: globalThis.fetch });

test('system download adapter preserves shared Range quota and the official source header across redirects', async () => {
  let bytes = 0, failures = 0, sourcePage = '', observed = [];
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/redirect')) { res.writeHead(302, { Location: '/file' }); res.end(); return; }
    observed.push(req.headers.referer);
    if (req.headers.referer !== sourcePage) { failures++; res.writeHead(403); res.end(); return; }
    const range = /bytes=0-(\d+)/.exec(req.headers.range || '');
    const amount = Number(range[1]) + 1; bytes += amount;
    res.writeHead(206, { 'Content-Length': amount, 'Content-Type': 'application/octet-stream' }); res.end(Buffer.alloc(amount));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    sourcePage = 'http://127.0.0.1:' + server.address().port + '/source';
    const runner = new DownloadRunner({ fetcher: systemFetch });
    runner.start({ url: 'http://127.0.0.1:' + server.address().port + '/redirect', referrer: sourcePage, threads: 4, limitBytes: 100_000 });
    await runner.task; assert.equal(runner.status, 'completed', JSON.stringify({message:runner.message,workers:runner.workers,failures,sourcePage,observed})); assert.equal(runner.bytes, 100_000); assert.equal(bytes, 100_000); assert.equal(failures, 0);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('system download adapter blocks local protocols and credentials at request and redirect boundaries', async () => {
  for (const url of ['file:///C:/Windows/test', 'https://user:secret@example.com/file']) await assert.rejects(systemFetch(url));
  for (const referrer of ['file:///C:/private','https://user:secret@example.com/']) assert.throws(() => validateConfig({ url:'https://example.com/file', referrer }));
  let guard;
  createSystemFetch({ fetch: globalThis.fetch, webRequest: { onBeforeRequest: (_filter, handler) => { guard = handler; } } });
  for (const url of ['file:///C:/private', 'data:text/plain,private', 'https://user:secret@example.com/file']) {
    let result; guard({ url }, value => { result = value; }); assert.equal(result.cancel, true);
  }
  let permitted; guard({ url:'https://example.com/public' }, value => { permitted = value; }); assert.equal(permitted.cancel, false);
});
