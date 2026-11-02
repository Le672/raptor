import { document,tag,cls,attr,byId,clean,content,dateTime } from '../../novel/server/html.mjs';
import { cached } from '../../novel/server/cache.mjs';
import { parseContent,plainText } from '../../novel/server/service.mjs';
import { SourceError } from '../../novel/server/html-fetch.mjs';
import { sourceInfo,imageSource,bookIdValid,nativeBookId,sourceBookUrl,partIdValid } from '../shared/sources.mjs';
export { imageSource,bookIdValid,sourceBookUrl };
export const SOURCE='https://www.biquge345.com';
export const validPartId=partIdValid;
const meta=()=>({checkedAt:new Date().toISOString(),stale:false,reason:'',provider:'普通小说书库',refreshMinutes:5});
const unique=items=>[...new Map(items.filter(Boolean).map(item=>[item.id,item])).values()];
function part(value){let h=2166136261;for(const c of value)h=Math.imul(h^c.codePointAt(0),16777619);return `v${(h>>>0).toString(16).padStart(8,'0')}`;}
function imageUrl(input){const src=imageSource(input);return src?`/api/image?src=${encodeURIComponent(src)}`:'';}
function base(id,values){return{id:`biqu-${id}`,title:'',author:'',illustrator:'',description:'',cover:imageUrl(`${SOURCE}/files/article/image/${Math.floor(Number(id)/1000)}/${Number(id)}/${Number(id)}s.jpg`),tags:[],status:'unknown',updatedAt:null,sourceFetchedAt:new Date().toISOString(),source:'biqu',sourceName:sourceInfo('biqu').name,sourceUrl:sourceBookUrl(`biqu-${id}`),...values};}
export async function sourceHtml(path,query){
  const url=new URL(path,SOURCE);if(url.origin!==SOURCE)throw new SourceError('无效书源地址',400);
  const response=await fetch(url.href,{...(query!==undefined?{method:'POST',body:new URLSearchParams({s:query,type:'articlename'}).toString(),headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'YukinoNovel/2 (+https://novel.yukino.bond)'}}:{headers:{'User-Agent':'YukinoNovel/2 (+https://novel.yukino.bond)'}}),signal:AbortSignal.timeout(18000),redirect:'manual'});
  if([401,403].includes(response.status))throw new SourceError('源站要求登录或访问验证，请前往源站查看',403,'restricted');
  if(!response.ok)throw new SourceError(`书源暂不可用（HTTP ${response.status}）`);
  const bytes=await response.arrayBuffer();if(bytes.byteLength>5*1024*1024)throw new SourceError('源站页面超过大小限制');
  const html=new TextDecoder().decode(bytes);if(/<title>\s*(?:Just a moment|登录|访问验证)/i.test(html))throw new SourceError('书源需要访问验证',403,'restricted');return html;
}
function genre(node){return clean(cls(node,'lei')[0]).replace(/^\[|\]$/g,'');}
export function parseList(html,search=false){
  const root=document(html);const rows=tag(root,'li').filter(node=>tag(node,'a').some(a=>/^\/book\/\d+\/$/.test(attr(a,'href')))&&tag(node,'a').some(a=>/^\/chapter\//.test(attr(a,'href'))));
  return unique(rows.map(row=>{const link=tag(row,'a').find(a=>/^\/book\/\d+\/$/.test(attr(a,'href'))),id=attr(link,'href').match(/\/book\/(\d+)\//)?.[1],title=clean(link).replace(/^《|》$/g,'');if(!id||!title)return null;
    const author=clean(cls(row,'zuo')[0]);return base(id,{title,author,tags:genre(row)?[genre(row)]:[],updatedAt:dateTime(clean(row))});}));
}
export function parseBook(html,id){
  const root=document(html),fields=new Map(tag(root,'meta').map(node=>[attr(node,'property'),attr(node,'content')]));
  const title=fields.get('og:title');if(!title)throw new SourceError('书源未返回作品详情');
  const chapters=unique(tag(cls(root,'info').find(node=>node.tagName==='ul'),'a').map(link=>{
    const match=attr(link,'href').match(new RegExp(`^/chapter/${id}/(\\d{1,16})\\.html$`));if(!match)return null;
    const url=SOURCE+attr(link,'href');return{id:part(url),title:clean(link),restricted:false,sourceUrl:url};
  }));
  if(!chapters.length)throw new SourceError('书源未返回完整公开目录');
  const volumes=[];for(let offset=0;offset<chapters.length;offset+=200){const items=chapters.slice(offset,offset+200);volumes.push({id:part(`${id}:${items[0].id}`),title:chapters.length>200?`正文 · 第 ${offset+1}–${offset+items.length} 章`:'正文',cover:'',chapters:items});}
  const info=cls(root,'tu')[0],state=clean(info)+' '+clean(root).slice(0,1500);
  return base(id,{title:plainText(title),author:plainText(fields.get('og:novel:author')||''),description:plainText(fields.get('og:description')||'').slice(0,2400),cover:imageUrl(fields.get('og:image')||''),tags:[fields.get('og:novel:category')].filter(Boolean),status:/完结|完本|完成/.test(state)?'completed':/连载/.test(state)?'ongoing':'unknown',updatedAt:dateTime(fields.get('og:novel:update_time'))||dateTime(state),volumes});
}
export function parseChapter(html){const root=document(html),body=byId(root,'neirong');if(!body)throw new SourceError('书源未公开章节正文',403,'restricted');return{title:clean(tag(root,'h1')[0]),blocks:parseContent(content(body),imageUrl)};}
export async function catalog(env,ctx,force=false){return cached(env,ctx,'fiction:feed:v1',async()=>{const items=parseList(await sourceHtml('/'));if(!items.length)throw new SourceError('普通小说书目列表为空，保留已有索引');return items;},300000,{force,background:true,provider:sourceInfo('biqu').name});}
export async function getBook(env,ctx,id,force=false){if(!bookIdValid(id))throw new SourceError('普通小说编号不正确',404);return cached(env,ctx,`fiction:book:${id}`,()=>sourceHtml(`/book/${nativeBookId(id)}/`).then(html=>parseBook(html,nativeBookId(id))),300000,{force,background:true,provider:sourceInfo('biqu').name});}
export async function getVolume(env,ctx,id,vid,force=false){const book=await getBook(env,ctx,id,force),volume=book.data.volumes.find(v=>v.id===vid);if(!volume)throw new SourceError('分卷不属于此作品',404);return{data:{...volume,bookId:id},meta:book.meta};}
export async function getChapter(env,ctx,id,cid,force=false){const book=await getBook(env,ctx,id,force),volume=book.data.volumes.find(v=>v.chapters.some(c=>c.id===cid)),chapter=volume?.chapters.find(c=>c.id===cid);if(!chapter)throw new SourceError('章节不属于此作品',404);return cached(env,ctx,`text:fiction:${id}:${cid}`,async()=>({...parseChapter(await sourceHtml(chapter.sourceUrl)),id:cid,bookId:id,volumeId:volume.id,sourceUrl:chapter.sourceUrl,source:'biqu',sourceName:sourceInfo('biqu').name}),900000,{force,retention:7*86400,staleOnRestricted:false,provider:sourceInfo('biqu').name});}
export async function search(env,ctx,q,force=false){return cached(env,ctx,'fiction:search:v1:'+encodeURIComponent(q),async()=>{const html=await sourceHtml('/s.php',q),items=parseList(html,true);if(!items.length&&!html.includes('搜索'))throw new SourceError('源站搜索页面格式变化');return items;},300000,{force,retention:3600,provider:sourceInfo('biqu').name});}
