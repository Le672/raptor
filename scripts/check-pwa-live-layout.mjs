// Uses public pages and controlled platform signals; no account or saved data is changed.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(resolve('.wrangler/pwa-check/node_modules/playwright/index.mjs')).href);
const out=resolve('.wrangler/pwa-live-layout');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for(const site of ['ln','novel']) for(const mode of ['browser','ios-standalone']) {
    const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:1});
    if(mode==='ios-standalone')await context.addInitScript(()=>Object.defineProperty(navigator,'standalone',{get:()=>true}));
    const page=await context.newPage();
    await page.goto(`https://${site}.yukino.bond/`,{waitUntil:'networkidle'});
    await page.locator('.mobile-nav').waitFor({state:'visible'});
    await page.locator('#yukino-global-header').waitFor({state:'attached'});
    const state=await page.evaluate(()=>{
      const header=document.querySelector('#yukino-global-header'),search=header.querySelector('.search-toggle');
      const topbar=document.querySelector('.topbar'),sidebar=document.querySelector('.sidebar');
      return {header:getComputedStyle(header).display,sidebar:getComputedStyle(sidebar).display,
        app:document.documentElement.classList.contains('yukino-app-window'),
        independent:document.body.classList.contains('yukino-independent'),
        top:topbar.getBoundingClientRect().top,headerWidth:topbar.getBoundingClientRect().width,
        width:document.documentElement.scrollWidth,searchWidth:search.getBoundingClientRect().width,
        searchHeight:search.getBoundingClientRect().height,
        label:getComputedStyle(search.querySelector('.nav-search-label')).display};
    });
    await page.screenshot({path:resolve(out,`${site}-${mode}.png`)});
    if(mode==='ios-standalone') {
      await page.getByRole('button',{name:'切换深色主题',exact:true}).click();
      await page.screenshot({path:resolve(out,`${site}-${mode}-dark.png`)});
      const book=page.locator('.book-title').first();
      if(await book.count()) {
        const color=await book.evaluate(node=>getComputedStyle(node).color);
        assert.ok(color.match(/\d+/g).slice(0,3).map(Number).every(n=>n>120),color);
      }
    }
    console.log(site,mode,JSON.stringify(state));
    assert.equal(state.sidebar,'none');assert.ok(state.width<=393,JSON.stringify(state));
    if(mode==='ios-standalone') {
      assert.equal(state.app,true);assert.equal(state.header,'none');
      assert.equal(state.independent,false);assert.ok(state.top<65,JSON.stringify(state));
    } else {
      assert.notEqual(state.header,'none');assert.equal(state.label,'none');
      assert.ok(state.searchWidth>=32&&state.searchHeight<=40,JSON.stringify(state));
    }
    await context.close();
  }
} finally {await browser.close();}
