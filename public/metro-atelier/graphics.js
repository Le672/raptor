"use strict";
const Art=(()=>{
 const colors={slab:"#e5eae0",edge:"#9eaca1",dark:"#344b48",green:"#2d8474",yellow:"#f2bb53"};
 function painter(ctx,project,scale){
   const P=(x,y,z=0)=>project(x,y,z);
   function poly(points,fill,stroke){ctx.beginPath();points.forEach(([x,y,z],i)=>{let p=P(x,y,z);i?ctx.lineTo(...p):ctx.moveTo(...p)});ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(.48,scale*.022);ctx.stroke()}}
   function line(x,y,z,x2,y2,z2,color,width=.045){ctx.beginPath();ctx.moveTo(...P(x,y,z));ctx.lineTo(...P(x2,y2,z2));ctx.strokeStyle=color;ctx.lineWidth=Math.max(.55,scale*width);ctx.stroke()}
   function box(x,y,w,h,b,t,top,front,side){
     poly([[x+w,y,b],[x+w,y+h,b],[x+w,y+h,t],[x+w,y,t]],side);
     poly([[x,y+h,b],[x+w,y+h,b],[x+w,y+h,t],[x,y+h,t]],front);
     poly([[x,y,t],[x+w,y,t],[x+w,y+h,t],[x,y+h,t]],top);
   }
   function disc(x,y,z,r,col){const [a,b]=P(x,y,z);ctx.beginPath();ctx.ellipse(a,b,r*scale,r*scale*.63,0,0,Math.PI*2);ctx.fillStyle=col;ctx.fill()}
   function label(x,y,z,str,size,fg,bg){
     let [a,b]=P(x,y,z);ctx.font='bold '+Math.max(7,scale*size)+'px Consolas,monospace';ctx.textAlign="center";ctx.textBaseline="middle";
     if(bg){let w=ctx.measureText(str).width+scale*.34;ctx.fillStyle=bg;ctx.fillRect(a-w/2,b-scale*size*.72,w,scale*size*1.45)}
     ctx.fillStyle=fg;ctx.fillText(str,a,b)
   }
   function obj(x,y,k,a=0,upper=false){
     const b=(dx,dy,w,h,z,t,top,front,side)=>box(x+dx,y+dy,w,h,z,t,top,front,side);
     const l=(dx,dy,z,ex,ey,ez,col,wide)=>line(x+dx,y+dy,z,x+ex,y+ey,ez,col,wide);
     if(k==="track"){
       for(let n of [.14,.46,.78])b(n,.06,.12,.88,.01,.04,"#737c76","#58645e","#636e66");
       for(let n of [.20,.75])b(0,n,1,.055,.05,.095,"#c9d0c7","#647169","#89958a");
     }else if(k==="platform"){
       for(let n of [.12,.37,.62,.87])b(n,.05,.16,.12,0,.025,"#e6b647","#ae9d6d","#d9bc74");
     }else if(k==="pillar"){
       b(.26,.24,.48,.52,0,.13,"#9aa79e","#8c9890","#75867b");b(.34,.32,.32,.36,.13,1.14,"#d1d8cd","#bac5ba","#98a99f");b(.30,.28,.40,.44,1.12,1.21,"#e3e8df","#becbc1","#99aaa0");
       b(.335,.315,.33,.37,.38,.50,"#5d8478","#688e82","#51776b")
     }else if(k==="plant"){
       b(.16,.15,.70,.70,0,.29,"#c8b59a","#a58f76","#8e806e");
       for(let [dx,dy,h,r,c] of [[.34,.35,.48,.31,"#729791"],[.56,.40,.58,.34,"#63866e"],[.42,.64,.52,.33,"#739c70"],[.63,.59,.71,.31,"#659464"],[.43,.43,.8,.29,"#8cab73"]])disc(x+dx,y+dy,h,r,c)
     }else if(k==="bench"){
       b(.19,.30,.12,.43,0,.29,"#74897c","#546c60","#536359");b(.72,.30,.12,.43,0,.29,"#74897c","#546c60","#536359");
       for(let n of [.3,.47,.64])b(.08,n,.86,.13,.27,.36,"#c48d54","#9f723f","#805b3c");
       b(.09,.25,.84,.10,.36,.60,"#d39c62","#bc8b55","#916939")
     }else if(k==="gate"||k==="check"){
       for(let n of [.13,.67]){b(n,.10,.20,.82,0,.47,"#c3dbca","#709a85","#608b78");b(n+.025,.18,.15,.21,.47,.50,"#204d43","#23483b","#193d33");b(n+.05,.23,.08,.08,.5,.52,"#b5f572","#9cce72","#8bbc70")}
       if(k==="check"){for(let n of [.16,.7])b(n,.37,.12,.22,.48,1.05,"#537c70","#3e665b","#36594e");b(.16,.37,.66,.22,1.05,1.15,"#78a393","#4b7567","#426758")}
     }else if(["stairs","escalator","ramp"].includes(k)){
       const stair=k!=="ramp",col=k==="escalator"?"#7ca89c":"#b8c3b6";
       for(let n=7;n>=0;n--){const h=.12+n*.075;b(.09,.83-n*.1,.82,.105,0,h,stair?(n%2?col:"#cbd5c8"):"#a9bdac","#899e93","#788e82")}
       for(let n of [.08,.91]){l(n,.93,.29,n,.15,.95,"#49685d",.09);l(n,.9,0,n,.9,.3,"#688074");l(n,.15,.6,n,.15,.95,"#688074")}
       if(k==="escalator")label(x+.47,y+.45,.65,a===2?"↓":"↑",.38,"#f4f9d1","#427968")
     }else if(k==="lift"){
       b(.15,.13,.70,.70,0,1.16,"#afcfc2","#7faaa1","#69948d");b(.22,.838,.53,.025,.04,.87,"#9fb8aa","#b2c9bd","#6e8d80");
       l(.48,.87,.06,.48,.87,.85,"#718d80",.035);label(x+.50,y+.84,1.03,"↕",.30,"white","#315f55");
       b(.1,.08,.8,.8,1.14,1.22,"#d5e4d8","#96b8a8","#83aa98")
     }else if(k==="entry"){
       for(let n of [.10,.85])b(n,.29,.07,.18,0,1.23,"#68867a","#6d857a","#486455");
       b(.07,.21,.92,.30,.95,1.28,"#80a28e","#285e50","#204c42");label(x+.52,y+.55,1.12,String.fromCharCode(65+a),.26,"#ebfabf");
     }else if(k==="fence"){
       for(let n of [.12,.85])b(n,.46,.07,.09,0,.61,"#828f85","#627468","#4d5e53");
       l(.12,.49,.59,.90,.49,.59,"#657d6f",.085);l(.12,.49,.33,.90,.49,.33,"#83978a",.06)
     }else if(k==="one"){const [dx,dy]=Metro.dirs[a],cx=.5,cy=.5;l(cx-dx*.3,cy-dy*.3,.035,cx+dx*.28,cy+dy*.28,.035,"#308574",.11);
       for(let t of [-1,1])l(cx+dx*.28,cy+dy*.28,.04,cx+dy*t*.2,cy+dx*t*.2,.04,"#308574",.10)
     }else if(k==="empty"){l(.15,.15,.05,.85,.85,.05,"#a66047",.12);l(.85,.15,.05,.15,.85,.05,"#a66047",.12)}
   }
   function train(x,y,len,lineId){
     const stripe=lineId===1?"#3e9b8e":lineId===2?"#9494bc":"#e6ac41", w=len-.10;
     box(x+.08,y+.16,w,.67,.11,.32,"#4d605b","#434e49","#344a41");
     box(x+.04,y+.08,w,.82,.3,.96,"#e0e9df","#cad7cd","#abbdb3");
     box(x+.04,y+.08,w,.82,.45,.56,stripe,stripe,lineId===1?"#398679":"#be8c3b");
     for(let n=.24;n<w-.3;n+=.58){box(x+n,y+.904,.38,.018,.60,.87,"#819f97","#3c5d60","#4a6d68")}
     for(let n=.9;n<w-.18;n+=1.75){line(x+n,y+.927,.33,x+n,y+.927,.91,"#778e83",.04);line(x+n+.22,y+.927,.33,x+n+.22,y+.927,.91,"#778e83",.04)}
     box(x+.14,y+.15,w-.22,.65,.96,1.015,"#eff3e8","#d7e1d5","#c9d6cb");
     for(let n=.65;n<w-.7;n+=1.65)box(x+n,y+.29,.71,.37,1.015,1.09,"#b6c7bd","#a1b5a9","#92a89a");
     poly([[x+.04+w,y+.18,.62],[x+.04+w,y+.8,.62],[x+.04+w,y+.76,.86],[x+.04+w,y+.26,.86]],"#38575a");
     for(let n of [.2,.72])disc(x+.04+w,y+n,.45,.055,"#fff1b2")
   }
   return {P,poly,line,box,disc,label,obj,train}
 }
 const palette=["#2d7069","#b87142","#516c94","#c69c47","#a76879","#527e56"];
 class MapView{
   constructor(canvas){this.c=canvas;this.ctx=canvas.getContext("2d");this.zoom=1;this.pan=[0,0];this.z=1;this.top=false;this.dirty=true;this.hitPeople=[]}
   resize(){let {width:w,height:h}=this.c.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
     if(w!==this.w||h!==this.h||dpr!==this.dpr){this.w=w;this.h=h;this.dpr=dpr;this.c.width=Math.round(w*dpr);this.c.height=Math.round(h*dpr);this.dirty=true}
     this.scale=Math.min(this.w/(this.top?this.geo.W+3:(this.geo.W+this.geo.H)*.975),this.h/(this.top?this.geo.H+3:(this.geo.W+this.geo.H)*.48))*this.zoom;
     this.ox=this.w/2+this.pan[0];this.oy=this.h*.53+this.pan[1];
   }
   proj(x,y,z=0){let a=x-this.geo.W/2,b=y-this.geo.H/2+.1,s=this.scale;return this.top?[this.ox+a*s,this.oy+b*s-z*s*.18]:[this.ox+(a-b)*s,this.oy+(a+b)*s*.49-z*s*.82]}
   grid(px,py){let u=(px-this.ox)/this.scale,v=(py-this.oy)/this.scale;
     let x=Math.floor(this.geo.W/2+(this.top?u:(u+v/.49)/2)),y=Math.floor(this.geo.H/2-.1+(this.top?v:(v/.49-u)/2));
     return x>=0&&y>=0&&x<this.geo.W&&y<this.geo.H?this.geo.id(x,y,this.z):-1}
   reset(){this.zoom=1;this.pan=[0,0];this.dirty=true}
   base(s){
     let layer=document.createElement("canvas");layer.width=this.c.width;layer.height=this.c.height;let c=layer.getContext("2d");c.scale(this.dpr,this.dpr);
     const a=painter(c,(...p)=>this.proj(...p),this.scale);
     c.fillStyle="#e7ede4";c.fillRect(0,0,this.w,this.h);
     for(let x=-45;x<64;x++)a.line(x,-45,-.35,x,64,-.35,x%5?"#dce5d9":"#cddbcf",.018);
     for(let y=-45;y<64;y++)a.line(-45,y,-.35,64,y,-.35,y%5?"#dce5d9":"#cddbcf",.018);
     const tiles=[];for(let y=0;y<this.geo.H;y++)for(let x=0;x<this.geo.W;x++){let i=this.geo.id(x,y,this.z);tiles.push({x,y,i,c:s.cells[i]})}
     tiles.sort((a,b)=>a.x+a.y-b.x-b.y||a.x-b.x);
     for(let {x,y,i,c:tile} of tiles){
       if(!s.mask[i]){a.poly([[x,y,0],[x+1,y,0],[x+1,y+1,0],[x,y+1,0]],"#c9d2c5");a.line(x,y,0,x+1,y+1,0,"#b9c5b7",.023)}
       if(tile)a.poly([[x+.25,y+.20,-.42],[x+1.25,y+.20,-.42],[x+1.25,y+1.20,-.42],[x+.25,y+1.20,-.42]],"#bdcabb")
     }
     const grays=["#e9ede3","#e3e9dd","#e7ece1","#e2e8dc"];
     for(let {x,y,i,c:tile} of tiles){
       if(!tile)continue;let k=tile.k,top=k==="track"?"#7d877d":k==="platform"?"#d3d8c8":grays[(x*3+y*7)%4];
       a.box(x,y,1,1,-.32,0,top,"#a7b4a5","#91a298");
       a.poly([[x,y,0],[x+1,y,0],[x+1,y+1,0],[x,y+1,0]],null,"#c2cdbc");
       if(!s.cells[this.geo.local(i,1)])a.line(x,y+1,-.18,x+1,y+1,-.18,"#72887a",.032);
       if(!s.cells[this.geo.local(i,0)])a.line(x+1,y,-.18,x+1,y+1,-.18,"#637b70",.032)
     }
     this.tiles=tiles;this.under=layer;
     const furniture=document.createElement("canvas");furniture.width=layer.width;furniture.height=layer.height;let f=furniture.getContext("2d");f.scale(this.dpr,this.dpr);
     const b=painter(f,(...p)=>this.proj(...p),this.scale);
          const across=painter(f,(x,y,z)=>this.proj(y,x,z),this.scale),axes=new Map();
     for(let {x,y,i,c} of tiles)if(c){
       if(c.k==="track"){
         const sameTrack=d=>s.cells[this.geo.local(i,d)]?.k==="track";
         const axis=(sameTrack(1)||sameTrack(3))&&!(sameTrack(0)||sameTrack(2))?1:0;
         axes.set(i,axis);
         if(axis)across.obj(y,x,"track");else b.obj(x,y,"track")
       }else b.obj(x,y,c.k,c.a)
     }
     this.trackRuns=[];
     for(const t of tiles){
       if(!axes.has(t.i))continue;
       const axis=axes.get(t.i);if(axes.get(this.geo.local(t.i,axis+2))===axis)continue;
       let line=null,n=0,i=t.i;
       while(i>=0&&axes.get(i)===axis){
         for(const d of [0,1,2,3]){const c=s.cells[this.geo.local(i,d)];if(c?.k==="platform"&&line===null)line=c.a}
         n++;i=this.geo.local(i,axis)
       }
       if(line!==null)this.trackRuns.push({...t,axis,n,line})
     }
     // Platform identifiers stand at the trackside, like suspended wayfinding signs.
     for(let line=0;line<3;line++){
       let pads=tiles.filter(t=>t.c?.k==="platform"&&t.c.a===line);if(pads.length<4)continue;
       let t=pads[Math.floor(pads.length*.64)],x=t.x,y=t.y;
       b.line(x+.46,y+.66,0,x+.46,y+.66,1.35,"#60766c",.075);
       b.label(x+.46,y+.66,1.38,"0"+(line+1)+"  ›",.32,"#fcf7d7","#264b42")
     }
     this.over=furniture;this.dirty=false;
   }
   draw(s,opts){
     this.geo=Metro.geometry(s);this.resize();if(this.dirty||this.last!==s){this.base(s);this.last=s}
     const c=this.ctx;c.setTransform(1,0,0,1,0,0);c.drawImage(this.under,0,0);c.setTransform(this.dpr,0,0,this.dpr,0,0);
     const a=painter(c,(...p)=>this.proj(...p),this.scale),tileMark=(i,color,stroke)=>{let [x,y]=this.geo.xyz(i);a.poly([[x,y,.015],[x+1,y,.015],[x+1,y+1,.015],[x,y+1,.015]],color,stroke)};
     if(opts.heat&&opts.density)for(const t of this.tiles){let n=opts.density[t.i];if(n>0)tileMark(t.i,n>8?"#d653388f":n>4?"#ed963e9c":"#dec74c83")}
     c.drawImage(this.over,0,0,this.w,this.h);
     for(const track of this.trackRuns){
       const {n,line,axis}=track,x=axis?track.y:track.x,y=axis?track.x:track.y;
       const railArt=axis?painter(c,(u,v,z)=>this.proj(v,u,z),this.scale):a;       let phase=opts.time==null?4:(opts.time+line*3)%(48+line*5);
       if(phase<16||phase>45+line*5){
         let len=Math.min(5.7,n>=7?n/2-.25:Math.max(.75,n-.2)),offset=phase>45+line*5?(48+line*5-phase)*-1.6:phase>12?(phase-12)*1.7:0;
         c.save();let hull=[[x,y,1.5],[x+n,y,1.5],[x+n,y+1.3,1.5],[x+n,y+1.3,-.3],[x,y+1.3,-.3],[x,y,-.3]];c.beginPath();hull.forEach(([u,v,z],j)=>j?c.lineTo(...railArt.P(u,v,z)):c.moveTo(...railArt.P(u,v,z)));c.closePath();c.clip();
         railArt.train(x+.12+offset,y,len,line);if(n>=7)railArt.train(x+.16+len+offset,y,len,line);c.restore()
       }
     }
     this.hitPeople=[];let selected=opts.selected;
     if(selected){let last;for(let code of selected.history){let v=Transit.decode(code);if(v.t>(opts.time??0))break;if(v.pos<0)continue;let [x,y,z]=this.geo.xyz(v.pos);if(z===this.z&&last?.[2]===z)a.line(last[0]+.5,last[1]+.5,.08,x+.5,y+.5,.08,"#cc673b",.11);last=[x,y,z]}}
     const crowd=opts.people||[];
     for(const p of crowd){
       let pos=p.pos,reason=p.reason;if(opts.replay){let q=Transit.where(p,opts.time);pos=q.pos;reason=q.reason}
       if(pos<0||Math.floor(pos/this.geo.AREA)!==this.z||reason===9)continue;
       let [x,y]=this.geo.xyz(pos);x+=.18+((p.id*31)%67)*.009;y+=.15+((p.id*23)%73)*.009;
       const [px,py]=a.P(x,y,.18);this.hitPeople.push({px,py,id:p.id});
       if(selected?.id===p.id){a.disc(x,y,0,.29,"#f5bb45");a.label(x,y,.72,"#"+p.id,.29,"white","#164b40")}
       a.disc(x,y,.02,.12,"#62786d65");a.line(x,y,.10,x,y,.31,palette[p.id%6],.17);a.disc(x,y,.37,.085,"#866e58");
     }
     if(opts.hover>=0){tileMark(opts.hover,"#8fc68c66","#377f68");if(opts.ghost&&opts.ghost!=="floor"){let [x,y]=this.geo.xyz(opts.hover);c.globalAlpha=.58;a.obj(x,y,opts.ghost,opts.a);c.globalAlpha=1}}
   }
 }
 function icon(canvas,k){canvas.width=96;canvas.height=58;let c=canvas.getContext("2d"),s=22;
   let a=painter(c,(x,y,z)=>[48+(x-y)*s,32+(x+y-1)*s*.43-z*s*.77],s);
   a.box(0,0,1,1,-.18,0,k==="track"?"#829185":"#d9e2d2","#aab8a7","#91a695");a.obj(0,0,k,1);
 }
 return {MapView,icon}
})();
