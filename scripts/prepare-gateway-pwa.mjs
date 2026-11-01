import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { preparePwa } from './prepare-pwa.mjs';
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) setGlobalDispatcher(new ProxyAgent(proxy));
for (const id of ['draw', 'tools', 'drop']) {
  const origin = `https://${id}.yukino.bond`, directory = resolve('.wrangler/pwa-gateway', id);
  await mkdir(directory, { recursive: true });
  const response = await fetch(origin, { signal: AbortSignal.timeout(25000) });
  if (!response.ok || !response.headers.get('Content-Type')?.includes('text/html')) throw new Error(`${id}: public shell unavailable`);
  const html = await response.text(); await writeFile(resolve(directory, 'index.html'), html);
  // Only public startup JS/CSS; never fetch files, shares, lab pages or cookies.
  const pending = id === 'drop' ? [] : [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|mjs|css)(?:\?[^"']*)?)["']/g)].map(match => new URL(match[1], origin));
  const seen = new Set();
  while (pending.length && seen.size < 60) {
    const url = pending.shift(); if (url.origin !== origin || !url.pathname.startsWith('/assets/') || seen.has(url.pathname)) continue;
    seen.add(url.pathname);
    const result = await fetch(url, { signal: AbortSignal.timeout(25000) }); if (!result.ok) throw new Error(`${id}: ${url.pathname} unavailable`);
    const body = await result.text(); const target = resolve(directory, '.' + url.pathname); await mkdir(resolve(target, '..'), { recursive: true }); await writeFile(target, body);
    for (const match of body.matchAll(/(?:\b(?:import|export)[^;()]*?\bfrom\s*|\bimport\s*)["'](\.\/[^"']+\.(?:js|mjs|css))["']/g)) pending.push(new URL(match[1], url));
  }
  await preparePwa(directory, id, { keepEntry: true });
}
