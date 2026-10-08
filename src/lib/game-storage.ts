export function readScore(key: string) {
  try { const value = Number(localStorage.getItem(key)); return Number.isSafeInteger(value) && value >= 0 ? value : 0; } catch { return 0; }
}
export function writeScore(key: string, value: number) {
  if (!Number.isSafeInteger(value) || value < 0) return;
  try { localStorage.setItem(key, String(value)); } catch { /* Scores remain usable for this round. */ }
}
