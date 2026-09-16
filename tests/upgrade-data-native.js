/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto');
const TL = require('../core');
const { createInstalledParty, assertInstalledParty } = require('./installed-party-fixture');

module.exports = async ({
  app,
  controller,
  getOverlay,
  getState,
  setOverlay,
  store,
  updates,
  guide,
}) => {
  const directory = path.dirname(store.directory);
  const restarted = process.env.TABLELIGHT_TEST_RESTART === '1';
  const resultFile = path.join(
    directory,
    'upgrade-data' + (restarted ? '-restart' : '') + '-results.json'
  );
  const expectedFile = path.join(directory, 'expected-party.json');
  const checkpoint = path.join(directory, 'before-restart');
  const saveNames = ['party.json', 'party.previous.json', 'updates.json'];
  const results = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (check) => {
    const deadline = Date.now() + 10000;
    while (!(await check())) {
      if (Date.now() > deadline) throw Error('Upgrade-data check timed out.');
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  };
  const originalOpenPath = guide.openPath;
  try {
    await wait(() => run("return Boolean(document.querySelector('[data-action=add-character]'));"));
    if (!restarted) {
      const fixture = createInstalledParty();
      fixture.settings.displayId = await run('return display().id;');
      await run(
        `await commit(()=>{state=TL.normalize(${JSON.stringify(fixture)});selectedId=state.activeId;view='character';});await saveQueue;`
      );
      await run('await commit(()=>{selected().hp=22;});await saveQueue;');
      fixture.characters[0].hp = 22;
      const expected = TL.toBackup(fixture);
      assert.deepEqual(TL.toBackup(getState()), expected);
      assertInstalledParty(JSON.parse(fs.readFileSync(store.file)));
      results.push(
        'The real DM renderer saves the complete installer fixture: shared/local and unused passives, hybrid text, personal costs, independent reminders, themes and HUD scale/rotation.'
      );

      setOverlay(true);
      await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
      const overlay = getOverlay();
      const tv = (code) => overlay.webContents.executeJavaScript(`(async()=>{${code}})()`);
      await wait(() => tv('return Boolean(window.tablelight && state?.characters?.length);'));
      const characterId = fixture.characters[0].id;
      const itemId = fixture.characters[0].items.find(
        (item) => item.libraryId === 'update-passive'
      ).id;
      await tv(
        `await window.tablelight.hudCommand(${JSON.stringify({ type: 'passive', characterId, itemId, active: false })});`
      );
      const toggled = TL.clone(expected);
      toggled.characters[0].items.find((item) => item.id === itemId).passiveActive = false;
      assert.deepEqual(TL.toBackup(getState()), toggled);
      const denied = await tv(
        `try{await window.tablelight.hudCommand(${JSON.stringify({ type: 'use', characterId, itemId, level: 1 })});return '';}catch(error){return error.message;}`
      );
      assert.match(denied, /Passive abilities/);
      assert.deepEqual(TL.toBackup(getState()), toggled);
      await run('await undo();await saveQueue;');
      assert.deepEqual(TL.toBackup(getState()), expected);
      setOverlay(false);
      updates.setEnabled(false);
      await run(
        "await messageClient.refresh();await messageClient.command('send',selected().id,{body:'SYNTHETIC_UPGRADE_RESTART_MESSAGE'});"
      );
      assert.equal(await run('return (await api.messages()).messages.length;'), 1);
      for (const name of ['party.json', 'party.previous.json'])
        assert.ok(
          !fs
            .readFileSync(path.join(store.directory, name), 'utf8')
            .includes('SYNTHETIC_UPGRADE_RESTART_MESSAGE')
        );
      fs.writeFileSync(expectedFile, JSON.stringify(expected));
      fs.mkdirSync(checkpoint);
      for (const name of saveNames)
        fs.copyFileSync(path.join(store.directory, name), path.join(checkpoint, name));
      results.push(
        'Overlay reminder changes and Undo preserve all other fields; passive use is rejected. Session messages stay out of both saves before a full process restart.'
      );
    } else {
      const expected = JSON.parse(fs.readFileSync(expectedFile));
      assert.deepEqual(TL.toBackup(getState()), expected);
      assertInstalledParty(JSON.parse(fs.readFileSync(store.file)));
      for (const name of saveNames)
        assert.deepEqual(
          fs.readFileSync(path.join(store.directory, name)),
          fs.readFileSync(path.join(checkpoint, name))
        );
      results.push(
        'A fresh Electron process reloads the exact expected party and every passive/hybrid, personal setting and HUD pose; the party, previous save and update preference remain byte-identical.'
      );
      assert.equal(updates.preferences.enabled, false);
      assert.deepEqual(await run('return (await api.messages()).messages;'), []);
      assert.equal(await run('return overlayStatus.visible;'), false);
      results.push(
        'Restart preserves the update opt-out, clears the transient player message and starts the overlay hidden.'
      );
    }

    const expectedGuide = path.join(
      path.resolve(__dirname, '..'),
      'docs',
      'Tablelight-User-Guide.pdf'
    );
    assert.equal(guide.file, expectedGuide);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(path.resolve(__dirname, '..'), 'docs/user-guide/manifest.json'))
    );
    assert.equal(
      crypto.createHash('sha256').update(fs.readFileSync(guide.file)).digest('hex'),
      manifest.pdfSha256
    );
    const before = fs.readFileSync(store.file);
    const opened = [];
    guide.openPath = async (file) => {
      opened.push(file);
      return '';
    };
    await run("view='help';render();document.querySelector('[data-action=open-guide]').click();");
    await wait(() => run('return !guideOpening;'));
    assert.deepEqual(opened, [expectedGuide]);
    assert.match(await run('return guideFeedback;'), /sent to your PDF viewer/);
    assert.deepEqual(fs.readFileSync(store.file), before);
    results.push(
      'Help hands off this app copy’s exact manifest-matching PDF without changing the party. The viewer callback is simulated; no installation or interactive reader result is claimed.'
    );
    fs.writeFileSync(resultFile, JSON.stringify({ passed: true, results }, null, 2));
  } catch (error) {
    fs.writeFileSync(
      resultFile,
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
  } finally {
    guide.openPath = originalOpenPath;
    setOverlay(false);
    app.quit();
  }
};
