import { useState, useSyncExternalStore } from 'react';

export type Appearance = { mode: 'auto' | 'light' | 'dark'; theme: 'light' | 'dark'; timeZone: string; source: 'ip' | 'browser'; now: number };
declare global {
  interface Window {
    YukinoTheme?: { getState(): Appearance; setMode(mode: Appearance['mode']): void; refresh(): Promise<void>; themeAt(at: number, zone: string): Appearance['theme'] };
  }
}
const subscribe = (notify: () => void) => { window.addEventListener('yukino-theme-change', notify); return () => window.removeEventListener('yukino-theme-change', notify); };
export function useAppearance() {
  const [fallback, setFallback] = useState<Appearance['theme']>('light');
  const theme = useSyncExternalStore<Appearance['theme']>(subscribe, () => window.YukinoTheme?.getState().theme || fallback, () => 'light');
  const setTheme = (value: 'light' | 'dark' | ((previous: 'light' | 'dark') => 'light' | 'dark')) => {
    const next = typeof value === 'function' ? value(theme) : value;
    if (window.YukinoTheme) window.YukinoTheme.setMode(next); else setFallback(next);
  };
  return [theme, setTheme] as const;
}
