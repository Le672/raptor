import { useEffect, useState } from 'react';
import { readStatusReport } from '@/lib/status-client';

export function StatusNotice() {
  const [message, setMessage] = useState('');
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
  return <a className="status-notice" href="https://status.yukino.bond/" role="status"><span>{message}</span></a>;
}
