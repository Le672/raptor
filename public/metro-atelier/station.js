"use strict";
const Metro = (() => {
  const W=22, H=15, AREA=W*H, SIZE=AREA*4;
  const floors=["B2","B1","G","L1"], floorNames=["地下二层","地下一层","地面层","高架层"];
  const dirs=[[1,0],[0,1],[-1,0],[0,-1]], arrows=["东 →","南 ↓","西 ←","北 ↑"];
  const raw={
    floor:["站厅地坪",8,"floor","连续铺设站厅与步行通道。"],
    platform:["站台",16,"platform","紧邻轨道的站台可接发指定线路列车。"],
    track:["轨道",12,"track","紧贴站台铺设，轨道不可步行。"],
    entry:["出入口",40,"entry","设置 A、B 或 C 号街道出入口。"],
    gate:["闸机",60,"gate","进站与出站均须过闸，多开一组可分流。"],
    check:["安检",75,"check","进站先安检再过闸，每台独立排队。"],
    stairs:["楼梯",95,"stairs","连接相邻楼层，可限制上行、下行或双向。"],
    escalator:["自动扶梯",145,"escalator","单向跨层输送，出口拥堵时暂停。"],
    ramp:["无障碍坡道",110,"ramp","双向跨层通行，适合回避楼梯的乘客。"],
    lift:["直达电梯",220,"lift","连接指定楼层，两端同坐标，每班限载。"],
    fence:["护栏",9,"fence","阻止乘客穿越，分隔进、出站流线。"],
    one:["单向通道",14,"one","仅准沿箭头离开此格，R 旋转方向。"],
    bench:["候车长椅",18,"bench","占用一格空间，改善周围候车舒适度。"],
    plant:["绿化",12,"plant","占用一格空间，改善相邻区域舒适度。"],
    pillar:["既有结构",0,"pillar","不可通行。关卡编辑器可布置结构障碍。"],
    empty:["清除",0,"erase","移除设施并返还造价，跨层设施两端同步清理。"]
  };
  const tools=Object.fromEntries(Object.entries(raw).map(([k,[name,cost,icon,tip]])=>[k,{name,cost,icon,tip}]));
  const sizes=[[22,15],[36,24],[48,32]];
  const geometries=sizes.map(([W,H])=>{
    const AREA=W*H,SIZE=AREA*4;
    const id=(x,y,z)=>z*AREA+y*W+x,xyz=i=>[i%W,Math.floor(i/W)%H,Math.floor(i/AREA)];
    function local(i,d){const [x,y,z]=xyz(i),[dx,dy]=dirs[d];return x+dx>=0&&x+dx<W&&y+dy>=0&&y+dy<H?id(x+dx,y+dy,z):-1}
    return {W,H,AREA,SIZE,id,xyz,local};
  });
  function geometry(s){const plan=geometries[s?.size??0];if(!plan||!Number.isInteger(s?.size??0))throw Error("不支持的场地大小");return plan}
  const {id,xyz,local}=geometries[0];
  function expand(s,size){
    const old=geometry(s),next=geometries[size];
    if(!next||next.W<old.W)throw Error("请选择当前或更大的用地");
    if(next===old)return s;
    const cells=Array(next.SIZE).fill(null),mask=Array(next.SIZE).fill(1);
    const move=i=>{let [x,y,z]=old.xyz(i);return next.id(x+Math.floor((next.W-old.W)/2),y+Math.floor((next.H-old.H)/2),z)};
    s.cells.forEach((c,i)=>{let j=move(i);mask[j]=s.mask[i];cells[j]=c&&vertical(c.k)?{...c,to:move(c.to)}:c});
    return {...s,cells,mask,size,edited:s.edited+1}
  }  const walk=c=>!!c&&!["empty","track","fence","pillar","bench","plant"].includes(c.k);
  const vertical=k=>["stairs","escalator","ramp","lift"].includes(k);
  const cell=(k,a=0)=>({k,a});
  const cost=s=>s.cells.reduce((sum,c,i)=>sum+(c&&(!vertical(c.k)||i<c.to)?tools[c.k].cost:0),0);
  function rng(seed){let n=seed>>>0;return ()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296)}
  const tutorial=[
    ["检票口的第一班车","在 B1 补设一组闸机，打通进出站流程。","gate"],
    ["地面到站厅","在 G 与 B1 之间增设楼梯，接通两个楼层。","stairs"],
    ["无台阶旅程","用跨层直梯连接 G 与 B1，让只乘直梯的乘客也能进站。","lift"],
    ["各行其道","在 B1 增设上行扶梯，给离站客流独立的通道。","escalator"],
    ["复盘早高峰","先试运行并查看热力回放，再改建并用同批客流复测。","replay"]
  ];
  const missions=[
    ["榆树街","gate"],["南门市场","check"],["纸坊巷","floor"],["沿河码头","stairs"],["长青医院","lift"],["金谷广场","gate"],
    ["西港仓库","floor"],["花园路","ramp"],["天文台","escalator"],["大学东门","check"],["剧院前","gate"],["旧城墙","floor"],
    ["双桥口","transfer"],["白塔寺","lift"],["城际东站","transfer"],["云岭街","stairs"],["北岸会展","check"],["高架公园","elevated"],
    ["日晖里","ramp"],["体育中心","gate"],["石门隧道","floor"],["东港枢纽","transfer"],["枫林谷","lift"],["空中走廊","elevated"],
    ["滨江剧场","escalator"],["会展新城","check"],["机场大道","transfer"],["山麓总站","ramp"],["中央环廊","elevated"],["十字中央","transfer"]
  ];
  const briefs={gate:"分散过闸队列，在预算内完成疏运。",check:"补足入站安检能力，缩短排队时间。",floor:"把断开的站厅重新接通，绕开既有结构。",stairs:"重新连接站厅与站台，楼梯方向由你决定。",lift:"为只乘直梯的乘客打通跨层路线。",ramp:"为回避楼梯的旅客修建平缓的跨层路线。",escalator:"补建上行扶梯，避免出口滞留。",transfer:"接通两条线路，让换乘与出站客流顺畅交汇。",elevated:"连接高架站台与地面站厅，完成高峰疏运。"};
  function create(mode="sandbox",index=0){
    const spec=mode==="training"?tutorial[index]:mode==="challenge"?missions[index]:null;
    const goal=mode==="training"?spec[2]:spec?.[1]||"free", advanced=mode==="challenge"&&index>=12;
    const s={version:1,name:spec?.[0]||"晴川路",mode,index,goal,seed:714021+index*811+(mode==="training"?301:0),peak:index%2?"evening":"morning",demand:mode==="training"?90+index*20:mode==="challenge"?180+index*36:480,
      budget:0,target:mode==="challenge"?0.70+Math.floor(index/6)*0.025:0.66,cells:Array(SIZE).fill(null),mask:Array(SIZE).fill(1),edited:0};
    const put=(x,y,z,k,a=0)=>s.cells[id(x,y,z)]=cell(k,a);
    const rect=(x1,y1,x2,y2,z,k)=>{for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++)put(x,y,z,k)};
    const pair=(x,y,z,t,k,a=0)=>{let b=id(x,y,z),e=id(x,y,t);s.cells[b]={k,a,to:e};s.cells[e]={k,a,to:b}};
    let n=mode==="challenge"?index:0, elevated=goal==="elevated", p=elevated?3:1, g=2, low=elevated?1:0;
    const left=2+n%3, right=19-(Math.floor(n/3)%2), north=2+(n%2);
    rect(left,north,right,11,p,"floor"); rect(left,north,right,north,p,"track");
    for(let x=left;x<=right;x++)put(x,north+1,p,"platform",0);
    rect(3,5,18,10,g,"floor"); put(3,8,g,"entry",0); put(18,8,g,"entry",1);
    for(const x of [5,16]){put(x,7,g,"check");put(x,9,g,"gate")}
    for(const x of [6,15])pair(x,8,g,p,"stairs");
    pair(12,7,g,p,"lift");pair(9,8,g,p,"escalator",1);
    for(const x of [5,10,16]){put(x,5,p,"bench");put(x,10,p,"plant")}
    for(const x of [4,8,13,17])put(x,6,p,"pillar");
    if(advanced||mode==="sandbox"){
      rect(5,3,16,11,low,"floor");rect(5,11,16,11,low,"track");
      for(let x=5;x<=16;x++)put(x,10,low,"platform",1);
      pair(8,7,elevated?g:p,low,"stairs");pair(14,8,elevated?g:p,low,"lift");
    }
    function clearKinds(ks){for(let i=0;i<SIZE;i++)if(ks.includes(s.cells[i]?.k))s.cells[i]=cell("floor")}
    if(goal==="gate")clearKinds(["gate"]);
    if(goal==="check")clearKinds(["check"]);
    if(["stairs","lift","ramp","escalator"].includes(goal)){
      if(goal==="stairs")clearKinds(["stairs","lift","escalator","ramp"]);
      else clearKinds([goal]);
    }
    if(goal==="elevated"){for(const x of [6,15]){put(x,8,g,"floor");put(x,8,p,"floor")}put(9,8,g,"floor");put(9,8,p,"floor")}
    if(goal==="transfer")for(const x of [8,14]){let y=x===8?7:8;put(x,y,p,"floor");put(x,y,low,"floor")}
    if(goal==="floor"){for(let x=left;x<=right;x++)s.cells[id(x,north+2,p)]=null}
    if(mode==="challenge"){
      const rnd=rng(s.seed);
      for(let z=0;z<4;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        let i=id(x,y,z);if(!s.cells[i]&&(x<1+n%2||x>20||y===0||y>13))s.mask[i]=0;
        if(s.cells[i]?.k==="floor"&&rnd()<.018+(index%6)*.003)put(x,y,z,"pillar")
      }
    }
    s.entries=[0,1];s.lines=advanced||mode==="sandbox"?[0,1]:[0];s.budget=mode==="sandbox"?0:cost(s)+ (mode==="training"?850:540+(index%6)*55+(advanced?380:0));
    return s;
  }
  function edit(s,i,k,opt={}){const {SIZE,AREA}=geometry(s);
    if(!Number.isInteger(i)||i<0||i>=SIZE||!s.mask[i])return "超出可建设用地";
    if(!tools[k]||(k==="pillar"&&!opt.editor))return "该设施仅供关卡编辑";
    const old=s.cells[i]; if(old?.k==="pillar"&&!opt.editor)return "既有结构无法拆除";
    const draft=new Map();
    function detach(at){const c=s.cells[at];if(c&&vertical(c.k))draft.set(c.to,cell("floor"))}
    detach(i);
    const a=opt.a||0;
    if(vertical(k)){
      const z=Math.floor(i/AREA), dest=opt.z??(z===3?2:z+1);
      if(dest<0||dest>3||dest===z||(k!=="lift"&&Math.abs(dest-z)!==1))return "请选择可连接的目标楼层";
      const j=i%AREA+dest*AREA;
      if(!s.mask[j]||(s.cells[j]?.k==="pillar"&&!opt.editor))return "另一层的落点被占用或越界";
      detach(j);draft.set(i,{k,a,to:j});draft.set(j,{k,a,to:i})
    }else draft.set(i,k==="empty"?null:cell(k,a));
    let delta=0, changed=false;
    for(const [j,c] of draft){const prev=s.cells[j];
      const price=v=>v&&(!vertical(v.k)||j<v.to)?tools[v.k].cost:0;
      delta+=price(c)-price(prev);if(JSON.stringify(c)!==JSON.stringify(prev))changed=true}
    if(!changed)return "";
    if(s.budget&&cost(s)+delta>s.budget&&!opt.editor)return "建设预算不足";
    for(const [j,c] of draft)s.cells[j]=c;
    s.edited++;return null;
  }
  function validate(s){const {SIZE,AREA}=geometry(s);
    if(!s||s.version!==1||typeof s.name!=="string"||s.name.length>60||!Array.isArray(s.cells)||s.cells.length!==SIZE||!Array.isArray(s.mask)||s.mask.length!==SIZE)throw Error("无效车站文件");
    if(!["sandbox","training","challenge","custom"].includes(s.mode)||!Number.isInteger(s.index)||s.index<0||s.index>=(s.mode==="training"?5:30)||!Number.isInteger(s.demand)||s.demand<1||s.demand>20000||!Number.isFinite(s.budget)||s.budget<0||!Number.isInteger(s.seed)||!["morning","evening"].includes(s.peak)||!Number.isFinite(s.target)||s.target<0||s.target>1||!Number.isInteger(s.edited)||s.edited<0)throw Error("关卡参数超出范围");
    for(const key of ["entries","lines"])if(!Array.isArray(s[key])||!s[key].length||s[key].length>3||s[key].some(v=>!Number.isInteger(v)||v<0||v>2)||new Set(s[key]).size!==s[key].length)throw Error("客流起讫配置无效");s.cells.forEach((c,i)=>{if(![0,1].includes(s.mask[i]))throw Error("用地数据损坏");if(c===null)return;
      if(!Object.hasOwn(tools,c.k)||!Number.isInteger(c.a)||c.a<0||c.a>3||!s.mask[i])throw Error("设施数据损坏");
      if(vertical(c.k)){let p=s.cells[c.to];if(!Number.isInteger(c.to)||c.to===i||c.to%AREA!==i%AREA||p?.to!==i||p.k!==c.k||p.a!==c.a||(c.k!=="lift"&&Math.abs(c.to-i)!==AREA))throw Error("跨层连接数据损坏")}
    });return s
  }
  return {W,H,AREA,SIZE,sizes,geometry,expand,dirs,arrows,floors,floorNames,tools,id,xyz,local,walk,vertical,cost,rng,create,edit,validate,tutorial,missions,briefs}
})();
if(typeof module!=="undefined")module.exports=Metro;
