import {evidence,persons,statements,deductions,locations,chapters} from './content';

export const CONTENT_VERSION='1.0.0';
export type GameState={schemaVersion:1;contentVersion:string;caseId:'last-recording';playthroughId:string;chapter:number;location:string;collected:string[];heard:string[];readTopics:string[];readEvidence:string[];solved:string[];challenged:string[];notes:string;timelineOrder:string[];hints:Record<string,number>;endings:string[];startedAt:number;updatedAt:number;seq:number;settings:{sound:boolean;fontSize:number;reducedMotion:boolean;hotspots:boolean;guidance:'guided'|'standard'|'focus'}};
export type Command={type:'visit';id:string}|{type:'collect';id:string}|{type:'read';id:string}|{type:'topic';person:string;id:string}|{type:'challenge';id:string;supports:string[]}|{type:'deduce';id:string;option:string;supports:string[]}|{type:'advance'}|{type:'note';text:string}|{type:'timeline';ids:string[]}|{type:'hint';id:string}|{type:'settings';value:Partial<GameState['settings']>}|{type:'report';answers:Record<string,string>;supports:string[]};
export type Result={state:GameState;ok:boolean;message:string;ending?:string};
export const REPORT_QUESTIONS=[
 {id:'culprit',label:'实施今夜袭击的人',options:[['xu','许知微'],['shen','沈砚'],['luo','罗启明'],['zhou','周予安'],['tang','唐素'],['he','何闻']],correct:'zhou'},
 {id:'voice',label:'20:14 的广播性质',options:[['live','本人实时讲话'],['recording','较早录制、由播放器输出'],['imitation','陌生人模仿声音']],correct:'recording'},
 {id:'window',label:'可靠的作案可能区间',options:[['late','20:14 至 20:18'],['full','最后可靠存活观察 20:09:10 至 20:18 发现'],['early','20:05 至 20:08']],correct:'full'},
 {id:'card',label:'沈卡对应的入室记录应如何解释',options:[['owner','卡主本人入室'],['borrower','结合借卡、行程与接触物证识别持卡人'],['none','卡片记录没有任何价值']],correct:'borrower'},
 {id:'contact',label:'缺角工作证能独立证明什么',options:[['all','单独足以证明杀人'],['old','只能说明多年以前见过'],['contact','今夜现场接触，须与其他证据汇合']],correct:'contact'},
 {id:'responsibility',label:'如何处理其他人的责任',options:[['separate','今案机会与旧案行为分别核查'],['innocent','今案不在场便证明旧案清白'],['all','只要说过谎就是现场共犯']],correct:'separate'}
] as const;
export function initialState(id=crypto.randomUUID(),now=Date.now()):GameState{return{schemaVersion:1,contentVersion:CONTENT_VERSION,caseId:'last-recording',playthroughId:id,chapter:1,location:'lobby',collected:[],heard:[],readTopics:[],readEvidence:[],solved:[],challenged:[],notes:'',timelineOrder:[],hints:{},endings:[],startedAt:now,updatedAt:now,seq:0,settings:{sound:false,fontSize:17,reducedMotion:false,hotspots:true,guidance:'standard'}};}
const includesAll=(owned:string[],needed:string[])=>needed.every(id=>owned.includes(id));
export function evidenceOpen(s:GameState,id:string){const e=evidence.find(item=>item.id===id);return!!e&&e.chapter<=s.chapter&&includesAll(s.collected,e.requires||[]);}
export function locationOpen(s:GameState,id:string){return id==='lobby'||id==='archive'||s.chapter>=2&&['studio','security'].includes(id)||s.chapter>=3&&locations.some(l=>l.id===id);}
export function nextChapterMissing(s:GameState){return(chapters.find(c=>c.id===s.chapter)?.required||[]).filter(id=>!s.collected.includes(id)&&!s.solved.includes(id));}
export function canProve(s:GameState,id:string,supports=s.collected,proved=s.solved):boolean{const d=deductions.find(item=>item.id===id);return!!d&&d.chapter<=s.chapter&&includesAll(proved,d.prerequisites)&&d.requiredSets.some(set=>includesAll(supports,set)&&includesAll(s.collected,set));}
function proveCurrent(s:GameState,supports:string[]){let found=[...s.solved];for(let pass=0;pass<8;pass++)for(const d of deductions)if(!found.includes(d.id)&&canProve(s,d.id,supports,found))found.push(d.id);return found;}
export function apply(s:GameState,c:Command,now=Date.now()):Result{
 let n=structuredClone(s),message='',ending:string|undefined;
 const no=(text:string):Result=>({state:s,ok:false,message:text});
 const add=(list:string[],id:string)=>{if(!list.includes(id))list.push(id);};
 switch(c.type){
 case'visit':if(!locationOpen(s,c.id))return no('这个地点尚未开放。先完成当前调查。');n.location=c.id;break;
 case'collect':{if(!evidenceOpen(s,c.id))return no('目前还不能核实这份材料。请先核对它的来源与前置记录。');add(n.collected,c.id);message='证据已收录；原始材料可在档案夹里随时查看。';break;}
 case'read':if(!s.collected.includes(c.id))return no('尚未收录这项证据。');add(n.readEvidence,c.id);break;
 case'topic':{const p=persons.find(p=>p.id===c.person),t=p?.topics.find(t=>t.id===c.id);if(!t||t.chapter>s.chapter||!includesAll(s.collected,t.requires||[]))return no('尚没有足够的调查依据展开这个话题。');add(n.readTopics,`${c.person}:${c.id}`);if(t.statement)add(n.heard,t.statement);for(const id of t.evidence||[])if(evidenceOpen(s,id))add(n.collected,id);break;}
 case'challenge':{const item=statements.find(item=>item.id===c.id);if(!item||!s.heard.includes(c.id))return no('请先记录这条证言。');if(!includesAll(s.collected,c.supports)||!item.challengeEvidence.some(id=>c.supports.includes(id))||!item.challengeEvidence.length)return no('这些材料还不能核验这句话。请区分记录本身与对记录的解释。');add(n.challenged,c.id);message=item.reply.join('\n\n');break;}
 case'deduce':{const d=deductions.find(d=>d.id===c.id);if(!d||d.chapter>s.chapter)return no('这个问题尚未进入调查范围。');if(!includesAll(s.collected,c.supports))return no('只能使用已经收录的证据。');if(!d.options.some(o=>o.id===c.option&&o.correct))return no('这个解释仍与已有记录存在冲突。可以重新核对来源、时间与证据能证明的范围。');if(!canProve(s,c.id,c.supports))return no('解释需要更多支持。请检查前置结论与所选证据，不要把可能性当作证明。');add(n.solved,c.id);message='结论成立。依据已保留在推理板，可随时复核。';break;}
 case'advance':if(s.chapter>=5)return no('已经进入结案阶段。');if(nextChapterMissing(s).length)return no('当前章仍有未核验的问题，可以在任务笺查看。');n.chapter++;n.location=n.chapter===5?'transfer':n.location;message=chapters.find(ch=>ch.id===n.chapter)?.title||'';break;
 case'note':if(c.text.length>20000)return no('笔记最多保存 20,000 字。');n.notes=c.text;break;
 case'timeline':if(c.ids.length>100||new Set(c.ids).size!==c.ids.length||c.ids.some(id=>typeof id!=='string'||id.length>80))return no('时间线记录无效。');n.timelineOrder=c.ids;break;
 case'hint':if(!deductions.some(d=>d.id===c.id&&d.chapter<=s.chapter))return no('该提示尚未开放。');n.hints[c.id]=Math.min(3,(n.hints[c.id]||0)+1);break;
 case'settings':n.settings={...n.settings,...c.value};n.settings.fontSize=Math.max(16,Math.min(24,n.settings.fontSize));break;
 case'report':{
  if(!includesAll(s.collected,c.supports))return no('报告只能引用已经取得的材料。');
  const invalid=REPORT_QUESTIONS.find(q=>c.answers[q.id]!==q.correct);if(invalid)return no(`报告复核：请重新解释“${invalid.label}”。当前结论未能回应记录中的矛盾，调查进度已保留。`);
  const proved=proveCurrent(s,c.supports);if(!includesAll(proved,['D01','D02','D03','D04','D05','D06']))return no('报告复核：今案证据链尚未闭合。请补充声音来源、持卡者、本人接触与其他人员行程的支持。');
  n.solved=proved;ending=includesAll(proved,['D07','D08'])?'full':'current';add(n.endings,ending);message='调查报告已保存。';break;
 }
 }
 if(JSON.stringify(n)===JSON.stringify(s))return{state:s,ok:true,message};
 n.seq=s.seq+1;n.updatedAt=now;return{state:n,ok:true,message,ending};
}
export function decodeState(raw:unknown):GameState{
 if(!raw||typeof raw!=='object')throw new Error('不是有效的调查存档。');const s=raw as GameState;
 if(s.schemaVersion!==1||s.contentVersion!==CONTENT_VERSION||s.caseId!=='last-recording')throw new Error('存档版本不兼容，原文件不会被覆盖。');
 if(!/^[\w-]{8,80}$/.test(s.playthroughId)||!Number.isInteger(s.chapter)||s.chapter<1||s.chapter>5||!locations.some(l=>l.id===s.location)||!Number.isFinite(s.startedAt)||!Number.isFinite(s.updatedAt)||!Number.isSafeInteger(s.seq)||s.seq<0)throw new Error('存档结构损坏。');
 const valid=(a:unknown,ids:string[],max=500)=>Array.isArray(a)&&a.length<=max&&new Set(a).size===a.length&&a.every(x=>typeof x==='string'&&ids.includes(x));
 if(!valid(s.collected,evidence.map(e=>e.id))||!valid(s.heard,statements.map(e=>e.id))||!valid(s.solved,deductions.map(e=>e.id))||!valid(s.challenged,statements.map(e=>e.id))||!valid(s.readEvidence,evidence.map(e=>e.id))||!valid(s.readTopics,persons.flatMap(p=>p.topics.map(t=>`${p.id}:${t.id}`)))||!valid(s.endings,['current','full'])||typeof s.notes!=='string'||s.notes.length>20000||!Array.isArray(s.timelineOrder)||s.timelineOrder.length>100||s.timelineOrder.some(x=>typeof x!=='string'||x.length>80))throw new Error('存档包含无效的调查记录。');
 if(!s.hints||typeof s.hints!=='object'||Object.entries(s.hints).some(([id,v])=>!deductions.some(d=>d.id===id)||!Number.isInteger(v)||v<0||v>3))throw new Error('提示记录损坏。');
 const set=s.settings;if(!set||typeof set.sound!=='boolean'||typeof set.reducedMotion!=='boolean'||typeof set.hotspots!=='boolean'||!Number.isFinite(set.fontSize)||set.fontSize<16||set.fontSize>24||!['guided','standard','focus'].includes(set.guidance))throw new Error('存档设置无效。');
 return structuredClone(s);
}
