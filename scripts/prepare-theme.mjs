import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 14);
export async function themeAssets(directory, base = '/') {
  const root = resolve(directory); await mkdir(resolve(root, 'yukino-app-assets'), { recursive: true });
  const css = (await readFile(new URL('../shared/theme/portal-dark.css', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../shared/theme/style.css', import.meta.url), 'utf8'));
  const cssFile = `/yukino-app-assets/theme-${hash(css)}.css`, cssPath = base.replace(/\/$/, '') + cssFile;
  const script = (await readFile(new URL('../shared/theme/client.js', import.meta.url), 'utf8')).replaceAll('__YUKINO_THEME_CSS__', cssPath);
  const clientFile = `/yukino-app-assets/theme-${hash(script)}.js`, client = base.replace(/\/$/, '') + clientFile;
  await writeFile(resolve(root, '.' + cssFile), css); await writeFile(resolve(root, '.' + clientFile), script);
  return { client, css: cssPath, script, tags: `<link rel="stylesheet" href="${cssPath}" data-yukino-theme><script src="${client}" data-yukino-theme></script>` };
}
export async function prepareTheme(directory, base = '/') {
  const assets = await themeAssets(directory, base), entry = resolve(directory, 'index.html');
  let html = (await readFile(entry, 'utf8')).replace(/<(?:script|link)[^>]*data-yukino-theme[^>]*>(?:<\/script>)?/g, '');
  html = html.replace('</head>', assets.tags + '</head>');
  await writeFile(entry, html); return assets;
}
