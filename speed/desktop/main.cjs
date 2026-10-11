const { app, BrowserWindow, ipcMain, shell, Menu, powerSaveBlocker, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createSystemFetch } = require('./system-fetch.cjs');
let nativeFetch;
let window, runner, reporter, storage, records = {}, blocker, saveAt = 0;
app.setName('Yukino Speed');
const ownWindow = event => { if (!window || event.sender !== window.webContents) throw new Error('无效的客户端'); };
function writeJson(name, value) {
  const target = path.join(app.getPath('userData'), name); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target + '.tmp', JSON.stringify(value), 'utf8'); fs.renameSync(target + '.tmp', target);
}
function readJson(name, fallback) { try { return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), name), 'utf8')); } catch { return fallback; } }
async function init() {
  nativeFetch = createSystemFetch(session.fromPartition('yukino-speed-download', { cache: false }));
  const { SERVERS } = await import(pathToFileURL(path.join(__dirname, '../src/servers.mjs')).href);
  const sourceLinks = new Set(SERVERS.map(server => server.source).filter(Boolean));
  const openAllowed = address => { try { const url = new URL(address); return url.protocol === 'https:' && (['github.com', 'www.yukino.bond'].includes(url.hostname) || sourceLinks.has(url.href)); } catch { return false; } };
  const { DownloadRunner, validateConfig } = await import(pathToFileURL(path.join(__dirname, '../src/engine.mjs')).href);
  const { Reporter } = await import(pathToFileURL(path.join(__dirname, '../src/storage.mjs')).href);
  records = readJson('runs.json', {}); storage = readJson('reports.json', {});
  Object.defineProperties(storage, {
    getItem: { value: key => storage[key] ?? null },
    setItem: { value: (key, value) => { storage[key] = value; writeJson('reports.json', storage); } },
    removeItem: { value: key => { delete storage[key]; writeJson('reports.json', storage); } },
  });
  reporter = new Reporter(['https://speed.yukino.bond/api/speed', 'https://yukino-speed.pages.dev/api/speed'], () => {}, storage);
  runner = new DownloadRunner({ fetcher: nativeFetch, onUpdate: state => {
    if (state.id && (state.status !== 'running' || Date.now() - saveAt > 1000)) {
      saveAt = Date.now(); const { history, workers, ...record } = state; records[state.id] = record;
      try { writeJson('runs.json', records); reporter.enqueue(state); } catch { state.message = '本机统计写入失败，请检查用户目录的可写权限。'; }
      if (state.status !== 'running') void reporter.flush();
    }
    if (state.status === 'running' && blocker === undefined) blocker = powerSaveBlocker.start('prevent-app-suspension');
    if (state.status !== 'running' && blocker !== undefined) { powerSaveBlocker.stop(blocker); blocker = undefined; }
    if (window && !window.isDestroyed()) window.webContents.send('speed:state', state);
  } });
  for (const command of ['pause', 'resume', 'stop']) ipcMain.handle('speed:' + command, event => { ownWindow(event); runner[command](); return runner.snapshot(); });
  ipcMain.handle('speed:start', (event, config) => { ownWindow(event); return runner.start(config); });
  ipcMain.handle('speed:limits', (event, limits) => { ownWindow(event); const { limitBytes, rateBps, durationMs } = limits || {}; runner.updateLimits({ limitBytes, rateBps, durationMs }); return runner.snapshot(); });
  ipcMain.handle('speed:state', event => { ownWindow(event); return runner.snapshot(); });
  ipcMain.handle('speed:records', event => { ownWindow(event); return Object.values(records); });
  ipcMain.handle('speed:probe', async (event, address) => {
    ownWindow(event); const config = validateConfig(typeof address === 'string' ? { url: address } : { url: address?.url, referrer: address?.referrer }); const url = new URL(config.url);
    if (url.hostname === 'speed.cloudflare.com' && url.pathname === '/__down') url.searchParams.set('bytes', '0');
    const begin = performance.now(); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
    try { const response = await nativeFetch(url.href, { method: 'HEAD', signal: controller.signal, headers: config.referrer ? { Referer: config.referrer } : {} }); await response.body?.cancel(); if (!response.ok) throw new Error('HTTP ' + response.status); return { status: response.status, ms: performance.now() - begin }; }
    finally { clearTimeout(timeout); }
  });
  const bounds = readJson('window.json', {});
  window = new BrowserWindow({ width: Number(bounds.width) || 1220, height: Number(bounds.height) || 950, minWidth: 380, minHeight: 550,
    ...(Number.isFinite(bounds.x) && Number.isFinite(bounds.y) ? { x: bounds.x, y: bounds.y } : {}),
    title: 'Yukino Speed', icon: path.join(__dirname, '../dist/icon.ico'), backgroundColor: '#f8f9f5', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false },
  });
  window.webContents.setWindowOpenHandler(({ url }) => { if (openAllowed(url)) void shell.openExternal(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, address) => { if (address !== pathToFileURL(path.join(__dirname, '../dist/index.html')).href) { event.preventDefault(); if (openAllowed(address)) void shell.openExternal(address); } });
  window.on('close', () => { runner.stop(); try { writeJson('window.json', window.getBounds()); } catch {} });
  window.once('ready-to-show', () => { if (!process.argv.includes('--smoke')) window.show(); });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Yukino Speed', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'quit' }] }, { role: 'editMenu' }, { role: 'viewMenu' }]));
  await window.loadFile(path.join(__dirname, '../dist/index.html'));
  const timer = setInterval(() => void reporter.flush(), 5000); timer.unref(); void reporter.flush();
  // The packaged smoke uses only built-in, bounded public sources and records real bytes.
  if (process.argv.includes('--smoke')) {
    const sourceId = process.argv.find(value => value.startsWith('--smoke-source='))?.split('=')[1] || 'cloudflare';
    const selected = SERVERS.find(server => server.id === sourceId && server.url);
    if (!selected) throw new Error('无效的内置核验源');
    const proof = { version: app.getVersion(), packaged: app.isPackaged, sourceId,
      bridge: await window.webContents.executeJavaScript('typeof window.yukinoSpeed?.start'), title: window.getTitle(),
      catalog: await window.webContents.executeJavaScript("Array.from(document.querySelector(\"select[aria-label=\\\"下载服务器\\\"]\").options).map(option => ({id:option.value,label:option.textContent}))") };
    runner.start({ url: selected.url, kind: selected.kind, referrer: selected.referrer, cacheBust: selected.cacheBust !== false, threads: 2, limitBytes: 1_000_000, rateBps: 500_000, durationMs: 20000 });
    await runner.task;
    const syncDeadline = Date.now() + 12000;
    while (Date.now() < syncDeadline && (reporter.busy || Object.keys(storage).some(key => key.startsWith('yukino-speed:report:')))) {
      await reporter.flush(); await new Promise(resolve => setTimeout(resolve, 200));
    }
    proof.result = runner.snapshot(); proof.result.history = []; proof.blockerActive = blocker !== undefined;
    writeJson('smoke.json', proof); app.quit();
  }

}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(init).catch(error => { console.error(error.message); app.quit(); });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { runner?.stop(); });
}
