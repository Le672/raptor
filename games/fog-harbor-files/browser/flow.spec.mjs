const {test,expect}=await import(process.env.NATIONS_PLAYWRIGHT_MODULE||'@playwright/test');
import {evidence,locations,deductions,chapters,endings} from '../src/content.ts';
import {REPORT_QUESTIONS} from '../src/engine.ts';
const base='/fog-harbor-files/';
async function close(page){await page.getByRole('dialog').getByRole('button',{name:'关闭面板',exact:true}).click();}
async function start(page){await page.goto(base);await page.getByRole('button',{name:'开始调查',exact:true}).click();await page.getByRole('button',{name:'继续调查',exact:true}).click();}
async function acquire(page,item){
 await page.getByRole('button',{name:'馆内地图',exact:true}).click();
 const place=locations.find(l=>l.id===item.location),map=page.getByRole('dialog',{name:'馆内地图'});
 await map.getByRole('button').filter({has:page.getByRole('heading',{name:place.name,exact:true})}).click();
 const h=place.hotspots.find(h=>h.evidence.includes(item.id));await page.getByRole('button',{name:'调查'+h.title,exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'现场观察'});await dialog.getByRole('button',{name:new RegExp('^'+item.id+'\\b')}).click();
 await dialog.getByRole('button',{name:'收录至证据档案',exact:true}).click();await expect(dialog.getByText('已收录 · 可随时复查',{exact:true})).toBeVisible();await close(page);
}
async function solve(page,d){
 await page.getByRole('button',{name:'推理板',exact:true}).click();const board=page.getByRole('dialog',{name:'推理板'});
 await board.getByRole('button',{name:new RegExp('^'+d.id+'\\b')}).click();await board.getByRole('radio',{name:d.options.find(o=>o.correct).text,exact:true}).check();
 await board.getByRole('button',{name:'选择已收录材料',exact:true}).click();await board.getByRole('button',{name:'验证解释',exact:true}).click();await expect(board.getByRole('heading',{name:'已经核验',exact:true})).toBeVisible();await close(page);
}
test('completes the whole case, keeps IndexedDB progress and resumes offline',async({page,context},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page);const owned=new Set(),proved=new Set();
 for(let chapter=1;chapter<=5;chapter++){
  for(let pass=0;pass<32;pass++){const available=evidence.filter(e=>!owned.has(e.id)&&e.chapter<=chapter&&(e.requires||[]).every(id=>owned.has(id)));if(!available.length)break;for(const e of available){await acquire(page,e);owned.add(e.id);}}
  for(let pass=0;pass<8;pass++){const available=deductions.filter(d=>!proved.has(d.id)&&d.chapter<=chapter&&d.prerequisites.every(id=>proved.has(id))&&d.requiredSets.some(set=>set.every(id=>owned.has(id))));if(!available.length)break;for(const d of available){await solve(page,d);proved.add(d.id);}}
  if(chapter<5){await page.getByRole('button',{name:'进入下一章',exact:true}).click();await expect(page.getByRole('dialog').getByRole('heading',{name:chapters.find(c=>c.id===chapter+1).title,exact:true})).toBeVisible();await page.getByRole('button',{name:'继续调查',exact:true}).click();}
 }
 expect(owned.size).toBe(32);expect(proved.size).toBe(8);await page.getByRole('button',{name:'提交调查报告',exact:true}).click();
 const report=page.getByRole('dialog',{name:'调查报告'});for(const q of REPORT_QUESTIONS)await report.getByLabel(q.label,{exact:true}).selectOption(q.correct);await report.getByRole('button',{name:'选择已收录材料',exact:true}).click();page.once('dialog',dialog=>dialog.accept());await report.getByRole('button',{name:'提交复核',exact:true}).click();await expect(page.getByRole('dialog').getByRole('heading',{name:endings.find(e=>e.id==='full').title,exact:true})).toBeVisible();await close(page);
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('button',{name:'下载完整首案以便离线调查',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'完整首案已缓存'})).toBeVisible({timeout:20000});await close(page);
 await page.reload();await page.getByRole('button',{name:'继续调查',exact:true}).click();await expect(page.getByText('已收录 32 / 32',{exact:true})).toBeVisible();
 await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'继续调查',exact:true}).click();await expect(page.getByText('已收录 32 / 32',{exact:true})).toBeVisible();await context.setOffline(false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);await page.screenshot({path:testInfo.outputPath(testInfo.project.name+'-case.png'),fullPage:true});
});
