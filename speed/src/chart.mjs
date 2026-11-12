export function chartGeometry(history, rateBps = 0) {
  const clean = history.filter(p => Number.isFinite(p.t) && Number.isFinite(p.bps) && p.t >= 0 && p.bps >= 0);
  const end = clean.at(-1)?.t || 0;
  const start = Math.max(0, end - 45);
  const samples = clean.filter(p => p.t >= start);
  const max = Math.max(125000, rateBps, ...samples.map(p => p.bps));
  const span = Math.max(1, end - start);
  const points = samples.map(p => ({ ...p, x: (p.t - start) / span * 680, y: 116 - p.bps / max * 105 }));
  return { points, start, end, span, max };
}
export function nearestPoint(points, x) {
  return points.reduce((nearest, point) => !nearest || Math.abs(point.x - x) < Math.abs(nearest.x - x) ? point : nearest, null);
}
