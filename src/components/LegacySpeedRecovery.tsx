import { useEffect, useState } from 'react';
import { isPortalHost } from '@/lib/site-routing';
import { recoverLegacySpeed } from '@/lib/legacy-speed';
import { SiteLink } from '@/components/SiteLink';
/** Old reports also recover when the visitor returns to any page on their original portal origin. */
export function LegacySpeedRecovery() {
  const [message, setMessage] = useState(''), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!isPortalHost(window.location.hostname) || window.location.hostname === 'speed.yukino.bond') return;
    try { if (!Object.keys(localStorage).some(key => key.startsWith('yukino-speed:report:') || key.startsWith('yukino-speed:run:'))) return; } catch { return; }
    let active = true; setFailed(false); setMessage('正在补报这个旧地址保存的测速流量…');
    recoverLegacySpeed().then(result => { if (active) setMessage(result.sessions ? '旧测速记录已补报，全站累计流量已恢复同步。本机历史仍保留在原域名。' : ''); })
      .catch(() => { if (active) { setFailed(true); setMessage('旧测速记录暂未同步，本机记录仍保留。'); } });
    return () => { active = false; };
  }, [attempt]);
  if (!message) return null;
  return <aside className="legacy-sync-notice" role="status"><span>{message}</span>{failed && <button className="text-link" onClick={() => setAttempt(value => value + 1)}>重试补报</button>}<SiteLink className="text-link" to="/speed">打开测速站 ↗</SiteLink></aside>;
}
