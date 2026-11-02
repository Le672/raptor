import { useEffect,useState } from 'react';
import { ArrowRight,Download,BookOpen } from 'lucide-react';
import { readerSite } from './reader-site.mjs';
import { importLibrary,downloadFile } from './library';
const MARK='novel:migrated-from-novel-20261102';
function legacy(){const read=(key:string,fallback:unknown)=>{try{return JSON.parse(localStorage.getItem('novel:'+key)||'null')??fallback;}catch{return fallback;}};return{version:1,site:'ln',shelf:read('shelf',[]),history:read('history',[]),settings:read('settings',{})};}
export function LibraryMigration(){
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    if(!readerSite.light)return;
    try{if(localStorage.getItem(MARK))return;}catch{return;}
    const nonce=crypto.randomUUID(),frame=document.createElement('iframe');frame.hidden=true;frame.title='接收旧轻小说书架';frame.src='https://novel.yukino.bond/migration/export#'+nonce;
    const receive=(event:MessageEvent)=>{
      if(event.origin!=='https://novel.yukino.bond'||event.source!==frame.contentWindow||event.data?.type!=='yukino-light-library'||event.data?.nonce!==nonce)return;
      const payload=event.data.payload;if(!payload||JSON.stringify(payload).length>3*1024*1024||!Array.isArray(payload.shelf)||!Array.isArray(payload.history))return;
      try{
        importLibrary(JSON.stringify(payload));
        localStorage.setItem(MARK,new Date().toISOString());
        if(payload.shelf.length||payload.history.length)setNotice('已从旧 novel 域名合并轻小说书架与阅读进度。');
      }catch{setNotice('旧书架未能自动迁移，可在原应用导出备份后到此导入。');}
      frame.remove();window.removeEventListener('message',receive);
    };
    window.addEventListener('message',receive);document.body.appendChild(frame);
    const timer=window.setTimeout(()=>{frame.remove();window.removeEventListener('message',receive);},20000);
    return()=>{clearTimeout(timer);frame.remove();window.removeEventListener('message',receive);};
  },[]);
  if(readerSite.light)return notice?<p className="notice" role="status">{notice}</p>:null;
  return <div className="app-notice migration-notice"><BookOpen size={18}/><p>轻小说书房已迁至 <a href="https://ln.yukino.bond/">ln.yukino.bond</a>。原书架与进度可在新书房合并接收。</p><a className="text-button" href="https://ln.yukino.bond/shelf">前往轻小说书房<ArrowRight size={14}/></a><a className="text-button" href="/migration">迁移与备份</a></div>;
}
export function MigrationPage(){
  const data=legacy(),saved=Array.isArray(data.shelf)?data.shelf.length:0,recent=Array.isArray(data.history)?data.history.length:0;
  return <><div className="page-heading"><span className="eyebrow">YOUR LIBRARY MOVES WITH YOU</span><h1>轻小说书房搬家了</h1><p>轻小说在 ln.yukino.bond，当前 novel.yukino.bond 用于普通小说。</p></div><section className="settings-card"><h2>保留原来的故事与书签</h2><p>此浏览器检测到 {saved} 本旧轻小说收藏、{recent} 条阅读足迹。打开新书房时会尝试合并，原记录保留在本机。</p><div className="button-group"><a className="button" href="https://ln.yukino.bond/shelf">打开轻小说书房<ArrowRight size={14}/></a><button className="button secondary" onClick={()=>downloadFile('Yukino-轻小说书架备份.json',JSON.stringify(data,null,2),'application/json')}><Download size={15}/>导出旧轻小说书架与进度</button></div><p>iOS 主屏幕应用与浏览器可能使用独立存储；自动迁移不可用时，请在原应用导出，再到新轻小说站的“书源与设置”导入。普通小说与轻小说的书架分别保存。</p><p>新域名可重新安装为应用，登录仍使用原 Yukino 账户。</p></section></>;
}
