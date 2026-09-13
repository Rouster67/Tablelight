/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
module.exports = async ({ app, controller, store, updates, updateFixture }) => {
  const root = updateFixture.root;
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (fn) => {
    for (let i = 0; i < 200; i++) {
      if (await fn()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('Installed update UI timed out.');
  };
  try {
    assert.ok(fs.existsSync(path.join(process.resourcesPath, 'tablelight-installed')));
    await wait(() => run("return Boolean(document.querySelector('[data-action=add-character]'));"));
    assert.equal(updates.snapshot().supported, true);
    controller.showInactive();
    if (app.getVersion() === '0.0.1') {
      await run('commit(()=>{selected().hp=22;});await saveQueue;');
      await updates.check(true);
      assert.equal(updates.availableVersion, '0.0.2');
      await wait(() => run("return Boolean(document.getElementById('update-dialog'));"));
      updates.setEnabled(false);
      updates.on('change', (value) => {
        if (value.phase === 'installing')
          fs.copyFileSync(store.file, path.join(root, 'before-install.json'));
        if (value.message && !['checking', 'current'].includes(value.phase))
          fs.writeFileSync(path.join(root, 'update-error.txt'), value.message);
      });
      await run("document.querySelector('[data-action=update-download]').click();");
      // The actual updater and installer now close this process and launch version 0.0.2.
    } else {
      assert.equal(app.getVersion(), '0.0.2');
      assert.equal(controller.getTitle(), 'Tablelight 0.0.2 — DM Console');
      assert.deepEqual(
        fs.readFileSync(store.file),
        fs.readFileSync(path.join(root, 'before-install.json'))
      );
      const saved = JSON.parse(fs.readFileSync(store.file));
      assert.equal(saved.characters[0].hp, 22);
      assert.equal(saved.characters[0].notes, 'Private synthetic note survives the update.');
      assert.equal(saved.roster[0].name, 'Synthetic saved player');
      assert.equal(updates.preferences.enabled, false);
      assert.equal(await run('return overlayStatus.visible;'), false);
      fs.writeFileSync(
        path.join(root, 'installed-results.json'),
        JSON.stringify(
          {
            passed: true,
            version: app.getVersion(),
            executable: process.execPath,
            results: [
              'The old installed app checked, downloaded a real NSIS installer, quit, installed the new version in the same directory, and relaunched.',
              'Saved data is byte-for-byte identical across installation, including the latest HP change, private notes, and inactive roster.',
              'The automatic-check preference survives; the new title shows the installed version and the TV overlay starts hidden.',
            ],
          },
          null,
          2
        )
      );
      app.quit();
    }
  } catch (error) {
    fs.writeFileSync(
      path.join(root, 'installed-results.json'),
      JSON.stringify({ passed: false, error: error.stack }, null, 2)
    );
    app.quit();
  }
};
module.exports.makeAdapter = (app, fixture) => {
  const { ElectronAppAdapter } = require('electron-updater/out/ElectronAppAdapter');
  const facade = new ElectronAppAdapter(app);
  Object.defineProperty(facade, 'baseCachePath', { value: path.join(fixture.root, 'cache') });
  return new (require('../update-adapter').UpdateAdapter)({
    testFeed: fixture.feed,
    testApp: facade,
  });
};
