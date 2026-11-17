// Only browser-provided display signals identify an app window. URL flags and
// cached installation markers cannot turn a Safari tab into a Home Screen app.
export function isAppWindow(scope=globalThis){
  if(scope.navigator?.standalone===true)return true;
  return ['standalone','fullscreen','minimal-ui'].some(mode=>{try{return Boolean(scope.matchMedia?.(`(display-mode: ${mode})`).matches);}catch{return false;}});
}
export function observeAppWindow(change,scope=globalThis){
  const cleanups=[],refresh=()=>change(isAppWindow(scope));
  const listen=(target,event)=>{target?.addEventListener?.(event,refresh);cleanups.push(()=>target?.removeEventListener?.(event,refresh));};
  for(const mode of ['standalone','fullscreen','minimal-ui']){let media;try{media=scope.matchMedia?.(`(display-mode: ${mode})`);}catch{continue;}
    if(media?.addEventListener){media.addEventListener('change',refresh);cleanups.push(()=>media.removeEventListener('change',refresh));}
    else if(media?.addListener){media.addListener(refresh);cleanups.push(()=>media.removeListener(refresh));}
  }
  listen(scope,'pageshow');listen(scope,'focus');listen(scope.document,'visibilitychange');refresh();
  return()=>cleanups.forEach(stop=>stop());
}

export function applyAppWindowLayout(active,doc=globalThis.document){
  doc?.documentElement?.classList.toggle('yukino-app-window',active);
  if(doc?.body?.dataset.yukinoShell==='independent'){
    doc.body.classList.toggle('site-shell',!active);
    doc.body.classList.toggle('yukino-independent',!active);
  }
}
