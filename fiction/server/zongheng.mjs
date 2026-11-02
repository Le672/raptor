import {document,tag,cls,attr,clean,content,dateTime} from '../../novel/server/html.mjs';
import {cached} from '../../novel/server/cache.mjs';
import {plainText,parseContent} from '../../novel/server/service.mjs';
import {SourceError} from '../../novel/server/html-fetch.mjs';
import {sourceInfo,sourceBookUrl,nativeBookId,imageSource} from '../shared/sources.mjs';
const info=sourceInfo('zongheng');
const image=input=>{const src=imageSource(input);return src?`/api/image?src=${encodeURIComponent(src)}`:'';};
const title=input=>plainText(String(input||'').replace(/\u003c/gi,'<').replace(/\u003e/gi,'>').replace(/\u0026/gi,'&'));
function base(id,values={}){return{id:`zongheng-${id}`,title:'',author:'',illustrator:'',description:'',cover:'',tags:[],status:'unknown',updatedAt:null,sourceFetchedAt:new Date().toISOString(),source:'zongheng',sourceName:info.name,sourceUrl:sourceBookUrl(`zongheng-${id}`),...values};}
async function upstream(url,body){
  const parsed=new URL(url);if(!['www.zongheng.com','search.zongheng.com','bookapi.zongheng.com','read.zongheng.com'].includes(parsed.hostname)||parsed.protocol!=='https:')throw new SourceError('无效源站地址',400);
  const r=await fetch(url,{...(body?{method:'POST',body:new URLSearchParams(body).toString()}:{}),headers:{'User-Agent':'YukinoNovel/2 (+https://novel.yukino.bond)','Content-Type':'application/x-www-form-urlencoded'},redirect:'manual',signal:AbortSignal.timeout(18000)});
  if([401,403].includes(r.status))throw new SourceError('纵横需要登录或访问验证，请前往源站',403,'restricted');if(!r.ok)throw new SourceError(`纵横暂时不可用（HTTP ${r.status}）`);
  const bytes=await r.arrayBuffer();if(bytes.byteLength>5*1024*1024)throw new SourceError('书源响应超过限制');return new TextDecoder().decode(bytes);
}
export function parseHome(html){
  const entries=new Map();
  for(const link of tag(document(html),'a')){let u;try{u=new URL(attr(link,'href'),'https://www.zongheng.com');}catch{continue;}
    if(!['www.zongheng.com','book.zongheng.com'].includes(u.hostname))continue;
    const match=u.pathname.match(/^\/(?:detail\/(\d+)|book\/(\d+)\.html)$/);if(!match)continue;
    const id=match[1]||match[2],img=tag(link,'img')[0],name=clean(link)||attr(link,'title')||attr(img,'alt'),cover=image(attr(img,'src')||attr(img,'data-src'));
    const old=entries.get(id)||base(id);if(name&&name.length<120)old.title=name;if(cover)old.cover=cover;
    let container=link.parentNode;for(let depth=0;depth<3&&container;depth++,container=container.parentNode){if(clean(container).length>1200)break;const a=tag(container,'a').find(a=>/home\.zongheng\.com\/show\/userInfo\//.test(attr(a,'href')));if(a){old.author=clean(a);break;}}
    entries.set(id,old);
  }
  const books=[...entries.values()].filter(b=>b.title).slice(0,180);if(!books.length)throw new SourceError('纵横首页未返回公开书目');return books;
}
export function parseSearch(payload){if(payload.code!==0)throw new SourceError('纵横搜索暂不可用');const page=payload.data?.datas;if(!page||!Array.isArray(page.list))throw new SourceError('纵横未返回搜索结果');return{total:page.total,books:page.list.filter(b=>/^[1-9]\d*$/.test(String(b.bookId))).map(b=>base(b.bookId,{title:title(b.name),author:plainText(b.authorName||''),description:plainText(b.description||''),cover:image('https://static.zongheng.com/upload'+b.coverUrl),tags:[b.catePName,...String(b.keyword||'').split(/[、,，]/)].filter(Boolean).slice(0,12),status:b.serialStatus===1?'completed':'ongoing',updatedAt:dateTime(b.updateTime)}))};}
export async function catalog(env,ctx,force=false){return cached(env,ctx,'fiction:zh:feed',async()=>parseHome(await upstream('https://www.zongheng.com/')),300000,{force,background:true,provider:info.name});}
export async function search(env,ctx,q,force=false){return cached(env,ctx,'fiction:zh:search:'+encodeURIComponent(q),async()=>{
  const url=new URL('https://search.zongheng.com/search/book');url.search=new URLSearchParams({keyword:q,pageNo:'1',pageNum:'20'});
  const first=parseSearch(JSON.parse(await upstream(url.href)));const books=[...first.books];
  const pages=Math.min(5,Math.ceil(first.total/20));const rest=await Promise.all(Array.from({length:Math.max(0,pages-1)},async(_,i)=>{const next=new URL(url);next.searchParams.set('pageNo',String(i+2));return parseSearch(JSON.parse(await upstream(next.href))).books;}));
  return [...books,...rest.flat()];
},300000,{force,retention:3600,provider:info.name});}
export function parseDetail(html,catalog,id){
  const fields=new Map(tag(document(html),'meta').map(m=>[attr(m,'name')||attr(m,'property'),attr(m,'content')]));
  if(catalog.code!==0||!Array.isArray(catalog.result?.chapterList))throw new SourceError('纵横未返回完整目录');
  const volumes=catalog.result.chapterList.map(v=>({id:String(v.tome.tomeId),title:plainText(v.tome.tomeName),cover:'',chapters:v.chapterViewList.filter(c=>c.bookId===Number(id)).map(c=>({id:String(c.chapterId),title:plainText(c.chapterName),restricted:c.level===1,sourceUrl:`https://read.zongheng.com/chapter/${id}/${c.chapterId}.html`}))})).filter(v=>v.chapters.length);
  if(!fields.get('og:title')||!volumes.length)throw new SourceError('纵横详情或目录为空');
  return base(id,{title:plainText(fields.get('og:title')),author:plainText(fields.get('og:novel:author')),description:plainText(fields.get('og:description')).replace(/^content="|"$/g,''),cover:image(fields.get('og:image')),tags:[fields.get('og:novel:category')].filter(Boolean),status:/完结/.test(fields.get('og:novel:status'))?'completed':'ongoing',updatedAt:dateTime(fields.get('og:novel:update_time')),volumes});
}
export async function getBook(env,ctx,id,force=false){return cached(env,ctx,`fiction:zh:book:${id}`,async()=>{const n=nativeBookId(id);const [html,data]=await Promise.all([upstream(sourceBookUrl(id)),upstream('https://bookapi.zongheng.com/api/chapter/getChapterList',{bookId:n})]);return parseDetail(html,JSON.parse(data),n);},300000,{force,background:true,provider:info.name});}
export async function getVolume(env,ctx,id,vid,force=false){const b=await getBook(env,ctx,id,force),v=b.data.volumes.find(v=>v.id===vid);if(!v)throw new SourceError('分卷不属于此作品',404);return{data:{...v,bookId:id},meta:b.meta};}
export function parseChapter(html){const root=document(html),body=cls(root,'content').find(node=>attr(node,'data-prescription')==='0'&&!attr(node,'data-decoder'));if(!body)throw new SourceError('该章节未公开或需要源站订阅，请前往纵横阅读',403,'restricted');return{title:clean(cls(root,'title_txtbox')[0]||tag(root,'h1')[0]),blocks:parseContent(content(body),image)};}
export async function getChapter(env,ctx,id,cid,force=false){const b=await getBook(env,ctx,id,force),v=b.data.volumes.find(v=>v.chapters.some(c=>c.id===cid)),c=v?.chapters.find(c=>c.id===cid);if(!c)throw new SourceError('章节不属于此作品',404);if(c.restricted)throw new SourceError('VIP 章节需要在纵横源站登录订阅',403,'restricted');return cached(env,ctx,`text:fiction:zh:${id}:${cid}`,async()=>({...parseChapter(await upstream(c.sourceUrl)),id:cid,bookId:id,volumeId:v.id,sourceUrl:c.sourceUrl,source:'zongheng',sourceName:info.name}),900000,{force,retention:7*86400,staleOnRestricted:false,provider:info.name});}
