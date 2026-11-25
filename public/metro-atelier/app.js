"use strict";
const $=q=>document.querySelector(q), M=Metro,T=Transit;
const escapeText=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Number(n).toLocaleString("zh-CN"), money=n=>"¥ "+fmt(n);
const read=(key,def)=>{try{return JSON.parse(localStorage.getItem("ma."+key))??def}catch{return def}};
const write=(key,value)=>{try{localStorage.setItem("ma."+key,JSON.stringify(value));return true}catch{return false}};
const $all=q=>[...document.querySelectorAll(q)];
let station;try{station=M.validate(read("station",null))}catch{station=M.create()}
let book=read("records",{}),lastRecord=read("previous",null),library=read("library",[]),medals=read("medals",[]),reviewed=read("reviewed","");
const view=new Art.MapView($("#map"));let group=0,tool="floor",dir=0,dest=2,species=0,tab="design",state="edit",editor=false,hover=-1;
let run=null,previous=null,baseStats=null,paused=false,speed=4,heat=false,replayAt=0,selected=null,manualScroll=false;
let history=[],future=[],stroke=null,drag=null,needsDraw=true,lastPanel=0,clock=0,priorTime=0;
const groups=[["土建",["floor","platform","track","entry","fence","one","empty"]],["通行",["gate","check","stairs","escalator","ramp","lift","empty"]],["环境",["bench","plant","empty"]]];
const keyOf=s=>[s.mode,s.index,s.seed,s.peak,s.demand,s.entries.join(""),s.lines.join("")].join("/");
const modeName=s=>({training:"入职培训",challenge:"挑战任务",sandbox:"自由沙盒",custom:"自编关卡"})[s.mode];
const codeOf=s=>(s.mode==="training"?"T":s.mode==="challenge"?"C":s.mode==="custom"?"ED":"SB")+"–"+String(s.index+1).padStart(2,"0");
const goalOf=s=>s.mode==="training"?M.tutorial[s.index][2]:s.mode==="challenge"?M.missions[s.index][1]:s.goal;
const baseInstruction=s=>s.mode==="training"?M.tutorial[s.index][1]:s.mode==="challenge"?M.briefs[goalOf(s)]:s.mode==="custom"?"在规定造价内，达到关卡设计者设定的疏运率。":"在早晚高峰之间调整站厅、站台与换乘动线。";
const instruction=s=>baseInstruction(s)+(goalOf(s)==="lift"?" 直梯专用乘客至少 55% 到达。":"");
function say(text){let n=$("#toast");n.textContent=text;n.classList.add("show");clearTimeout(say.timer);say.timer=setTimeout(()=>n.classList.remove("show"),2100)}
function save(){let ok=write("station",station);$("#saveState").textContent=ok?"● 已保存至本机":"存储已满 · 请导出";if(!ok)say("本地存储不可用，请在工坊导出蓝图")}
function award(m){if(!medals.includes(m)){medals.push(m);write("medals",medals)}}
function scoreOf(r){return Math.round(r.finished/r.total*10000)+r.comfort*15-r.time-Math.round(r.cost/20)}
function finished(){
 state="replay";paused=true;replayAt=run.tick;heat=true;
 const result=run.result(),k=keyOf(station),baseline=lastRecord&&lastRecord.key===k?lastRecord:null;
 baseStats=baseline?.result||null;
 let won=result.finished/result.total>=station.target&&T.goalOK(station,run,baseline,reviewed===k)&&(!station.budget||result.cost<=station.budget);
 lastRecord={key:k,result,layout:JSON.stringify(station.cells),station:structuredClone(station),won};write("previous",lastRecord);previous=run;
 if(won&&station.mode!=="sandbox"){const rankKey=station.mode==="custom"?k:station.mode+station.index;
   const score=scoreOf(result);
   if(!book[rankKey]||score>book[rankKey].score)book[rankKey]={score,rate:result.finished/result.total,time:result.time,cost:result.cost};
   write("records",book);award("第一张合格图纸");if(Object.keys(book).filter(q=>q.startsWith("training")).length===5)award("培训毕业")}
 if(result.finished>0)award("首班车");if(result.total>=10000)award("万人潮汐");if(baseStats&&result.time<baseStats.time&&result.finished>=baseStats.finished)award("更短的旅程");
 tab="replay";render();say(station.mode==="sandbox"?"试运行完成，可拖动时间轴复盘":won?"验收通过，成绩已记录":"试运行结束，请查看验收结果")
}
function start(){
 closeDialog();if(state==="run"){paused=!paused;render();return}
 if(state==="replay"){backToEdit();return}
 baseStats=lastRecord?.key===keyOf(station)?lastRecord.result:null;
 run=new T.Run(station);state="run";paused=false;clock=0;selected=null;tab="traffic";hover=-1;heat=false;view.dirty=true;render()
}
function backToEdit(){state="edit";paused=false;run=null;selected=null;tab="design";heat=false;view.dirty=true;render()}
function replay(){if(!previous&&lastRecord?.key===keyOf(station)){previous=new T.Run(lastRecord.station);while(!previous.done)previous.step()}
 if(!previous){say("先完成一次试运行");return}
 run=previous;state="replay";tab="replay";paused=true;replayAt=Math.round(run.tick*.5);heat=true;view.dirty=true;noteReview();render()}
