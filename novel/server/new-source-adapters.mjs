import { document, tag, cls, attr, byId, clean, content, dateTime } from './html.mjs';
import { fetchHtml, SourceError } from './html-fetch.mjs';
import { imageUrl, parseContent, plainText } from './service.mjs';
import { sourceInfo } from '../shared/sources.mjs';

const KXG = 'https://kxgxs.com';
const ENCYCLOPEDIA = 'https://lnovel.org';
const REZERO = 'https://re0zero.top/mdbook/book/';
const statusOf = text => /^(?:已)?完[结結]|完本/.test(text) ? 'completed' : /[连連][载載]/.test(text) ? 'ongoing' : 'unknown';
const unique = books => [...new Map(books.filter(Boolean).map(book => [book.id, book])).values()];
function base(source, id, values) {
  return { id: `${source}-${id}`, title: '', author: '', illustrator: '', description: '', cover: '', tags: [], status: 'unknown', updatedAt: null,
    sourceFetchedAt: new Date().toISOString(), source, sourceName: sourceInfo(source).name, ...values };
}
export function stablePart(value) {
  let hash=2166136261;for(const character of value)hash=Math.imul(hash^character.codePointAt(0),16777619);
  return `v${(hash>>>0).toString(16).padStart(8,'0')}`;
}
function blocks(body, url, stripHeading=false) {
  if(!body)throw new SourceError('书源未返回公开正文',403,'restricted');
  if(stripHeading)for(const heading of tag(body,'h1'))heading.parentNode.childNodes=heading.parentNode.childNodes.filter(node=>node!==heading);
  for(const image of tag(body,'img')) {
    const src=image.attrs?.find(item=>item.name==='src');
    if(src)try{src.value=new URL(src.value,url).href;}catch{src.value='';}
  }
  const result=parseContent(content(body));
  const text=result.filter(block=>block.type==='text').map(block=>block.text).join('');
  if(text.length<120&&/暂无译文|尚未翻译|待翻译|敬请期待/.test(text))throw new SourceError('此章节尚未公开完整中文译文',403,'restricted');
  if(!result.some(block=>block.type==='text'&&block.text.trim()||block.type==='image'))throw new SourceError('书源正文为空或页面结构已变化');
  return result;
}
function verifyChapterUrl(value, origin, path) {
  let url;try{url=new URL(value);}catch{throw new SourceError('章节地址无效',400);}
  if(url.origin!==origin||url.username||url.password||url.search||url.hash||!path.test(url.pathname))throw new SourceError('章节地址不属于此轻小说书源',400);
  return url.href;
}

export function parseKxgList(html) {
  const root=document(html);
  return unique(tag(root,'article').filter(node=>attr(node,'class').split(/\s+/).includes('book-card')).map(node=>{
    if(clean(cls(node,'category')[0])!=='日本轻小说')return null;
    const link=tag(tag(node,'h3')[0],'a')[0],id=attr(link,'href').match(/^\/index\.php\/book\/info\/([1-9]\d{0,8})$/)?.[1],title=clean(link);
    if(!id||!title)return null;
    const cover=tag(cls(node,'cover')[0],'img')[0],state=clean(cls(node,'card-top')[0]).replace('日本轻小说','').trim();
    return base('kxg',id,{title,author:clean(cls(node,'author')[0]).split('·')[0].trim(),description:clean(cls(node,'summary')[0]),
      cover:imageUrl(new URL(attr(cover,'src')||attr(cover,'data-src')||'/',KXG).href),tags:tag(cls(node,'tag-row')[0],'a').map(clean),status:statusOf(state),sourceUrl:`${KXG}/index.php/book/info/${id}`});
  }));
}
export function parseKxgBook(html,tocHtml,id) {
  const root=document(html),toc=document(tocHtml),title=clean(tag(root,'h1')[0]),labels=clean(cls(root,'book-labels')[0]);
  if(!title)throw new SourceError('开心果未返回有效作品详情');
  if(!labels.includes('日本轻小说'))throw new SourceError('此作品不属于已接入的日本轻小说分区',404);
  const readPath=new RegExp(`^/index\\.php/book/read/${id}/([1-9]\\d{0,15})$`),volumes=[],seen=new Set();
  for(const heading of tag(toc,'h2')){
    let group=heading.parentNode;
    for(let depth=0;depth<3&&!tag(group,'a').some(a=>readPath.test(attr(a,'href')));depth++)group=group?.parentNode;
    const chapters=tag(group,'a').map(a=>{
      const cid=attr(a,'href').match(readPath)?.[1];if(!cid||seen.has(cid))return null;seen.add(cid);
      return{id:cid,title:clean(tag(a,'b')[0])||clean(a),restricted:false,sourceUrl:KXG+attr(a,'href')};
    }).filter(Boolean);
    if(chapters.length)volumes.push({id:chapters[0].id,title:clean(heading),cover:'',chapters});
  }
  if(!volumes.length)throw new SourceError('开心果未返回完整公开目录');
  const overview=cls(root,'book-overview')[0],author=tag(overview,'a').find(a=>/^\/index\.php\/author\/\d+$/.test(attr(a,'href')));
  const schema=tag(root,'script').filter(node=>attr(node,'type')==='application/ld+json').map(node=>{try{return JSON.parse(content(node));}catch{return null;}}).find(value=>value?.['@type']==='Book'&&value.name===title);
  const cover=attr(tag(cls(root,'detail-cover')[0],'img')[0],'src')||schema?.image||'';
  return base('kxg',id,{title,author:plainText(schema?.author?.name||'')||clean(author).replace(/查看作者作品.*$/,'').trim(),description:clean(cls(root,'book-intro')[0])||plainText(schema?.description||''),
    cover:cover?imageUrl(new URL(cover,KXG).href):'',tags:tag(cls(root,'book-labels')[0],'a').map(clean).filter(value=>value!=='日本轻小说'),status:statusOf(labels),
    updatedAt:dateTime(clean(cls(root,'latest-card')[0])),sourceUrl:`${KXG}/index.php/book/info/${id}`,volumes});
}
export function parseKxgChapter(html,url) {
  const root=document(html);return{title:clean(tag(root,'h1')[0]),blocks:blocks(cls(root,'chapter-content')[0],url)};
}

