(() => {
  if(window.parent===window)return;
  const nonce=location.hash.slice(1);if(!/^[a-z\d-]{16,80}$/i.test(nonce))return;
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem('novel:'+key)||'null')??fallback;}catch{return fallback;}};
  const payload={version:1,site:'ln',shelf:read('shelf',[]),history:read('history',[]),settings:read('settings',{})};
  if(JSON.stringify(payload).length>3*1024*1024)return;
  window.parent.postMessage({type:'yukino-light-library',nonce,payload},'https://ln.yukino.bond');
})();
