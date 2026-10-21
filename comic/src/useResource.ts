import {useEffect,useRef,useState} from 'react';
import {isLoginRequired,request} from './access';

export function useResource<T>(path:string){
  const[state,setState]=useState<{key:string;data?:T;error?:string;loading:boolean;loginRequired?:boolean}>({key:'',loading:true});
  const[revision,setRevision]=useState(0),last=useRef({path,revision});
  useEffect(()=>{
    const abort=new AbortController(),force=last.current.path===path&&last.current.revision!==revision;
    last.current={path,revision};
    setState(previous=>({key:path,data:previous.key===path?previous.data:undefined,loading:true}));
    const target=path+(force?(path.includes('?')?'&':'?')+'refresh=1':'');
    void request<T>(target,abort.signal).then(data=>{if(!abort.signal.aborted)setState({key:path,data,loading:false});}).catch(error=>{
      if(!abort.signal.aborted)setState(previous=>({key:path,data:previous.key===path?previous.data:undefined,loading:false,error:error.message,loginRequired:isLoginRequired(error)}));
    });
    return()=>abort.abort();
  },[path,revision]);
  const current=state.key===path?state:{key:path,loading:true,data:undefined,error:undefined,loginRequired:false};
  return {...current,error:current.data&&current.loginRequired?undefined:current.error,reload:()=>setRevision(value=>value+1)};
}

