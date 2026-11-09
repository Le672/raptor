import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { prepareTheme } from './prepare-theme.mjs';

// One reader, two independently installed applications and local libraries.
for (const site of [
  { folder:'ln', kind:'light', title:'轻小说书房', brand:'Yukino LN', prefix:'ln', data:'ln' },
  { folder:'fiction', kind:'fiction', title:'小说书房', brand:'Yukino Novel', prefix:'fiction', data:'fiction' },
]) {
  const root=new URL(`../${site.folder}/dist/`,import.meta.url);
  await build({configFile:fileURLToPath(new URL('../novel/vite.config.ts',import.meta.url)),
    build:{outDir:fileURLToPath(root),emptyOutDir:true},plugins:[{name:'reader-site',transformIndexHtml(html){
      if(site.kind==='fiction')html=html.replaceAll('轻小说','小说');
      return html.replace(/<title>.*?<\/title>/,`<title>${site.title} · ${site.brand}</title>`).replace('</head>',`<meta name="reader-kind" content="${site.kind}"/></head>`);
    }}]});
  await prepareTheme(fileURLToPath(root));
  const html=await readFile(new URL('index.html',root),'utf8');
  const assets=[...new Set(Array.from(html.matchAll(/(?:src|href)="(\/(?:assets|yukino-app-assets)\/[^"?#]+)"/g),match=>match[1]))];
  if(!assets.some(path=>path.endsWith('.js'))||!assets.some(path=>path.endsWith('.css')))throw new Error('Reader assets are missing');
  const manifest=JSON.parse(await readFile(new URL('manifest.webmanifest',root),'utf8'));
  manifest.name=`Yukino ${site.title}`;manifest.short_name=site.title;manifest.description=`随身的${site.title}：发现故事、收藏书架、接着上次读。`;
  await writeFile(new URL('manifest.webmanifest',root),JSON.stringify(manifest,null,2));
  const worker=await readFile(new URL('sw.js',root),'utf8');
  const icons=['/icons/icon-192.png','/icons/icon-512.png','/icons/maskable-512.png','/icons/apple-touch-icon.png'];
  const hashInput=createHash('sha256').update(html).update(worker).update(JSON.stringify(manifest));
  for(const icon of icons)hashInput.update(await readFile(new URL(icon.slice(1),root)));
  const hash=hashInput.digest('hex').slice(0,12);
  await writeFile(new URL('index.html',root),html.replace('</head>',`<meta name="novel-app-version" content="${hash}"/></head>`));
  const sw=worker.replace('yukino-novel-shell-v1',`yukino-${site.prefix}-shell-${hash}`)
    .replace("key.startsWith('yukino-novel-shell-')",`(key.startsWith('yukino-novel-shell-') || key.startsWith('yukino-${site.prefix}-shell-') || key === 'yukino-novel-data-v1')`)
    .replace("caches.open('yukino-novel-data-v1')",`caches.open('yukino-${site.data}-data-v1')`);
  await writeFile(new URL('sw.js',root),`self.__NOVEL_PRECACHE = ${JSON.stringify(['/','/book.svg','/manifest.webmanifest',...icons,...assets])};\n${sw}`);
  console.log(`${site.brand}: verified offline shell and ${assets.length} versioned JS/CSS assets.`);
}
