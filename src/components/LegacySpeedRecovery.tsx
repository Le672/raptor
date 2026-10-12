import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { isPortalHost } from '@/lib/site-routing';
import { recoverLegacySpeed } from '@/lib/legacy-speed';
import { SiteLink } from '@/components/SiteLink';
const DISMISSED_KEY = 'yukino-speed:recovery-notice-dismissed';
/** Old reports also recover when the visitor returns to any page on their original portal origin. */
export function LegacySpeedRecovery() {
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    if (!isPortalHost(window.location.hostname) || window.location.hostname === 'speed.yukino.bond') return;
    try { if (!Object.keys(localStorage).some(key => key.startsWith('yukino-speed:report:') || key.startsWith('yukino-speed:run:'))) return; } catch { return; }
    let active = true; setFailed(false);
    recoverLegacySpeed().catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt]);
  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch { /* Closing still works when storage is unavailable. */ }
  };
  if (!failed || dismissed) return null;
  return <aside className="legacy-sync-notice" role="status">
    <span>旧测速记录暂未同步，本机记录仍保留。</span>
    <div className="legacy-sync-actions">
      <button type="button" className="text-link" onClick={() => setAttempt(value => value + 1)}>重试补报</button>
      <SiteLink className="text-link" to="/speed">打开测速站 ↗</SiteLink>
      <button type="button" className="legacy-sync-close" onClick={dismiss} aria-label="关闭测速同步提示" title="关闭提示"><X size={16} aria-hidden="true" /></button>
    </div>
  </aside>;
}
