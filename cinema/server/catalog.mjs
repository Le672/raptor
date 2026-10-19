const film={drama:11,action:6,comedy:7,romance:8,scifi:9,horror:10,war:12};
const television={cn:13,west:16,hk:14,kr:15,tw:21,jp:22,overseas:23,th:24};
const entertainment={cn:25,hk:26,kr:27,west:28};
export const SOURCES=[
  {id:'ikun',name:'iKun',api:'https://ikunzyapi.com/api.php/provide/vod/',home:'https://www.ikunzy.cc/',categories:{movie:{...film,thriller:13,family:14,period:15,history:16,mystery:17,crime:18,disaster:19,short:21},series:{cn:23,west:26,hk:24,kr:25,tw:27,jp:28,overseas:29,th:30},variety:{cn:31,hk:32,kr:33,west:34},doc:{all:20}}},
  {id:'bf',name:'暴风',api:'https://bfzyapi.com/api.php/provide/vod/',home:'https://bfzy.tv/',categories:{movie:{drama:26,action:21,comedy:22,romance:25,scifi:24,horror:23,war:27},series:{cn:31,west:32,hk:33,kr:34,tw:35,jp:36,overseas:37,th:38},variety:{cn:46,hk:47,kr:48,west:49},doc:{all:28}}},
  {id:'ff',name:'非凡',api:'https://api.ffzyapi.com/api.php/provide/vod/',home:'https://ffzy.tv/',categories:{movie:{...film},series:{...television},variety:{...entertainment},doc:{all:20}}},
  {id:'lz',name:'量子',api:'https://cj.lziapi.com/api.php/provide/vod/',home:'https://lzizy.com/',categories:{movie:{...film},series:{...television},variety:{...entertainment},doc:{all:20}}},
];
export const CATEGORIES={all:'全部影视',movie:'电影',series:'电视剧',variety:'综艺',doc:'纪录片'};
export const GENRES={
  all:{all:'全部题材'},movie:{all:'全部题材',drama:'剧情',action:'动作',comedy:'喜剧',romance:'爱情',scifi:'科幻',horror:'恐怖',war:'战争',thriller:'惊悚',mystery:'悬疑',crime:'犯罪',family:'家庭',history:'历史',period:'古装',disaster:'灾难',short:'短片'},
  series:{all:'全部地区',cn:'国产剧',west:'欧美剧',hk:'香港剧',kr:'韩国剧',tw:'台湾剧',jp:'日本剧',overseas:'海外剧',th:'泰国剧'},
  variety:{all:'全部地区',cn:'大陆综艺',hk:'港台综艺',kr:'日韩综艺',west:'欧美综艺'},doc:{all:'全部纪录片'},
};
export function mediaKind(vod,source){
  if(/动漫|动画|里番|伦理|理论|成人|写真|解说|体育|短剧/.test(vod.type_name||''))return null;
  const kind=Object.entries(source.categories).find(([,genres])=>Object.values(genres).includes(Number(vod.type_id)))?.[0];
  const name=String(vod.type_name||'');
  if(kind==='movie')return /电影|片$/.test(name)&&!/纪录|记录/.test(name)?kind:null;
  if(kind==='series')return /剧$/.test(name)?kind:null;
  if(kind==='variety')return /综艺/.test(name)?kind:null;
  if(kind==='doc')return /纪录|记录/.test(name)?kind:null;
  return null;
}
// t=6,7 is interpreted as t=6 by these providers. Fetch up to three real categories,
// cycling remaining genres before the next native page, to bound edge subrequests.
export function queryPlan(source,{category='all',genre='all',q='',page=1}={}){
  if(category==='all')return {types:q?[undefined]:[undefined,source.categories.movie.drama,source.categories.series.cn],nativePage:page,hasNextGroup:false};
  const genres=source.categories[category];if(!genres)return {types:[],nativePage:page,hasNextGroup:false};
  if(genre!=='all')return {types:genres[genre]===undefined?[]:[genres[genre]],nativePage:page,hasNextGroup:false};
  const ids=[...new Set(Object.values(genres))],groups=Math.max(1,Math.ceil(ids.length/3)),index=(page-1)%groups;
  return {types:ids.slice(index*3,index*3+3),nativePage:Math.floor((page-1)/groups)+1,hasNextGroup:index<groups-1};
}
