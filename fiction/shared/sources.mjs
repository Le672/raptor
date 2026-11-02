export const SOURCES=[
  {id:'zongheng',name:'纵横中文网',kind:'普通小说 · 官方原创',origin:'https://www.zongheng.com',search:true,searchScope:'源站书名、作者与关键词搜索，最多收录当前前 100 条结果',note:'官方公开推荐与搜索、完整分卷目录和免费章节。VIP 章节明确标为订阅内容，前往源站登录订阅。'},
  {id:'biqu',name:'笔趣阁书库',kind:'普通小说 · 公开网页',origin:'https://www.biquge345.com',search:true,searchScope:'源站当前书名搜索结果，作者按源站标注',note:'玄幻、仙侠、都市、历史、科幻等普通小说。读取公开搜索、完整目录与正文，更新时间按源站标注，失败时保留上次有效数据。'}
];
export function sourceInfo(id){return SOURCES.find(source=>source.id===id);}
export function bookIdValid(id){return /^(?:biqu-\d{1,12}|zongheng-[1-9]\d{0,11})$/.test(String(id));}
export function bookSource(id){return String(id).startsWith('zongheng-')?'zongheng':'biqu';}
export function nativeBookId(id){return String(id).replace(/^(?:biqu|zongheng)-/,'');}
export function sourceBookUrl(id){return !bookIdValid(id)?'':bookSource(id)==='zongheng'?`https://www.zongheng.com/detail/${nativeBookId(id)}`:`https://www.biquge345.com/book/${nativeBookId(id)}/`;}
export function partIdValid(value){return /^(?:[1-9]\d{0,15}|v[0-9a-f]{8})$/.test(String(value));}
export function imageSource(input){try{const url=new URL(String(input));if(url.username||url.password||url.port||!['http:','https:'].includes(url.protocol))return '';const biqu=url.hostname==='www.biquge345.com'&&/^\/files\/article\/image\/\d+\/\d+\/\d+[a-z]?\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname),zh=url.hostname==='static.zongheng.com'&&/^\/upload\/cover\/[a-zA-Z0-9/_-]+\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname);if(!biqu&&!zh)return '';url.protocol='https:';url.hash='';return url.href;}catch{return '';}}
