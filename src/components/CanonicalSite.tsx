import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { canonicalPageUrl, isPortalHost } from '@/lib/site-routing';
import { recoverLegacySpeed } from '@/lib/legacy-speed';
import '../site-routing.css';

function SpeedHandoff({ target }: { target: string }) {
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setError('');
    recoverLegacySpeed().then(() => { if (active) window.location.replace(target); }).catch(() => {
      if (active) setError('旧地址的统计暂未同步，本机记录仍保留。联网后重试补报，或直接打开独立测速站。');
    });
    return () => { active = false; };
  }, [target, attempt]);
  return <section className="site-handoff" aria-label="测速地址迁移"><p className="eyebrow">YUKINO / SPEED</p><h1>测速有了统一的入口。</h1><p role={error ? 'alert' : 'status'}>{error || '正在补报这个旧地址保存的流量记录，随后进入 speed.yukino.bond…'}</p><p>补报保留原任务身份，已同步流量不会重复累计；本机历史仍保留在原域名。</p>{error && <button className="pill-button" onClick={() => setAttempt(value => value + 1)}>重试补报</button>}<a className="text-link" href={target}>{error ? '直接打开独立测速站 ↗' : '打开独立测速站 ↗'}</a></section>;
}
export function CanonicalSite({ children }: { children: ReactNode }) {
  const location = useLocation();
  const address = isPortalHost(window.location.hostname) ? new URL(location.pathname + location.search + location.hash, window.location.origin) : null;
  const target = address ? canonicalPageUrl(address.href) : null;
  const crossOrigin = target && new URL(target).origin !== window.location.origin;
  const legacySpeed = crossOrigin && new URL(target).hostname === 'speed.yukino.bond';
  useEffect(() => { if (crossOrigin && !legacySpeed) window.location.replace(target); }, [target, crossOrigin, legacySpeed]);
  if (legacySpeed) return <SpeedHandoff target={target} />;
  if (crossOrigin) return <section className="site-handoff"><p role="status">正在打开正确的站点…</p><a href={target}>继续访问 ↗</a></section>;
  return <>{children}</>;
}
