const { app, BrowserWindow, dialog, net, protocol, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([{
  scheme: 'yukino',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

const root = path.resolve(__dirname, 'dist');

function registerLocalProtocol() {
  protocol.handle('yukino', request => {
    const url = new URL(request.url);
    if (url.hostname !== 'desktop') return new Response('Not found', { status: 404 });
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); }
    catch { return new Response('Bad path', { status: 400 }); }
    const file = path.resolve(root, `.${pathname === '/' ? '/desktop.html' : pathname}`);
    if (file !== root && !file.startsWith(root + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 820,
    minHeight: 620,
    show: false,
    title: 'Yukino 漫画书房',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#171a1f',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('yukino://desktop/')) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    }
  });
  if (process.env.YUKINO_DESKTOP_SMOKE_FILE) {
    win.webContents.once('did-finish-load', async () => {
      let result;
      try {
        result = await win.webContents.executeJavaScript(`(async () => {
          await new Promise(resolve => setTimeout(resolve, 600));
          const response = await fetch('https://jm-api-yukino.3584643854.workers.dev/v1/health');
          return { title: document.title, workspace: !!document.querySelector('.jm-desktop'),
            secureContext: isSecureContext, opfs: typeof navigator.storage.getDirectory === 'function',
            apiStatus: response.status };
        })()`);
      } catch (error) { result = { error: String(error) }; }
      fs.writeFileSync(process.env.YUKINO_DESKTOP_SMOKE_FILE, JSON.stringify(result, null, 2));
      app.quit();
    });
  }
  win.loadURL('yukino://desktop/desktop.html');
}

app.whenReady().then(() => {
  registerLocalProtocol();
  session.defaultSession.on('will-download', (event, item, webContents) => {
    const owner = BrowserWindow.fromWebContents(webContents);
    const options = {
      title: '保存漫画文件',
      defaultPath: path.join(app.getPath('downloads'), item.getFilename()),
      buttonLabel: '保存',
    };
    const result = owner ? dialog.showSaveDialogSync(owner, options) : dialog.showSaveDialogSync(options);
    if (result) item.setSavePath(result);
    else event.preventDefault();
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
