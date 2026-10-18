(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const route = location.pathname.split('/')[2] || 'home';
  const page = ['radar','hooks','links'].includes(route) ? route : 'home';
  const metadata = {
    home:['SMALL TOOLS, EVERYDAY USE','把想法变成日常。','三个能反复用到的小项目，让服务器多做一点事。'],
    radar:['01 / KEEP AN EYE ON IT','网页变化雷达','留意一个页面，保存每次变化。检查记录和内容快照会跨设备保留。'],
    hooks:['02 / CATCH THE MESSAGE','Webhook 回调信箱','给脚本或服务一个接收地址，看看请求到底发来了什么。'],
    links:['03 / A LINK WORTH KEEPING','短链工坊','为链接取个好记的名字，带着二维码一起分享。']
  };
  let csrf = '', hooks = [], links = [], activeHook = null, currentEvents = [], lastEventKey = '', toastTimer;
  function el(tag, attributes={}, children=[]) {
    const node = document.createElement(tag);
    Object.entries(attributes).forEach(([key,value]) => {
      if (value === undefined || value === null) return;
      if (key === 'text') node.textContent = value;
      else if (key === 'class') node.className = value;
      else node.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).forEach(child => { if(child!==null && child!==undefined) node.append(child instanceof Node ? child : document.createTextNode(String(child))); });
    return node;
  }
  const text = (tag, value, cls) => el(tag, {text:value, class:cls});
  const button = (label, action, id, extra={}) => el('button', {type:'button', class:'quiet', text:label,'data-action':action,'data-id':id,...extra});
  const date = time => time ? new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Singapore',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(time*1000)) : '尚未检查';
  const urlLink = (url, label=url) => el('a',{href:url,text:label,class:'item-url',target:'_blank',rel:'noopener noreferrer'});
  function toast(message) { clearTimeout(toastTimer); $('toast').textContent=message; $('toast').hidden=false; toastTimer=setTimeout(()=>$('toast').hidden=true,5000); }
  function loggedOut() { $('login-panel').hidden=false; $('private-content').hidden=true; $('logout').hidden=true; }
  async function api(path, options={}) {
    let response;
    try { response=await fetch('/lab/api/'+path,{...options,headers:{'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{}),...options.headers},signal:AbortSignal.timeout(45000)}); }
    catch { throw new Error('请求结果尚未确认，请刷新列表检查后再试。'); }
    const data=await response.json().catch(()=>({error:'服务响应异常，请稍后再试'}));
    if(!response.ok) { if(response.status===401) loggedOut(); throw new Error(data.error||'请求未完成'); }
    return data;
  }
  function empty(container,title,description) { container.replaceChildren(el('div',{class:'empty'},[text('h3',title),text('p',description)])); }
  async function busy(control, work) {
    if(control.disabled) return;
    const label=control.textContent; control.disabled=true; control.textContent='处理中…';
    try { await work(); } catch(error) { toast(error.message); }
    finally { control.disabled=false; control.textContent=label; }
  }
  function formValues(form) { return Object.fromEntries(new FormData(form)); }
  function meta(...values) { return el('div',{class:'item-meta'},values.map(value=>text('span',value))); }
  function copy(value) { return navigator.clipboard.writeText(value).then(()=>toast('已复制')).catch(()=>toast('未能复制，请选中地址手动复制。')); }
  async function loadHome() {
    const data=await api('overview');
    $('stats').replaceChildren(...[['monitors','关注页面'],['hooks','回调信箱'],['links','已收好链接'],['clicks','短链打开次数']].map(([key,label])=>el('div',{class:'stat'},[text('strong',data[key]),text('span',label)])));
  }
  async function loadRadar() {
    const {items}=await api('monitors');
    if(!items.length) return empty($('radar-list'),'先关注一个有变化的地方。','可以从状态页、软件更新日志或公开文字页面开始。');
    $('radar-list').replaceChildren(...items.map(item=>{
      const state=!item.enabled?'已暂停':item.last_error?'需要留意':!item.checked_at?'等待首次检查':item.snapshot_count>1 && item.changed_at===item.checked_at?'发现变化':item.snapshot_count<=1?'已建立快照':'本次无变化';
      const card=el('article',{class:'item'},[el('div',{class:'item-top'},[el('div',{},[text('h3',item.name),urlLink(item.url)]),text('span',state,'badge '+(!item.enabled?'paused':item.last_error?'warning':''))]),meta('上次检查 '+date(item.checked_at),item.latency_ms!==null?item.latency_ms+' ms':'尚未连接',item.snapshot_count+' 版快照',item.enabled?'下次 '+date(item.next_at):'暂停自动检查')]);
      if(item.keyword) card.append(text('p','关注词：'+item.keyword,'hint'));
      if(item.last_error) card.append(text('p',item.last_error,'item-error'));
      if(item.truncated) card.append(text('p','正文较长，仅对比前 40,000 个字符。','hint'));
      card.append(el('div',{class:'item-actions'},[button('立即检查 ↻','check-radar',item.id),button('查看快照与差异','history',item.id),button(item.enabled?'暂停':'启用','toggle-radar',item.id,{'data-enabled':item.enabled?'0':'1'}),button('删除','delete-radar',item.id,{class:'quiet danger'})]));
      return card;
    }));
  }
  async function loadHistory(id) {
    const {items,diff}=await api('monitors/'+id+'/history');
    const panel=$('radar-history'); panel.hidden=false;
    panel.replaceChildren(el('div',{class:'section-title'},[text('h2','快照与变化'),button('收起','close-history')]));
    if(!items.length) panel.append(text('p','还没有成功读取的快照。先检查页面，再来看看。','hint'));
    else {
      panel.append(meta('最新 '+date(items[0].created_at),'已保存 '+items.length+' 版'));
      panel.append(el('div',{class:'detail-columns'},[el('div',{},[text('h3','前后差异'),text('pre',diff||'已建立首次快照。页面发生变化后，这里会出现逐行对照。')]),el('div',{},[text('h3','最新文字快照'),text('pre',items[0].text)])]));
      if(items.length>1) { const history=el('details',{},[el('summary',{text:'更早的快照 · '+(items.length-1)+' 版'})]); items.slice(1).forEach(item=>history.append(el('details',{},[el('summary',{text:date(item.created_at)}),text('pre',item.text)]))); panel.append(history); }
    }
    panel.scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function loadHooks() {
    const data=await api('hooks'); hooks=data.items;
    if(!hooks.length) return empty($('hook-list'),'等一条消息来。','创建信箱后，可以先给自己发送一次测试回调。');
    $('hook-list').replaceChildren(...hooks.map(item=>el('article',{class:'item'},[
      el('div',{class:'item-top'},[text('h3',item.name),text('span',item.enabled?'接收中':'已停用','badge '+(item.enabled?'':'paused'))]),
      text('p',item.url,'code-line'),meta(item.event_count+' 条保留记录','创建于 '+date(item.created_at)),
      el('div',{class:'item-actions'},[button('复制接收地址','copy-hook',item.id),button('查看请求','events',item.id),button('发送测试回调','test-hook',item.id),button(item.enabled?'停用':'启用','toggle-hook',item.id,{'data-enabled':item.enabled?'0':'1'}),button('删除','delete-hook',item.id,{class:'quiet danger'})])
    ])));
  }
  function showEvent(id) {
    const item=currentEvents.find(item=>item.id===id); if(!item) return;
    const panel=$('event-detail'); let body=item.body;
    try { body=JSON.stringify(JSON.parse(body),null,2); } catch {}
    panel.replaceChildren(text('h3','请求正文'),text('pre',body||'（空正文）'),text('h3','请求头'),text('pre',JSON.stringify(item.headers,null,2)));
    if(item.query) panel.append(text('h3','查询参数'),text('pre',item.query));
    if(item.truncated) panel.prepend(text('p','正文超过 16 KiB，当前显示截断后的内容。','item-error'));
    document.querySelectorAll('.event-row').forEach(row=>row.classList.toggle('active',Number(row.dataset.id)===id));
  }
  async function loadEvents(id,quiet=false) {
    const item=hooks.find(item=>item.id===id); if(!item) return;
    const {items}=await api('hooks/'+id+'/events'); const key=id+':'+items.map(e=>e.id).join(',');
    if(quiet && lastEventKey===key) return; lastEventKey=key; currentEvents=items; activeHook=id;
    const panel=$('hook-events'); panel.hidden=false;
    panel.replaceChildren(el('div',{class:'section-title'},[text('h2',item.name+' · 请求记录'),button('收起','close-events')]),text('p','每 10 秒刷新。请求头和查询中的常见认证字段已遮盖。','hint'));
    if(!items.length) panel.append(text('p','还没有收到请求。点击“发送测试回调”试试看。','hint'));
    else {
      panel.append(el('div',{class:'event-list'},items.map(event=>el('button',{class:'event-row',type:'button','data-action':'show-event','data-id':event.id},[text('span',event.method,'event-method'),text('span',date(event.created_at),'event-date'),text('span',event.bytes+' B','hint')]))),el('div',{id:'event-detail',class:'event-detail'}));
      showEvent(items[0].id);
    }
    if(!quiet) panel.scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function loadLinks() { links=(await api('links')).items; renderLinks(); }
  function renderLinks() {
    const query=$('link-search').value.toLocaleLowerCase().trim();
    const items=links.filter(item=>(item.name+' '+item.slug+' '+item.target).toLocaleLowerCase().includes(query));
    if(!items.length) return empty($('link-list'),links.length?'没有找到这条链接。':'把第一条链接收好。',links.length?'换个名字或关键词试试。':'为常用页面生成一个好记的短链接。');
    $('link-list').replaceChildren(...items.map(item=>{
      const expired=item.expires_at && item.expires_at<Date.now()/1000;
      return el('article',{class:'item'},[el('div',{class:'item-top'},[el('div',{},[text('h3',item.name),urlLink(item.target)]),text('span',!item.enabled?'已停用':expired?'已到期':'可访问','badge '+(!item.enabled||expired?'paused':''))]),
        urlLink(item.url),meta(item.clicks+' 次打开',item.expires_at?'到期 '+date(item.expires_at):'长期有效',item.days.length?'最近访问：'+item.days.map(day=>day.day.slice(5)+' · '+day.count+' 次').join(' / '):'还没有访问记录'),
        el('div',{class:'item-actions'},[button('复制短链','copy-link',item.id),el('a',{href:'/lab/api/links/'+item.id+'/qr.svg',class:'button quiet',text:'下载二维码 ↓',download:''}),el('a',{href:item.url,class:'button quiet',text:'打开短链 ↗',target:'_blank',rel:'noopener noreferrer'}),button(item.enabled?'停用':'启用','toggle-link',item.id,{'data-enabled':item.enabled?'0':'1'}),button('删除','delete-link',item.id,{class:'quiet danger'})])]);
    }));
  }
  async function enter() {
    $('login-panel').hidden=true; $('private-content').hidden=false; $('logout').hidden=false;
    ['home','radar','hooks','links'].forEach(name=>$(name+'-page').hidden=name!==page);
    await ({home:loadHome,radar:loadRadar,hooks:loadHooks,links:loadLinks})[page]();
  }
  $('page-kicker').textContent=metadata[page][0]; $('page-title').textContent=metadata[page][1]; $('page-description').textContent=metadata[page][2]; document.title=(page==='home'?'日常实验室':metadata[page][1])+' · Yukino Lab';
  document.querySelector('[data-page="'+page+'"]').classList.add('active');
  $('login-form').addEventListener('submit',event=>{event.preventDefault();busy(event.submitter,async()=>{const data=await api('session',{method:'POST',body:JSON.stringify(formValues(event.target))});csrf=data.csrf;event.target.reset();await enter();});});
  $('logout').addEventListener('click',()=>busy($('logout'),async()=>{await api('session',{method:'DELETE'});csrf='';activeHook=null;loggedOut();}));
  $('radar-form').addEventListener('submit',event=>{event.preventDefault();busy(event.submitter,async()=>{const created=await api('monitors',{method:'POST',body:JSON.stringify(formValues(event.target))});event.target.reset();await loadRadar();toast('已添加，正在读取首次快照…');const result=await api('monitors/'+created.id+'/check',{method:'POST'});await loadRadar();toast(result.ok?'首次快照已保存':result.error);});});
  $('hook-form').addEventListener('submit',event=>{event.preventDefault();busy(event.submitter,async()=>{await api('hooks',{method:'POST',body:JSON.stringify(formValues(event.target))});event.target.reset();await loadHooks();toast('信箱已创建，接收地址可以使用了。');});});
  $('link-form').addEventListener('submit',event=>{event.preventDefault();busy(event.submitter,async()=>{await api('links',{method:'POST',body:JSON.stringify(formValues(event.target))});event.target.reset();await loadLinks();toast('短链已生成');});});
  $('link-search').addEventListener('input',renderLinks);
  document.addEventListener('click',event=>{
    const control=event.target.closest('[data-action]'); if(!control) return;
    const action=control.dataset.action,id=Number(control.dataset.id);
    if(action==='close-history') { $('radar-history').hidden=true; return; }
    if(action==='close-events') { activeHook=null; $('hook-events').hidden=true; return; }
    if(action==='show-event') { showEvent(id); return; }
    busy(control,async()=>{
      if(action==='refresh-radar') await loadRadar();
      else if(action==='check-radar') { const data=await api('monitors/'+id+'/check',{method:'POST'});await loadRadar();toast(data.ok?(data.initial?'首次快照已保存':data.changed?'发现页面变化':'本次没有变化'):data.error); }
      else if(action==='history') await loadHistory(id);
      else if(action==='events') await loadEvents(id);
      else if(action==='copy-hook') await copy(hooks.find(item=>item.id===id).url);
      else if(action==='copy-link') await copy(links.find(item=>item.id===id).url);
      else if(action==='test-hook') { const hook=hooks.find(item=>item.id===id);const response=await fetch(hook.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:'Yukino Lab',message:'你好，这是一次真实回调。',sentAt:new Date().toISOString()}),signal:AbortSignal.timeout(20000)});if(response.status!==202) throw new Error('回调未被接收，请确认信箱仍然启用。');await loadHooks();await loadEvents(id);toast('测试回调已送达'); }
      else if(action.startsWith('toggle-') || action.startsWith('delete-')) {
        const kind=action.split('-')[1],path={radar:'monitors',hook:'hooks',link:'links'}[kind];
        const deleting=action.startsWith('delete-');
        if(deleting && !window.confirm('确定删除这一项及其记录？删除前可在实验室首页导出数据。')) return;
        await api(path+'/'+id,{method:deleting?'DELETE':'PATCH',...(deleting?{}:{body:JSON.stringify({enabled:control.dataset.enabled==='1'})})});
        await ({radar:loadRadar,hook:loadHooks,link:loadLinks})[kind]();
        if(deleting && kind==='hook' && activeHook===id) {activeHook=null;$('hook-events').hidden=true;}
        if(deleting && kind==='radar') $('radar-history').hidden=true;
        toast(deleting?'已删除':'状态已更新');
      }
    });
  });
  api('session').then(async data=>{csrf=data.csrf||'';if(data.authenticated) await enter();else loggedOut();}).catch(error=>{loggedOut();toast(error.message);});
  setInterval(()=>{if(page==='hooks' && activeHook && !document.hidden && !$('private-content').hidden) loadEvents(activeHook,true).catch(()=>{});},10000);
})();
