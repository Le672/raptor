(() => {
  'use strict';
  const BUILD = __YUKINO_APPS__;
  if (!['https:', 'http:'].includes(location.protocol) || /Electron/.test(navigator.userAgent) || document.body?.dataset.platform) return;
  const app = BUILD.sites[location.hostname] || BUILD.sites[BUILD.fallback];
  if (!app || window.__YUKINO_APP__) return;
  window.__YUKINO_APP__ = { id: app.id, version: BUILD.version };
  let deferred = null, registration = null, applying = false, user = null, checking = false;
  const installed = () => matchMedia('(display-mode: standalone)').matches || Boolean(navigator.standalone);
  const platform = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'pc';
  let selected = platform(), host, root;
  const nodes = {};
  const hasAccount = app.auth === 'portal' || app.auth === 'content';
  const accountPath = app.auth === 'portal' ? '/api/auth/me' : '/api/access';
  const loginPath = app.auth === 'portal' ? '/api/auth/me?action=login' : '/api/auth/login';
  const logoutPath = app.auth === 'portal' ? '/api/auth/me?action=logout' : '/api/auth/logout';
  const say = (text, error = false) => { if (!nodes.message) return; nodes.message.textContent = text; nodes.message.dataset.error = String(error); };
  function meta(name, content) { let node = document.querySelector(`meta[name="${name}"]`); if (!node) { node = document.createElement('meta'); node.name = name; document.head.append(node); } node.content = content; }
  function link(rel, href, sizes) { for (const old of document.querySelectorAll(`link[rel="${rel}"]`)) old.remove(); const node = document.createElement('link'); node.rel = rel; node.href = href; if (sizes) node.sizes = sizes; document.head.append(node); }
  link('manifest', app.manifest); link('apple-touch-icon', app.apple, '180x180');
  meta('apple-mobile-web-app-capable', 'yes'); meta('mobile-web-app-capable', 'yes');
  meta('apple-mobile-web-app-title', app.short); meta('apple-mobile-web-app-status-bar-style', 'default'); meta('application-name', app.name);
  const viewport = document.querySelector('meta[name="viewport"]'); if (viewport && !viewport.content.includes('viewport-fit')) viewport.content += ', viewport-fit=cover';
  // Fixed upstream tools register their original Workbox script themselves.
  // Redirect only that legacy root registration to this app's current script.
  if (app.bridge && 'serviceWorker' in navigator) {
    const original = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = (url, options = {}) => { const target = new URL(url, location.href); return original(target.origin === location.origin && target.pathname === '/sw.js' ? app.sw : url, { ...options, updateViaCache: 'none' }); };
  }
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferred = event; refresh(); });
  window.addEventListener('appinstalled', () => { deferred = null; refresh(); say('安装完成，可以从设备上的应用图标打开。'); });
  async function status() {
    const response = await fetch(accountPath, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error('登录状态暂时无法验证，已有会话会保留。');
    return (await response.json()).user || null;
  }
  async function checkAccount() {
    if (!hasAccount || checking) return;
    checking = true; nodes.session.textContent = '正在检查此设备的登录状态…';
    try { user = await status(); nodes.session.textContent = user ? `当前账号：${user.name}` : '当前设备尚未登录'; nodes.signin.hidden = Boolean(user); nodes.signout.hidden = !user; }
    catch (error) { nodes.session.textContent = user ? `${user.name} · 等待联网验证` : error.message; }
    finally { checking = false; }
  }
  function signalSession(action) {
    window.dispatchEvent(new CustomEvent('yukino-app-session', { detail: { action } }));
    try { localStorage.setItem('yukino-app-session-event', `${Date.now()}:${Math.random()}`); } catch { /* Cookies remain usable when localStorage is disabled. */ }
  }
  async function signIn(event) {
    event.preventDefault(); if (nodes.submit.disabled) return;
    nodes.submit.disabled = true; say('正在验证登录…');
    try {
      const response = await fetch(loginPath, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: nodes.email.value.trim(), password: nodes.password.value, source: nodes.source.value, remember: true }), signal: AbortSignal.timeout(25000) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || '登录失败，请重试。');
      nodes.password.value = '';
      user = await status(); if (!user) throw new Error('浏览器未保存登录会话，请允许本站 Cookie 后重试。');
      signalSession('login'); await checkAccount(); say('登录成功，此设备会在有效期内恢复会话。');
      if (app.auth === 'content') location.reload();
    } catch (error) { say(error.message || '网络暂时不可用，请稍后再试。', true); }
    finally { nodes.submit.disabled = false; }
  }
  async function signOut() {
    nodes.signout.disabled = true;
    try {
      const response = await fetch(logoutPath, { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('退出失败，请联网后重试。');
      user = null; signalSession('logout'); await checkAccount(); say('已退出此设备，其他设备不受影响。');
      if (app.auth === 'content') location.reload();
    } catch (error) { say(error.message, true); }
    finally { nodes.signout.disabled = false; }
  }
  function refresh() {
    if (!root) return;
    nodes.launcher.title = `${app.name} · 安装与应用`;
    nodes.install.hidden = installed() || selected === 'ios' || !deferred;
    nodes.manual.textContent = installed() ? '正在独立应用窗口中使用' : selected === 'ios' ? 'Safari → 分享 → 添加到主屏幕' : deferred ? '浏览器已准备好安装此应用' : '也可使用浏览器菜单中的安装选项';
    nodes.update.hidden = !registration?.waiting;
    const steps = selected === 'ios' ? ['在 Safari 中打开当前网址。', '点按分享，选择「添加到主屏幕」。', '如出现「作为网页 App 打开」，保持开启并添加。', '从主屏幕打开；需要账户时，在应用内登录一次。']
      : selected === 'android' ? ['用 Chrome 打开当前网址。', '点「安装应用」，在浏览器中完成安装。', '也可使用 Chrome 菜单中的「安装应用」或「添加到主屏幕」。']
      : ['用 Chrome 打开当前网址。', '点「安装应用」或地址栏右侧的安装图标。', '也可在 Chrome 菜单的「投放、保存和分享」中安装；Mac 可用 Safari「文件 → 添加到程序坞」。'];
    nodes.steps.replaceChildren(...steps.map(text => { const item = document.createElement('li'); item.textContent = text; return item; }));
    for (const button of root.querySelectorAll('[data-platform]')) button.setAttribute('aria-pressed', String(button.dataset.platform === selected));
  }
  function open(login = false) { if (!nodes.dialog) return; if (!nodes.dialog.open) nodes.dialog.showModal(); refresh(); if (hasAccount) void checkAccount(); if (login && hasAccount) nodes.account.scrollIntoView({ block: 'nearest' }); }
  function initialise() {
    host = document.createElement('div'); host.id = 'yukino-install-app'; document.body.append(host); root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      :host{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:max(20px,env(safe-area-inset-bottom));z-index:2147482000;font-family:system-ui,'Microsoft YaHei',sans-serif;color:#34465c;color-scheme:light;--panel:#fff;--paper:#f8fafc;--line:#dfe7ef;--ink:#34465c;--muted:#77899b;--blue:#547fa8}*{box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer}button:disabled{opacity:.6;cursor:wait}[hidden]{display:none!important}.launcher{display:flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:24px;background:var(--panel);color:var(--blue);padding:11px 15px;font-size:12px;box-shadow:0 4px 16px #34465c12}.launcher svg{width:16px;height:16px}.launcher:focus-visible,button:focus-visible{outline:2px solid var(--blue);outline-offset:3px}dialog{padding:0;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:17px;width:min(540px,calc(100vw - 26px));max-height:calc(100dvh - 36px);overscroll-behavior:contain}dialog::backdrop{background:#1e304858;backdrop-filter:blur(3px)}.head{display:flex;align-items:center;gap:13px;padding:25px 26px 20px;background:var(--panel);border-bottom:1px solid var(--line)}.head img{width:48px;height:48px;border-radius:13px}.head div{min-width:0;flex:1}.head h2{font-family:'Songti SC','SimSun',serif;font-size:21px;font-weight:500;margin:0 0 6px;overflow-wrap:anywhere}.head p{font-size:10px;letter-spacing:1.5px;color:var(--muted);margin:0}.close{border:0;background:transparent;color:var(--muted);font-size:25px;padding:0 5px}.body{padding:23px 26px}.tabs{display:flex;gap:4px;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:4px}.tabs button{flex:1;padding:10px 5px;border:0;border-radius:5px;background:transparent;color:var(--muted);font-size:12px}.tabs button[aria-pressed=true]{background:#edf4fa;color:#416a93}ol{padding-left:22px;font-size:12px;line-height:1.9;margin:20px 0}li{padding:5px 0}.actions{display:flex;align-items:center;gap:13px;flex-wrap:wrap}.primary{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:11px 15px;border:1px solid var(--blue);border-radius:7px;background:var(--blue);color:white;font-size:12px}.text{padding:6px 0;border:0;background:transparent;color:var(--blue);font-size:12px}.note{font-size:11px;line-height:1.9;color:var(--muted);margin:15px 0}.section{margin-top:23px;padding-top:20px;border-top:1px solid var(--line)}.section h3{font-size:14px;font-weight:500;margin:0 0 11px}.session{font-size:12px;line-height:1.9;color:var(--blue)}label{display:block;font-size:12px;margin:13px 0 7px}input,select{width:100%;padding:10px 11px;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:7px;font-size:14px;min-height:42px}form .primary{width:100%;margin-top:17px}.message{font-size:12px;line-height:1.9;color:var(--blue);margin-bottom:0}.message[data-error=true]{color:#b85572}.version{font-size:10px;line-height:1.8;color:var(--muted);margin-top:22px}.update{margin-top:17px;padding:13px;background:var(--panel);border:1px solid var(--line);border-radius:8px;font-size:12px;line-height:1.8}.update button{margin-left:9px}:host(.dark){--panel:#202a36;--paper:#181f29;--line:#3a4b5e;--ink:#e4edf5;--muted:#a2b3c5;--blue:#7ba3c8;color-scheme:dark}.offline{font-size:11px;color:var(--muted);margin:14px 0 0}@media(max-width:760px){:host{right:14px;bottom:calc(82px + env(safe-area-inset-bottom))}.launcher{width:40px;height:40px;padding:11px;justify-content:center}.launcher span{display:none}.head{padding:20px}.body{padding:20px}.head h2{font-size:19px}input,select{font-size:16px}dialog{max-height:calc(100dvh - 28px)}}
    </style><button class="launcher" aria-label="安装与应用"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/></svg><span>安装应用</span></button><dialog aria-label="安装与应用"><div class="head"><img alt=""><div><h2></h2><p>YOUR APP, ON EVERY DEVICE</p></div><button class="close" aria-label="关闭安装窗口">×</button></div><div class="body"><div class="tabs" role="group" aria-label="安装设备"><button data-platform="ios">iOS / iPadOS</button><button data-platform="android">安卓</button><button data-platform="pc">电脑</button></div><ol></ol><div class="actions"><button class="primary install">安装应用</button><button class="text check-update">检查更新</button></div><p class="note manual"></p><div class="update" hidden>应用有新版本，更新会保留本机数据。<button class="text apply-update">更新应用</button></div><section class="section account"><h3>登录与设备</h3><p class="session"></p><form class="signin"><label>登录方式<select class="source" aria-label="登录方式"><option value="mail">Yukino 邮箱账户</option><option value="local">原主站账户</option></select></label><label>邮箱<input class="email" type="email" autocomplete="username" inputmode="email" maxlength="254" required></label><label>密码<input class="password" type="password" autocomplete="current-password" maxlength="512" required></label><button class="primary submit" type="submit">登录并记住此设备</button></form><button class="text signout" hidden>退出此设备</button><p class="note account-note"></p></section><section class="section"><h3>本机数据与离线使用</h3><p class="note storage-note"></p><p class="offline" hidden>当前离线，实时数据和账户验证需要联网。</p></section><p class="message" role="status" aria-live="polite"></p><p class="version"></p></div></dialog>`;
    const selectors = { launcher: '.launcher', dialog: 'dialog', install: '.install', manual: '.manual', update: '.update', steps: 'ol', account: '.account', session: '.session', signin: '.signin', signout: '.signout', submit: '.submit', email: '.email', password: '.password', source: '.source', message: '.message' };
    for (const [name, selector] of Object.entries(selectors)) nodes[name] = root.querySelector(selector);
    root.querySelector('h2').textContent = app.name; root.querySelector('.head img').src = app.icon;
    root.querySelector('.version').textContent = `${location.hostname} · 应用更新不会清除本机存储。`;
    root.querySelector('.storage-note').textContent = app.onlineOnly ? '安装后可独立打开。上传、下载和私有分享需要联网，应用不缓存文件、口令或私有页面。' : '更新保留此设备的收藏、进度、设置和已有登录数据。离线能力取决于已缓存的页面；实时搜索、播放、收发与身份验证仍需联网。不同设备的本机数据不会自动同步。';
    const descriptions = { portal: '登录默认保留 7 天，关闭重开会检查有效会话。密码不写入网页存储。iOS 安装后请在应用内登录一次。', content: '使用安全 Cookie 记住当前设备 7 天。登录在当前应用内完成，到期或退出后需重新登录。', mail: '邮箱沿用已有的有效登录会话，关闭后重开由邮箱服务验证，到期或退出后需重新登录。', source: '姬漫的书架、阅读进度与翻译配置继续保存在此设备，无需额外的 Yukino 登录。书源要求的验证仍按源站处理。', owner: '工具可直接使用。实验室的私人管理入口沿用现有安全 Cookie 与有效期，请在管理页登录。', upload: '上传仍使用原传送门口令。此安装组件不保存或公开上传口令。', none: '此服务可以直接使用，无需新增账户。' };
    root.querySelector('.account-note').textContent = descriptions[app.auth];
    if (!hasAccount) { nodes.session.hidden = true; nodes.signin.hidden = true; }
    nodes.launcher.addEventListener('click', () => open()); root.querySelector('.close').addEventListener('click', () => nodes.dialog.close());
    nodes.dialog.addEventListener('click', event => { if (event.target === nodes.dialog) { const box = nodes.dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) nodes.dialog.close(); } });
    for (const button of root.querySelectorAll('[data-platform]')) button.addEventListener('click', () => { selected = button.dataset.platform; refresh(); });
    nodes.signin.addEventListener('submit', signIn); nodes.signout.addEventListener('click', () => void signOut());
    nodes.install.addEventListener('click', async () => { const prompt = deferred; if (!prompt) return; deferred = null; nodes.install.disabled = true; try { await prompt.prompt(); const choice = await prompt.userChoice; say(choice.outcome === 'accepted' ? '安装已提交，请从设备上的应用图标打开。' : '已取消安装，之后仍可从这里安装。'); } catch { say('请使用浏览器菜单中的安装选项。'); } finally { nodes.install.disabled = false; refresh(); } });
    root.querySelector('.apply-update').addEventListener('click', () => { if (registration?.waiting) { applying = true; registration.waiting.postMessage({ type: 'SKIP_WAITING' }); } });
    root.querySelector('.check-update').addEventListener('click', async () => { try { if (!registration) { say('应用缓存正在准备，联网后请稍后重试。'); return; } await registration.update(); refresh(); say('已检查应用更新，新版本准备完成后会在这里提示。'); } catch { say('暂时无法检查更新，请联网后重试。', true); } });
    const appearance = () => host.classList.toggle('dark', document.documentElement.dataset.theme === 'dark' || document.documentElement.classList.contains('dark'));
    new MutationObserver(appearance).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] }); appearance();
    const online = () => { root.querySelector('.offline').hidden = navigator.onLine !== false; }; online(); window.addEventListener('online', online); window.addEventListener('offline', online);
    document.addEventListener('fullscreenchange', () => { host.hidden = Boolean(document.fullscreenElement); });
    document.addEventListener('click', event => {
      if (!hasAccount || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest?.('a[href]'); if (!anchor) return; let url; try { url = new URL(anchor.href, location.href); } catch { return; }
      if (url.pathname === '/login' && [location.origin, 'https://www.yukino.bond'].includes(url.origin)) { event.preventDefault(); event.stopPropagation(); open(true); }
    }, true);
    refresh();
    if (new URL(location.href).searchParams.get('yukino-install') === '1') open();
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (applying) location.reload(); });
      navigator.serviceWorker.register(app.sw, { scope: '/', updateViaCache: 'none' }).then(value => {
        registration = value; refresh(); value.addEventListener('updatefound', () => { const worker = value.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed') refresh(); }); });
      }).catch(() => say('应用缓存尚未准备好，请联网刷新后重试安装。', true));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true }); else initialise();
})();
