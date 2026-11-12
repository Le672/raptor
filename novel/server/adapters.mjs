import { fetchHtml, SourceError } from './html-fetch.mjs';
import { newSourceAdapters } from './new-source-adapters.mjs';
export { fetchHtml, SourceError } from './html-fetch.mjs';
import { document, all, attr, cls, tag, byId, clean, text, content, dateTime } from './html.mjs';
import { imageUrl, parseContent, plainText } from './service.mjs';
import { sourceInfo } from '../shared/sources.mjs';
import { parseWenkuCatalog, WENKU_SITEMAP, WENKU_CATALOG } from './wenku-catalog.mjs';

const origins = { linovel: 'https://www.linovel.net', wenku: 'https://www.wenku8.net' };
const dedupe = items => [...new Map(items.filter(Boolean).map(item => [item.id, item])).values()];
const statusOf = value => /已完[结結]|完本|\[完[结結]\]/.test(value) ? 'completed' : /[连連][载載]/.test(value) ? 'ongoing' : 'unknown';
function base(source, id, value = {}) {
  return { id: `${source}-${id}`, title: '', author: '', illustrator: '', description: '', cover: '', tags: [], status: 'unknown', updatedAt: null, sourceFetchedAt: new Date().toISOString(), source, sourceName: sourceInfo(source).name, ...value };
}
function stableVolume(title) {
  let hash = 2166136261; for (const char of title) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  return `v${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
export function parseLinovelList(html) {
  const root=document(html), groups=[...cls(root,'rank-book'), ...cls(root,'search-book')];
  return dedupe(groups.map(node=>{
    const href=attr(node,'href') || tag(node,'a').map(a=>attr(a,'href')).find(value=>/^\/book\/\d+\.html/.test(value)) || '';
    const id=href.match(/^\/book\/(\d+)\.html/)?.[1]; if(!id)return null;
    const extra=clean(cls(node,'book-extra')[0]), tags=cls(node,'book-tag').map(clean);
    return base('linovel',id,{title:clean(cls(node,'book-name')[0]),author:extra.split(/[丨|]/)[0].trim(),description:clean(cls(node,'book-intro')[0]),cover:imageUrl(attr(tag(cls(node,'book-cover')[0],'img')[0],'src')),tags,status:statusOf(tags.join(' ')),updatedAt:dateTime(extra),sourceUrl:`${origins.linovel}/book/${id}.html`});
  }));
}
export function parseLinovelBook(html,id) {
  const root=document(html), title=clean(cls(root,'book-title')[0]);
  if(!title)throw new SourceError('书源未返回这本书的详情');
  const index=cls(root,'section-list')[0];
  const volumes=cls(index,'section').map(section=>{
    const chapters=tag(section,'a').map(a=>{
      const match=attr(a,'href').match(new RegExp(`^/book/${id}/(\\d+)\\.html$`));if(!match)return null;
      const restricted=/vip|locked|pay/.test(attr(a,'class')) || Boolean(cls(a,'lock').length);
      return {id:match[1],title:clean(a),restricted,sourceUrl:origins.linovel+attr(a,'href')};
    }).filter(Boolean);
    const title=clean(cls(section,'volume-title')[0]);
    return{id:chapters[0]?.id || stableVolume(title),title:title || '正文',cover:imageUrl(attr(tag(cls(section,'volume-cover')[0],'img')[0],'src')),chapters};
  }).filter(volume=>volume.chapters.length);
  if(!volumes.length)throw new SourceError('书源未返回有效章节目录');
  const author=cls(root,'novelist')[0], authorLink=tag(author,'a').find(a=>/\/user\/info/.test(attr(a,'href')));
  const tags=tag(cls(root,'book-cats')[0],'a').map(clean);
  return base('linovel',id,{title,author:clean(authorLink),cover:imageUrl(attr(tag(cls(root,'book-cover')[0],'img')[0],'src')),description:plainText(content(cls(root,'about-text')[0])).slice(0,2400),tags,status:statusOf(clean(cls(root,'book-data')[0])+' '+tags.join(' ')),updatedAt:dateTime(clean(cls(root,'book-last-update')[0])),sourceUrl:`${origins.linovel}/book/${id}.html`,volumes});
}
export function parseLinovelChapter(html) {
  const root=document(html), body=cls(root,'article-text')[0];
  if(!body)throw new SourceError('章节未公开或需要在源站登录',403,'restricted');
  return{title:clean(cls(root,'article-title')[0]),blocks:parseContent(content(body))};
}

export function parseWenkuBook(html,tocHtml,id) {
  const root=document(html), toc=document(tocHtml), title=clean(byId(toc,'title'));
  if(!title)throw new SourceError('书源未公开此书目录，可能因版权或登录限制暂不可读',403,'restricted');
  const cells=tag(root,'td').map(clean).filter(value=>value.length<100);
  const field=prefix=>cells.find(value=>value.startsWith(prefix))?.slice(prefix.length).trim() || '';
  const tocLink=tag(root,'a').map(a=>attr(a,'href')).find(href=>new RegExp(`^/novel/\\d+/${id}/index\\.htm$`).test(href));
  if(!tocLink)throw new SourceError('书源目录地址缺失，未尝试读取受限内容',403,'restricted');
  const directory=tocLink.slice(0,-'index.htm'.length),volumes=[];let current;
  for(const node of tag(toc,'td')){
    if(attr(node,'class').split(/\s+/).includes('vcss')){current={id:attr(node,'vid') || stableVolume(clean(node)),title:clean(node),cover:'',chapters:[]};volumes.push(current);}
    else if(attr(node,'class').split(/\s+/).includes('ccss'))for(const a of tag(node,'a')){
      const match=attr(a,'href').match(/^(\d+)\.htm$/);if(!match)continue;
      if(!current){current={id:'1',title:'正文',cover:'',chapters:[]};volumes.push(current);}
      current.chapters.push({id:match[1],title:clean(a),restricted:false,sourceUrl:origins.wenku+directory+match[1]+'.htm'});
    }
  }
  if(!volumes.some(v=>v.chapters.length))throw new SourceError('书源未返回公开章节',403,'restricted');
  const cover=tag(root,'img').find(img=>new RegExp(`/image/\\d+/${id}/${id}[a-z]?\\.jpg`).test(attr(img,'src')));
  const tags=html.match(/作品Tags[：:]([^<]+)/)?.[1]?.trim().split(/\s+/) || [];
  const description=html.match(/内容简介[：:][\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/)?.[1] || '';
  return base('wenku',id,{title,author:field('小说作者：'),description:plainText(description),cover:imageUrl(attr(cover,'src')),tags,status:statusOf(field('文章状态：')),updatedAt:dateTime(field('最后更新：')),sourceUrl:`${origins.wenku}/book/${id}.htm`,volumes:volumes.filter(v=>v.chapters.length)});
}
export function parseWenkuChapter(html) {
  const root=document(html), body=byId(root,'content');
  if(!body)throw new SourceError('书源未公开章节正文',403,'restricted');
  return{title:clean(byId(root,'title')),blocks:parseContent(content(body))};
}

export const adapters = {
  ...newSourceAdapters,
  linovel: {
    async catalog(){const data=parseLinovelList(await fetchHtml(`${origins.linovel}/cat/-1.html?sort=updates&sign=-1`));if(!data.length)throw new SourceError('轻之文库列表格式变化，保留已有书目');return data;},
    async search(query){const html=await fetchHtml(`${origins.linovel}/search/?kw=${encodeURIComponent(query)}`),data=parseLinovelList(html);if(!data.length&&!/class=["'][^"']*\bbox-search\b/.test(html))throw new SourceError('轻之文库搜索页面格式变化');return data;},
    async book(id){return parseLinovelBook(await fetchHtml(`${origins.linovel}/book/${id}.html`),id);},
    async chapter(url){return parseLinovelChapter(await fetchHtml(url));},
  },
  wenku: {
    async catalog(){
      const [sitemap,index]=await Promise.all([fetchHtml(WENKU_SITEMAP,'utf-8'),fetchHtml(WENKU_CATALOG,'utf-8')]);
      let data;try{data=JSON.parse(index);}catch{throw new SourceError('文库公开书目索引格式变化，保留已有索引');}
      return parseWenkuCatalog(data,sitemap);
    },
    async book(id){const detail=await fetchHtml(`${origins.wenku}/book/${id}.htm`,'gbk');const path=detail.match(new RegExp(`href=["'](/novel/\\d+/${id}/index\\.htm)["']`))?.[1];if(!path)throw new SourceError('书源未公开此书目录',403,'restricted');return parseWenkuBook(detail,await fetchHtml(origins.wenku+path,'gbk'),id);},
    async chapter(url){return parseWenkuChapter(await fetchHtml(url,'gbk'));},
  },
};
