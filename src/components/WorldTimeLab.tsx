import { useEffect, useState } from 'react';
import type { Appearance } from '../../shared/theme/react';

const cities = [
  ['新加坡', 'Asia/Singapore'], ['东京', 'Asia/Tokyo'], ['伦敦', 'Europe/London'],
  ['纽约', 'America/New_York'], ['悉尼', 'Australia/Sydney'], ['加德满都', 'Asia/Kathmandu'],
];
const localTime = (at: number, timeZone: string) => new Intl.DateTimeFormat('zh-CN', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
const daytime = (at: number, timeZone: string) => {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(at));
  return hour >= 7 && hour < 19;
};
export function WorldTimeLab() {
  const [location, setLocation] = useState<Appearance | undefined>(() => window.YukinoTheme?.getState());
  const [zone, setZone] = useState('visitor');
  const [shift, setShift] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const update = () => { const next = window.YukinoTheme?.getState(); setLocation(next); setNow(next?.now ?? Date.now()); };
    update(); const timer = window.setInterval(update, 10000);
    window.addEventListener('yukino-theme-change', update);
    return () => { window.clearInterval(timer); window.removeEventListener('yukino-theme-change', update); };
  }, []);
  const visitorZone = location?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const timeZone = zone === 'visitor' ? visitorZone : zone;
  const simulated = now + shift * 3600000;
  const day = daytime(simulated, timeZone);
  return <div className="world-lab">
    <div className="world-lab-controls"><label>观察地区<select aria-label="实验时区" value={zone} onChange={event => setZone(event.target.value)}><option value="visitor">我的所在地 · {visitorZone}</option>{cities.map(([name, value]) => <option value={value} key={value}>{name}</option>)}</select></label><button className="pill-button" type="button" onClick={() => { setZone('visitor'); setShift(0); }}>回到此时此地</button></div>
    <div className="world-lab-sky" data-night={!day} role="img" aria-label={`${timeZone} ${localTime(simulated, timeZone)}，${day ? '浅色时段' : '深色时段'}`}>
      <span className="world-lab-orb" aria-hidden="true"/><p>{zone === 'visitor' ? '此时此地' : cities.find(([, value]) => value === zone)?.[0]} · {day ? '日间浅色' : '夜间深色'}</p>
      <time className="world-lab-clock" dateTime={new Date(simulated).toISOString()}>{localTime(simulated, timeZone)}</time>
      <p>{new Intl.DateTimeFormat('zh-CN', { timeZone, month: 'long', day: 'numeric', weekday: 'long' }).format(simulated)}<br/>{timeZone}</p>
    </div>
    <label className="world-lab-slider">时间旅行 · {shift === 0 ? '实时' : `${shift > 0 ? '+' : ''}${shift} 小时`}<input type="range" aria-label="模拟时间偏移（小时）" min="-12" max="12" step="0.5" value={shift} onChange={event => setShift(Number(event.target.value))}/></label>
    <div className="world-lab-cities" aria-label="世界城市时钟">{cities.map(([name, value]) => <button type="button" key={value} aria-pressed={zone === value} onClick={() => setZone(value)}><span>{daytime(simulated, value) ? '☀' : '☾'} {name}</span><strong>{localTime(simulated, value)}</strong></button>)}</div>
    <p className="text-xs leading-6 text-stone-500">{location?.source === 'ip' ? '已按访问 IP 识别时区' : 'IP 时区暂不可用，当前使用设备时区'}：{visitorZone}。按当地 07:00／19:00 切换，包含夏令时与非整点时差；这是时钟规则演示，并非实际日出日落。拖动只影响本实验预览。</p>
  </div>;
}
