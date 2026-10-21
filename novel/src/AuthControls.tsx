import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LogIn, UserRound, X } from 'lucide-react';
import { access, loginUrlForPage, type Access } from './api';

export function LoginRequiredPanel() {
  return <section className="state-panel login-required" role="status"><LogIn size={29} /><h3>登录后，继续这个故事</h3><p>章节阅读需要使用 Yukino 账户登录。登录后会回到当前章节，书架与阅读进度会保留。</p><a className="button" href={loginUrlForPage()}><LogIn size={15} />登录后阅读</a><small>目录、搜索和书籍介绍可以直接浏览。</small></section>;
}

export function AccountControl() {
  const route = useLocation();
  const [session, setSession] = useState<Access | null>(null), [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const check = () => { if (!document.hidden) void access(controller.signal).then(value => { setSession(value); setUnavailable(false); }).catch(() => { if (!controller.signal.aborted) { setSession(null); setUnavailable(true); } }); };
    const expired = () => setSession(null);
    check(); window.addEventListener('focus', check); document.addEventListener('visibilitychange', check); window.addEventListener('novel-login-required', expired);
    return () => { controller.abort(); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); window.removeEventListener('novel-login-required', expired); };
  }, [route.pathname]);
  return session?.user ? <span className="novel-account" title={`已登录：${session.user.name}`}><UserRound size={15} /><span>{session.user.name}</span></span> : <a className="novel-account" href={loginUrlForPage()} title={unavailable ? '登录状态暂不可用，可前往主站重新登录' : '使用主站或邮箱账户登录'}><LogIn size={15} /><span>登录</span></a>;
}

export function LoginNotice() {
  const route = useLocation();
  const [visible, setVisible] = useState(false);
  useEffect(() => { const show = () => setVisible(true); window.addEventListener('novel-login-required', show); return () => window.removeEventListener('novel-login-required', show); }, []);
  useEffect(() => setVisible(false), [route.pathname, route.search]);
  if (!visible || route.pathname.startsWith('/read/')) return null;
  return <div className="novel-login-notice" role="status"><LogIn size={18} /><p>登录后可以手动同步书源并阅读章节。<a href={loginUrlForPage()}>登录并返回此页<LogIn size={13} /></a></p><button className="icon-button" onClick={() => setVisible(false)} aria-label="关闭登录提示"><X size={15} /></button></div>;
}
