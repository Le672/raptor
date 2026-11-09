import { useEffect, useState, useSyncExternalStore } from 'react';
// Keep React resolved within JM's independent workspace (React 19).
type Theme = 'light' | 'dark';
const api = () => (window as Window & { YukinoTheme?: { getState(): { theme: Theme }; setMode(mode: Theme): void } }).YukinoTheme;
const subscribe = (notify: () => void) => { window.addEventListener('yukino-theme-change', notify); return () => window.removeEventListener('yukino-theme-change', notify); };
export function useAppearance(initial: Theme = 'light') {
  const [fallback, setFallback] = useState(initial);
  const theme = useSyncExternalStore<Theme>(subscribe, () => api()?.getState().theme || fallback, () => initial);
  useEffect(() => { if (!api()) document.documentElement.dataset.jmTheme = fallback; }, [fallback]);
  return [theme, (value: Theme | ((previous: Theme) => Theme)) => {
    const next = typeof value === 'function' ? value(theme) : value;
    if (api()) api()?.setMode(next); else setFallback(next);
  }] as const;
}
