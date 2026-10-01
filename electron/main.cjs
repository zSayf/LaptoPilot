const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch (error) {
  // electron-squirrel-startup is optional and may not be available in development
  console.log('electron-squirrel-startup not available, continuing...');
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      // Explicit rather than relying on the Electron>=20 default.
      sandbox: true,
    },
  });

  // Never let remote content load inside an app window.
  //
  // Every retailer link and grounding source renders with target="_blank", so a
  // click would otherwise open a BrowserWindow loading attacker-influenced HTML
  // - with no address bar to signal the user left the app. Send them to the OS
  // browser instead, and refuse any non-http(s) scheme.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        // Swallow the rejection: an unhandled one would terminate the main process.
        Promise.resolve(shell.openExternal(parsed.href)).catch(() => {});
      } else {
        console.warn('Blocked external link with disallowed scheme:', parsed.protocol);
      }
    } catch (error) {
      console.warn('Blocked malformed external URL');
    }
    return { action: 'deny' };
  });

  // Block in-page navigation away from the app itself.
  //
  // Compares the parsed ORIGIN, not the string. A startsWith() check lets
  // "http://localhost:3005@evil.test/" through, because everything before the "@"
  // is userinfo, not the host.
  const DEV_SERVER_ORIGIN = 'http://localhost:3005';
  mainWindow.webContents.on('will-navigate', (event, url) => {
    let allowed = false;
    if (process.env.NODE_ENV === 'development') {
      try {
        allowed = new URL(url).origin === DEV_SERVER_ORIGIN;
      } catch {
        allowed = false;
      }
    }
    if (!allowed) {
      event.preventDefault();
      console.warn('Blocked in-app navigation to:', url);
    }
  });

  // and load the index.html of the app.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3005');
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.