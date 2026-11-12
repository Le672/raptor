import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const {test,expect}=await import(process.env.NATIONS_PLAYWRIGHT_MODULE||'@playwright/test');
let moduleUrl;
test.beforeAll(async()=>{
 const result=await build({entryPoints:[fileURLToPath(new URL('../src/storage.ts',import.meta.url))],bundle:true,format:'esm',platform:'browser',write:false});
 moduleUrl='data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64');
});
test('persists compact local saves, skips identical writes and resumes a pre-update record',async({page})=>{
 await page.goto('/fog-harbor-files/');await page.getByRole('button',{name:'开始调查',exact:true}).click();await page.getByRole('button',{name:'继续调查',exact:true}).click();
 await expect(page.locator('.save-status')).toHaveText('本地已保存');
 const result=await page.evaluate(async url=>{
  const {CaseStore}=await import(url),store=new CaseStore(),state=await store.current();
  let writes=0;const put=store.put.bind(store);store.put=(key,value)=>{if(key.startsWith('save:'))writes++;return put(key,value);};
  await store.save(state);await store.save(state);const unchangedWrites=writes;
  const updated={...state,notes:'旧存档笔记完整保留',seq:1,updatedAt:state.updatedAt+1};await store.save(updated);await store.save(updated);await store.save(updated,'manual','手动一');await store.save(updated,'manual','手动二');
  const current=await store.get('save:current'),packed=JSON.parse(await new Response(new Blob([current.encoded.gzip]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
  const rows=await store.list(),restored=await store.current();
  const beforeBurst=writes;await Promise.all([store.save({...updated,seq:2,notes:'中间笔记'}),store.save({...updated,seq:3,notes:'最新完整笔记'})]);const burstWrites=writes-beforeBurst;
  const burstNotes=(await store.current()).notes;
  // Recreate the original IndexedDB shape in this isolated browser context.
  const {encoded,fingerprint,...meta}=current;await put('save:current',{...meta,state:updated});
  return{unchangedWrites,changedWrites:beforeBurst,burstWrites,burstNotes,format:packed.format,rawState:!!current.state,notes:restored.notes,manuals:rows.filter(row=>row.kind==='manual').length};
 },moduleUrl);
 expect(result).toEqual({unchangedWrites:0,changedWrites:3,burstWrites:1,burstNotes:'最新完整笔记',format:'fog-packed',rawState:false,notes:'旧存档笔记完整保留',manuals:2});
 await page.reload();await page.getByRole('button',{name:'继续调查',exact:true}).click();await page.getByRole('button',{name:'档案管理',exact:true}).click();
 await expect(page.getByRole('heading',{name:'手动一',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'手动二',exact:true})).toBeVisible();
});
