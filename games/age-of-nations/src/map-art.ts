import type { Tile } from './core';

// Small, cached canvas illustrations keep the atlas sharp at every zoom without
// downloading textures. Variation comes only from tile coordinates, never RNG.
const cache = new Map<string, HTMLCanvasElement>();
const palette: Record<string, [string, string]> = {
  grass: ['#a4ba70', '#69874d'], plains: ['#c8c286', '#8e9f59'],
  forest: ['#809d67', '#476b4d'], hills: ['#b3ad7b', '#7e8958'],
  mountain: ['#9ba08d', '#6d7c6b'], desert: ['#d6c18a', '#b29d64'],
  tundra: ['#bec8ac', '#8d9f8e'], marsh: ['#93ae8c', '#668d7c'],
  coast: ['#76b5b6', '#3f8996'], ocean: ['#5596a5', '#2b657b'],
};
export function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 - 30) * Math.PI / 180;
    const px = x + Math.cos(angle) * radius, py = y + Math.sin(angle) * radius;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}
function shape(ctx: CanvasRenderingContext2D, points: number[][], fill: string, stroke?: string) {
  ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
  ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.7;ctx.stroke();}
}
function ellipse(ctx: CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string){
  ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
}
function tree(ctx: CanvasRenderingContext2D,x:number,y:number,size:number,pine=false){
  ellipse(ctx,x+3,y+2,size*.6,size*.22,'#233f3938');
  ctx.fillStyle='#675239';ctx.fillRect(x-1,y-size*.6,2,size*.65);
  if(pine){
    shape(ctx,[[x-size*.43,y-size*.2],[x,y-size*1.5],[x+size*.43,y-size*.2]],'#315b47');
    shape(ctx,[[x-size*.3,y-size*.7],[x,y-size*1.6],[x+size*.08,y-size*.65]],'#608264');
    shape(ctx,[[x,y-size*1.6],[x+size*.43,y-size*.2],[x+size*.1,y-size*.4]],'#264f41');
  }else{
    ellipse(ctx,x,y-size*.8,size*.47,size*.54,'#3a6548');
    ellipse(ctx,x-size*.18,y-size*.96,size*.32,size*.4,'#63834e');
    ellipse(ctx,x-size*.22,y-size*1.12,size*.21,size*.2,'#91a769');
  }
}
function mountain(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,snow:boolean){
  ellipse(ctx,x+5,y+3,size*.78,size*.2,'#3c4c423b');
  shape(ctx,[[x-size*.75,y],[x-size*.08,y-size],[x+size*.7,y]],'#6b786d','#657367');
  shape(ctx,[[x-size*.75,y],[x-size*.08,y-size],[x+size*.04,y-size*.25],[x-size*.15,y-size*.4],[x-size*.3,y]],'#c0bba0');
  shape(ctx,[[x-size*.08,y-size],[x+size*.7,y],[x+size*.15,y-size*.12]],'#859286');
  if(snow)shape(ctx,[[x-size*.08,y-size],[x-size*.33,y-size*.63],[x-size*.13,y-size*.69],[x,y-size*.54],[x+size*.06,y-size*.72],[x+size*.18,y-size*.6]],'#e3e7d8');
  ctx.strokeStyle='#53665d88';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(x-size*.04,y-size*.65);ctx.lineTo(x+size*.17,y-size*.24);ctx.lineTo(x+size*.4,y-size*.08);ctx.stroke();
}
export function terrainSprite(tile: Pick<Tile,'q'|'r'|'terrain'>) {
  const variant=((tile.q*17+tile.r*31)%6+6)%6,key=tile.terrain+variant;
  const existing=cache.get(key);if(existing)return existing;
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=144;
  const ctx=canvas.getContext('2d')!;ctx.translate(64,70);
  const colors=palette[tile.terrain]||palette.grass,water=['coast','ocean'].includes(tile.terrain);
  hexPath(ctx,0,3,63);ctx.fillStyle=water?'#2b586b':'#52674e';ctx.fill();
  ctx.save();hexPath(ctx,0,0,63);ctx.clip();
  const gradient=ctx.createLinearGradient(-35,-55,45,55);gradient.addColorStop(0,colors[0]);gradient.addColorStop(1,colors[1]);
  ctx.fillStyle=gradient;ctx.fillRect(-64,-64,128,128);
  // Broad irregular brush marks, then tiny grain. These never encode hidden terrain.
  for(let i=0;i<46;i++){
    const x=((i*43+variant*17)%117)-58,y=((i*67+variant*23)%119)-59;
    ellipse(ctx,x,y,3+(i%7),1+(i%3),i%2?'#f1e3b112':'#274b3a0d');
  }
  if(water){
    for(let i=0;i<11;i++){
      const x=((i*47+variant*11)%101)-50,y=((i*23)%101)-50;
      ctx.beginPath();ctx.moveTo(x-8,y);ctx.quadraticCurveTo(x,y+3,x+9,y-1);
      ctx.strokeStyle=i%3?'#c3e5d438':'#e0f0d76b';ctx.lineWidth=.8;ctx.stroke();
    }
    if(tile.terrain==='coast'){
      const glint=ctx.createRadialGradient(-27,-23,0,-27,-23,50);glint.addColorStop(0,'#d5e6b448');glint.addColorStop(1,'#8ec5b400');ctx.fillStyle=glint;ctx.fillRect(-64,-64,128,128);
    }
  }else if(tile.terrain==='forest'){
    for(let i=0;i<10;i++)tree(ctx,((i*37+variant*11)%74)-37,-25+i*6,12+i%4*2,i%3===0);
  }else if(tile.terrain==='mountain'){
    mountain(ctx,-16,-6,30,true);mountain(ctx,18,15,37,true);mountain(ctx,-22,29,24,false);
  }else if(tile.terrain==='hills'){
    mountain(ctx,16,-10,22,false);mountain(ctx,-17,21,29,false);tree(ctx,30,28,13,true);
  }else if(tile.terrain==='desert'){
    for(let i=0;i<5;i++){
      ctx.beginPath();ctx.moveTo(-65,-25+i*19);ctx.bezierCurveTo(-20,-50+i*21,10,-4+i*15,67,-23+i*21);ctx.strokeStyle=i%2?'#f1d9a56b':'#8d784b33';ctx.lineWidth=2;ctx.stroke();
    }
  }else if(tile.terrain==='marsh'){
    for(let i=0;i<5;i++)ellipse(ctx,-30+i*15,-15+(i%3)*20,15,5,'#547f7c');
    for(let i=0;i<14;i++){const x=(i*31%95)-47,y=(i*43%77)-38;ctx.strokeStyle='#547551';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-2,y-8);ctx.moveTo(x,y);ctx.lineTo(x+3,y-7);ctx.stroke();}
  }else{
    for(let i=0;i<29;i++){
      const x=((i*37+variant*13)%102)-51,y=((i*53+variant*19)%98)-49;
      ctx.strokeStyle=i%4?'#536f4140':'#eee6ad88';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-1,y-3);ctx.moveTo(x,y);ctx.lineTo(x+2,y-2);ctx.stroke();
    }
    if(tile.terrain==='grass'){tree(ctx,-29,1,12);tree(ctx,27,24,10);}
    if(tile.terrain==='tundra'){ellipse(ctx,17,10,15,4,'#e4e7d266');tree(ctx,-23,7,14,true);}
  }
  ctx.restore();hexPath(ctx,0,0,62.5);ctx.strokeStyle=water?'#c4e1c925':'#e3e7b845';ctx.lineWidth=1;ctx.stroke();
  cache.set(key,canvas);return canvas;
}
export function paintTerrain(ctx:CanvasRenderingContext2D,tile:Pick<Tile,'q'|'r'|'terrain'>,x:number,y:number,radius:number){
  const sprite=terrainSprite(tile);ctx.drawImage(sprite,x-radius*64/63,y-radius*70/63,radius*128/63,radius*144/63);
}
function house(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,roof:string){
  shape(ctx,[[x-w,y-h],[x,y-h-w*.5],[x+w,y-h],[x,y-h+w*.5]],roof,'#5c5141');
  shape(ctx,[[x-w,y-h],[x,y-h+w*.5],[x,y+w*.5],[x-w,y]],'#d4c59a','#796b50');
  shape(ctx,[[x,y-h+w*.5],[x+w,y-h],[x+w,y],[x,y+w*.5]],'#a69f80','#796b50');
  ctx.fillStyle='#536465';ctx.fillRect(x-w*.65,y-h*.67,2,3);ctx.fillStyle='#f5daa0';ctx.fillRect(x+w*.4,y-h*.5,2,3);
}
export function paintCity(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,color:string,population:number,industrial=false){
  ctx.save();ctx.translate(x,y);ctx.scale(size,size);
  ellipse(ctx,3,7,27,12,'#20383455');
  shape(ctx,[[-28,4],[-8,-8],[28,1],[11,16]],'#b7ab7b','#756e51');
  house(ctx,-12,-4,9,15,'#805e49');house(ctx,12,-7,8,14,'#8f6a4b');
  house(ctx,1,6,11,21,'#536c69');
  if(population>2)house(ctx,21,6,7,15,'#9a6a4b');
  if(population>4)house(ctx,-22,7,7,16,'#6c7770');
  // Clock tower and a national banner make cities readable above the landscape.
  ctx.fillStyle='#d5ccaa';ctx.fillRect(-3,-32,6,21);shape(ctx,[[-5,-32],[0,-39],[5,-32]],'#596f68','#455950');
  ellipse(ctx,0,-27,2,2,'#4c6059');
  ctx.fillStyle='#e8d6a1';ctx.fillRect(22,-32,1.3,23);shape(ctx,[[23,-32],[34,-29],[23,-25]],color,'#ebd6a1');
  if(industrial){ctx.fillStyle='#887c66';ctx.fillRect(-22,-31,5,22);for(let i=0;i<3;i++)ellipse(ctx,-21-i*3,-35-i*4,4+i*2,2+i,'#e4e0c73f');}
  ctx.restore();
}
export function paintUnit(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,color:string,type:string,ready=true){
  ctx.save();ctx.translate(x,y);ctx.scale(size,size);ctx.globalAlpha=ready?1:.68;
  ellipse(ctx,2,8,15,6,'#1c302d60');
  if(['steamship','destroyer','submarine','carrier','cruiser'].includes(type)){
    shape(ctx,[[-18,1],[16,1],[10,10],[-10,10]],'#344a51','#e3d5ae');
    house(ctx,-1,0,7,8,'#8c8d7c');ctx.fillStyle='#6b7168';ctx.fillRect(-5,-17,4,12);ctx.fillRect(3,-15,4,10);
    ctx.strokeStyle='#d8caa2';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(10,-20);ctx.lineTo(10,0);ctx.stroke();shape(ctx,[[11,-20],[21,-17],[11,-13]],color);
  }else if(['fighter','bomber'].includes(type)){
    shape(ctx,[[0,-20],[3,-3],[19,7],[17,10],[3,6],[3,14],[9,18],[8,20],[0,17],[-8,20],[-9,18],[-3,14],[-3,6],[-17,10],[-19,7],[-3,-3]],'#c2cab0','#334c4c');
    ctx.fillStyle=color;ctx.fillRect(-3,-7,6,10);
  }else if(['tank','mechanized','artillery'].includes(type)){
    ellipse(ctx,-8,6,11,6,'#35403b');ellipse(ctx,7,6,11,6,'#35403b');
    shape(ctx,[[-17,-4],[8,-10],[18,0],[-6,7]],'#82936c','#394b41');house(ctx,0,-3,7,7,color);
    ctx.strokeStyle='#465947';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(3,-12);ctx.lineTo(20,-19);ctx.stroke();
  }else if(type==='settler'){
    for(const dx of [-9,9]){ellipse(ctx,dx,7,4,5,'#4d4637');ellipse(ctx,dx,7,2,3,'#bcab78');}
    shape(ctx,[[-14,-6],[8,-11],[17,-3],[-5,3]],'#a47a4b','#66543a');
    ctx.fillStyle='#e6d7b0';ctx.beginPath();ctx.ellipse(0,-8,13,12,-.15,Math.PI,Math.PI*2);ctx.fill();
    shape(ctx,[[0,-20],[12,-17],[13,-5],[1,-8]],'#cabb96');
    ctx.strokeStyle='#eee1bc';ctx.lineWidth=1;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-8+i*6,-18);ctx.lineTo(-8+i*6,-7);ctx.stroke();}
    ctx.fillStyle='#d2b582';ctx.fillRect(15,-25,1.5,25);shape(ctx,[[17,-25],[28,-22],[17,-17]],color,'#eed5a0');
  }else{
    const engineer=type==='engineer';
    for(const [dx,dy] of [[-7,-1],[7,3]]){
      ctx.fillStyle='#353d39';ctx.fillRect(dx-4,dy+1,3,9);ctx.fillRect(dx+1,dy+1,3,9);
      shape(ctx,[[dx-5,dy-12],[dx+4,dy-12],[dx+6,dy+3],[dx-6,dy+3]],engineer?'#b89c62':color,'#233f39');
      ellipse(ctx,dx,dy-16,3.5,4.5,'#dfbb8b');ctx.fillStyle=engineer?'#dbc17b':'#36463e';ctx.fillRect(dx-4,dy-21,8,4);
      ctx.strokeStyle=engineer?'#7f7356':'#d9cdb0';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(dx+6,dy+5);ctx.lineTo(dx+8,dy-22);ctx.stroke();
      if(engineer){ctx.strokeStyle='#b3bdac';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(dx+3,dy-22);ctx.lineTo(dx+13,dy-22);ctx.stroke();}
    }
  }
  ctx.restore();
}
export function paintResource(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,id:string){
  ctx.save();ctx.translate(x,y);ctx.scale(size,size);
  ellipse(ctx,1,2,8,6,'#1d3b354d');ellipse(ctx,0,0,7.5,7.5,'#e8d7a8');
  ctx.strokeStyle='#a18b5e';ctx.lineWidth=.7;ctx.stroke();
  if(['wheat','tea','coffee','spice','rubber','wood'].includes(id)){
    ctx.strokeStyle='#8c7943';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-2,5);ctx.lineTo(2,-5);ctx.stroke();
    for(let i=0;i<3;i++){ellipse(ctx,-2+i,-2+i*2,2,1.2,id==='wheat'?'#b09143':'#63834d');ellipse(ctx,3+i,-4+i*2,2,1.2,id==='wheat'?'#b09143':'#63834d');}
  }else if(id==='fish'){
    ellipse(ctx,-1,0,4,2,'#508696');shape(ctx,[[2,0],[5,-3],[5,3]],'#508696');
  }else if(id==='oil'){
    ctx.fillStyle='#384e53';ctx.beginPath();ctx.moveTo(0,-5);ctx.bezierCurveTo(-10,5,4,8,4,2);ctx.closePath();ctx.fill();
  }else if(id==='cattle'){
    ellipse(ctx,0,1,4,2.5,'#816c4e');ellipse(ctx,4,-1,2,2,'#816c4e');ctx.fillStyle='#816c4e';ctx.fillRect(-3,2,1,3);ctx.fillRect(2,2,1,3);
  }else{
    shape(ctx,[[-5,3],[-3,-3],[1,-5],[5,0],[4,4]],id==='coal'?'#46504b':id==='uranium'?'#7b9855':'#8a8d82','#60695b');shape(ctx,[[-3,-3],[1,-5],[1,2],[-5,3]],'#d7ceb04d');
  }
  ctx.restore();
}
