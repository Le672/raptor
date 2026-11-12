import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { prepareSiteShell } from './prepare-site-shell.mjs';
import { APPS, appManifest } from '../shared/pwa/sites.mjs';
import { themeAssets } from './prepare-theme.mjs';
const source = new URL('../shared/pwa/', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 14);
function scripts(html) { return [...html.matchAll(/(?:src|href)=["']([^"'#?]+\.(?:js|mjs|css))["']/g)].map(match => new URL(match[1], 'https://pwa.test/').pathname); }
async function dependencies(root, paths) {
  const files = new Set(), pending = [...paths];
  while (pending.length && files.size < 100) {
    const path = pending.shift(); if (files.has(path) || !/^\/(?:assets\/|yukino-app-assets\/|yukino-shell\/)/.test(path)) continue;
    let content; try { content = await readFile(resolve(root, '.' + path), 'utf8'); } catch { continue; }
    files.add(path);
    if (path.endsWith('.js') || path.endsWith('.mjs')) {
      const refs = [...content.matchAll(/(?:\b(?:import|export)[^;()]*?\bfrom\s*|\bimport\s*)["'](\.\/[^"']+\.(?:js|mjs|css))["']/g)];
      for (const match of refs) pending.push(new URL(match[1], 'https://pwa.test' + path).pathname);
    }
  }
  return [...files];
}
export async function preparePwa(directory, id = 'portal', options = {}) {
  const root = resolve(directory), entry = resolve(root, 'index.html');
  const shell = id !== 'portal' ? await prepareSiteShell(root, { siteId: id }) : null;
  let html = await readFile(entry, 'utf8');
  // Re-running the packaging step must produce one control, not duplicate apps.
  html = html.replace(/<script[^>]*data-yukino-app[^>]*><\/script>/g, '');
  html = html.replace(/<link[^>]*data-yukino-theme[^>]*>/g, '');
  html = html.replace(/content=["']width=device-width,\s*initial-scale=1(?:\.0)?["']/g, 'content="width=device-width, initial-scale=1.0, viewport-fit=cover"');
  const apps = id === 'portal' ? APPS.filter(app => app.group === 'portal') : APPS.filter(app => app.id === id);
  if (!apps.length) throw new Error(`Unknown PWA ${id}`);
  let runtime = await readFile(new URL('client.js', source), 'utf8');
  const appearance = await themeAssets(root);
  runtime = appearance.script + '\n' + runtime;
  const worker = await readFile(new URL('sw-template.js', source), 'utf8');
  const iconDir = resolve(root, 'yukino-app-assets'); await mkdir(iconDir, { recursive: true });
  const css = runtime.match(/<style>([\s\S]*?)<\/style>/);
  if (!css) throw new Error('PWA control stylesheet missing');
  const cssPath = `/yukino-app-assets/control-${hash(css[1])}.css`;
  await writeFile(resolve(root, '.' + cssPath), css[1]);
  runtime = runtime.replace(css[0], `<link rel="stylesheet" href="${cssPath}">`);
  const configurations = {};
  const assetEntries = [...scripts(html), ...(shell?.files || [])], directoryAssets = await readdir(resolve(root, 'assets')).catch(() => []);
  for (const app of apps) {
    const icons = {};
    for (const size of [180, 192, 512]) {
      const bytes = await readFile(new URL(`icons/${app.id}-${size}.png`, source));
      const path = `/yukino-app-assets/${app.id}-${size}-${hash(bytes)}.png`; await writeFile(resolve(root, '.' + path), bytes); icons[size] = path;
    }
    const manifest = appManifest(app, icons), manifestText = JSON.stringify(manifest), manifestPath = `/yukino-app-manifest-${app.id}-${hash(manifestText)}.webmanifest`;
    await writeFile(resolve(root, '.' + manifestPath), manifestText);
    const landing = app.chunk ? directoryAssets.filter(name => name.startsWith(app.chunk + '-') && name.endsWith('.js')).map(name => '/assets/' + name) : [];
    const assets = await dependencies(root, [...assetEntries, ...landing]);
    configurations[app.host] = { ...app, manifest: manifestPath, apple: icons[180], icon: icons[192], assets, icons: Object.values(icons) };
    if (app.id === 'www') configurations['yukino.bond'] = configurations[app.host];
  }
  const version = hash(html + runtime + worker + JSON.stringify(configurations));
  for (const config of new Set(Object.values(configurations))) config.sw = `/yukino-app-sw-${config.id}-${version}.js`;
  const payload = JSON.stringify({ sites: configurations, fallback: apps[0].host, version });
  const client = runtime.replace('__YUKINO_APPS__', payload), clientPath = `/yukino-app-assets/client-${hash(client)}.js`;
  await writeFile(resolve(root, '.' + clientPath), client);
  const tag = `<link rel="stylesheet" href="${appearance.css}" data-yukino-theme><script src="${clientPath}" data-yukino-app></script>`;
  html = html.replace('</head>', `${tag}</head>`).replace(/content=["']width=device-width,\s*initial-scale=1(?:\.0)?["']/g, 'content="width=device-width, initial-scale=1.0, viewport-fit=cover"');
  if (!options.keepEntry) await writeFile(entry, html);
  const offline = app => app.onlineOnly ? `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${app.name}</title>${tag}</head><body style="font:16px/1.8 system-ui;background:#f8fafc;color:#34465c;padding:10vh 7vw"><h1>${app.name}</h1><p>当前离线。上传、读取分享内容与验证口令需要网络连接。</p><p>此应用不会缓存文件、口令或私有分享页面。</p><a href="/">联网后重新打开</a></body></html>` : html;
  for (const config of new Set(Object.values(configurations))) {
    const shell = `/yukino-app-shell-${config.id}-${version}.html`; await writeFile(resolve(root, '.' + shell), offline(config));
    const prefix = `yukino-app-shell-${config.id}-`;
    const data = { prefix, cache: prefix + version, shell, onlineOnly: Boolean(config.onlineOnly), privateLab: config.id === 'tools', files: [shell, clientPath, cssPath, appearance.css, config.manifest, ...config.icons, ...config.assets] };
    await writeFile(resolve(root, '.' + config.sw), worker.replace('__YUKINO_APP_WORKER__', JSON.stringify(data)));
  }
  const headersPath = resolve(root, '_headers'); let headers = await readFile(headersPath, 'utf8').catch(() => '');
  if (!headers.includes('# Yukino installable apps')) {
    headers += '\n# Yukino installable apps\n/yukino-app-sw-*.js\n  Cache-Control: no-store, no-cache, must-revalidate\n  CDN-Cache-Control: no-store\n  Cloudflare-CDN-Cache-Control: no-store\n  Service-Worker-Allowed: /\n/yukino-app-manifest-*.webmanifest\n  Cache-Control: no-cache\n/yukino-app-assets/*\n  Cache-Control: public, max-age=31536000, immutable\n';
    await writeFile(headersPath, headers);
  }
  await writeFile(resolve(root, 'yukino-app-build.json'), JSON.stringify({ version, client: clientPath, sites: configurations }));
  console.log(`Installable apps prepared: ${apps.map(app => app.id).join(', ')} (${version})`);
  return { version, client: clientPath, sites: configurations };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await preparePwa(process.argv[3] || 'dist', process.argv[2] || 'portal');