export function parseEncyclopediaList(html) {
  const root=document(html),books=unique(tag(root,'a').map(link=>{
    const id=attr(link,'href').match(/^\/books-([1-9]\d{0,8})$/)?.[1],title=clean(link);
    if(!id||!title||!tag(link,'img').length)return null;
    const src=attr(tag(link,'img')[0],'src');
    return base('encyclopedia',id,{title,cover:src?imageUrl(new URL(src,ENCYCLOPEDIA).href):'',sourceUrl:`${ENCYCLOPEDIA}/books-${id}`});
  }));
  const next=tag(root,'a').map(a=>({label:clean(a),href:attr(a,'href')})).find(a=>/^(?:›|下一[页頁])$/.test(a.label)&&/^\/books\?page=[1-9]\d*$/.test(a.href));
  return{books,next:next?Number(new URL(next.href,ENCYCLOPEDIA).searchParams.get('page')):null};
}
// The origin currently ignores its search query. Build the actual public title
// index once, then refresh the first two pages rather than recrawling it on reads.
export async function encyclopediaCatalog(previous=[],fetcher=fetchHtml) {
  const first=parseEncyclopediaList(await fetcher(`${ENCYCLOPEDIA}/books`));
  if(!first.books.length)throw new SourceError('轻小说百科未返回公开书名索引，保留已有目录');
  const result=new Map(previous.map(book=>[book.id,book]));
  for(const book of first.books)result.set(book.id,book);
  let next=first.next,pages=1;const visited=new Set([1]);
  while(next){
    if(visited.has(next)||next!==pages+1||next>80)throw new SourceError('轻小说百科分页结构变化，保留已有索引');
    visited.add(next);
    const page=parseEncyclopediaList(await fetcher(`${ENCYCLOPEDIA}/books?page=${next}`));
    if(!page.books.length)throw new SourceError('轻小说百科分页为空，未覆盖已有索引');
    for(const book of page.books)result.set(book.id,book);
    pages++;next=page.next;
    if(previous.length>first.books.length*2)break;
  }
  return[...result.values()];
}
export function parseEncyclopediaBook(html,id) {
  const root=document(html),title=clean(tag(root,'h1')[0]),toc=byId(root,'volumes');
  if(!title||!toc)throw new SourceError('轻小说百科未返回作品及其公开目录');
  const fields=new Map();for(const dl of tag(root,'dl')){
    const cells=(dl.childNodes||[]).filter(node=>['dt','dd'].includes(node.tagName));
    for(let i=0;i<cells.length-1;i++)if(cells[i].tagName==='dt'&&cells[i+1].tagName==='dd')fields.set(clean(cells[i]),cells[i+1]);
  }
  const volumes=cls(toc,'accordion-item').map(section=>{
    const chapters=tag(cls(section,'accordion-collapse')[0],'a').map(a=>{
      const cid=attr(a,'href').match(/^\/chapters-([1-9]\d{0,15})$/)?.[1];
      return cid?{id:cid,title:clean(a),restricted:false,sourceUrl:ENCYCLOPEDIA+attr(a,'href')}:null;
    }).filter(Boolean);
    return{id:chapters[0]?.id,title:clean(tag(section,'h3')[0]),cover:'',chapters};
  }).filter(volume=>volume.id&&volume.chapters.length);
  if(!volumes.length)throw new SourceError('轻小说百科未返回公开章节',403,'restricted');
  const intro=tag(root,'h2').find(node=>clean(node)==='简介')?.parentNode;
  const cover=tag(root,'img').find(node=>/^\/uploads\/(?:https|http)\//.test(attr(node,'src')));
  return base('encyclopedia',id,{title,author:clean(fields.get('作者')),tags:tag(fields.get('类别'),'a').map(clean),status:statusOf(clean(fields.get('状态'))),
    updatedAt:dateTime(clean(fields.get('更新'))),description:tag(intro,'p').map(clean).join('\n').slice(0,2400),cover:cover?imageUrl(new URL(attr(cover,'src'),ENCYCLOPEDIA).href):'',sourceUrl:`${ENCYCLOPEDIA}/books-${id}`,volumes});
}
export function parseEncyclopediaChapter(html,url) {
  const root=document(html);return{title:clean(tag(root,'h1')[0]),blocks:blocks(byId(root,'chaptersShowContent'),url)};
}

export function parseRezeroBook(html) {
  const root=document(html),sidebar=byId(root,'sidebar')||cls(root,'sidebar-scrollbox')[0];
  if(!sidebar||!clean(tag(root,'title')[0]).includes('从零开始'))throw new SourceError('Re0 汉化站未返回有效目录');
  const volumes=[],groups=new Map(),ids=new Map();
  for(const a of tag(sidebar,'a')){
    const match=attr(a,'href').match(/^markdown\/ch\/(chapter\d{3})\/([a-z\d_-]+)\.html$/i);if(!match)continue;
    const [,group,chapter]=match;
    if(chapter==='index'){
      if(!groups.has(group)){const volume={id:stablePart(group),title:clean(a),cover:'',chapters:[]};groups.set(group,volume);volumes.push(volume);}continue;
    }
    const volume=groups.get(group);if(!volume)continue;
    const url=new URL(attr(a,'href'),REZERO).href,id=stablePart(url);
    if(ids.has(id)){if(ids.get(id)!==url)throw new SourceError('Re0 章节编号冲突，未返回混合目录');continue;}
    ids.set(id,url);volume.chapters.push({id,title:clean(a),restricted:false,sourceUrl:url});
  }
  const available=volumes.filter(volume=>volume.chapters.length);if(!available.length)throw new SourceError('Re0 汉化站没有可读的公开译文章节');
  const main=tag(root,'main')[0],cover=attr(tag(main,'img')[0],'src');
  return base('rezero','1',{title:'Re:从零开始的异世界生活（WEB 中文汉化版）',author:'长月达平',description:'re-zero-khis 中文汉化项目，按原作篇章整理已公开的译文，保留翻译与校对说明。专题书源仅含本系列 WEB 译本。',
    cover:cover?imageUrl(new URL(cover,REZERO).href):'',tags:['日轻','WEB版','中文汉化','异世界','Re0'],status:'ongoing',sourceUrl:REZERO+'index.html',volumes:available});
}
export function parseRezeroChapter(html,url) {
  const root=document(html),body=tag(root,'main')[0];return{title:clean(tag(body,'h1')[0]),blocks:blocks(body,url,true)};
}

export const newSourceAdapters = {
  kxg:{
    async catalog(){const items=parseKxgList(await fetchHtml(`${KXG}/index.php/library/books/5`));if(!items.length)throw new SourceError('开心果日轻列表为空或格式变化');return items;},
    async search(query){const html=await fetchHtml(`${KXG}/index.php/library/books/5?key=${encodeURIComponent(query)}`),items=parseKxgList(html);if(!items.length&&!html.includes('没有找到'))throw new SourceError('开心果搜索未返回有效日轻列表');return items;},
    async book(id){const [detail,toc]=await Promise.all([fetchHtml(`${KXG}/index.php/book/info/${id}`),fetchHtml(`${KXG}/index.php/book/catalog/${id}`)]);return parseKxgBook(detail,toc,id);},
    async chapter(value){const url=verifyChapterUrl(value,KXG,/^\/index\.php\/book\/read\/[1-9]\d{0,8}\/[1-9]\d{0,15}$/);return parseKxgChapter(await fetchHtml(url),url);},
  },
  encyclopedia:{
    catalog:encyclopediaCatalog,
    async book(id){return parseEncyclopediaBook(await fetchHtml(`${ENCYCLOPEDIA}/books-${id}`),id);},
    async chapter(value){const url=verifyChapterUrl(value,ENCYCLOPEDIA,/^\/chapters-[1-9]\d{0,15}$/);return parseEncyclopediaChapter(await fetchHtml(url),url);},
  },
  rezero:{
    async catalog(){const {volumes,...book}=parseRezeroBook(await fetchHtml(REZERO+'index.html'));return[book];},
    async book(id){if(id!=='1')throw new SourceError('专题书源仅收录 Re0 WEB 中文汉化版',404);return parseRezeroBook(await fetchHtml(REZERO+'index.html'));},
    async chapter(value){const url=verifyChapterUrl(value,'https://re0zero.top',/^\/mdbook\/book\/markdown\/ch\/chapter\d{3}\/(?!index\.html$)[a-z\d_-]+\.html$/i);return parseRezeroChapter(await fetchHtml(url),url);},
  },
};
