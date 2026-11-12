import './account.css';
import {useEffect,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {ArrowUpRight,LogIn,ShieldCheck,X} from 'lucide-react';
import {LOGIN_EVENT,loginUrl,request} from './access';
import type {AccessStatus} from './access';

export function AccountControl(){
  const location=useLocation(),[access,setAccess]=useState<AccessStatus>(),[failed,setFailed]=useState(false);
  useEffect(()=>{
    let disposed=false;let abort:AbortController|undefined;
    async function check(){abort?.abort();abort=new AbortController();try{const value=await request<AccessStatus>('/api/access',abort.signal);if(!disposed){setAccess(value);setFailed(false);}}catch(error){if(!disposed&&!(error instanceof DOMException&&error.name==='AbortError')){setAccess(undefined);setFailed(true);}}}
    void check();const onFocus=()=>void check();window.addEventListener('focus',onFocus);
    return()=>{disposed=true;abort?.abort();window.removeEventListener('focus',onFocus);};
  },[]);
  const href=loginUrl(location.pathname+location.search+location.hash);
  return <a className={'account-control'+(access?.user?' signed-in':'')} href={href} title={access?.user?'已登录 Yukino，播放与手动同步已开放':failed?'账号服务暂时未连上，可前往主站登录':'使用 Yukino 主站或邮箱账号登录'}>
    {access?.user?<ShieldCheck size={14}/>:<LogIn size={14}/>}<span>{access?.user?.name||'登录'}</span>{access?.user&&<small>已登录</small>}
  </a>;
}
export function AccountNotice(){
  const location=useLocation(),[message,setMessage]=useState('');
  useEffect(()=>{const receive=(event:Event)=>setMessage((event as CustomEvent<{message:string}>).detail?.message||'登录后即可播放与手动同步。');window.addEventListener(LOGIN_EVENT,receive);return()=>window.removeEventListener(LOGIN_EVENT,receive);},[]);
  useEffect(()=>setMessage(''),[location.pathname,location.search]);
  if(!message)return null;
  return <div className="account-notice" role="alert"><div><strong>登录后继续</strong><p>{message}</p></div><a className="button" href={loginUrl(location.pathname+location.search+location.hash)}>登录 Yukino<ArrowUpRight size={13}/></a><button className="icon-button" aria-label="关闭登录提示" onClick={()=>setMessage('')}><X size={15}/></button></div>;
}

