import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Eye, RefreshCw } from 'lucide-react';
import { isMainHost, isLocalHost, MAIN_ORIGIN } from '@/lib/site-routing';
import { isNativeApp } from '@/lib/runtime';
import { validVisitTotal, type SiteVisitTotal } from '@/lib/site-visits';
import '../site-routing.css';
type State = { total: SiteVisitTotal | null; error: string; loading: boolean; refresh: () => void };
const Visits = createContext<State | null>(null);
export function SiteVisitsProvider({ children }: { children: ReactNode }) {
  const location = useLocation(), host = window.location.hostname;
  const main = !isNativeApp() && (isMainHost(host) || isLocalHost(host) || host === 'raptor.pages.dev');
  const publicPage = !/^\/(?:admin|login|register)(?:\/|$)/.test(location.pathname);
  const endpoint = main ? '/api/visits' : MAIN_ORIGIN + '/api/visits';
  const event = useRef<{ path: string; id: string } | null>(null);
  if (!event.current || event.current.path !== location.pathname) event.current = { path: location.pathname, id: crypto.randomUUID() };
  const [total, setTotal] = useState<SiteVisitTotal | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  const id = event.current.id;
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    const load = async () => {
      try {
        const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(10000), ...(main && publicPage ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) } : {}) });
        const value = await response.json();
        if (!response.ok || !validVisitTotal(value)) throw new Error();
        if (active) { setTotal(previous => previous && previous.visits > value.visits ? previous : value); setError(''); }
      } catch { if (active) setError('访问量暂时无法读取。'); }
      finally { if (active) setLoading(false); }
    };
    void load();
    const online = () => { void load(); }; window.addEventListener('online', online);
    return () => { active = false; window.removeEventListener('online', online); };
  }, [endpoint, main, publicPage, id, retry]);
  return <Visits.Provider value={{ total, error, loading, refresh: () => setRetry(value => value + 1) }}>{children}</Visits.Provider>;
}
export function SiteVisits({ compact = false }: { compact?: boolean }) {
  const stats = useContext(Visits);
  if (!stats) return null;
  const since = stats.total ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(stats.total.startedAt)) : '';
  return <section className={`site-visits${compact ? ' site-visits-compact' : ''}`} aria-label="主站累计访问量"><Eye size={compact ? 15 : 20}/><div><span>主站累计访问量</span><strong data-testid={compact ? 'site-visits-footer' : 'site-visits-home'}>{stats.total ? new Intl.NumberFormat('zh-CN').format(stats.total.visits) : '—'}</strong><small>{stats.error || (stats.loading && !stats.total ? '正在读取…' : `页面浏览次数 · ${since} 起`)}</small></div>{stats.error && <button onClick={stats.refresh} className="ip-text-button" aria-label="重试读取访问量"><RefreshCw size={14}/></button>}<span className="sr-only">每次打开、刷新或切换主站公开页面记为一次，不代表独立访客数；从启用时开始累计。</span></section>;
}
