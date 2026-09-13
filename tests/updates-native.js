/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const nextVersion = require('semver').inc(require('../package.json').version, 'minor');
module.exports = async ({
  app,
  controller,
  getOverlay,
  getState,
  setOverlay,
  store,
  updates,
  updateAdapter,
}) => {
  const directory = path.dirname(store.directory),
    results = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (fn) => {
    for (let i = 0; i < 160; i++) {
      if (await fn()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('Timed out waiting for update UI');
  };
  const click = (selector) =>
    run(
      `const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled)throw new Error('Unavailable button');el.click();`
    );
  const shot = async (name) => {
    await new Promise((r) => setTimeout(r, 150));
    fs.writeFileSync(
      path.join(directory, name + '.png'),
      (await controller.webContents.capturePage()).toPNG()
    );
  };
  try {
    await wait(() => run("return Boolean(document.querySelector('[data-action=add-character]'));"));
    controller.setBounds({ width: 1100, height: 800 });
    controller.showInactive();
    await click('[data-action="add-character"]');
    await run("document.querySelector('[name=name]').value='Unsaved test draft';");
    await updates.check(true);
    assert.equal(
      await run("return document.querySelector('[name=name]').value;"),
      'Unsaved test draft'
    );
    assert.equal(await run("return Boolean(document.getElementById('update-dialog'));"), false);
    await click('[data-action="close-modal"]');
    await wait(() => run("return Boolean(document.getElementById('update-dialog'));"));
    assert.ok(
      (await run("return document.querySelector('.modal').textContent;")).includes(nextVersion)
    );
    await shot('01-update-offer');
    assert.equal(updateAdapter.downloads, 0);
    await click('.modal-footer [data-action="close-modal"]');
    assert.equal(
      await run(
        "return document.querySelector('#update-indicator button').getAttribute('aria-label');"
      ),
      `Update available: v${nextVersion}`
    );
    results.push(
      'Launch offer waits for an open editor; Later keeps the accessible update icon without downloading.'
    );
    await click('[data-action="view-help"]');
    await click('#update-checks');
    await wait(() => !updates.preferences.enabled);
    assert.equal(JSON.parse(fs.readFileSync(updates.preferences.file)).automaticChecks, false);
    const count = updateAdapter.checks;
    await updates.check(true);
    assert.equal(updateAdapter.checks, count);
    updateAdapter.version = app.getVersion();
    await click('[data-action="update-check"]');
    await wait(() => updates.phase === 'current');
    assert.equal(updateAdapter.checks, count + 1);
    assert.equal(
      await run("return Boolean(document.querySelector('#update-indicator button'));"),
      false
    );
    results.push(
      'Disabling checks persists separately; manual checks still work and an equal version removes the update icon.'
    );
    updateAdapter.offline = true;
    await click('[data-action="update-check"]');
    await wait(() => Boolean(updates.message));
    assert.equal(await run("return Boolean(document.querySelector('.modal'));"), false);
    assert.match(
      await run("return document.getElementById('updates-panel').textContent;"),
      /Could not check/
    );
    await shot('02-offline-settings');
    await run(
      "commit(()=>{const c=TL.character(0);c.name='Update test player';c.maxHp=42;c.hp=23;state.characters=[c];state.activeId=c.id;selectedId=c.id;});await saveQueue;"
    );
    assert.equal(getState().characters[0].hp, 23);
    results.push(
      'Offline checks show status only in Setup & help; local character saves remain available.'
    );
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    const denied = await getOverlay().webContents.executeJavaScript(
      "window.tablelight.checkUpdates().then(()=>'',error=>error.message)"
    );
    assert.match(denied, /only available in the DM window/);
    assert.equal(
      await getOverlay().webContents.executeJavaScript(
        "Boolean(document.getElementById('updates-panel'))"
      ),
      false
    );
    results.push(
      'The player overlay has no update UI and cannot invoke privileged update controls.'
    );
    setOverlay(false);
    updateAdapter.offline = false;
    updateAdapter.version = nextVersion;
    await updates.check();
    await click('[data-action="update-offer"]');
    await click('[data-action="update-download"]');
    await wait(() => updates.phase === 'downloading');
    updateAdapter.emit('progress', 42);
    await wait(() => run("return document.querySelector('#update-dialog progress')?.value===42;"));
    await shot('03-download-progress');
    await run('closeModal();');
    assert.equal(await run("return Boolean(document.getElementById('update-dialog'));"), true);
    await click('[data-action="update-cancel"]');
    await wait(() => updates.phase === 'available');
    assert.equal(updateAdapter.installs, 0);
    results.push(
      'Download progress is visible; Cancel download keeps Tablelight open without installing.'
    );
    const originalSave = store.save.bind(store);
    store.save = () => {
      throw new Error('Synthetic disk failure');
    };
    await click('[data-action="update-download"]');
    await wait(() => updates.phase === 'downloading');
    updateAdapter.finishDownload();
    await wait(() => updates.phase === 'ready');
    assert.equal(updateAdapter.installs, 0);
    assert.match(updates.message, /could not save/);
    await shot('04-save-failure');
    store.save = originalSave;
    const downloads = updateAdapter.downloads;
    await click('[data-action="update-download"]');
    await wait(() => updateAdapter.installs === 1);
    assert.equal(updateAdapter.downloads, downloads);
    assert.equal(JSON.parse(fs.readFileSync(store.file)).characters[0].hp, 23);
    results.push(
      'A save failure prevents installation; retry saves the current party and reuses the verified download.'
    );
    fs.writeFileSync(
      path.join(directory, 'updates-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'updates-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
  } finally {
    app.quit();
  }
};
module.exports.makeAdapter = () => {
  const adapter = new EventEmitter();
  Object.assign(adapter, {
    version: nextVersion,
    checks: 0,
    downloads: 0,
    installs: 0,
    offline: false,
    async check() {
      this.checks++;
      if (this.offline) throw new Error('Synthetic offline');
      return { version: this.version, available: true };
    },
    download() {
      this.downloads++;
      return new Promise((resolve, reject) => {
        this.finishDownload = resolve;
        this.rejectDownload = reject;
      });
    },
    cancel() {
      this.rejectDownload?.(new Error('Canceled'));
    },
    install() {
      this.installs++;
    },
  });
  return adapter;
};
