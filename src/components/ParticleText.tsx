import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import './particle-text.css';

type Particle = { x: number; y: number; homeX: number; homeY: number; vx: number; vy: number; color: string };
type Controls = { point(x: number, y: number, burst?: boolean): void; leave(): void; demo(): void };
const colors = ['#9dd8ff', '#80efe0', '#c5b4ff', '#ffbad8', '#ffe2a3'];

export function ParticleText() {
  const [text, setText] = useState('Yukino Lab');
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [unavailable, setUnavailable] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const controls = useRef<Controls | null>(null);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const changed = () => setReducedMotion(media?.matches ?? false);
    media?.addEventListener('change', changed);
    return () => media?.removeEventListener('change', changed);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current, stage = stageRef.current;
    if (!canvas || !stage) return;
    const context = canvas.getContext('2d');
    const mask = document.createElement('canvas'), maskContext = mask.getContext('2d', { willReadFrequently: true });
    if (!context || !maskContext) { setUnavailable(true); return; }
    let particles: Particle[] = [], width = 1, height = 224, frame = 0, lastFrame = 0;
    let visible = true, disposed = false, forcedUntil = 0;
    let pointer: { x: number; y: number } | null = null;
    const draw = () => {
      context.clearRect(0, 0, width, height);
      for (const particle of particles) {
        context.fillStyle = particle.color;
        context.beginPath(); context.arc(particle.x, particle.y, 1.35, 0, Math.PI * 2); context.fill();
      }
      if (pointer) {
        context.strokeStyle = '#a9d9ff70'; context.lineWidth = 1;
        context.beginPath(); context.arc(pointer.x, pointer.y, 38, 0, Math.PI * 2); context.stroke();
      }
    };
    const animate = (at: number) => {
      frame = 0;
      if (disposed || !visible || document.hidden) return;
      if (lastFrame && at - lastFrame < 30) { frame = requestAnimationFrame(animate); return; }
      const dt = Math.min(1.5, Math.max(.5, lastFrame ? (at - lastFrame) / 33 : 1)); lastFrame = at;
      if (reducedMotion && at > forcedUntil) {
        for (const p of particles) { p.x = p.homeX; p.y = p.homeY; p.vx = 0; p.vy = 0; }
        draw(); return;
      }
      let moving = false;
      for (const p of particles) {
        if (pointer) {
          const dx = p.x - pointer.x, dy = p.y - pointer.y, distance = Math.hypot(dx, dy);
          if (distance < 62) {
            const strength = (1 - distance / 62) * 3;
            p.vx += (distance ? dx / distance : 1) * strength;
            p.vy += (distance ? dy / distance : 0) * strength;
          }
        }
        p.vx = (p.vx + (p.homeX - p.x) * .075 * dt) * Math.pow(.75, dt);
        p.vy = (p.vy + (p.homeY - p.y) * .075 * dt) * Math.pow(.75, dt);
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (Math.abs(p.vx) + Math.abs(p.vy) + Math.abs(p.x - p.homeX) + Math.abs(p.y - p.homeY) > .12) moving = true;
      }
      draw();
      if (moving || pointer || at < forcedUntil) frame = requestAnimationFrame(animate);
    };
    const wake = () => { if (!frame && visible && !document.hidden && !disposed) { lastFrame = 0; frame = requestAnimationFrame(animate); } };
    const rebuild = () => {
      if (disposed) return;
      width = Math.max(1, stage.clientWidth);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio); canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      mask.width = width; mask.height = height;
      const value = text.trim() || '输入文字开始';
      let size = Math.min(56, Math.max(20, (width - 40) / Math.min(Array.from(value).length, 12)));
      let lines: string[] = [];
      const layout = () => {
        maskContext.font = `700 ${size}px "Segoe UI", "Microsoft YaHei", sans-serif`;
        lines = [''];
        for (const char of Array.from(value)) {
          const index = lines.length - 1;
          if (lines[index] && maskContext.measureText(lines[index] + char).width > Math.max(1, width - 32)) lines.push(char);
          else lines[index] += char;
        }
      };
      layout();
      while (lines.length > 3 && size > 14) { size -= 2; layout(); }
      maskContext.textAlign = 'center'; maskContext.textBaseline = 'middle'; maskContext.fillStyle = '#fff';
      lines.forEach((line, index) => maskContext.fillText(line, width / 2, height / 2 + (index - (lines.length - 1) / 2) * size * 1.25));
      const pixels = maskContext.getImageData(0, 0, width, height).data;
      const candidates: { x: number; y: number }[] = [];
      for (let y = 6; y < height - 6; y += 4) for (let x = 4; x < width - 4; x += 4) {
        if (pixels[(y * width + x) * 4 + 3] > 130) candidates.push({ x, y });
      }
      const stride = Math.max(1, Math.ceil(candidates.length / 1100));
      particles = candidates.filter((_, index) => index % stride === 0).map(({ x, y }, index) => ({
        x: x + (reducedMotion ? 0 : (Math.random() - .5) * 25), y: y + (reducedMotion ? 0 : (Math.random() - .5) * 25),
        homeX: x, homeY: y, vx: 0, vy: 0, color: colors[Math.floor(index / 9) % colors.length],
      }));
      canvas.dataset.particleCount = String(particles.length);
      draw(); if (!reducedMotion) wake();
    };
    const burst = (x = width / 2, y = height / 2) => {
      forcedUntil = performance.now() + 1800;
      for (const p of particles) {
        const angle = Math.atan2(p.y - y, p.x - x) + (Math.random() - .5) * .6;
        const speed = 6 + Math.random() * 11;
        p.vx += Math.cos(angle) * speed; p.vy += Math.sin(angle) * speed;
      }
      wake();
    };
    controls.current = {
      point(x, y, pressed) { pointer = { x, y }; if (reducedMotion) draw(); else if (pressed) burst(x, y); else wake(); },
      leave() { pointer = null; if (reducedMotion) draw(); else wake(); },
      demo() { pointer = null; burst(); },
    };
    const resize = new ResizeObserver(rebuild); resize.observe(stage);
    const intersection = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      if (!visible) { cancelAnimationFrame(frame); frame = 0; } else if (!reducedMotion || forcedUntil > performance.now()) wake();
    }); intersection.observe(stage);
    const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else if (!reducedMotion || forcedUntil > performance.now()) wake(); };
    document.addEventListener('visibilitychange', visibility);
    rebuild(); void document.fonts?.ready.then(rebuild);
    return () => { disposed = true; controls.current = null; cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, [text, reducedMotion]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>, pressed = false) => {
    const rect = event.currentTarget.getBoundingClientRect();
    controls.current?.point(event.clientX - rect.left, event.clientY - rect.top, pressed);
  };
  return <div className="particle-text-experiment">
    <div className="particle-text-controls"><input type="text" aria-label="粒子文字" placeholder="输入文字…" maxLength={60} value={text} onChange={event => setText(event.target.value)}/><button className="pill-button" type="button" onClick={() => controls.current?.demo()}><Sparkles size={15}/>播放演示</button></div>
    <div className="particle-text-stage" ref={stageRef}>
      <canvas ref={canvasRef} role="img" aria-label={`${text || '输入文字开始'}的粒子文字预览`} onPointerMove={event => point(event)} onPointerDown={event => point(event, true)} onPointerUp={() => controls.current?.leave()} onPointerLeave={() => controls.current?.leave()} onPointerCancel={() => controls.current?.leave()}>{text}</canvas>
      {unavailable && <p role="status">当前浏览器暂不支持粒子画布。</p>}
      <span className="particle-text-stage-label" aria-hidden="true">PARTICLE TYPE · TOUCH TO SCATTER</span>
    </div>
    <p className="particle-text-hint">{reducedMotion ? '已遵循系统的“减少动态效果”：显示静态粒子文字；点击“播放演示”仍可主动体验一次动画。' : '文字由彩色粒子组成。移动鼠标、点按或拖动可打散粒子，松开后会重新聚成文字。'}</p>
  </div>;
}
