import { useSyncExternalStore } from 'react';
type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let prompt: InstallPrompt | null = null, registration: ServiceWorkerRegistration | null = null, applying = false;
const listeners = new Set<() => void>();
const standalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
let state = { installed: standalone(), installReady: false, installing: false, updateReady: false, offline: typeof navigator !== 'undefined' && navigator.onLine === false, error: '' };
function update(value: Partial<typeof state>) { state = { ...state, ...value }; listeners.forEach(listener => listener()); }
export function usePwa() { return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => state, () => state); }
export const devicePlatform = (): 'ios' | 'android' | 'pc' => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : 'pc';
async function keepStorage() { try { await navigator.storage?.persist?.(); } catch { /* Browser-controlled; never prevents installation. */ } }
export async function installApp() {
  const pending = prompt; if (!pending) return;
  prompt = null; update({ installing: true, installReady: false, error: '' });
  try { await pending.prompt(); const choice = await pending.userChoice; if (choice.outcome === 'accepted') void keepStorage(); }
  catch { update({ error: '未能打开安装窗口，请使用浏览器菜单中的安装选项。' }); }
  finally { update({ installing: false }); }
}
export function applyUpdate() { if (registration?.waiting) { applying = true; registration.waiting.postMessage({ type: 'SKIP_WAITING' }); } }
export async function checkUpdate() { try { await registration?.update(); } catch { update({ error: '暂时无法检查更新，联网后可重试。' }); } }
export function startPwa() {
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); prompt = event as InstallPrompt; update({ installReady: true }); });
  window.addEventListener('appinstalled', () => { prompt = null; update({ installed: true, installReady: false }); void keepStorage(); });
  const mode = window.matchMedia?.('(display-mode: standalone)'); mode?.addEventListener('change', () => update({ installed: standalone() }));
  window.addEventListener('online', () => update({ offline: false })); window.addEventListener('offline', () => update({ offline: true }));
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (applying) window.location.reload(); });
  const register = async () => {
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      if (registration.waiting) update({ updateReady: true });
      registration.addEventListener('updatefound', () => { const installing = registration?.installing; installing?.addEventListener('statechange', () => { if (installing.state === 'installed' && navigator.serviceWorker.controller) update({ updateReady: true }); }); });
      if (standalone()) void keepStorage();
      window.addEventListener('pageshow', () => { if (!document.hidden && navigator.onLine) void checkUpdate(); });
    } catch { update({ error: '应用缓存尚未准备好，请联网刷新后重试安装。' }); }
  };
  if (document.readyState === 'complete') void register(); else window.addEventListener('load', () => { void register(); }, { once: true });
}
