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
      await run(
        `await messageClient.refresh();await messageClient.command('send',selected().id,{body:'SYNTHETIC_UPDATE_SESSION_MESSAGE'});`
      );
      assert.equal(await run('return (await api.messages()).messages.length;'), 1);
      await updates.check(true);
      assert.equal(updates.availableVersion, '0.0.2');
      await wait(() => run("return Boolean(document.getElementById('update-dialog'));"));
      updates.setEnabled(false);
      updates.on('change', (value) => {
        if (value.phase === 'installing') {
          fs.mkdirSync(path.join(root, 'before-install-data'), { recursive: true });
          for (const name of ['party.json', 'party.previous.json', 'updates.json'])
            fs.copyFileSync(
              path.join(store.directory, name),
              path.join(root, 'before-install-data', name)
            );
          for (const name of ['party.json', 'party.previous.json'])
            assert.equal(
              fs
                .readFileSync(path.join(store.directory, name), 'utf8')
                .includes('SYNTHETIC_UPDATE_SESSION_MESSAGE'),
              false
            );
        }
        if (value.message && !['checking', 'current'].includes(value.phase))
          fs.writeFileSync(path.join(root, 'update-error.txt'), value.message);
      });
      await run("document.querySelector('[data-action=update-download]').click();");
      // The actual updater and installer now close this process and launch version 0.0.2.
    } else {
      assert.equal(app.getVersion(), '0.0.2');
      assert.equal(controller.getTitle(), 'Tablelight 0.0.2 — DM Console');
      for (const name of ['party.json', 'party.previous.json', 'updates.json'])
        assert.deepEqual(
          fs.readFileSync(path.join(store.directory, name)),
          fs.readFileSync(path.join(root, 'before-install-data', name))
        );
      const saved = JSON.parse(fs.readFileSync(store.file));
      const expected = JSON.parse(fs.readFileSync(path.join(root, 'expected-party.json')));
      // First launch selects a physical display. The byte comparison above still
      // requires that chosen display, along with every other setting, to survive.
      expected.settings.displayId = JSON.parse(
        fs.readFileSync(path.join(root, 'before-install-data', 'party.json'))
      ).settings.displayId;
      assert.deepEqual(saved, expected);
      assert.equal(saved.characters[0].hp, 22);
      assert.equal(saved.characters[0].notes, 'Private synthetic note survives the update.');
      assert.equal(saved.roster[0].name, 'Synthetic saved player');
      assert.equal(saved.library.length, 4);
      assert.equal(saved.conditionLibrary.length, 3);
      assert.equal(saved.characters[0].items.length, 3);
      assert.equal(saved.roster[0].items.length, 1);
      assert.equal(saved.characters[0].conditionIds.length, 1);
      assert.equal(saved.roster[0].conditionIds.length, 1);
      assert.ok(saved.characters[0].avatar.startsWith('data:image/png;base64,'));
      assert.equal(saved.version, 10);
      assert.equal(saved.characters[0].theme, 'artificer');
      assert.equal(saved.roster[0].theme, 'wizard');
      assert.ok(saved.library[0].icon.startsWith('data:image/png;base64,'));
      assert.ok(saved.library[2].icon.startsWith('data:image/png;base64,'));
      assert.ok(saved.library[3].icon.startsWith('data:image/png;base64,'));
      assert.ok(saved.characters[0].items[2].icon.startsWith('data:image/png;base64,'));
      assert.equal(saved.characters[0].items[0].icon, undefined);
      assert.deepEqual(await run('return (await api.messages()).messages;'), []);
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
              'The old installed app checked, downloaded a real NSIS installer, quit, updated its custom folder despite a missing installation-path record, and relaunched.',
              'Active and saved players, assigned and unused abilities and conditions, portraits, resources, slots, concentration, notes, and settings match the expected saved party.',
              'The party, previous save, and update preference are byte-for-byte identical across installation.',
              'The automatic-check preference survives; the new title shows the installed version and the TV overlay starts hidden.',
              'Format 10 shared/local artwork and active/inactive themes survive the actual installer update; the previous session message is absent from saves and clears on relaunch.',
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
