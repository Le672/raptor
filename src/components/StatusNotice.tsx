import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { readStatusReport } from '@/lib/status-client';

export function StatusNotice() {
  const [message, setMessage] = useState('');
  const [dismissedMessage, setDismissedMessage] = useState('');
  const [paused, setPaused] = useState(false);
  const visibleMessage = message === dismissedMessage ? '' : message;
  const windowRef = useRef<HTMLAnchorElement>(null);
  const itemRef = useRef<HTMLSpanElement>(null);
  const [repeat, setRepeat] = useState(4);
  const [duration, setDuration] = useState(40);
  useEffect(() => {
    const window = windowRef.current, item = itemRef.current;
    if (!window || !item || !visibleMessage) return;
    const measure = () => {
      const width = item.getBoundingClientRect().width;
      if (!width) return;
      const copies = Math.max(2, Math.ceil(window.clientWidth / width) + 1);
      setRepeat(copies);
      setDuration(copies * width / 55);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(window); observer.observe(item); measure();
    return () => observer.disconnect();
  }, [visibleMessage]);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.hidden) return;
      void readStatusReport().then(report => {
        if (!active) return;
        if (Date.now() - Date.parse(report.checkedAt) > 300000) { setMessage(''); return; }
        const errors = report.services.filter(service => service.state === 'error' && !service.statusOnly);
        const nextMessage = errors.length ? `服务异常：${errors.map(service => service.name).join('、')}。点击查看状态详情。` : '';
        setMessage(nextMessage);
        setDismissedMessage(previous => previous === nextMessage ? previous : '');
      }).catch(() => { if (active) setMessage(''); });
    };
    refresh();
    const timer = setInterval(refresh, 180000);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  if (!visibleMessage) return null;
  return <div className="status-notice" role="status" aria-label={visibleMessage}>
    <a ref={windowRef} className="status-notice-window" href="https://status.yukino.bond/" aria-label={visibleMessage}>
      <div className={`status-notice-track${paused ? ' is-paused' : ''}`} style={{ '--ticker-duration': `${duration}s` } as CSSProperties} aria-hidden="true">
        {[0, 1].map(group => <div className="status-notice-group" key={group}>
          {Array.from({ length: repeat }, (_, index) => <span key={index} ref={group === 0 && index === 0 ? itemRef : undefined}>{visibleMessage}</span>)}
        </div>)}
      </div>
    </a>
    <div className="status-notice-actions">
      <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? '播放故障滚动提示' : '暂停故障滚动提示'}>{paused ? '播放' : '暂停'}</button>
      <button type="button" onClick={() => { setDismissedMessage(visibleMessage); setPaused(false); }} aria-label="关闭故障滚动提示">关闭</button>
    </div>
  </div>;
}
