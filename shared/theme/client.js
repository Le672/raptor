/* Shared by every public website, including independently hosted applications. */
(() => {
  'use strict';
  if (window.YukinoTheme) return;
  const root = document.documentElement;
  if (!document.querySelector('link[data-yukino-theme]')) {
    const sheet = document.createElement('link'); sheet.rel = 'stylesheet'; sheet.href = '__YUKINO_THEME_CSS__'; sheet.dataset.yukinoTheme = ''; document.head.append(sheet);
  }
  const validMode = value => ['auto', 'light', 'dark'].includes(value);
  const validZone = value => {
    if (typeof value !== 'string' || value.length > 100) return false;
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
  };
  const cookie = name => { try { return document.cookie.split('; ').find(item => item.startsWith(name + '='))?.slice(name.length + 1); } catch { return undefined; } };
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const cookieMode = cookie('yukino-theme-mode');
  const storedMode = read('yukino-theme-mode');
  // The legacy portal key was an explicit light/dark preference. Other apps
  // wrote their default on startup, so those defaults cannot imply an override.
  let mode = validMode(cookieMode) ? cookieMode : validMode(storedMode) ? storedMode : validMode(read('theme')) ? read('theme') : 'auto';
  let zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let source = 'browser', offset = 0, fetchedAt = 0, inFlight = null, control;
  const nativeTools = location.hostname === 'tools.yukino.bond' && !location.pathname.startsWith('/lab');
  const nativeDraw = location.hostname === 'draw.yukino.bond';
  let nativeSyncing = false, drawingSwitchPending = false, drawingInteractionAt = -Infinity;
  const syncNative = theme => {
    if (nativeTools) {
      try {
        const previous = read('vueuse-color-scheme');
        if (previous !== theme) {
          nativeSyncing = true;
          localStorage.setItem('vueuse-color-scheme', theme);
          window.dispatchEvent(new CustomEvent('vueuse-storage', { detail: { key: 'vueuse-color-scheme', oldValue: previous, newValue: theme, storageArea: localStorage } }));
          nativeSyncing = false;
        }
      } catch { nativeSyncing = false; }
    }
    if (nativeDraw) {
      const canvas = document.querySelector('.excalidraw');
      if (!canvas) { try { localStorage.setItem('excalidraw-theme', theme); } catch { /* Native defaults still work without storage. */ } }
      else if (canvas.classList.contains('theme--dark') !== (theme === 'dark') && !drawingSwitchPending) {
        // Excalidraw's native theme shortcut changes its renderer as well as
        // its menus. Never invert a canvas or rewrite the saved scene.
        drawingSwitchPending = true;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', code: 'KeyD', altKey: true, shiftKey: true, bubbles: true }));
        setTimeout(() => { drawingSwitchPending = false; }, 100);
      }
    } else document.querySelectorAll('.excalidraw').forEach(node => node.classList.toggle('theme--dark', theme === 'dark'));
  };
  const clock = () => Date.now() + offset;
  const hourAt = (at, timeZone) => Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(at));
  const themeAt = (at, timeZone) => { const hour = hourAt(at, timeZone); return hour >= 7 && hour < 19 ? 'light' : 'dark'; };
  let state;
  const apply = () => {
    const theme = mode === 'auto' ? themeAt(clock(), zone) : mode;
    const next = { mode, theme, timeZone: zone, source, now: clock() };
    const changed = !state || ['mode', 'theme', 'timeZone', 'source'].some(key => state[key] !== next[key]);
    state = next;
    if (root.dataset.theme !== theme) root.dataset.theme = theme;
    if (root.dataset.jmTheme !== theme) root.dataset.jmTheme = theme;
    if (root.dataset.yukinoTheme !== theme) root.dataset.yukinoTheme = theme;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    if (root.style.colorScheme !== theme) root.style.colorScheme = theme;
    syncNative(theme);
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => { meta.content = theme === 'dark' ? '#151e29' : '#f8fafc'; });
    if (control) {
      const select = control.querySelector('select');
      if (select.value !== mode) select.value = mode;
      control.querySelector('small').textContent = `${source === 'ip' ? 'IP 时区' : '设备时区（IP 暂不可用）'} · ${zone} · ${theme === 'dark' ? '深色' : '浅色'}`;
    }
    if (changed) window.dispatchEvent(new CustomEvent('yukino-theme-change', { detail: { ...state } }));
  };
  const setMode = value => {
    if (!validMode(value)) return;
    mode = value;
    try { localStorage.setItem('yukino-theme-mode', mode); } catch { /* This visit still works with storage disabled. */ }
    try { document.cookie = `yukino-theme-mode=${mode}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}${/(^|\.)yukino\.bond$/.test(location.hostname) ? '; Domain=yukino.bond' : ''}`; } catch { /* Cookie access is optional. */ }
    apply();
  };
  const refresh = () => {
    if (inFlight) return inFlight;
    if (!['http:', 'https:'].includes(location.protocol)) return Promise.resolve();
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000);
    inFlight = fetch('https://www.yukino.bond/api/theme', { credentials: 'omit', cache: 'no-store', signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Time zone unavailable'); return response.json(); })
      .then(data => {
        if (!validZone(data.timeZone) || data.source !== 'ip') throw new Error('Invalid IP time zone');
        zone = data.timeZone; source = 'ip'; fetchedAt = Date.now();
        if (Number.isFinite(data.now)) offset = data.now - Date.now();
        apply();
      }).catch(() => {
        // A stale IP location must not survive a failed lookup after moving networks.
        zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; source = 'browser'; offset = 0; fetchedAt = Date.now(); apply();
      }).finally(() => { clearTimeout(timer); inFlight = null; });
    return inFlight;
  };
  window.YukinoTheme = { getState: () => ({ ...state, now: clock() }), setMode, refresh, themeAt };
  apply();
  // Native apps may set their old startup theme once. The shared preference is
  // authoritative; native controls call setMode explicitly through the bridge.
  new MutationObserver(() => {
    if (root.dataset.theme !== state.theme || root.dataset.jmTheme !== state.theme || root.dataset.yukinoTheme !== state.theme || root.classList.contains('dark') !== (state.theme === 'dark')) apply();
  }).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-jm-theme', 'data-yukino-theme', 'class'] });
  const mount = () => {
    if (document.querySelector('yukino-theme-control')) return;
    const host = document.createElement('yukino-theme-control');
    host.setAttribute('aria-label', '网站外观');
    const shadow = host.attachShadow({ mode: 'open' });
    // External CSS supports applications that disable inline styles in CSP.
    const stylesheet = document.createElement('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = '__YUKINO_THEME_CSS__'; shadow.append(stylesheet);
    const box = document.createElement('details');
    box.innerHTML = '<summary aria-label="网站外观设置" title="网站外观设置">◐<span>外观</span></summary><div class="panel"><label>网站外观<select aria-label="网站主题"><option value="auto">自动 · 按 IP 时区</option><option value="light">浅色</option><option value="dark">深色</option></select></label><small></small><p>当地 07:00–19:00 浅色，其余时段深色。IP 定位不可用时使用设备时区。</p></div>';
    shadow.append(box); control = box;
    box.querySelector('select').addEventListener('change', event => setMode(event.target.value));
    box.addEventListener('keydown', event => { if (event.key === 'Escape') { box.open = false; box.querySelector('summary').focus(); } });
    document.body.append(host); apply();
    // Apply the native Excalidraw theme when its asynchronously loaded shell arrives.
    new MutationObserver(records => {
      if (records.every(record => record.type === 'attributes' && !record.target.matches('.excalidraw'))) return;
      const canvas = nativeDraw && document.querySelector('.excalidraw');
      if (canvas && !drawingSwitchPending && Date.now() - drawingInteractionAt < 1000 && canvas.classList.contains('theme--dark') !== (state.theme === 'dark')) {
        setMode(canvas.classList.contains('theme--dark') ? 'dark' : 'light');
      } else syncNative(state.theme);
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
  const sync = () => {
    const shared = cookie('yukino-theme-mode'); if (validMode(shared)) mode = shared;
    apply(); if (Date.now() - fetchedAt > 15 * 60 * 1000) void refresh();
  };
  window.addEventListener('focus', sync);
  window.addEventListener('online', () => void refresh());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  window.addEventListener('storage', event => { if (event.key === 'yukino-theme-mode' && validMode(event.newValue)) { mode = event.newValue; apply(); } });
  window.addEventListener('vueuse-storage', event => {
    const change = event.detail;
    if (!nativeTools || nativeSyncing || change?.key !== 'vueuse-color-scheme') return;
    if (change.newValue === 'auto') setMode(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    else if (['light', 'dark'].includes(change.newValue)) setMode(change.newValue);
  });
  document.addEventListener('click', event => { if (nativeDraw && event.isTrusted && event.target.closest?.('.excalidraw')) { drawingInteractionAt = Date.now(); drawingSwitchPending = false; } }, true);
  document.addEventListener('keydown', event => { if (nativeDraw && event.isTrusted && event.altKey && event.shiftKey && event.code === 'KeyD') { drawingInteractionAt = Date.now(); drawingSwitchPending = false; } }, true);
  setInterval(() => { if (!document.hidden) sync(); }, 30000);
  void refresh();
})();
