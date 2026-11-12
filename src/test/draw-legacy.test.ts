import {it,expect} from 'vitest';
import {importLegacyDrawing} from '../lib/draw-legacy';
it('imports old vector drawings without mutating the original, and reports unsupported images',()=>{
 const elements=[{type:'rectangle',x:-100,y:500,width:200,height:100,strokeWidth:2,strokeColor:'#123456',angle:.5},{type:'text',x:0,y:600,text:'你好\nYukino',fontSize:20},{type:'image',x:30,y:40,width:50,height:50},{type:'line',x:1,y:2,isDeleted:true}];
 const before=JSON.stringify(elements),result=importLegacyDrawing(elements);
 expect(JSON.stringify(elements)).toBe(before);expect(result.shapes).toHaveLength(3);expect(result.skipped).toBe(1);expect(result.shapes[0].color).toBe('#123456');expect(result.shapes[2].text).toBe('Yukino');expect(result.shapes.every(s=>s.points.every(([x,y])=>x>=0&&x<=1200&&y>=0&&y<=800))).toBe(true);
});
it('rejects a non-drawing payload rather than replacing the current scene',()=>{
 expect(()=>importLegacyDrawing({error:'invalid'})).toThrow();expect(()=>importLegacyDrawing([{type:'image',x:0,y:0}])).toThrow();
});
