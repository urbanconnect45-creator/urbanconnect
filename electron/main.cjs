const { app, BrowserWindow, shell } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const allowedRemoteHosts = new Set(['view2connect.ng', 'www.view2connect.ng']);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

let localOrigin = '';
let webServer;
const openWindows = new Set();

if (process.env.VIEW2CONNECT_DESKTOP_DEBUG_PORT) {
  app.commandLine.appendSwitch(
    'remote-debugging-port',
    process.env.VIEW2CONNECT_DESKTOP_DEBUG_PORT,
  );
}

function resolveWebRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'web')
    : path.resolve(__dirname, '..', 'dist');
}

function resolveRequestFile(webRoot, requestUrl) {
  const requestPath = decodeURIComponent(new URL(requestUrl, 'http://127.0.0.1').pathname);
  const relativePath = requestPath.replace(/^\/+/, '');
  const candidates = [];

  if (!relativePath || requestPath.endsWith('/')) {
    candidates.push(path.join(webRoot, relativePath, 'index.html'));
  } else {
    candidates.push(path.join(webRoot, relativePath));
    candidates.push(path.join(webRoot, relativePath, 'index.html'));
  }

  const normalizedRoot = path.resolve(webRoot);
  return candidates.find((candidate) => {
    const normalizedCandidate = path.resolve(candidate);
    return (
      normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`) &&
      fs.existsSync(normalizedCandidate) &&
      fs.statSync(normalizedCandidate).isFile()
    );
  });
}

function startWebServer() {
  const webRoot = resolveWebRoot();

  return new Promise((resolve, reject) => {
    webServer = http.createServer((request, response) => {
      const filePath = resolveRequestFile(webRoot, request.url ?? '/');

      if (!filePath) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }

      response.writeHead(200, {
        'Cache-Control': 'no-cache',
        'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      });
      fs.createReadStream(filePath).pipe(response);
    });

    webServer.once('error', reject);
    webServer.listen(0, '127.0.0.1', () => {
      const address = webServer.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to start the View2Connect desktop runtime.'));
        return;
      }

      localOrigin = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
}

function isInternalUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin === localOrigin || allowedRemoteHosts.has(parsed.hostname);
  } catch {
    return false;
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    title: 'View2Connect Seller Portal',
    backgroundColor: '#10081F',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  openWindows.add(window);
  window.on('closed', () => openWindows.delete(window));

  window.once('ready-to-show', () => window.show());
  window.webContents.setZoomFactor(0.9);
  window.webContents.on('did-finish-load', () => window.webContents.setZoomFactor(0.9));
  window.webContents.setUserAgent(`${window.webContents.getUserAgent()} View2ConnectSellerDesktop/1.0.4`);
  void window.loadURL(`${localOrigin}/seller-portal/?desktopApp=1`);

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url)) {
      void window.loadURL(url);
      return { action: 'deny' };
    }

    void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (isInternalUrl(url)) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(url);
  });
}

app.whenReady().then(async () => {
  app.setAppUserModelId('ng.view2connect.sellerportal');
  await startWebServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  webServer?.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