function noteReview(){if(state==="replay"&&heat&&replayAt<run.tick&&reviewed!==keyOf(run.station)){reviewed=keyOf(run.station);write("reviewed",reviewed)}}
function switchStation(s){M.validate(s);station=s;editor=false;run=null;previous=null;baseStats=null;selected=null;state="edit";history=[];future=[];tab="design";heat=false;hover=-1;view.z=1;dest=2;tool="floor";group=0;view.reset();closeDialog();save();render()}
function checkpoint(){history.push(JSON.stringify(station));if(history.length>65)history.shift();future=[]}
function undo(redo=false){if(state!=="edit")return;const from=redo?future:history,to=redo?history:future;if(!from.length)return;to.push(JSON.stringify(station));station=JSON.parse(from.pop());view.dirty=true;save();render()}
function setFloor(z){view.z=z;dest=z<3?z+1:2;view.dirty=true;hover=-1;render()}
function render(){
 const s=state==="replay"?run.station:station;
 $("#name").textContent=s.name+(/站$/.test(s.name)?"":"站");$("#meta").innerHTML='<span class="tag">'+modeName(s)+'</span>'+s.lines.map((l)=>'<span class="lineTag '+(l?"blue":"")+'">● L'+(l+1)+'</span>').join("");
 $("#floors").innerHTML=[3,2,1,0].map(z=>'<button data-z="'+z+'" class="'+(view.z===z?"active":"")+'" title="'+M.floorNames[z]+'">'+M.floors[z]+'</button>').join("");
 $("#floorCode").textContent=M.floors[view.z];$("#floorName").textContent=M.floorNames[view.z];$("#layerDetail").textContent=s.cells.slice(view.z*M.geometry(s).AREA,(view.z+1)*M.geometry(s).AREA).some(c=>c?.k==="platform")?"列车站台层":"公共通行层";
 $("#view").textContent=view.top?"轴测":"俯视";$("#groups").innerHTML=groups.map(([n],i)=>'<button data-group="'+i+'" class="'+(i===group?"active":"")+'">'+n+'</button>').join("");
 let wanted=groups[group][1].slice();if(editor&&group===0)wanted.push("pillar","land");
 $("#tools").innerHTML=wanted.map(k=>'<button class="tool '+(tool===k?"active":"")+'" data-tool="'+k+'" title="'+(M.tools[k]?.tip||"切换空地的用地边界")+'" '+(state!=="edit"?"disabled":"")+'><canvas></canvas><span>'+(M.tools[k]?.name||"用地边界")+'</span></button>').join("");
 $all(".tool").forEach(el=>Art.icon(el.querySelector("canvas"),el.dataset.tool));
 options();$("#undo").disabled=!history.length||state!=="edit";$("#redo").disabled=!future.length||state!=="edit";
 $("#settings").disabled=state!=="edit";$all("[data-tab]").forEach(el=>el.classList.toggle("active",el.dataset.tab===tab));
 $("#run").textContent=state==="run"?(paused?"▶  继续仿真":"Ⅱ  暂停仿真"):state==="replay"?"✎  返回设计台":"▶  开始试运行";
 $("#runNote").textContent=state==="edit"?"固定客流种子  /  "+s.seed:state==="replay"?"改建后可使用同批客流复测":"仿真期间锁定施工图";
 $("#modeLabel").textContent=state==="edit"?(editor?"关卡编辑中":"设计中"):state==="run"?(paused?"已暂停":"运行中"):"回放中";
 $("#hint").textContent=state==="edit"?"左键布置 · 右键拖动平移 · 滚轮缩放":"点击乘客追踪动线 · 可切换楼层查看";
 $("#mapStatus").textContent="1 GRID = 2 m    /    "+codeOf(s)+"    /    "+Math.round(view.zoom*100)+"%";
 panel();needsDraw=true;
}
function selectOpt(id,items,value){return '<select id="'+id+'">'+items.map(([v,n])=>'<option value="'+v+'" '+(value==v?"selected":"")+'>'+n+'</option>').join("")+'</select>'}
function options(){
 let k=tool,parts=[];
 if(state!=="edit"){$("#toolOptions").textContent="查看客流时，可切换楼层、缩放和移动视图。";return}
 if(M.vertical(k)){
   let levels=[0,1,2,3].filter(z=>z!==view.z&&(k==="lift"||Math.abs(view.z-z)===1));if(!levels.includes(dest))dest=levels[0];
   parts.push("连接 "+selectOpt("targetZ",levels.map(z=>[z,M.floors[z]]),dest));
   if(k==="stairs"||k==="escalator"){if(k==="escalator"&&dir===0)dir=1;parts.push(selectOpt("direction",(k==="stairs"?[[0,"双向"]]:[]).concat([[1,"上行 ↑"],[2,"下行 ↓"]]),dir))}
 }else if(k==="one")parts.push(selectOpt("direction",M.arrows.map((n,i)=>[i,n]),dir));
 else if(k==="platform"||k==="entry")parts.push(selectOpt("species",[0,1,2].map(i=>[i,k==="entry"?"出入口 "+String.fromCharCode(65+i):"线路 L"+(i+1)]),species));
 $("#toolOptions").innerHTML=parts.join(" ")+' <span>'+(M.tools[k]?money(M.tools[k].cost)+" / 格　"+M.tools[k].tip:"点击空地切换可建范围。")+'</span>'
}
function selectTool(k){tool=k;dir=k==="escalator"?1:0;species=0;render()}
const title=(a,b)=>'<div class="sectionTitle">'+a+'<small>'+b+'</small></div>';
const row=(a,b)=>'<div class="row"><span>'+a+'</span><b>'+b+'</b></div>';
const metric=(arr)=>'<div class="metric">'+arr.map(([a,b])=>'<div><small>'+a+'</small><strong>'+b+'</strong></div>').join("")+'</div>';
function panel(){
 const s=state==="replay"?run.station:station,r=run?.result(),el=$("#panel"),offset=el.scrollTop;
 let out="";
 if(tab==="design"){
   out='<div class="card dark"><div class="eyebrow">'+codeOf(s)+' / '+(s.mode==="sandbox"?"SANDBOX":"BRIEF")+'</div><h3>'+(s.mode==="sandbox"?"自由设计":s.mode==="custom"?"关卡条件":"任务简报")+'</h3><p>'+instruction(s)+'</p></div>';
   out+=title("工程概览","PROJECT")+row("当前造价",money(M.cost(s)))+row("可用预算",s.budget?money(s.budget-M.cost(s)):"不限")+row("已建设面积",fmt(s.cells.filter(Boolean).length*4)+" m²");
   out+=title("客流方案","DEMAND")+metric([["时段",s.peak==="morning"?"早高峰":"晚高峰"],["乘客人数",fmt(s.demand)]]);
   if(s.mode!=="sandbox")out+=row("目标疏运率",Math.round(s.target*100)+"%");else out+='<div class="notice">可在车站设置中切换高峰、调整人数或从空地起建。</div>';
   if(state==="edit"&&lastRecord?.key===keyOf(station))out+='<button class="linkBtn" data-act="replay">查看上次回放 ↗</button>';
 }else if(!run){
   out=title(tab==="traffic"?"客流计划":"运行档案",tab==="traffic"?"TIMETABLE":"REPLAY");
   if(tab==="traffic"){out+=metric([["客流总量",fmt(s.demand)],["参与线路",s.lines.length]])+row("进站流程","安检 → 过闸 → 候车")+row("换乘流程","下车 → 换乘 → 候车")+row("出站流程","下车 → 过闸 → 出口");
     out+=title("列车时刻","HEADWAY")+s.lines.map(l=>row("L"+(l+1)+" 号线",(48+l*5)+" s / 班")).join("")}
   else out+=lastRecord?.key===keyOf(station)?'<div class="card"><h3>上次试运行</h3><p>完成 '+fmt(lastRecord.result.finished)+' 人次，可拖动时间轴检查排队位置。</p><button class="linkBtn" data-act="replay">打开回放 ↗</button></div>':'<p class="sub">运行一轮客流后，这里会保留站内动线、热力分布和试运行成绩。</p>'
 }else{
   const replaying=state==="replay",time=replaying?replayAt:run.tick;
   out=title(replaying?"运行回放":"实时客流",replaying?"PLAYBACK":"LIVE SIMULATION");
   if(replaying){
     out+='<div class="sessionRow"><button class="soft" data-act="play">'+(paused?"▶ 播放":"Ⅱ 暂停")+'</button><b class="code">'+time+' / '+run.tick+' s</b></div><input id="timeline" type="range" min="0" max="'+run.tick+'" value="'+time+'" aria-label="回放时间">';
   }else out+='<div class="trackBar"><i style="width:'+(run.tick/run.end*100)+'%"></i></div>'+row("仿真时钟",time+" s");
   out+='<div class="sessionRow">'+selectOpt("speed",[[1,"1× 速度"],[4,"4× 速度"],[16,"16× 速度"],[64,"64× 速度"]],speed)+'<button class="soft" data-act="heat">热力图 '+(heat?"●":"○")+'</button>'+(replaying?'':'<button class="soft" data-act="stop">中止</button>')+'</div>';
   if(heat)out+='<div class="smallCode">密度　<span style="color:#b49b24">■ 1–4</span>　<span style="color:#c47b21">■ 5–8</span>　<span style="color:#c3593f">■ 9+ 人/格</span></div>';
   const past=replaying?run.flow.findLast(f=>f.t<=time):null;
   out+=metric([["已到达 / 人",fmt(replaying?(time===run.tick?r.finished:past?.done||0):r.finished)],["在站及待下车 / 人",fmt(replaying?(time===run.tick?run.active.length:past?.n||0):run.active.length)]]);
   out+='<canvas id="flowPlot" class="graph" aria-label="站内与待下车人数随时间变化"></canvas>';
   if(replaying){if(run.hotspot)out+='<button class="linkBtn" data-act="hotspot">定位峰值拥堵 ↗</button>';out+=title("验收与方案对比","RESULTS");
     if(s.mode!=="sandbox")out+='<div class="notice '+(lastRecord?.won?"":"bad")+'">'+(lastRecord?.won?"● 已达到任务条件":"○ 未通过 · "+instruction(s)+" 疏运目标 "+Math.round(s.target*100)+"%。")+'</div>';
     const compare=(name,key,unit)=>{const v=r[key],diff=baseStats?v-baseStats[key]:null;return row(name,fmt(v)+unit+(diff!==null?' <small class="code">('+(diff>0?"+":"")+diff+')</small>':""))};
     out+=row("疏运完成率",Math.round(r.finished/r.total*100)+"%")+compare("平均通行","time"," s")+compare("平均排队","wait"," s")+compare("峰值密度","peak"," 人/格")+compare("误车人次","missed","")+compare("舒适度","comfort"," /100")+compare("建设造价","cost"," 元");
     if(baseStats)out+='<div class="notice">括号内为相同客流下，本次相对上次的变化。</div>';
   }else out+=title("列车动态","SERVICE")+s.lines.map(l=>row("L"+(l+1)+" 号线",T.service(time,l)?"● 停站上下客":"区间运行")).join("");
   out+=title("乘客追踪","PASSENGER")+'<div class="sessionRow"><input type="number" id="personId" min="1" max="'+s.demand+'" placeholder="乘客编号" style="width:104px" value="'+(selected?.id||"")+'"><button class="soft" data-act="find">追踪</button></div>';
   if(selected){const p=selected,q=T.where(p,time),fmtNode=v=>v<0?"—":M.floors[run.geo.xyz(v)[2]]+" ("+run.geo.xyz(v).slice(0,2).join(",")+")";
     const stopName=k=>k.startsWith("p")?"L"+(Number(k.slice(1))+1)+" 站台":k.startsWith("e")?String.fromCharCode(65+Number(k.slice(1)))+" 出口":k==="gate"?"闸机":"安检";
     out+='<div class="card"><b>#'+p.id+'　'+({in:"进站",out:"出站",transfer:"换乘"})[p.type]+'</b><p>'+[p.from,...p.targets].map(stopName).join(" → ")+'</p><p>'+T.habits[p.habit]+' · '+(2/p.speed).toFixed(1)+' m/s</p><p>'+T.status[q.reason]+' · '+fmtNode(q.pos)+'</p>';
     const activeUntil=p.history.map(T.decode).filter(v=>v.t<=time),events=activeUntil.filter((v,i,a)=>v.reason!==0&&v.reason!==9&&(i===0||v.reason!==a[i-1].reason||v.pos!==a[i-1].pos));
     const choice=p.decisions.findLast(v=>v.t<=time);
     if(choice)out+='<p>'+choice.t+'s · '+(choice.revised?"队列变化，重新选路":"前往下一站点")+'。'+(choice.score<0?"当前偏好下目的地不可达。":"选定 "+fmtNode(choice.to)+" 的"+stopName(choice.target)+"，综合代价 "+choice.score+"，下一格 "+choice.load+" 人。")+'</p>';
     out+='<p>选路考虑步行时间、跨层偏好与队列，每 8 秒更新。</p>'+(events.length?'<ul class="log">'+events.slice(-12).reverse().map(v=>'<li>'+v.t+'s　'+T.status[v.reason]+'　'+fmtNode(v.pos)+'</li>').join("")+'</ul>':'')+'</div>';
   }else out+='<p class="sub">点选图中乘客或输入编号，查看完整动线、出行偏好与受阻记录。</p>'
 }
 el.innerHTML=out;el.scrollTop=offset;if($("#flowPlot")&&run)drawFlow($("#flowPlot"),run,state==="replay"?replayAt:run.tick);
}
function drawFlow(canvas,r,t){
 const w=canvas.clientWidth||240,h=52,ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=w*ratio;canvas.height=h*ratio;const c=canvas.getContext("2d");c.scale(ratio,ratio);
 const max=r.flow.reduce((v,p)=>Math.max(v,p.n),1),end=r.done?r.tick:r.end,px=v=>3+(w-6)*v/end,py=v=>h-5-(h-18)*v/max;
 c.fillStyle="#eff4ea";c.fillRect(0,0,w,h);c.beginPath();c.moveTo(3,h-5);for(const p of r.flow)c.lineTo(px(p.t),py(p.n));c.lineTo(px(r.tick),h-5);c.closePath();c.fillStyle="#a8cbb2";c.fill();
 c.beginPath();r.flow.forEach((v,i)=>i?c.lineTo(px(v.t),py(v.n)):c.moveTo(px(v.t),py(v.n)));c.strokeStyle="#3d8168";c.lineWidth=1.4;c.stroke();
 c.fillStyle="#365d4d";c.font="9px sans-serif";c.fillText("在站及待下车人数",5,11);c.fillRect(px(t),12,1,h-12);
}
function openDialog(cap,name,html){$("#dialogCap").textContent=cap;$("#dialogTitle").textContent=name;$("#dialogBody").innerHTML=html;if(!$("#dialog").open)$("#dialog").showModal()}
function closeDialog(){if($("#dialog").open)$("#dialog").close()}
function levels(kind="training"){
 const list=kind==="training"?M.tutorial:M.missions;
 let out='<div class="formActions"><button class="'+(kind==="training"?"darkBtn":"soft")+'" data-leveltab="training">入职培训 · 5</button><button class="'+(kind==="challenge"?"darkBtn":"soft")+'" data-leveltab="challenge">设计挑战 · 30</button><button class="outline" data-act="sandbox">新建沙盒</button></div>';
 out+='<div class="dialogGrid">'+list.map((v,i)=>'<button class="level" data-level="'+i+'" data-kind="'+kind+'"><span class="smallCode">'+(kind==="training"?"TRAINING":"CHALLENGE")+' / '+String(i+1).padStart(2,"0")+(book[kind+i]?"　● 已通过":"")+'</span><b>'+v[0]+'</b><small>'+(kind==="training"?v[1]:M.briefs[v[1]])+'</small></button>').join("")+'</div>';
 openDialog("OPERATIONS ACADEMY","培训与挑战",out)
}
function shelfCurrent(){const copy=structuredClone(station),sig=JSON.stringify(copy);if(!library.some(s=>JSON.stringify(s)===sig)){library.unshift(copy);library=library.slice(0,24);write("library",library)}}
function changeTo(s){shelfCurrent();switchStation(s)}
function settings(){
 const s=station,free=s.mode==="sandbox"||editor;
 let out='<p class="sub">'+(free?"设置将随车站蓝图一同保存。":"本关使用固定客流与预算。可以复制到沙盒继续自由设计。")+'</p>';
 if(free){
   out+='<label class="field">车站名称<input id="sName" type="text" maxlength="48" value="'+escapeText(s.name)+'"></label><label class="field">高峰时段'+selectOpt("sPeak",[["morning","早高峰"],["evening","晚高峰"]],s.peak)+'</label><label class="field">乘客人数<input id="sDemand" type="number" min="1" max="20000" value="'+s.demand+'"></label><label class="field">客流种子<input id="sSeed" type="number" min="0" max="4294967295" value="'+s.seed+'"></label>';
   out+=title("客流起讫点","ORIGINS & DESTINATIONS")+'<p class="sub">选中的起讫点会产生客流，请在车站内布置对应编号的入口、站台和相邻轨道。</p><div class="formActions">'+[0,1,2].map(i=>'<label><input type="checkbox" name="entries" value="'+i+'" '+(s.entries.includes(i)?"checked":"")+'> 出口 '+String.fromCharCode(65+i)+'</label>').join("")+'</div><div class="formActions">'+[0,1,2].map(i=>'<label><input type="checkbox" name="lines" value="'+i+'" '+(s.lines.includes(i)?"checked":"")+'> L'+(i+1)+' 线</label>').join("")+'</div>';
   out+='<label class="field">建设用地'+selectOpt("sSize",M.sizes.map(([w,h],i)=>[i,w+" × "+h+" 格"]).slice(s.size||0),s.size||0)+'</label>';
   if(editor)out+='<label class="field">关卡总预算（0 为不限）<input id="sBudget" type="number" min="0" max="1000000" value="'+s.budget+'"></label><label class="field">目标疏运率（%）<input id="sTarget" type="number" min="1" max="100" value="'+Math.round(s.target*100)+'"></label>';
   out+='<div class="formActions"><button class="darkBtn" data-act="apply">保存设置</button><button class="soft" data-act="'+(editor?"playCustom":"editor")+'">'+(editor?"保存并试玩自编关卡":"进入关卡编辑器")+'</button><button class="outline" data-act="blank">新建空白沙盒</button></div>'
 }else out+='<div class="formActions">'+(s.mode==="custom"?'<button class="soft" data-act="resumeEditor">编辑关卡</button>':"")+'<button class="darkBtn" data-act="copySandbox">复制到沙盒</button></div>';
 out+=title("本机记录","PERSONAL BEST")+row("已通过挑战",Object.keys(book).filter(k=>k.startsWith("challenge")).length+" / 30")+row("培训进度",Object.keys(book).filter(k=>k.startsWith("training")).length+" / 5")+row("本地成就",medals.length||"0");
 if(medals.length)out+='<div class="notice">'+medals.map(escapeText).join("　·　")+'</div>';
 const best=book[s.mode==="custom"?keyOf(s):s.mode+s.index];if(best)out+=row("本关最高分",best.score);
 openDialog("STATION PARAMETERS","车站设置",out)
}
function applySettings(){
 let entries=$all('[name=entries]:checked').map(x=>+x.value),lines=$all('[name=lines]:checked').map(x=>+x.value);
 let next={...station,name:$("#sName").value.trim()||"未命名",entries,lines,peak:$("#sPeak").value,demand:Number($("#sDemand").value),seed:Number($("#sSeed").value)};
 if(editor){next.budget=Number($("#sBudget").value);next.target=Number($("#sTarget").value)/100}
 try{next=M.expand(next,+$("#sSize").value);M.validate(next);if(next.seed<0||next.seed>4294967295||next.budget>1000000)throw Error("数值超出范围")}catch(e){say(e.message);return false}
 checkpoint();if(keyOf(next)!==keyOf(station)){previous=null;baseStats=null}station=next;view.dirty=true;save();closeDialog();render();return true
}
function workshop(){
 let out='<p class="sub">保存当前图纸，或通过导入、导出蓝图交换车站。切换关卡前的方案会保存在当前浏览器的图纸架。</p><div class="formActions"><button class="darkBtn" data-act="shelf">保存到图纸架</button><button class="soft" data-act="export">导出蓝图</button><button class="soft" data-act="import">导入蓝图</button></div>';
 out+=title("本机图纸架","BLUEPRINTS")+'<div class="workList">'+(library.length?library.map((s,i)=>'<div class="workItem"><span><b>'+escapeText(s.name)+'</b>　'+modeName(s)+' · '+fmt(s.demand)+' 人</span><button class="outline" data-load="'+i+'">载入</button></div>').join(""):'<p class="sub">还没有收藏的图纸。</p>')+'</div>';
 openDialog("STATION WORKSHOP","车站工坊",out);
}
function help(){openDialog("FIELD MANUAL","操作指南",'<div class="helpGrid"><b>第一次玩</b><span>晴川路是一座可直接运行的双线车站。点击「开始试运行」，或进入「培训与挑战」从第一课开始。</span><b>施工</b><span>选择楼层与工具，左键点按或拖动连续布置。清除工具拆除并返还造价，Ctrl+Z / Ctrl+Y 撤销和重做。</span><b>垂直交通</b><span>选楼梯、扶梯、坡道或直梯，再指定目标层与方向。一次布置生成两端落点，只有直梯可以跨过中间楼层。</span><b>运输</b><span>在客流方案启用的出口与线路间服务。进站先安检后过闸，出站需过闸，换乘旅客直接前往另一站台。站台旁至少有一格轨道才能上下客。</span><b>动线</b><span>R 旋转单向通道或切换楼梯方向。并排铺设可增加通行能力，护栏可阻挡穿行。</span><b>镜头</b><span>滚轮缩放，右键或中键拖动平移。按 1–4 从地下二层到高架层切换，⌖ 复位镜头。</span><b>回放</b><span>运行结束后拖动时间轴或播放回放，开启热力图，点选乘客查看经过路线。返回设计台改建后再跑，成绩显示与同批客流上次结果的差值。</span><b>成绩</b><span>在工期与预算内达到目标疏运率，并完成任务简报中的设施要求。通行时间、疏运率、舒适度与造价共同计入本机关卡最高分。</span><b>保存</b><span>编辑自动保存。工坊可以收藏多个方案，并导入、导出蓝图。</span></div>')}
function download(){const blob=new Blob([JSON.stringify(station)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=station.name+".metro.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function findPerson(id){if(!run)return;let p=run.people.find(p=>p.id===id);if(!p){say("该编号不在本批客流内");return}selected=p;let t=state==="replay"?replayAt:run.tick,q=T.where(p,t);
 if(q.pos<0&&state==="replay"&&p.history.length){let first=p.history.map(T.decode).find(v=>v.pos>=0);if(first){replayAt=first.t;q=first;paused=true}}
 if(q.pos>=0)view.z=run.geo.xyz(q.pos)[2];view.dirty=true;render()}
function act(k){
 if(k==="replay")replay();else if(k==="sandbox"||k==="blank"){let s=M.create();if(k==="blank"){s.name="新车站";s.cells.fill(null);s.lines=[0];s.entries=[0]}changeTo(s)}
 else if(k==="copySandbox"){let s=structuredClone(station);s.mode="sandbox";s.budget=0;s.goal="free";s.index=0;changeTo(s)}
 else if(k==="resumeEditor"){editor=true;render();settings()}else if(k==="apply")applySettings();else if(k==="editor"){if(!applySettings())return;editor=true;station.mode="custom";station.goal="custom";station.index=0;save();render();settings()}
 else if(k==="playCustom"){if(!applySettings())return;editor=false;say("自编关卡已保存，开始试运行即可验收");render()}
 else if(k==="play"){if(replayAt>=run.tick)replayAt=0;paused=!paused;clock=0;noteReview();render()}
 else if(k==="heat"){heat=!heat;noteReview();render()}
 else if(k==="stop"){backToEdit();say("已中止本轮试运行")}
 else if(k==="hotspot"&&run?.hotspot){view.z=run.geo.xyz(run.hotspot.i)[2];replayAt=run.hotspot.t;paused=true;heat=true;selected=null;view.dirty=true;noteReview();render()}
 else if(k==="find")findPerson(+$("#personId").value);
 else if(k==="export")download();else if(k==="import")$("#file").click();
 else if(k==="shelf"){shelfCurrent();workshop();say("车站已加入本机图纸架")}
}
document.addEventListener("click",e=>{
 const el=e.target.closest("button");if(!el||el.disabled)return;let d=el.dataset;
 if(d.nav==="studio")closeDialog();else if(d.nav==="levels")levels();else if(d.nav==="workshop")workshop();
 else if(d.tab){tab=d.tab;render()}
 else if(d.act)act(d.act);else if(d.leveltab)levels(d.leveltab);
 else if(d.level!==undefined)changeTo(M.create(d.kind,+d.level));
 else if(d.load!==undefined)changeTo(structuredClone(library[+d.load]));
 else if(d.group!==undefined){group=+d.group;selectTool(groups[group][1][0])}
 else if(d.tool)selectTool(d.tool);else if(d.z!==undefined)setFloor(+d.z);
 else switch(el.id){case "view":view.top=!view.top;view.reset();render();break;case "plus":case "minus":view.zoom=Math.max(.45,Math.min(3,view.zoom*(el.id==="plus"?1.2:1/1.2)));view.dirty=true;render();break;case "home":view.reset();render();break;case "run":start();break;case "settings":settings();break;case "help":help();break;case "undo":undo();break;case "redo":undo(true);break;case "close":closeDialog();break}
});
document.addEventListener("change",async e=>{
 let v=e.target.value;switch(e.target.id){case "targetZ":dest=+v;break;case "direction":dir=+v;break;case "species":species=+v;break;case "speed":speed=+v;clock=0;e.target.blur();break;case "file":{
   let f=e.target.files[0];if(!f)break;try{if(f.size>800000)throw Error("蓝图文件过大");let s=M.validate(JSON.parse(await f.text()));changeTo(s);say("已导入车站")}catch(err){say(err.message)}e.target.value="";break}}
});
document.addEventListener("input",e=>{if(e.target.id==="timeline"){paused=true;replayAt=+e.target.value;noteReview();needsDraw=true;manualScroll=true}});
document.addEventListener("pointerup",()=>{if(manualScroll){manualScroll=false;if(state==="replay")panel()}});
document.addEventListener("keyup",e=>{if(e.target.id==="timeline"){manualScroll=false;panel();$("#timeline")?.focus()}});
$("#dialog").addEventListener("click",e=>{if(e.target===$("#dialog")){let b=$("#dialog").getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeDialog()}});
document.addEventListener("keydown",e=>{
 if($("#dialog").open||["INPUT","SELECT","TEXTAREA"].includes(e.target.tagName))return;
 if(e.ctrlKey&&e.key.toLowerCase()==="z"){e.preventDefault();undo(e.shiftKey);return}if(e.ctrlKey&&e.key.toLowerCase()==="y"){e.preventDefault();undo(true);return}
 if("1234".includes(e.key)&&e.key.length===1)setFloor(+e.key-1);
 if(e.code==="Space"&&state!=="edit"&&e.target.tagName!=="BUTTON"){e.preventDefault();state==="run"?start():act("play")}
 if(e.key.toLowerCase()==="r"&&state==="edit"){dir=tool==="one"?(dir+1)%4:tool==="stairs"?(dir+1)%3:tool==="escalator"?(dir===1?2:1):dir;options();needsDraw=true}
});
function editTile(i){
 if(i<0||stroke?.seen.has(i))return;stroke.seen.add(i);
 let error;if(tool==="land"&&editor){if(station.cells[i])error="只能调整空地边界";else{station.mask[i]=station.mask[i]?0:1;station.edited++}}
 else error=M.edit(station,i,tool,{z:dest,a:tool==="one"||tool==="stairs"||tool==="escalator"?dir:tool==="entry"||tool==="platform"?species:0,editor});
 if(error)say(error);else if(error!==""){stroke.changed=true;view.dirty=true;needsDraw=true}
}
const canvas=$("#map"),pos=e=>{const b=canvas.getBoundingClientRect();return [e.clientX-b.left,e.clientY-b.top]};
canvas.addEventListener("contextmenu",e=>e.preventDefault());
canvas.addEventListener("pointerdown",e=>{
 canvas.focus();canvas.setPointerCapture(e.pointerId);let [x,y]=pos(e);if(e.button===2||e.button===1||e.shiftKey){drag=[x,y,...view.pan];return}
 if(state==="edit"){stroke={before:JSON.stringify(station),seen:new Set(),changed:false};editTile(view.grid(x,y))}
 else{let closest=null,best=12;for(let p of view.hitPeople){let d=Math.hypot(p.px-x,p.py-y);if(d<best){best=d;closest=p}}if(closest)findPerson(closest.id)}
});
canvas.addEventListener("pointermove",e=>{let [x,y]=pos(e);if(drag){view.pan=[drag[2]+x-drag[0],drag[3]+y-drag[1]];view.dirty=true}else{hover=view.grid(x,y);if(stroke)editTile(hover)}needsDraw=true});
function endStroke(){if(stroke?.changed){history.push(stroke.before);if(history.length>65)history.shift();future=[];save();render()}stroke=null;drag=null}
canvas.addEventListener("pointerup",endStroke);canvas.addEventListener("pointercancel",endStroke);canvas.addEventListener("pointerleave",()=>{hover=-1;needsDraw=true});
canvas.addEventListener("wheel",e=>{e.preventDefault();view.zoom=Math.max(.45,Math.min(3,view.zoom*(e.deltaY<0?1.10:1/1.10)));view.dirty=true;needsDraw=true;$("#mapStatus").textContent="1 GRID = 2 m    /    "+codeOf(station)+"    /    "+Math.round(view.zoom*100)+"%"},{passive:false});
function loop(now){
 const dt=Math.min(220,now-(priorTime||now));priorTime=now;
 if(run&&!paused&&!$("#dialog").open){
   clock+=dt*.002*speed;let n=Math.min(32,Math.floor(clock));clock-=n;
   if(state==="run"){
     for(let i=0;i<n&&!run.done;i++)run.step();
     if(run.done)finished();
   }else if(state==="replay"){replayAt=Math.min(run.tick,replayAt+n);if(replayAt>=run.tick)paused=true;noteReview()}
   if(n)needsDraw=true;
   if(now-lastPanel>430&&!manualScroll&&!["personId","timeline"].includes(document.activeElement?.id)){panel();lastPanel=now}
 }
 if(needsDraw||view.dirty){
   const s=state==="replay"?run.station:station,t=state==="replay"?replayAt:run?.tick;
   view.draw(s,{time:t,people:state==="replay"?run.people:run?.active,selected,density:heat&&run?(state==="replay"?run.density(t):run.occ):null,heat,replay:state==="replay",hover:state==="edit"?hover:-1,ghost:state==="edit"?tool:null,a:dir});needsDraw=false
 }
 requestAnimationFrame(loop)
}
new ResizeObserver(()=>{view.dirty=true;needsDraw=true}).observe(canvas);render();requestAnimationFrame(loop);
