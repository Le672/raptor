import {hexPath,paintTerrain,paintCity,paintUnit,paintResource} from './map-art';
import { civs, terrains, unitTypes } from './content';
import { cityName, t } from './i18n';
import { tileAt, visible, type GameState, type Tile } from './core';
export const HEX=32;
export const hexPoint=(tile:Pick<Tile,'q'|'r'>)=>({x:Math.sqrt(3)*HEX*(tile.q+tile.r/2),y:HEX*1.5*tile.r});
export const resourceSymbols:Record<string,string>={wheat:'♧',cattle:'♧',fish:'≈',wood:'♣',coal:'⬟',iron:'◆',oil:'◉',aluminium:'◇',rubber:'♤',uranium:'✺',tea:'❧',coffee:'❧',spice:'✧'};
export const unitSymbols:Record<string,string>={settler:'⚑',engineer:'⚒',infantry:'Ⅰ',cavalry:'Ⅱ',artillery:'✣',tank:'▰',mechanized:'▣',rifle:'Ⅲ',steamship:'♜',destroyer:'♜',submarine:'≋',carrier:'▱',fighter:'✈',bomber:'✈',guard:'✦',cruiser:'♜'};
type Camera={x:number;y:number;zoom:number};
export class AtlasRenderer {
  camera:Camera={x:400,y:400,zoom:1.65};
  private gl:WebGLRenderingContext|null;
  private ctx:CanvasRenderingContext2D;
  private buffer?:WebGLBuffer;
  private program?:WebGLProgram;
  private width=1;private height=1;private frame=0;
  state?:GameState; selected?:string; path:string[]=[];colorblind=false;
  constructor(private base:HTMLCanvasElement,private ink:HTMLCanvasElement){
    this.gl=base.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power'});this.ctx=ink.getContext('2d')!;
    if(this.gl){const gl=this.gl;const shader=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'shader');return s;};const p=gl.createProgram()!;gl.attachShader(p,shader(gl.VERTEX_SHADER,'attribute vec2 a; attribute vec3 c; varying vec3 color; void main(){gl_Position=vec4(a,0.,1.);color=c;}'));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,'precision mediump float; varying vec3 color; void main(){gl_FragColor=vec4(color,1.);}'));gl.linkProgram(p);this.program=p;this.buffer=gl.createBuffer()!;}
  }
  get isWebgl(){return!!this.gl;}
  resize(width:number,height:number){this.width=Math.max(1,width);this.height=Math.max(1,height);const dpr=Math.min(2,window.devicePixelRatio||1);for(const c of[this.base,this.ink]){c.width=Math.round(this.width*dpr);c.height=Math.round(this.height*dpr);c.style.width=this.width+'px';c.style.height=this.height+'px';}this.ctx.setTransform(dpr,0,0,dpr,0,0);this.gl?.viewport(0,0,this.base.width,this.base.height);this.draw();}
  center(id?:string){const s=this.state;if(!s)return;const at=tileAt(s,id||s.cities.find(c=>c.owner===0)?.tile||s.units.find(u=>u.owner===0)?.tile||s.tiles[0].id);if(at){const p=hexPoint(at);this.camera.x=p.x;this.camera.y=p.y;this.draw();}}
  screen(point:{x:number;y:number}){return{x:(point.x-this.camera.x)*this.camera.zoom+this.width/2,y:(point.y-this.camera.y)*this.camera.zoom+this.height/2};}
  world(x:number,y:number){return{x:(x-this.width/2)/this.camera.zoom+this.camera.x,y:(y-this.height/2)/this.camera.zoom+this.camera.y};}
  pick(x:number,y:number){const w=this.world(x,y),r=2/3*w.y/HEX,q=(Math.sqrt(3)/3*w.x-w.y/3)/HEX;let a=Math.round(q),b=Math.round(r),c=Math.round(-q-r);const da=Math.abs(a-q),db=Math.abs(b-r),dc=Math.abs(c+q+r);if(da>db&&da>dc)a=-b-c;else if(db>dc)b=-a-c;return this.state&&tileAt(this.state,`${a},${b}`)?.id;}
  pan(dx:number,dy:number){this.camera.x-=dx/this.camera.zoom;this.camera.y-=dy/this.camera.zoom;this.draw();}
  zoom(factor:number,x=this.width/2,y=this.height/2){const before=this.world(x,y);this.camera.zoom=Math.min(3,Math.max(.35,this.camera.zoom*factor));const after=this.world(x,y);this.camera.x+=before.x-after.x;this.camera.y+=before.y-after.y;this.draw();}
  draw(){if(!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;this.paint();});}
  destroy(){cancelAnimationFrame(this.frame);if(this.gl){this.gl.deleteBuffer(this.buffer||null);this.gl.deleteProgram(this.program||null);}}
  private paint(){const s=this.state;if(!s)return;const ctx=this.ctx,w=this.width,h=this.height,z=this.camera.zoom,rad=HEX*z;const v=visible(s,0),known=new Set(s.players[0].explored);ctx.clearRect(0,0,w,h);if(!this.gl){ctx.fillStyle='#263b39';ctx.fillRect(0,0,w,h);}const vertices:number[]=[];const onscreen:{tile:Tile;x:number;y:number;seen:boolean;known:boolean}[]=[];
    const rgb=(hex:string)=>hex.replace('#','').match(/../g)!.map(n=>parseInt(n,16)/255);
    const vertex=(x:number,y:number,color:number[])=>vertices.push(x/w*2-1,1-y/h*2,...color);
    const poly=(x:number,y:number,size:number)=>{ctx.beginPath();for(let i=0;i<6;i++){const a=(60*i-30)*Math.PI/180;const px=x+Math.cos(a)*size,py=y+Math.sin(a)*size;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();};
    for(const tile of s.tiles){const pt=this.screen(hexPoint(tile));if(pt.x<-rad*2||pt.x>w+rad*2||pt.y<-rad*2||pt.y>h+rad*2)continue;const seen=v.has(tile.id),explored=known.has(tile.id);let color=explored?rgb(terrains[tile.terrain].color):rgb('#2b403d');if(explored&&!seen)color=color.map((n,i)=>n*.48+[.16,.2,.18][i]*.52);const tint=((tile.q*7+tile.r*13)%5)*.006;color=color.map(c=>c+tint);if(this.gl){for(let i=0;i<6;i++){const a=(i*60-30)*Math.PI/180,b=((i+1)*60-30)*Math.PI/180;vertex(pt.x,pt.y,color);vertex(pt.x+Math.cos(a)*rad,pt.y+Math.sin(a)*rad,color);vertex(pt.x+Math.cos(b)*rad,pt.y+Math.sin(b)*rad,color);}}else{poly(pt.x,pt.y,rad);ctx.fillStyle=`rgb(${color.map(c=>Math.round(c*255)).join(',')})`;ctx.fill();}onscreen.push({tile,x:pt.x,y:pt.y,seen,known:explored});}
    if(this.gl&&this.program&&this.buffer){const gl=this.gl;gl.clearColor(.15,.22,.21,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);for(const [name,size,offset]of[['a',2,0],['c',3,8]] as const){const a=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,20,offset);}gl.drawArrays(gl.TRIANGLES,0,vertices.length/5);}
    const sky=ctx.createRadialGradient(w*.48,h*.45,10,w*.48,h*.45,Math.max(w,h)*.7);sky.addColorStop(0,'#304b4c');sky.addColorStop(.55,'#233b40');sky.addColorStop(1,'#111f2a');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    // The fog uses only a neutral grid; no hidden terrain is read to paint it.
    const top=this.world(0,0),bottom=this.world(w,h),r0=Math.floor(top.y/(HEX*1.5))-1,r1=Math.ceil(bottom.y/(HEX*1.5))+1;
    ctx.strokeStyle='#afc1ac0c';ctx.lineWidth=.65;
    for(let r=r0;r<=r1;r++){const q0=Math.floor(top.x/(Math.sqrt(3)*HEX)-r/2)-1,q1=Math.ceil(bottom.x/(Math.sqrt(3)*HEX)-r/2)+1;for(let q=q0;q<=q1;q++){const p=this.screen(hexPoint({q,r}));hexPath(ctx,p.x,p.y,rad);ctx.stroke();}}
    ctx.strokeStyle='#d7d2a90a';ctx.lineWidth=1;for(let i=0;i<7;i++){ctx.beginPath();ctx.ellipse(w*.5,h*.5,rad*(4+i*1.4),rad*(2.8+i),-.28,0,Math.PI*2);ctx.stroke();}
    const directions=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
    for(const {tile,x,y,seen,known:explored}of onscreen.sort((a,b)=>a.y-b.y||a.x-b.x)){
      if(!explored)continue;ctx.globalAlpha=seen?1:.52;paintTerrain(ctx,tile,x,y,rad);
      if(tile.river){ctx.save();hexPath(ctx,x,y,rad);ctx.clip();ctx.lineCap='round';for(const [color,width]of[['#c4d3a488',5],['#538e9e',3],['#b1dad0',.8]]as const){ctx.strokeStyle=color;ctx.lineWidth=width*z;ctx.beginPath();ctx.moveTo(x-rad*.7,y-rad*.6);ctx.bezierCurveTo(x+rad*.2,y-rad*.2,x-rad*.3,y+rad*.25,x+rad*.7,y+rad*.6);ctx.stroke();}ctx.restore();}
      if(seen&&tile.improvement){ctx.save();ctx.translate(x,y);ctx.scale(z,z);
        if(['farm','plantation'].includes(tile.improvement)){ctx.fillStyle='#b9a25f';ctx.fillRect(-17,-9,28,17);ctx.strokeStyle='#e1c67a';ctx.lineWidth=1.2;for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(-16+i*5,-9);ctx.lineTo(-13+i*5,8);ctx.stroke();}}
        else if(tile.improvement==='mine'){ctx.fillStyle='#7b7862';ctx.fillRect(-10,-8,20,16);ctx.fillStyle='#263f39';ctx.beginPath();ctx.arc(0,0,7,Math.PI,0);ctx.lineTo(7,8);ctx.lineTo(-7,8);ctx.fill();ctx.strokeStyle='#b8a57b';ctx.lineWidth=3;ctx.strokeRect(-9,-8,18,16);}
        else if(tile.improvement==='well'){ctx.strokeStyle='#3a504c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-12,10);ctx.lineTo(0,-21);ctx.lineTo(11,10);ctx.moveTo(-7,-2);ctx.lineTo(9,-2);ctx.moveTo(-8,-21);ctx.lineTo(15,-16);ctx.stroke();}
        else if(tile.improvement==='fort'){ctx.fillStyle='#acac8c';ctx.fillRect(-15,-8,30,17);for(let i=0;i<4;i++)ctx.fillRect(-15+i*8,-13,5,6);ctx.fillStyle='#435b51';ctx.fillRect(-3,-1,6,10);}
        ctx.restore();
      }
      if(seen&&tile.rail){for(const [dq,dr]of directions){const other=tileAt(s,`${tile.q+dq},${tile.r+dr}`);if(!other?.rail)continue;const end=this.screen(hexPoint(other));ctx.strokeStyle='#233e36';ctx.lineWidth=3*z;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo((x+end.x)/2,(y+end.y)/2);ctx.stroke();ctx.strokeStyle='#d5ccb0';ctx.lineWidth=1.6*z;ctx.setLineDash([z,4*z]);ctx.stroke();ctx.setLineDash([]);}}
      if(tile.resource&&rad>16)paintResource(ctx,x+rad*.46,y+rad*.48,Math.max(.8,z*.65),tile.resource);
      const owner=seen?tile.owner:s.players[0].memory[tile.id]?.owner;if(owner!==undefined&&owner>=0){const color=civs[s.players[owner].civ].color;
        for(let i=0;i<6;i++){const [dq,dr]=directions[i],other=tileAt(s,`${tile.q+dq},${tile.r+dr}`),otherOwner=other&&(v.has(other.id)?other.owner:s.players[0].memory[other.id]?.owner);if(otherOwner===owner)continue;const a=(i*60-30)*Math.PI/180,b=((i+1)*60-30)*Math.PI/180;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*(rad-1),y+Math.sin(a)*(rad-1));ctx.lineTo(x+Math.cos(b)*(rad-1),y+Math.sin(b)*(rad-1));ctx.strokeStyle='#f5ddacbb';ctx.lineWidth=4*z;ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=2*z;ctx.stroke();}
        if(this.colorblind){ctx.fillStyle='#fff3d0';ctx.font=`bold ${Math.max(10,rad*.3)}px serif`;ctx.textAlign='left';ctx.fillText(civs[s.players[owner].civ].symbol,x-rad*.6,y+rad*.6);}
      }
    }
    ctx.globalAlpha=1;
    if(this.path.length){ctx.strokeStyle='#fff4cb';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();this.path.forEach((id,i)=>{const tile=tileAt(s,id);if(!tile)return;const p=this.screen(hexPoint(tile));i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.stroke();ctx.setLineDash([]);}
    if(this.selected){const at=tileAt(s,this.selected);if(at){const p=this.screen(hexPoint(at));poly(p.x,p.y,rad-2);ctx.strokeStyle='#fff3c8';ctx.lineWidth=3;ctx.stroke();poly(p.x,p.y,rad-6);ctx.strokeStyle='#34493a';ctx.lineWidth=1;ctx.stroke();}}
    for(const c of s.cities){if(!v.has(c.tile)&&c.owner!==0)continue;const at=tileAt(s,c.tile)!;const p=this.screen(hexPoint(at));if(p.x<-120||p.x>w+120||p.y<-90||p.y>h+90)continue;const color=c.owner>=0?civs[s.players[c.owner].civ].color:'#97896a';
      paintCity(ctx,p.x,p.y-3*z,z*.95,color,c.population,c.buildings.includes('factory'));
      const label=cityName(c,s);ctx.font=`600 ${Math.max(11,12*z)}px "Microsoft YaHei",sans-serif`;const size=ctx.measureText(label).width+39;
      ctx.shadowColor='#0c1a21';ctx.shadowBlur=8;ctx.fillStyle='#1d343bee';ctx.beginPath();ctx.roundRect(p.x-size/2,p.y+17*z,size,22*z,3);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#bfaa6b';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#efe5be';ctx.textAlign='center';ctx.fillText(label,p.x-8,p.y+32*z);ctx.fillStyle='#cdb46e';ctx.font=`bold ${12*z}px Georgia`;ctx.fillText(String(c.population),p.x+size/2-13,p.y+32*z);
    }
    for(const tile of s.tiles){const memory=s.players[0].memory[tile.id];if(v.has(tile.id)||!memory?.city)continue;const [nameCiv,index]=memory.city.split(':');const p=this.screen(hexPoint(tile));if(p.x<0||p.x>w||p.y<0||p.y>h)continue;ctx.globalAlpha=.55;ctx.fillStyle='#e6e2c2';ctx.fillRect(p.x-5*z,p.y-5*z,10*z,10*z);ctx.font=`${Math.max(10,11*z)}px Georgia,serif`;ctx.textAlign='center';ctx.fillText(cityName({owner:0,nameCiv,name:Number(index)} as import('./core').City,s),p.x,p.y+19*z);ctx.globalAlpha=1;}
    for(const u of s.units){if(u.owner!==0&&!v.has(u.tile))continue;const at=tileAt(s,u.tile);if(!at)continue;const p=this.screen(hexPoint(at)),civil=unitTypes[u.type].civilian,offset=s.cities.some(c=>c.tile===u.tile)?-20:0,xx=p.x+(civil?12:-11)*z,yy=p.y+offset*z;
      paintUnit(ctx,xx,yy,z*.82,civs[s.players[u.owner].civ].color,u.type,u.moves>0);
      if(rad>25){ctx.fillStyle='#142e33';ctx.fillRect(xx-10*z,yy+11*z,20*z,4*z);ctx.fillStyle=u.hp<40?'#b2674f':u.moves>0?'#b9ce80':'#7d9181';ctx.fillRect(xx-9*z,yy+12*z,18*z*u.hp/100,2*z);}
    }

    // Cartographic scale and north marker stay readable at every zoom level.
    ctx.strokeStyle='#ede5c5aa';ctx.fillStyle='#ede5c5aa';ctx.font='10px Georgia,serif';ctx.textAlign='left';ctx.beginPath();ctx.moveTo(22,h-26);ctx.lineTo(102,h-26);ctx.moveTo(22,h-30);ctx.lineTo(22,h-22);ctx.moveTo(102,h-30);ctx.lineTo(102,h-22);ctx.stroke();ctx.fillText(`${Math.round(80/(Math.sqrt(3)*rad)*100)} km`,23,h-35);
  }
}
