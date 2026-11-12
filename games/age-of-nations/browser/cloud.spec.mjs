import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
const {test,expect}=await import(process.env.NATIONS_PLAYWRIGHT_MODULE||'@playwright/test');
test('opt-in, automatic upload, a concurrent edit, keep-both and cloud restoration',async({page})=>{
  const records=new Map();let injectConflict=false;
  await page.route('**/api/games/age-of-nations/**',async route=>{
    const req=route.request(),url=new URL(req.url()),id=url.pathname.split('/').at(-1),method=req.method();
    const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(id==='session')return json({user:{id:1,name:'同步测试'},available:true});
    if(id==='saves')return json({saves:[...records.values()].map(r=>r.meta),usage:0,limits:{saves:20,bytes:52428800,versions:3}});
    if(method==='PUT'){
      const data=JSON.parse(decodeURIComponent(req.headers()['x-nations-meta'])),body=req.postDataBuffer(),old=records.get(id),revision=Number(req.headers()['if-match'].replaceAll('"',''));
      if(old&&injectConflict){injectConflict=false;const state=JSON.parse(gunzipSync(old.body));(state.saveFormat==='nations-packed'?state.state:state).turn=5;old.body=gzipSync(Buffer.from(JSON.stringify(state)));old.meta={...old.meta,turn:5,revision:old.meta.revision+1,hash:createHash('sha256').update(old.body).digest('hex')};}
      if(revision!==(old?.meta.revision||0))return json({code:'CONFLICT',save:old.meta},409);
      const meta={...data,id,revision:revision+1,hash:req.headers()['x-state-hash'],size:body.length,created:Date.now(),updated:Date.now(),deleted:false};records.set(id,{meta,body});return json({save:meta});
    }
    const value=records.get(id);if(!value)return json({code:'NOT_FOUND'},404);
    return route.fulfill({contentType:'application/gzip',headers:{'X-State-Hash':value.meta.hash,'X-Nations-Meta':encodeURIComponent(JSON.stringify(value.meta))},body:value.body});
  });
  await page.goto('/age-of-nations/');await page.getByRole('button',{name:'开启新纪元'}).click();await page.getByRole('button',{name:'建立国家'}).click();
  const openSaves=async()=>{await page.getByRole('button',{name:'菜单',exact:true}).click();await expect(page.getByRole('heading',{name:'云端存档'})).toBeVisible();};
  const closeSaves=async()=>page.getByRole('dialog',{name:'读取存档'}).getByRole('button',{name:'关闭',exact:true}).click();
  const next=async()=>{await page.getByRole('button',{name:/下一回合/}).click();await page.getByRole('dialog',{name:'确认',exact:true}).getByRole('button',{name:'确认',exact:true}).click();};
  await openSaves();await page.getByRole('button',{name:'将当前进度另存到云端'}).click();await expect.poll(()=>records.size).toBe(1);await closeSaves();
  await next();await expect(page.locator('.date')).toContainText('回合 2 / 150');await expect.poll(()=>[...records.values()].filter(r=>r.meta.kind==='auto').length,{timeout:15000}).toBe(1);
  injectConflict=true;await next();await expect(page.locator('.date')).toContainText('回合 3 / 150');await expect.poll(()=>[...records.values()].some(r=>r.meta.turn===5),{timeout:15000}).toBe(true);
  await openSaves();await expect(page.getByRole('heading',{name:'同一存档有两份进度'})).toBeVisible();await page.getByRole('button',{name:'两份都保留'}).click();await expect.poll(()=>records.size,{timeout:15000}).toBe(3);
  const remote=page.locator('.cloud-save-list article').filter({hasText:'回合 5'});await remote.getByRole('button',{name:'读取存档'}).click();await page.getByRole('alertdialog').getByRole('button',{name:'确认',exact:true}).click();await closeSaves();await expect(page.locator('.date')).toContainText('回合 5 / 150');
  await page.reload();await page.getByRole('button',{name:'继续上次旅程'}).click();await expect(page.locator('.date')).toContainText('回合 5 / 150');
});
