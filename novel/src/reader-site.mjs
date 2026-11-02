const declared=typeof document!=='undefined'?document.querySelector('meta[name="reader-kind"]')?.getAttribute('content'):null;
const ordinary=declared==='fiction'||!declared&&typeof location!=='undefined'&&location.hostname==='novel.yukino.bond';
export const readerSite=ordinary?{
  id:'novel',light:false,origin:'https://novel.yukino.bond',host:'novel.yukino.bond',title:'小说书房',genre:'小说',brand:'Yukino Novel',upperBrand:'YUKINO NOVEL',brandShort:'Novel',storage:'fiction',cache:'yukino-fiction-data-v1',
  hints:['剑来','诡秘之主','玄幻','仙侠'],sourcesIntro:'玄幻、仙侠、都市、历史与科幻，每个书源的实际范围清楚可见。',
}:{
  id:'ln',light:true,origin:'https://ln.yukino.bond',host:'ln.yukino.bond',title:'轻小说书房',genre:'轻小说',brand:'Yukino LN',upperBrand:'YUKINO LN',brandShort:'LN',storage:'novel',cache:'yukino-ln-data-v1',
  hints:['邻家天使','实力至上','恋爱','异世界'],sourcesIntro:'译文书库与中文原创一起找，每个书源的状态都清楚可见。',
};
