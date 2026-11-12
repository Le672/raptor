import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { DownloadRunner } from '../src/engine.mjs';
const require = createRequire(import.meta.url);
const { nativeFetch, closeAgents } = require('../desktop/native-fetch.cjs');
test('native streaming downloads HTTP files without CORS, honors shared quota and follows redirects', async () => {
  let sent = 0;
  const server = http.createServer((request, response) => {
    if (request.url.startsWith('/redirect')) { response.writeHead(302, { Location: '/file' }); response.end(); return; }
    const match = /bytes=0-(\d+)/.exec(request.headers.range || '');
    const amount = match ? Number(match[1]) + 1 : 128000; sent += amount;
    response.writeHead(match ? 206 : 200, { 'Content-Type': 'application/octet-stream', 'Content-Length': amount, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes 0-${amount - 1}/128000` });
    response.end(Buffer.alloc(amount));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const runner = new DownloadRunner({ fetcher: nativeFetch });
  try {
    runner.start({ url: `http://127.0.0.1:${server.address().port}/redirect`, kind: 'file', threads: 4, limitBytes: 160000, rateBps: 320000 });
    await runner.task;
    assert.equal(runner.status, 'completed'); assert.equal(runner.bytes, 160000); assert.equal(sent, 160000);
    assert.ok(runner.snapshot().elapsedMs >= 400);
    await assert.rejects(nativeFetch('file:///C:/secret.txt'));
  } finally { runner.stop(); closeAgents(); await new Promise(resolve => server.close(resolve)); }
});
test('a native request closes immediately when its shared abort signal fires', async () => {
  const server = http.createServer((_request, _response) => {});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { const controller = new AbortController(); const promise = nativeFetch(`http://127.0.0.1:${server.address().port}/hang`, { signal: controller.signal }); controller.abort(); await assert.rejects(promise); }
  finally { closeAgents(); await new Promise(resolve => server.close(resolve)); }
});
