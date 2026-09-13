/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  dialog,
  globalShortcut,
  nativeImage,
  Menu,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const TL = require('./core');
const { hudRegions } = require('./window-shape');
let overlayFrames = [],
  overlayDragging = false;
const { Store } = require('./storage');
const selfTest = process.argv.includes('--self-test');
app.setName('Tablelight');
if (selfTest)
  app.setPath(
    'userData',
    path.resolve(process.env.TABLELIGHT_TEST_DATA || path.join(__dirname, 'test-data'))
  );
else app.setPath('userData', path.join(app.getPath('appData'), 'Tablelight'));
let controller,
  overlay,
  store,
  state,
  warning = '',
  overlayVisible = false,
  overlayHit = false;
const hudRequests = new Map();
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (controller) {
      if (controller.isMinimized()) controller.restore();
      controller.show();
      controller.focus();
    }
  });
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    store = new Store(app.getPath('userData'));
    try {
      ({ state, warning } = store.load());
    } catch (error) {
      dialog.showErrorBox('Tablelight — saved party needs attention', error.message);
      app.quit();
      return;
    }
    if (state.settings.hudControlsVersion < 1) {
      state.settings.soloExpand = false;
      state.settings.overlayInteractive = true;
      state.settings.hudControlsVersion = 1;
      try {
        state = store.save(state);
      } catch (error) {
        dialog.showErrorBox('Tablelight — unable to update your saved party', error.message);
        app.quit();
        return;
      }
    }
    createController();
    registerIPC();
    globalShortcut.register('Control+Alt+H', () => setOverlay(false));
    globalShortcut.register('Control+Alt+O', () => setOverlay(!overlayVisible));
    globalShortcut.register('Control+Alt+I', () =>
      requestHudCommand({ type: 'interactive' }).catch(() => {})
    );
    screen.on('display-added', displaysChanged);
    screen.on('display-removed', displaysChanged);
    screen.on('display-metrics-changed', displaysChanged);
    if (selfTest)
      controller.webContents.once('did-finish-load', () =>
        require('./tests/native-test')({
          app,
          controller,
          getOverlay: () => overlay,
          getState: () => state,
          screen,
          setOverlay,
          store,
        })
      );
  });
}
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => globalShortcut.unregisterAll());
function safeWindow(options) {
  const win = new BrowserWindow({
    ...options,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false)
  );
  return win;
}
function createController() {
  const b = screen.getPrimaryDisplay().workArea;
  controller = safeWindow({
    title: `Tablelight ${app.getVersion()} — DM Console`,
    width: Math.min(1480, b.width),
    height: Math.min(940, b.height),
    minWidth: 940,
    minHeight: 660,
    backgroundColor: '#0d1517',
    show: false,
    icon: path.join(__dirname, 'icon.png'),
  });
  // Keep the installed version visible when the HTML document sets its own title.
  controller.on('page-title-updated', (event) => event.preventDefault());
  controller.loadFile(path.join(__dirname, 'index.html'));
  controller.once('ready-to-show', () => {
    if (!selfTest) controller.show();
  });
  controller.on('closed', () => {
    controller = null;
    if (overlay && !overlay.isDestroyed()) overlay.destroy();
  });
}
function displays() {
  return screen.getAllDisplays().map((d, i) => ({
    id: String(d.id),
    name: d.label || 'Display ' + (i + 1),
    primary: d.id === screen.getPrimaryDisplay().id,
    width: d.bounds.width,
    height: d.bounds.height,
    scaleFactor: d.scaleFactor,
  }));
}
function chosenDisplay() {
  return (
    screen.getAllDisplays().find((d) => String(d.id) === state.settings.displayId) ||
    screen.getAllDisplays().find((d) => d.id !== screen.getPrimaryDisplay().id) ||
    screen.getPrimaryDisplay()
  );
}
function status() {
  return {
    visible: overlayVisible,
    interactive: state.settings.overlayInteractive,
    displayId: overlayVisible ? String(chosenDisplay().id) : null,
  };
}
function sendStatus() {
  for (const win of [controller, overlay])
    if (win && !win.isDestroyed()) win.webContents.send('display:status', status());
}
function setOverlayHit(hit) {
  overlayHit = Boolean(hit) && state.settings.overlayInteractive;
  if (overlay && !overlay.isDestroyed())
    overlay.setIgnoreMouseEvents(!overlayHit, { forward: true });
}
function updateOverlayShape(regions) {
  if (!overlay || overlay.isDestroyed()) return;
  const interactive = overlayVisible && state.settings.overlayInteractive;
  if (!interactive) {
    overlay.setShape([]);
    setOverlayHit(false);
    return;
  }
  const bounds = overlay.getBounds();
  regions ??= hudRegions(overlayFrames, bounds.width, bounds.height);
  overlay.setShape(overlayDragging ? [] : regions);
  setOverlayHit(overlayDragging || regions.length > 0);
}
function requestHudCommand(command) {
  if (!controller || controller.isDestroyed())
    return Promise.reject(new Error('The DM console is closed.'));
  return new Promise((resolve, reject) => {
    const id = TL.uid();
    const timer = setTimeout(() => {
      hudRequests.delete(id);
      reject(new Error('The DM console did not respond. Try again.'));
    }, 10000);
    hudRequests.set(id, { resolve, reject, timer });
    controller.webContents.send('hud:request', { id, command });
  });
}
function createOverlay() {
  overlayFrames = [];
  overlayDragging = false;
  overlay = safeWindow({
    ...chosenDisplay().bounds,
    title: 'Tablelight · Player HUD',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: state.settings.overlayInteractive,
    resizable: false,
    movable: false,
    hasShadow: false,
    show: false,
  });
  setOverlayHit(false);
  overlay.setFocusable(state.settings.overlayInteractive);
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.loadFile(path.join(__dirname, 'overlay.html'));
  overlay.once('ready-to-show', () => {
    if (overlayVisible) {
      overlay.showInactive();
      overlay.setBounds(chosenDisplay().bounds);
    }
  });
  overlay.on('closed', () => {
    overlay = null;
    overlayVisible = false;
    sendStatus();
  });
}
function setOverlay(visible) {
  overlayVisible = Boolean(visible);
  if (overlayVisible) {
    if (!overlay || overlay.isDestroyed()) createOverlay();
    else {
      overlay.setBounds(chosenDisplay().bounds);
      overlay.showInactive();
    }
  } else if (overlay && !overlay.isDestroyed()) {
    overlay.hide();
    setOverlayHit(false);
  }
  updateOverlayShape();
  sendStatus();
  return status();
}
function displaysChanged() {
  if (
    overlayVisible &&
    !screen.getAllDisplays().some((d) => String(d.id) === state.settings.displayId)
  )
    setOverlay(false);
  if (overlayVisible && overlay) overlay.setBounds(chosenDisplay().bounds);
  if (controller) controller.webContents.send('display:changed', displays());
}
function auth(event) {
  if (!controller || event.sender.id !== controller.webContents.id)
    throw new Error('This control is only available in the DM window.');
}
function registerIPC() {
  ipcMain.handle('app:license', (event) => {
    auth(event);
    return fs.readFileSync(path.join(__dirname, 'LICENSE'), 'utf8');
  });
  ipcMain.handle('party:load', (event) => ({
    state:
      controller && event.sender.id === controller.webContents.id ? state : TL.overlayState(state),
    warning: controller && event.sender.id === controller.webContents.id ? warning : '',
    native: true,
    status: status(),
    dataPath: store.directory,
    version: app.getVersion(),
  }));
  ipcMain.handle('party:save', (event, raw) => {
    auth(event);
    const mode = state.settings.overlayInteractive;
    state = store.save(raw);
    if (overlay && mode !== state.settings.overlayInteractive)
      overlay.setFocusable(state.settings.overlayInteractive);
    if (!state.settings.overlayInteractive) overlayDragging = false;
    if (overlay) overlay.webContents.send('party:state', TL.overlayState(state));
    // Painted geometry updates the native region; ordinary stat saves leave it alone.
    if (mode !== state.settings.overlayInteractive) {
      updateOverlayShape();
      sendStatus();
    }
    return { ok: true };
  });
  ipcMain.on('hud:regions', (event, frames) => {
    if (!overlay || event.sender.id !== overlay.webContents.id) return;
    try {
      const bounds = overlay.getBounds();
      const regions = hudRegions(frames, bounds.width, bounds.height);
      overlayFrames = frames;
      updateOverlayShape(regions);
    } catch {
      /* Ignore malformed renderer geometry. */
    }
  });
  ipcMain.on('hud:dragging', (event, active) => {
    if (!overlay || event.sender.id !== overlay.webContents.id) return;
    overlayDragging = active === true && state.settings.overlayInteractive;
    updateOverlayShape();
  });
  ipcMain.handle('hud:scroll', (event, command) => {
    auth(event);
    if (
      !command ||
      !state.characters.some((c) => c.id === command.characterId) ||
      !['summary', 'section'].includes(command.area) ||
      ![-1, 1].includes(command.direction)
    )
      throw new Error('Choose a party member and a valid HUD scroll control.');
    if (overlay)
      overlay.webContents.send('hud:scroll', {
        characterId: command.characterId,
        area: command.area,
        direction: command.direction,
      });
    return { ok: true };
  });
  ipcMain.handle('hud:command', (event, command) => {
    if (!overlay || event.sender.id !== overlay.webContents.id)
      throw new Error('This control is only available in the overlay.');
    if (!state.settings.overlayInteractive)
      throw new Error('The overlay is in click-through mode.');
    return requestHudCommand(command);
  });
  ipcMain.handle('hud:conditions', (event, query) => {
    if (
      !overlay ||
      event.sender.id !== overlay.webContents.id ||
      !state.settings.overlayInteractive
    )
      throw new Error('Condition selection is only available on the interactive overlay.');
    return TL.searchConditions(state, query);
  });
  ipcMain.on('hud:result', (event, result) => {
    auth(event);
    const request = hudRequests.get(result?.id);
    if (!request) return;
    clearTimeout(request.timer);
    hudRequests.delete(result.id);
    if (result.error) request.reject(new Error(result.error));
    else request.resolve({ ok: true });
  });
  ipcMain.handle('display:list', () => displays());
  ipcMain.handle('display:overlay', (event, options) => {
    auth(event);
    if (options.displayId != null) {
      const id = String(options.displayId);
      if (!displays().some((d) => d.id === id))
        throw new Error('That display is no longer connected.');
      state.settings.displayId = id;
      store.save(state);
    }
    return setOverlay(options.visible);
  });
  ipcMain.handle('file:avatar', async (event) => {
    auth(event);
    const result = await dialog.showOpenDialog(controller, {
      title: 'Choose a character portrait',
      properties: ['openFile'],
      filters: [{ name: 'Portrait images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    if (fs.statSync(file).size > 25 * 1024 * 1024)
      throw new Error('Choose an image smaller than 25 MB.');
    let image = nativeImage.createFromPath(file);
    if (image.isEmpty()) throw new Error('This image could not be opened. Use PNG, JPG, or WebP.');
    const size = image.getSize();
    image = image.resize(size.width > size.height ? { width: 512 } : { height: 512 });
    return 'data:image/png;base64,' + image.toPNG().toString('base64');
  });
  ipcMain.handle('file:export', async (event) => {
    auth(event);
    const result = await dialog.showSaveDialog(controller, {
      title: 'Back up your party',
      defaultPath: 'Tablelight-party-' + new Date().toISOString().slice(0, 10) + '.json',
      filters: [{ name: 'Tablelight party backup', extensions: ['json'] }],
    });
    if (result.canceled) return false;
    fs.writeFileSync(result.filePath, JSON.stringify(TL.toBackup(state), null, 2), 'utf8');
    return true;
  });
  ipcMain.handle('file:import', async (event) => {
    auth(event);
    const result = await dialog.showOpenDialog(controller, {
      title: 'Restore a party backup',
      properties: ['openFile'],
      filters: [{ name: 'Tablelight party backup', extensions: ['json'] }],
    });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    return TL.normalize(JSON.parse(fs.readFileSync(file, 'utf8')));
  });
}
