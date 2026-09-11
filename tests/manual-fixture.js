/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const { BrowserWindow } = require('electron');
const path = require('node:path');
module.exports = async ({ app, controller, screen, setOverlay }) => {
  const wait = async () => {
    for (let i = 0; i < 100; i++) {
      if (
        await controller.webContents.executeJavaScript(
          `Boolean(document.querySelector('[data-action="add-character"]'))`
        )
      )
        return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('UI not ready');
  };
  await wait();
  const underlay = new BrowserWindow({
    ...screen.getPrimaryDisplay().bounds,
    frame: false,
    title: 'Tablelight · Test map',
    backgroundColor: '#202c29',
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  await underlay.loadFile(path.join(__dirname, 'map-fixture.html'));
  underlay.setBounds(screen.getPrimaryDisplay().bounds);
  await controller.webContents.executeJavaScript(
    `(async()=>{commit(()=>{state.characters=Array.from({length:3},(_,i)=>{const c=TL.character(i);c.name='Test player '+(i+1);c.hud.x=20+30*i;c.hud.y=25;c.hud.rotation=i*90;return c;});selectedId=state.characters[0].id;state.activeId=selectedId;state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};state.settings.overlayInteractive=true;state.settings.soloExpand=false;view='display';});await saveQueue;})()`
  );
  controller.setBounds({ width: 1100, height: 760 });
  controller.showInactive();
  setOverlay(true);
  controller.minimize();
  app.once('before-quit', () => {
    if (!underlay.isDestroyed()) underlay.destroy();
  });
};
