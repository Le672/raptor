const {test,expect}=await import(process.env.NATIONS_PLAYWRIGHT_MODULE||'@playwright/test');
test('compact checkpoints avoid duplicate writes and preserve original JSON saves',async({page})=>{
  await page.goto('/age-of-nations/');await page.getByRole('button',{name:'开启新纪元'}).click();await page.getByRole('button',{name:'建立国家'}).click();
  await expect.poll(()=>page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('yukino-age-of-nations-v1');request.onsuccess=()=>{const db=request.result,get=db.transaction('saves').objectStore('saves').get('checkpoint');get.onsuccess=()=>{resolve(!!get.result?.gzip);db.close();};};}))).toBe(true);
  const result=await page.evaluate(async()=>{
    const {LocalSaveStore}=await import('/age-of-nations/src/store.ts');const store=new LocalSaveStore(),state=await store.load('checkpoint');
    const read=()=>new Promise(resolve=>{const request=indexedDB.open('yukino-age-of-nations-v1');request.onsuccess=()=>{const db=request.result,get=db.transaction('saves').objectStore('saves').get('checkpoint');get.onsuccess=()=>{resolve(get.result);db.close();};};});
    const before=await read();await store.save(state,'checkpoint');await store.save(state,'checkpoint');const after=await read();
    const packed=JSON.parse(await new Response(new Blob([after.gzip]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
    // Recreate a real pre-update checkpoint in this isolated test browser.
    await new Promise((resolve,reject)=>{const request=indexedDB.open('yukino-age-of-nations-v1');request.onsuccess=()=>{const db=request.result,tx=db.transaction('saves','readwrite');const {gzip,...meta}=after;tx.objectStore('saves').put({...meta,json:JSON.stringify(state)});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
    return{before:before.updated,after:after.updated,format:packed.saveFormat};
  });
  expect(result.before).toBe(result.after);expect(result.format).toBe('nations-packed');
  await page.reload();await page.getByRole('button',{name:'继续上次旅程'}).click();await expect(page.locator('.date')).toContainText('回合 1 / 150');
});
