import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as icons from 'lucide-react';
import { siteNavigation } from '../shared/shell/navigation.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const iconNames=['Mail','Home','FileText','Code2','Upload','PenTool','LayoutGrid','Gamepad2','BookOpen','Palette','BookMarked','BookMarked','Film','Film','Newspaper','Clock3','TrainFront','Flag','Gauge','Globe2','FolderDown','BookOpen','Laptop','FlaskConical','Users','Rss','Radio','Settings2','CircleHelp'];
const svg=name=>renderToStaticMarkup(createElement(icons[name]||icons.Link2,{size:17,strokeWidth:1.6,'aria-hidden':true,className:'nav-section-icon'}));
export async function prepareSiteShell(directory,{inject=true}={}){
  const dir=resolve(directory);await mkdir(resolve(dir,'yukino-shell'),{recursive:true});
  const navigation=siteNavigation.map((n,i)=>({...n,icon:svg(iconNames[i]),href:n.href||(n.to==='/notes'?'https://www.yukino.bond/notes':n.to==='/'?'https://www.yukino.bond/':'https://'+(n.to==='/about-me'?'about':n.to.slice(1))+'.yukino.bond/')}));
  const runtime=(await readFile(resolve(root,'shared/shell/client.js'),'utf8')).replace('__YUKINO_NAVIGATION__',JSON.stringify(navigation));
  const css=(await readFile(resolve(root,'src/styles/chrome-refresh.css'),'utf8'))+'\n'+await readFile(resolve(root,'shared/shell/independent.css'),'utf8');
  const hash=createHash('sha256').update(runtime+css).digest('hex').slice(0,12);
  const script=`/yukino-shell/shell-${hash}.js`,style=`/yukino-shell/shell-${hash}.css`;
  await writeFile(resolve(dir,'.'+script),runtime);await writeFile(resolve(dir,'.'+style),css);
  await copyFile(resolve(root,'public/favicon.png'),resolve(dir,'yukino-shell/avatar.png'));
  if(inject){const file=resolve(dir,'index.html');let html=await readFile(file,'utf8');html=html.replace(/<link[^>]*data-yukino-shell[^>]*>|<script[^>]*data-yukino-shell[^>]*><\/script>/g,'');await writeFile(file,html.replace('</head>',`<link rel="stylesheet" href="${style}" data-yukino-shell><script src="${script}" defer data-yukino-shell></script></head>`));}
  return {script,style,files:[script,style,'/yukino-shell/avatar.png']};
}
