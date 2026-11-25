"use strict";
const Transit = ((M)=>{
  const {walk,vertical,rng,cost}=M;
  const status=["步行","等待安检","等待过闸","等候列车","通道排队","等待电梯","扶梯停运","无可达路径","等待下车","到达目的地","等待发车","尚未出发"];
  const habits=["优先快捷路线","尽量避开楼梯","只乘直梯"];
  class Heap{
    constructor(){this.q=[]}
    push(v,d){const q=this.q;let n=q.length;q.push([v,d]);while(n){let p=(n-1)>>1;if(q[p][1]<=d)break;q[n]=q[p];n=p}q[n]=[v,d]}
    pop(){let q=this.q,first=q[0],last=q.pop();if(q.length){let n=0;while(n*2+1<q.length){let c=n*2+1;if(c+1<q.length&&q[c+1][1]<q[c][1])c++;if(q[c][1]>=last[1])break;q[n]=q[c];n=c}q[n]=last}return first}
  }
  function manifest(s){
    const roll=rng(s.seed), people=[], window=Math.max(115,Math.ceil(s.demand/7)), pick=a=>a[Math.floor(roll()*a.length)];
    for(let i=0;i<s.demand;i++){
      const chance=roll(),transfer=s.lines.length>1&&chance<.21, incoming=!transfer&&chance<(s.peak==="morning"?.76:.46);
      const entry=pick(s.entries),line=pick(s.lines),other=pick(s.lines.filter(l=>l!==line).length?s.lines.filter(l=>l!==line):[line]);
      const h=roll(),speed=.8+roll()*.75,spawn=1+Math.floor((roll()+roll())*.5*window);
      const type=transfer?"transfer":incoming?"in":"out";
      const targets=incoming?["check","gate","p"+line]:transfer?["p"+other]:["gate","e"+entry];
      people.push({id:i+1,spawn,type,entry,line,other,habit:h<.08?2:h<.30?1:0,speed,targets,from:incoming?"e"+entry:"p"+line})
    }
    return people.sort((a,b)=>a.spawn-b.spawn||a.id-b.id)
  }
  function service(t,l){const cycle=48+l*5, shift=l*3;return ((t+shift)%cycle)<13}
  function nextTrain(t,l){while(!service(t,l))t++;return t}
  function graph(s){const {SIZE,local}=M.geometry(s);
    const edges=Array.from({length:SIZE},()=>[]), sources=new Map();
    function group(k,i){if(!sources.has(k))sources.set(k,[]);sources.get(k).push(i)}
    for(let i=0;i<SIZE;i++){
      const c=s.cells[i];if(!walk(c))continue;
      if(c.k==="entry")group("e"+c.a,i);
      if(c.k==="platform"&&[0,1,2,3].some(d=>s.cells[local(i,d)]?.k==="track"))group("p"+c.a,i);
      if(c.k==="gate"||c.k==="check")group(c.k,i);
      for(let d=0;d<4;d++){let j=local(i,d);if(walk(s.cells[j])&&(c.k!=="one"||c.a===d))edges[j].push([i,1,"walk"])}
      if(vertical(c.k)&&((c.k!=="stairs"&&c.k!=="escalator")||(c.k==="stairs"&&c.a===0)||(c.a===1&&c.to>i)||(c.a===2&&c.to<i)))edges[c.to].push([i,c.k==="lift"?3.4:2.2,c.k])
    }
    return {edges,sources}
  }
  const pack=(t,pos,reason)=>t*131072+(pos+1)*16+reason;
  const record=(p,t,reason)=>{if(p.reason===reason&&p.lastPos===p.pos)return;p.reason=reason;p.lastPos=p.pos;p.history.push(pack(t,p.pos,reason))};
  function decode(code){return {t:Math.floor(code/131072),pos:((code%131072)>>4)-1,reason:code%16}}
  function where(p,time){
    const h=p.history;let lo=0,hi=h.length;
    while(lo<hi){let mid=(lo+hi)>>1;if(Math.floor(h[mid]/131072)<=time)lo=mid+1;else hi=mid}
    return lo?decode(h[lo-1]):{t:0,pos:-1,reason:11}
  }
  class Run{
    constructor(s){this.geo=M.geometry(s);const {SIZE,local}=this.geo;
      this.station=structuredClone(s);this.map=graph(s);this.people=manifest(s).map(a=>({...a,pos:-1,stage:0,ready:0,done:0,lastPos:-2,reason:11,history:[],wait:0,misses:0,reroutes:0,decisions:[],intended:-1,decidedStage:-1,blockedAt:-1}));
      this.cursor=0;this.active=[];this.tick=0;this.end=Math.max(115,Math.ceil(s.demand/7))+230;
      this.occ=new Uint16Array(SIZE);this.traffic=new Uint32Array(SIZE);this.pressure=new Uint16Array(SIZE);this.cache=new Map();this.stops=new Uint8Array(SIZE);
      this.finished=0;this.elapsed=0;this.totalWait=0;this.missed=0;this.peak=0;this.hotspot=null;this.comfortLoss=0;this.cost=cost(s);this.done=false;
      this.seats=new Uint16Array(3);this.through=new Uint8Array(SIZE);this.alight=new Uint8Array(SIZE);this.escalators=s.cells.flatMap((c,i)=>c?.k==="escalator"&&((c.a===1&&c.to>i)||(c.a===2&&c.to<i))?[i]:[]);
      this.flow=[];this.amenities=new Uint8Array(SIZE);
      for(let i=0;i<SIZE;i++)this.amenities[i]=[0,1,2,3].some(d=>["bench","plant"].includes(s.cells[local(i,d)]?.k));
    }
    field(target,habit){const {SIZE}=this.geo;
      const key=target+habit;if(this.cache.has(key))return this.cache.get(key);
      const d=new Float32Array(SIZE).fill(Infinity),next=new Int16Array(SIZE).fill(-1),sink=new Int16Array(SIZE).fill(-1),heap=new Heap();
      for(const i of this.map.sources.get(target)||[]){let q=this.pressure[i]*(target==="gate"||target==="check"?1.8:.36);d[i]=q;sink[i]=i;heap.push(i,d[i])}
      while(heap.q.length){
        const [v,dist]=heap.pop();if(d[v]!==dist)continue;
        for(const [u,base,k] of this.map.edges[v]){
          if(habit===2&&k!=="walk"&&k!=="lift")continue;
          const w=base+(habit===1&&k==="stairs"?11:0)+this.pressure[v]*.48;
          const nd=Math.fround(dist+w);if(nd>=d[u])continue;d[u]=nd;next[u]=v;sink[u]=sink[v];heap.push(u,nd)
        }
      }
      let res={next,d,sink};this.cache.set(key,res);return res
    }
    wait(p,why){p.wait++;this.totalWait++;if(why!==3&&why!==8&&p.pos>=0)p.blockedAt=p.pos;record(p,this.tick,why)}
    finish(p){this.finished++;p.done=this.tick;this.elapsed+=p.done-p.spawn;this.occ[p.pos]--;record(p,this.tick,9);p.pos=-1}
    step(){const {SIZE,AREA}=this.geo;
      if(this.done)return;let t=++this.tick;
      if(t%8===1){this.pressure.set(this.occ);this.cache.clear()}
      for(let l=0;l<3;l++)if(service(t,l)&&!service(t-1,l)||t===1)this.seats[l]=65+10*l;
      this.through.fill(0);this.alight.fill(0);
      for(const i of this.escalators){const n=this.occ[this.station.cells[i].to];if(n>=7)this.stops[i]=1;else if(n<=3)this.stops[i]=0}
      while(this.cursor<this.people.length&&this.people[this.cursor].spawn<=t)this.active.push(this.people[this.cursor++]);
      for(const p of this.active){
        if(p.done)continue;
        if(p.pos===-1){
          const list=this.map.sources.get(p.from)||[];
          if(!list.length){this.wait(p,7);continue}
          if(p.type!=="in"&&!service(t,p.line)){this.wait(p,8);continue}
          let start=list[p.id%list.length];
          for(let n=0;n<list.length;n++){let q=list[(p.id+n)%list.length];if(this.occ[q]<this.occ[start])start=q}
          if(this.occ[start]>=12||(p.type!=="in"&&this.alight[start]>=2)){this.wait(p,p.type==="in"?4:8);continue}
          this.alight[start]++;p.pos=start;this.occ[start]++;record(p,t,0);
          p.expected=nextTrain(p.spawn+Math.round((p.type==="transfer"?17:23)*p.speed),p.type==="transfer"?p.other:p.line);
        }
        const target=p.targets[p.stage],boarding=target?.startsWith("p"),destLine=p.type==="transfer"?p.other:p.line;
        if(p.type!=="out"&&t>=p.expected&&!service(t,destLine)&&service(t-1,destLine)){this.missed++;p.misses++;p.expected=nextTrain(t,destLine)}
        if(t<p.ready)continue;
        const route=this.field(target,p.habit), j=route.next[p.pos];
        if(p.decidedStage!==p.stage||(j!==p.intended&&p.intended>=0&&p.lastDecision!==t)){
          const revised=p.decidedStage===p.stage;if(revised)p.reroutes++;p.decisions.push({t,at:p.pos,to:route.sink[p.pos],target,score:Number.isFinite(route.d[p.pos])?Math.round(route.d[p.pos]):-1,load:j>=0?this.pressure[j]:0,revised});p.decidedStage=p.stage;p.lastDecision=t;p.intended=j;
        }
        if(j<0){
          if(!Number.isFinite(route.d[p.pos])){this.wait(p,7);continue}
          if(boarding){
            if(!service(t,destLine)||this.seats[destLine]===0){this.wait(p,3);continue}
            this.seats[destLine]--;
          }else if(target==="gate"||target==="check"){
            if(this.through[p.pos]>=(target==="gate"?3:2)){this.wait(p,target==="check"?1:2);continue}
            this.through[p.pos]++;p.ready=t+(target==="check"?3:2);
          }
          if(++p.stage===p.targets.length){this.finish(p);continue}
          record(p,t,0);continue
        }
        const c=this.station.cells[p.pos],cross=Math.abs(j-p.pos)>=AREA;
        if(cross&&c.k==="escalator"&&(this.stops[p.pos]||this.occ[j]>=7)){this.stops[p.pos]=1;this.wait(p,6);continue}
        if(cross&&c.k==="lift"&&(t%6!==0||this.through[p.pos]>=6)){this.wait(p,5);continue}
        if(this.occ[j]>=14||(cross&&this.through[p.pos]>= (c.k==="escalator"?2:c.k==="stairs"?3:6))){this.wait(p,4);continue}
        if(cross)this.through[p.pos]++;

        this.occ[p.pos]--;p.pos=j;this.occ[j]++;this.traffic[j]++;
        p.intended=route.next[j];p.ready=t+Math.max(1,Math.round(p.speed*(cross?3:1)+(this.occ[j]>6?1:0)));record(p,t,0);
      }
      this.active=this.active.filter(p=>!p.done);
      for(let i=0;i<SIZE;i++)if(this.occ[i]){if(this.occ[i]>this.peak){this.peak=this.occ[i];this.hotspot={i,t};}this.comfortLoss+=Math.max(0,this.occ[i]-4-this.amenities[i]*2)}
      this.flow.push({t,n:this.active.length,done:this.finished});
      if(t>=this.end||(this.cursor===this.people.length&&!this.active.length))this.done=true
    }
    result(){return {total:this.people.length,finished:this.finished,time:this.finished?Math.round(this.elapsed/this.finished):0,wait:Math.round(this.totalWait/Math.max(1,this.people.length)),peak:this.peak,missed:this.missed,cost:this.cost,comfort:Math.max(0,Math.round(100-this.comfortLoss/Math.max(1,this.tick*this.people.length)*210-this.totalWait/(this.people.length*this.tick)*55)),tick:this.tick}}
    density(time){const a=new Uint16Array(this.geo.SIZE);for(const p of this.people){const q=where(p,time);if(q.pos>=0&&q.reason!==9)a[q.pos]++}return a}
  }
function goalOK(s,r,baseline,reviewedRun){
 const g=s.mode==="training"?M.tutorial[s.index][2]:s.mode==="challenge"?M.missions[s.index][1]:s.goal,c=s.cells;if(s.mode==="sandbox")return true;
 if(g==="replay")return reviewedRun&&baseline&&JSON.stringify(s.cells)!==baseline.layout;
 if(["gate","check","stairs","lift","ramp","escalator"].includes(g)){
   if(!c.some(v=>v?.k===g&&(g!=="escalator"||v.a===1)))return false;
   if(g==="lift")return r.people.filter(p=>p.habit===2&&p.done).length>=Math.max(1,r.people.filter(p=>p.habit===2).length*.55);
 }
 if(g==="transfer"&&!r.people.some(p=>p.type==="transfer"&&p.done))return false;
 if(g==="elevated"&&!r.people.some(p=>p.done&&p.history.some(h=>Math.floor(decode(h).pos/r.geo.AREA)===3)))return false;
 return true
}
  return {manifest,graph,Run,where,decode,service,status,habits,goalOK}
})(typeof Metro!=="undefined"?Metro:require("./station.js"));
if(typeof module!=="undefined")module.exports=Transit;
