import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {evidence,locations} from '../src/content.ts';
import {deserializeCase,serializeCase} from '../src/save-codec.ts';
const {test,expect}=await import(process.env.NATIONS_PLAYWRIGHT_MODULE||'@playwright/test');
test('opts in, keeps a compressed offline outbox, resolves a conflict and restores cloud progress',async({page,context},testInfo)=>{
 const records=new Map();let conflict=false;
 await page.route('**/api/games/fog-harbor-files/**',async route=>{
  const req=route.request(),id=new URL(req.url()).pathname.split('/').at(-1),json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(id==='session')return json({user:{id:1,name:'同步测试'},available:true,storage:'d1'});
  if(id==='saves')return json({saves:[...records.values()].map(row=>row.meta)});
  const previous=records.get(id);
  if(req.method()==='PUT'){
   const meta=JSON.parse(decodeURIComponent(req.headers()['x-fog-meta'])),base=Number(req.headers()['if-match'].replaceAll('"','')),body=req.postDataBuffer();
   if(previous&&conflict){conflict=false;const state=deserializeCase(JSON.parse(gunzipSync(previous.body)));state.chapter=4;state.notes='另一台设备的调查';previous.body=gzipSync(serializeCase(state));previous.meta={...previous.meta,chapter:4,revision:previous.meta.revision+1,hash:createHash('sha256').update(previous.body).digest('hex')};}
   if(previous&&previous.meta.hash===req.headers()['x-state-hash']&&base<=previous.meta.revision)return json({save:previous.meta,unchanged:true});
   if(base!==(previous?.meta.revision||0))return json({code:'CONFLICT',save:previous?.meta},409);
   const stored={...meta,id,revision:base+1,hash:req.headers()['x-state-hash'],updated:Date.now(),deleted:false};records.set(id,{meta:stored,body});return json({save:stored});
  }
  if(!previous)return json({code:'NOT_FOUND'},404);return route.fulfill({contentType:'application/gzip',headers:{'X-State-Hash':previous.meta.hash},body:previous.body});
 });
 const close=()=>page.getByRole('dialog').getByRole('button',{name:'关闭面板',exact:true}).click();
 const saves=()=>page.getByRole('button',{name:'档案管理',exact:true}).click();
 const collect=async id=>{
  const item=evidence.find(e=>e.id===id),place=locations.find(l=>l.id===item.location),hotspot=place.hotspots.find(h=>h.evidence.includes(id));
  await page.getByRole('button',{name:'馆内地图',exact:true}).click();await page.getByRole('dialog').getByRole('button').filter({has:page.getByRole('heading',{name:place.name,exact:true})}).click();
  await page.getByRole('button',{name:'调查'+hotspot.title,exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:new RegExp('^'+id+'\\b')}).click();await page.getByRole('button',{name:'收录至证据档案',exact:true}).click();await close();
 };
 await page.goto('/fog-harbor-files/');await page.getByRole('button',{name:'开始调查',exact:true}).click();await page.getByRole('button',{name:'继续调查',exact:true}).click();await saves();
 expect(records.size).toBe(0);await page.getByRole('button',{name:'启用并同步本次调查',exact:true}).click();await expect.poll(()=>records.size).toBe(1);await close();
 await context.setOffline(true);await collect('E01');
 await expect.poll(()=>page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('yukino.fog-harbor-files');request.onsuccess=()=>{const db=request.result,get=db.transaction('records').objectStore('records').get('sync:1');get.onsuccess=()=>{const items=Object.values(get.result?.pending||{});resolve(items.length===1&&items.every(item=>!item.state&&!!item.encoded?.gzip&&!item.encoded.json));db.close();};};}))).toBe(true);
 expect([...records.values()][0].meta.revision).toBe(1);await context.setOffline(false);await expect.poll(()=>[...records.values()][0].meta.revision,{timeout:15000}).toBe(2);
 conflict=true;await collect('E02');await saves();await expect(page.getByRole('heading',{name:'两份进度存在分歧',exact:true})).toBeVisible({timeout:15000});
 await page.getByRole('button',{name:'两份都保留',exact:true}).click();await expect.poll(()=>records.size,{timeout:15000}).toBe(2);
 const remote=page.locator('.cloud-section .save-list article').filter({hasText:'第 4 章'});page.once('dialog',dialog=>dialog.accept());await remote.getByRole('button',{name:'恢复',exact:true}).click();
 await expect(page.locator('.chapter-label')).toContainText('CH.04');await page.reload();await page.getByRole('button',{name:'继续调查',exact:true}).click();await expect(page.locator('.chapter-label')).toContainText('CH.04');
 await page.screenshot({path:testInfo.outputPath(testInfo.project.name+'-cloud-restored.png'),fullPage:true});
});
