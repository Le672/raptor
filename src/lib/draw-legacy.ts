export type DrawingPoint = [number, number];
export type DrawingShape = { id:string; kind:'pen'|'line'|'rectangle'|'ellipse'|'text'; points:DrawingPoint[]; color:string; width:number; text?:string };

/** Read vector shapes from an old Excalidraw export. Never mutate the source. */
export function importLegacyDrawing(input:unknown):{shapes:DrawingShape[];skipped:number}{
  const data=input as {elements?:unknown[]},elements=Array.isArray(input)?input:data?.elements;
  if(!Array.isArray(elements)||elements.length>5000)throw new Error('旧版画稿结构无效或图形过多');
  const shapes:DrawingShape[]=[];let skipped=0;
  for(const raw of elements){
    if(!raw||typeof raw!=='object'){skipped++;continue;}
    const e=raw as Record<string,unknown>;if(e.isDeleted)continue;
    const x=Number(e.x),y=Number(e.y),w=Number(e.width)||0,h=Number(e.height)||0;
    if(!Number.isFinite(x)||!Number.isFinite(y)){skipped++;continue;}
    const color=typeof e.strokeColor==='string'&&/^#[\da-f]{6}$/i.test(e.strokeColor)?e.strokeColor:'#416a93';
    const common={color,width:Math.max(1,Math.min(12,Number(e.strokeWidth)||2))};
    if(e.type==='text'&&typeof e.text==='string'){
      const font=Math.max(16,Math.min(72,Number(e.fontSize)||20));
      e.text.split('\n').forEach((text,i)=>shapes.push({...common,width:font/6,id:'legacy-'+shapes.length,kind:'text',points:[[x,y+font*(i+1)]],text:text.slice(0,2000)}));continue;
    }
    let points:DrawingPoint[]=[];
    if(['freedraw','line','arrow'].includes(String(e.type))&&Array.isArray(e.points))points=e.points.filter((p:unknown)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)).slice(0,50000).map((p:number[])=>[x+p[0],y+p[1]]);
    else if(e.type==='rectangle')points=[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
    else if(e.type==='diamond')points=[[x+w/2,y],[x+w,y+h/2],[x+w/2,y+h],[x,y+h/2],[x+w/2,y]];
    else if(e.type==='ellipse')points=Array.from({length:49},(_,i)=>[x+w/2+Math.cos(i/48*Math.PI*2)*w/2,y+h/2+Math.sin(i/48*Math.PI*2)*h/2]);
    else{skipped++;continue;}
    if(!points.length){skipped++;continue;}
    const angle=Number(e.angle)||0,cx=x+w/2,cy=y+h/2;
    if(angle)points=points.map(([px,py])=>[cx+(px-cx)*Math.cos(angle)-(py-cy)*Math.sin(angle),cy+(px-cx)*Math.sin(angle)+(py-cy)*Math.cos(angle)]);
    shapes.push({...common,id:'legacy-'+shapes.length,kind:'pen',points});
  }
  if(!shapes.length)throw new Error('没有可以读取的矢量图形。原始画稿仍保留。');
  const points=shapes.flatMap(s=>s.points),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(let i=0;i<xs.length;i++){minX=Math.min(minX,xs[i]);maxX=Math.max(maxX,xs[i]);minY=Math.min(minY,ys[i]);maxY=Math.max(maxY,ys[i]);}
  const scale=Math.min(1,1120/Math.max(1,maxX-minX),700/Math.max(1,maxY-minY));
  return {shapes:shapes.map(s=>({...s,width:Math.max(.5,s.width*scale),points:s.points.map(([x,y])=>[40+(x-minX)*scale,50+(y-minY)*scale])})),skipped};
}
