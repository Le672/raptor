import { useId, useState } from 'react';
import { chartGeometry, nearestPoint } from './chart.mjs';
import { formatBytes } from './engine.mjs';

export default function SpeedChart({ history, rateBps = 0 }: { history: { t: number; bps: number }[]; rateBps?: number }) {
  const gradient = 'ys-chart-' + useId().replace(/:/g, '');
  const { points } = chartGeometry(history, rateBps);
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [keyboardInspection, setKeyboardInspection] = useState(false);
  const selected = selectedTime === null ? null : points.find(p => p.t === selectedTime);
  const path = points.map(p => `${p.x},${p.y}`).join(' ');
  const pick = (event: React.PointerEvent<SVGSVGElement>) => {
    setKeyboardInspection(false);
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = nearestPoint(points, Math.max(0, Math.min(680, (event.clientX - bounds.left) / Math.max(1, bounds.width) * 680)));
    setSelectedTime(point?.t ?? null);
  };
  return <div className="ys-chart">
    <svg viewBox="0 0 680 130" preserveAspectRatio="none" role="img" aria-label="实时下载带宽曲线" tabIndex={points.length ? 0 : -1}
      onPointerMove={pick} onPointerDown={pick} onPointerLeave={e => { if (e.pointerType !== 'touch' && !keyboardInspection) setSelectedTime(null); }}
      onFocus={() => setSelectedTime(current => current ?? points.at(-1)?.t ?? null)} onBlur={() => { setSelectedTime(null); setKeyboardInspection(false); }}
      onKeyDown={event => {
        const index = Math.max(0, points.findIndex(p => p.t === selectedTime));
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : event.key === 'ArrowLeft' ? Math.max(0, index - 1) : event.key === 'ArrowRight' ? Math.min(points.length - 1, index + 1) : null;
        if (next !== null) { event.preventDefault(); setKeyboardInspection(true); setSelectedTime(points[next]?.t ?? null); }
        if (event.key === 'Escape') setSelectedTime(null);
      }}>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#70936b" stopOpacity=".22"/><stop offset="100%" stopColor="#70936b" stopOpacity="0"/></linearGradient></defs>
      {[12, 46, 80, 116].map(y => <line key={y} x1="0" x2="680" y1={y} y2={y} className="ys-grid-line"/>)}
      {!!points.length && <><polygon points={`${points[0].x},130 ${path} ${points.at(-1)!.x},130`} fill={`url(#${gradient})`}/><polyline points={path} fill="none" stroke="#63865b" strokeWidth="2" vectorEffect="non-scaling-stroke"/></>}
      {selected && <><line x1={selected.x} x2={selected.x} y1="0" y2="130" className="ys-chart-crosshair" vectorEffect="non-scaling-stroke"/><circle cx={selected.x} cy={selected.y} r="4" fill="#527b49" stroke="#fffefa" strokeWidth="2" vectorEffect="non-scaling-stroke"/></>}
    </svg>
    {selected && <div role="tooltip" className={`ys-chart-tooltip ${selected.x > 340 ? 'ys-chart-tooltip-left' : ''}`} style={{ left: `${selected.x / 680 * 100}%` }}>
      <span>任务 {selected.t.toFixed(2)} 秒</span><strong>{(selected.bps * 8 / 1e6).toFixed(2)} Mbps</strong><small>{formatBytes(selected.bps)}/s</small>
    </div>}
    {!points.length && <span>开始任务后，速度曲线将在这里生长。</span>}
  </div>;
}
