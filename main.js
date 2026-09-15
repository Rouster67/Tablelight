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
  shell,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const TL = require('./core');
const { packImages, unpackImages } = require('./preload');
const { Service: ApprovalService } = require('./approval-service');
let approvals;
const { hudRegions } = require('./window-shape');
let overlayFrames = [],
  overlayDragging = false;
const { Store } = require('./storage');
const { readIcon, decodeInWindow } = require('./image-import');
const { UpdatePreferences, UpdateService } = require('./update-service');
const packageInfo = require('./package.json');
const updateFixture = packageInfo.name === 'tablelight-update-test' ? packageInfo.updateTest : null;
const selfTest = process.argv.includes('--self-test') || Boolean(updateFixture);
app.setName(updateFixture ? 'Tablelight Update Test' : 'Tablelight');
app.setAppUserModelId(
  updateFixture ? 'io.github.rouster67.tablelight.updatetest' : 'io.github.rouster67.tablelight'
);
if (selfTest)
  app.setPath(
    'userData',
    updateFixture
      ? path.join(updateFixture.root, 'data')
      : path.resolve(process.env.TABLELIGHT_TEST_DATA || path.join(__dirname, 'test-data'))
  );
else app.setPath('userData', path.join(app.getPath('appData'), 'Tablelight'));
let controller,
  overlay,
  store,
  state,
  warning = '',
  overlayVisible = false,
  overlayHit = false;
let updates,
  updateLock = false,
  updateTimer;
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
    approvals = new ApprovalService(state, {
      save: (next) => store.save(next),
      onChange: (snapshot, change) => {
        const mode = state.settings.overlayInteractive;
        state = snapshot.state;
        if (controller && !controller.isDestroyed())
          controller.webContents.send('approval:state', packImages({ ...snapshot, change }));
        if (overlay && !overlay.isDestroyed()) {
          overlay.webContents.send('party:state', packImages(approvals.overlayState()));
          if (mode !== state.settings.overlayInteractive)
            overlay.setFocusable(state.settings.overlayInteractive);
        }
        if (!state.settings.overlayInteractive) overlayDragging = false;
        if (mode !== state.settings.overlayInteractive) {
          updateOverlayShape();
          sendStatus();
        }
      },
    });
    const installed =
      process.platform === 'win32' &&
      app.isPackaged &&
      fs.existsSync(path.join(process.resourcesPath, 'tablelight-installed'));
    let updateAdapter = null;
    if (updateFixture)
      updateAdapter = require('./tests/installed-update-native').makeAdapter(app, updateFixture);
    else if (selfTest && process.env.TABLELIGHT_TEST_SCENARIO === 'updates')
      updateAdapter = require('./tests/updates-native').makeAdapter();
    else if (!selfTest && installed)
      updateAdapter = new (require('./update-adapter').UpdateAdapter)();
    updates = new UpdateService({
      version: app.getVersion(),
      preferences: new UpdatePreferences(app.getPath('userData')),
      adapter: updateAdapter,
      beforeInstall: async () => {
        updateLock = true;
        try {
          await requestHudCommand({ type: 'prepare-update' });
        } catch (error) {
          updateLock = false;
          throw error;
        }
      },
      installFailed: () => {
        updateLock = false;
      },
    });
    updates.on('change', (value) => {
      if (controller && !controller.isDestroyed())
        controller.webContents.send('updates:state', value);
    });
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
        (updateFixture
          ? require('./tests/installed-update-native')
          : require('./tests/native-test'))({
          app,
          controller,
          getOverlay: () => overlay,
          getState: () => state,
          screen,
          setOverlay,
          store,
          updates,
          updateAdapter,
          updateFixture,
        })
      );
  });
}
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => {
  clearTimeout(updateTimer);
  updates?.dispose();
  globalShortcut.unregisterAll();
});
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
    if (!selfTest) updateTimer = setTimeout(() => updates.check(true), 1500);
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
  if (updateLock && command.type !== 'prepare-update')
    return Promise.reject(
      new Error('Tablelight is saving before an update. Try again after it restarts.')
    );
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
  for (const [channel, handler] of [
    ['updates:status', () => updates.snapshot()],
    ['updates:enabled', (enabled) => updates.setEnabled(enabled)],
    ['updates:check', () => updates.check()],
    ['updates:dismiss', () => updates.dismiss()],
    ['updates:download', () => updates.update()],
    ['updates:cancel', () => updates.cancelDownload()],
    [
      'updates:release-page',
      () => shell.openExternal('https://github.com/Rouster67/Tablelight/releases/latest'),
    ],
  ])
    ipcMain.handle(channel, (event, value) => {
      auth(event);
      return handler(value);
    });
  ipcMain.handle('app:license', (event) => {
    auth(event);
    return fs.readFileSync(path.join(__dirname, 'LICENSE'), 'utf8');
  });
  ipcMain.handle('party:load', (event) => {
    const dm = controller && event.sender.id === controller.webContents.id;
    if (!dm && (!overlay || event.sender.id !== overlay.webContents.id))
      throw new Error('Unknown Tablelight window.');
    return packImages({
      ...(dm ? approvals.snapshot() : { state: approvals.overlayState() }),
      warning: dm ? warning : '',
      native: true,
      status: status(),
      dataPath: dm ? store.directory : undefined,
      version: app.getVersion(),
      updates: dm ? updates.snapshot() : undefined,
    });
  });
  ipcMain.handle('party:save', (event, raw) => {
    auth(event);
    return approvals.change({ edited: unpackImages(raw) }).then(packImages);
  });
  ipcMain.handle('party:change', (event, value) => {
    auth(event);
    return approvals.change(unpackImages(value)).then(packImages);
  });
  ipcMain.handle('party:undo', (event) => {
    auth(event);
    return approvals.undo().then(packImages);
  });
  ipcMain.handle('party:flush', (event) => {
    auth(event);
    return approvals.flush();
  });
  ipcMain.handle('approval:command', (event, value) => {
    auth(event);
    return approvals.command(unpackImages(value)).then(packImages);
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
    if (updateLock)
      throw new Error('Tablelight is saving before an update. Try again after it restarts.');
    if (!command || typeof command !== 'object') throw new Error('Invalid HUD control.');
    return approvals
      .hud({ sessionId: approvals.snapshot().approvals.id, commandId: TL.uid(), ...command })
      .then((value) => ({ result: value.result }));
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
  ipcMain.handle('display:overlay', async (event, options) => {
    auth(event);
    if (options.displayId != null) {
      const id = String(options.displayId);
      if (!displays().some((d) => d.id === id))
        throw new Error('That display is no longer connected.');
      if (state.settings.displayId !== id) {
        const edited = TL.clone(state);
        edited.settings.displayId = id;
        await approvals.change({ base: state, edited });
      }
    }
    return setOverlay(options.visible);
  });
  let iconImportBusy = false;
  ipcMain.handle('file:ability-icon', async (event) => {
    auth(event);
    if (iconImportBusy) throw new Error('An ability image is already being opened.');
    iconImportBusy = true;
    try {
      const result = await dialog.showOpenDialog(controller, {
        title: 'Choose an ability icon',
        properties: ['openFile'],
        filters: [{ name: 'Ability images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });
      if (result.canceled) return null;
      return await readIcon(result.filePaths[0], (data) => decodeInWindow(data, BrowserWindow));
    } finally {
      iconImportBusy = false;
    }
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
    return packImages(store.validate(JSON.parse(fs.readFileSync(file, 'utf8'))));
  });
}
