const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

const sellerPortalUrl = 'https://www.view2connect.ng/seller-portal/';
const allowedHosts = new Set(['view2connect.ng', 'www.view2connect.ng']);

function isView2ConnectUrl(url) {
  try {
    return allowedHosts.has(new URL(url).hostname);
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
    backgroundColor: '#F7F5FC',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => window.show());
  window.loadURL(sellerPortalUrl);

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isView2ConnectUrl(url)) {
      window.loadURL(url);
      return { action: 'deny' };
    }

    void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (isView2ConnectUrl(url)) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(url);
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId('ng.view2connect.sellerportal');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
