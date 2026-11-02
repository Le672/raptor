import { useEffect, useState } from 'react';
import { readStatusReport } from '@/lib/status-client';

export function StatusNotice() {
  const [message, setMessage] = useState('');
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.hidden) return;
      void readStatusReport().then(report => {
        if (!active) return;
        if (Date.now() - Date.parse(report.checkedAt) > 300000) { setMessage(''); return; }
        const errors = report.services.filter(service => service.state === 'error');
        setMessage(errors.length ? `服务异常：${errors.map(service => service.name).join('、')}。点击查看状态详情。` : '');
      }).catch(() => { if (active) setMessage(''); });
    };
    refresh();
    const timer = setInterval(refresh, 180000);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  if (!message) return null;
  return <div className="status-notice" role="status" aria-label={message}>
    <a className="status-notice-window" href="https://status.yukino.bond/" aria-label={message}>
      <div className={`status-notice-track${paused ? ' is-paused' : ''}`} aria-hidden="true">
        <span>{message}</span><span>{message}</span>
      </div>
    </a>
    <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? '播放故障滚动提示' : '暂停故障滚动提示'}>{paused ? '播放' : '暂停'}</button>
  </div>;
}
