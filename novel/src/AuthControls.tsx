import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, LoaderCircle, LogIn, LogOut, ShieldCheck, UserRound, X } from 'lucide-react';
import { access, type Access } from './api';

export function appLoginUrlForPage() {
  return '/login?returnTo=' + encodeURIComponent(location.pathname === '/login' ? '/shelf' : location.pathname + location.search + location.hash);
}
function safeReturn(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/shelf';
  const url = new URL(value, location.origin);
  return url.origin === location.origin && url.pathname !== '/login' ? url.pathname + url.search + url.hash : '/shelf';
}
type Session = { user: Access['user']; loading: boolean; unavailable: boolean; check(): Promise<void>; changed(user: Access['user']): void };
const SessionContext = createContext<Session>({ user: null, loading: true, unavailable: false, check: async () => {}, changed: () => {} });
export const useSession = () => useContext(SessionContext);
export function SessionProvider({ children }: { children: ReactNode }) {
  const route = useLocation();
  const [user, setUser] = useState<Access['user']>(null), [loading, setLoading] = useState(true), [unavailable, setUnavailable] = useState(false);
  const revision = useRef(0), controller = useRef<AbortController | null>(null);
  const check = useCallback(async () => {
    if (document.hidden) return;
    controller.current?.abort(); const request = new AbortController(); controller.current = request; const current = ++revision.current;
    const timeout = window.setTimeout(() => request.abort(), 12000);
    try { const result = await access(request.signal); if (current === revision.current) { setUser(result.user); setUnavailable(false); if (!result.user) window.dispatchEvent(new Event('novel-session-cleared')); } }
    catch { if (current === revision.current) setUnavailable(true); }
    finally { clearTimeout(timeout); if (current === revision.current) setLoading(false); }
  }, []);
  const changed = useCallback((next: Access['user']) => {
    ++revision.current; controller.current?.abort(); setUser(next); setLoading(false); setUnavailable(false);
    if (!next) window.dispatchEvent(new Event('novel-session-cleared'));
    // An event marker crosses tabs; credentials and account data never do.
    try { localStorage.setItem('yukino-novel-session-event', Date.now() + ':' + Math.random()); } catch { /* Storage may be disabled. */ }
  }, []);
  useEffect(() => {
    const refresh = () => { void check(); }, expired = () => { ++revision.current; controller.current?.abort(); setUser(null); setLoading(false); setUnavailable(false); };
    const storage = (event: StorageEvent) => { if (event.key === 'yukino-novel-session-event') refresh(); };
    window.addEventListener('focus', refresh); window.addEventListener('pageshow', refresh); window.addEventListener('online', refresh); window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', refresh); window.addEventListener('novel-login-required', expired);
    return () => { ++revision.current; controller.current?.abort(); window.removeEventListener('focus', refresh); window.removeEventListener('pageshow', refresh); window.removeEventListener('online', refresh); window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('novel-login-required', expired); };
  }, [check]);
  useEffect(() => { void check(); }, [route.pathname, check]);
  return <SessionContext.Provider value={{ user, loading, unavailable, check, changed }}>{children}</SessionContext.Provider>;
}
export function LoginRequiredPanel() {
  return <section className="state-panel login-required" role="status"><LogIn size={29} /><h3>登录后，继续这个故事</h3><p>章节阅读需要使用 Yukino 账户登录。登录后会回到当前章节，书架与阅读进度会保留。</p><Link className="button" to={appLoginUrlForPage()}><LogIn size={15} />登录后阅读</Link><small>目录、搜索和书籍介绍可以直接浏览。</small></section>;
}
export function AccountControl() {
  const session = useSession();
  return <Link className="novel-account" to={appLoginUrlForPage()} title={session.unavailable ? '登录状态暂不可用，联网后会重新检查' : session.user ? '已登录：' + session.user.name : '在书房内登录，记住这台设备'}>{session.loading ? <LoaderCircle className="spin" size={15} /> : session.user ? <UserRound size={15} /> : <LogIn size={15} />}<span>{session.loading ? '检查中' : session.user ? session.user.name + (session.unavailable ? ' · 待验证' : '') : session.unavailable ? '检查登录' : '登录'}</span></Link>;
}
export function LoginNotice() {
  const route = useLocation(), [visible, setVisible] = useState(false);
  useEffect(() => { const show = () => setVisible(true); window.addEventListener('novel-login-required', show); return () => window.removeEventListener('novel-login-required', show); }, []);
  useEffect(() => setVisible(false), [route.pathname, route.search]);
  if (!visible || route.pathname.startsWith('/read/')) return null;
  return <div className="novel-login-notice" role="status"><LogIn size={18} /><p>登录后可以手动同步书源并阅读章节。<Link to={appLoginUrlForPage()}>登录并返回此页<LogIn size={13} /></Link></p><button className="icon-button" onClick={() => setVisible(false)} aria-label="关闭登录提示"><X size={15} /></button></div>;
}
export function LoginPage() {
  const session = useSession(), navigate = useNavigate(), [params] = useSearchParams();
  const [source, setSource] = useState('mail'), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [remember, setRemember] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const returnTo = safeReturn(params.get('returnTo'));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, source, remember }), signal: AbortSignal.timeout(25000) });
      const result = await response.json(); if (!response.ok || !result.user) throw new Error(result.error || '登录失败，请重试');
      setPassword('');
      // Confirm the browser accepted its HttpOnly cookie before navigating.
      const verified = await access(); if (!verified.user) throw new Error('此浏览器没有保存登录会话，请允许本站 Cookie 后重试。');
      session.changed(verified.user); navigate(returnTo, { replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : '登录失败，请稍后重试'); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    setBusy(true); setError('');
    try { const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) }); if (!response.ok) throw new Error('退出失败，请联网后重试'); session.changed(null); setPassword(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '退出失败'); } finally { setBusy(false); }
  };
  return <div className="login-page"><Link to={returnTo} className="back-link"><ArrowLeft size={15} />回到刚才的故事</Link><section className="login-card"><img src="/icons/icon-192.png" width="64" height="64" alt="" /><span className="eyebrow">WELCOME TO YOUR READING ROOM</span><h1>{session.user ? '书房已为你打开。' : '登录，接着读。'}</h1><p>使用 Yukino 邮箱或主站账户，在这台设备留下你的阅读时光。</p>{session.loading ? <p role="status"><LoaderCircle className="spin" size={17} />正在恢复登录状态…</p> : session.user ? <div className="signed-in-card"><UserRound size={24} /><strong>{session.user.name}</strong><p>{session.unavailable ? '当前网络无法验证会话，联网后将重新检查。' : '重新打开应用时，会自动检查有效会话。'}</p><Link to={returnTo} className="button">继续阅读<ArrowRight size={15} /></Link><button className="text-button" disabled={busy} onClick={() => void logout()}><LogOut size={15} />{busy ? '正在退出…' : '退出此设备'}</button><small>退出会清除此应用的登录会话，其他设备不受影响。</small></div> : <form onSubmit={event => void submit(event)}><div className="login-source" role="group" aria-label="登录方式"><button type="button" aria-pressed={source === 'mail'} onClick={() => setSource('mail')}>Yukino 邮箱</button><button type="button" aria-pressed={source === 'local'} onClick={() => setSource('local')}>主站账户</button></div><label htmlFor="novel-email">邮箱</label><input id="novel-email" type="email" autoComplete="username" inputMode="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required disabled={busy} placeholder={source === 'mail' ? '你的 Yukino 邮箱地址' : '主站账户的邮箱地址'} /><label htmlFor="novel-password">密码</label><input id="novel-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} maxLength={512} required disabled={busy} /><label className="remember-device"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} disabled={busy} />在此设备保持登录（7 天）</label><button className="button login-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <LogIn size={16} />}{busy ? '正在登录…' : '登录并继续阅读'}</button><small><ShieldCheck size={13} />密码不会保存在网页中，登录会话自动恢复。</small><a className="text-button" href="https://mail.yukino.bond" target="_blank" rel="noreferrer">注册 Yukino 邮箱<ArrowRight size={13} /></a></form>}{error && <p className="inline-error" role="alert">{error}</p>}{session.unavailable && !session.user && <p className="inline-error" role="status">暂时无法恢复登录状态，请检查网络后重试。<button className="text-button" onClick={() => void session.check()}>重新检查</button></p>}<p className="login-footnote">从 iOS 主屏幕打开时，请在应用内登录。会话到期、主动退出或清除网站数据后需要重新登录。</p></section></div>;
}
