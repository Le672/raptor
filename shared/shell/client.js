/* Yukino's shared public navigation. No account, messages, files or credentials are read. */
(()=>{
  'use strict';
  const entries=__YUKINO_NAVIGATION__;
  const configuredSite=__YUKINO_SITE__;
  function start(){
    if(document.querySelector('#yukino-global-header')||document.querySelector('.collection-header'))return;
    if(location.protocol==='file:')return;
    document.body.classList.add('site-shell','yukino-independent');
    const site=location.hostname.endsWith('.yukino.bond')?location.hostname.split('.')[0]:configuredSite||location.hostname.split('.')[0];
    document.body.dataset.yukinoSite=site;
    const current=entries.find(e=>new URL(e.href).hostname===site+'.yukino.bond');
    const header=document.createElement('header');header.id='yukino-global-header';header.className='site-header collection-header';
    const html=(tag,className,parent,text)=>{const n=document.createElement(tag);n.className=className;if(text)n.textContent=text;parent.append(n);return n;};
    const inner=html('div','nav-inner',header),brandLock=html('div','brand-lockup',inner),brand=html('a','brand',brandLock);brand.href='https://www.yukino.bond/';brand.setAttribute('aria-label','Yukino.');
    const img=html('img','brand-mark',brand);img.src='/yukino-shell/avatar.png';img.alt='';img.width=40;img.height=40;
    const word=html('span','brand-wordmark',brand,'Yukino');html('span','brand-dot',word,'.');html('small','',word,'PERSONAL SPACE');
    const breadcrumb=html('div','collection-breadcrumb',inner);breadcrumb.setAttribute('aria-label','当前位置');html('span','',breadcrumb,'Yukino Portal');html('span','',breadcrumb,'›');html('strong','',breadcrumb,current?.label||'工具');
    const tools=html('div','nav-tools',inner),search=html('button','search-toggle',tools);search.type='button';search.textContent='⌕ 搜索';search.setAttribute('aria-label','搜索站内入口');html('kbd','',search,'Ctrl K');
    const account=html('div','nav-account',tools),login=html('a','',account,site==='mail'?'邮箱账户':'主站账户 ↗');login.href=site==='mail'?'/':'https://www.yukino.bond/login';
    const area=html('div','collection-navigation-area',inner),label=html('p','collection-nav-label',area,'探索小站');html('span','',label,'EXPLORE');const nav=html('nav','site-navigation',area);nav.setAttribute('aria-label','主导航');
    for(const item of entries){const a=html('a',current===item?'active':'',nav);a.href=item.href;a.title=item.description;if(current===item)a.setAttribute('aria-current','page');a.innerHTML=item.icon;html('span','',a,item.label);}
    const note=html('div','collection-sidebar-note',area);const text=html('span','',note,'保持好奇，慢慢记录。');html('small','',text,'CODE, NOTES & EVERYDAY LIFE');
    document.body.prepend(header);
    const measure=()=>document.body.style.setProperty('--yukino-shell-height',Math.ceil(header.getBoundingClientRect().height)+'px');
    measure();if(typeof ResizeObserver!=='undefined')new ResizeObserver(measure).observe(header);
    const dialog=document.createElement('dialog');dialog.className='yukino-navigation-search';dialog.setAttribute('aria-label','搜索站内入口');const form=html('form','',dialog);form.method='dialog';const close=html('button','',form,'关闭 ×');close.setAttribute('aria-label','关闭搜索');const input=html('input','',dialog);input.placeholder='搜索子站名称或功能…';input.setAttribute('aria-label','搜索站内入口');const results=html('div','',dialog);
    function filter(){results.replaceChildren();const q=input.value.toLowerCase();for(const e of entries.filter(e=>(e.label+' '+e.description).toLowerCase().includes(q))){const a=html('a','',results,e.label+' · '+e.description);a.href=e.href;}if(!results.children.length)html('p','',results,'没有找到入口');}
    const open=()=>{filter();dialog.showModal();input.focus();};input.addEventListener('input',filter);search.addEventListener('click',open);document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open();}});document.body.append(dialog);
    // Drop and private lab retain their own form/API behavior, inside the same shell.
    if(site==='drop'){
      const names={expiration:'过期时间',burn_after:'阅读次数',syntax_highlight:'语法高亮',privacy:'分享方式',password_field:'阅读密码',file:'添加文件'};
      for(const[id,name]of Object.entries(names)){const l=document.querySelector(`label[for="${id}"]`);if(l)l.childNodes[0].textContent=name+' ';}
      const content=document.querySelector('#content-input');if(content)content.setAttribute('placeholder','写下要传送的文字，或选择文件…');
      const password=document.querySelector('#uploader_password');if(password)password.setAttribute('placeholder','上传口令');
      const submit=document.querySelector('#submit-button');if(submit)submit.value='创建分享 →';
      const form=document.querySelector('#pasta-form');if(form&&!document.querySelector('.yukino-drop-heading')){const heading=document.createElement('div');heading.className='yukino-drop-heading';heading.innerHTML='<p>THE LITTLE DELIVERY</p><h1>传一段文字，<br>送一份文件。</h1><span>设置有效期，把要分享的内容交给临时传送门。</span>';form.before(heading);}
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
