/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const TL = require('../core'),
  fixture = require('./icon-stress-fixture');
module.exports = async ({ app, controller, getOverlay, getState, setOverlay, store }) => {
  const directory = path.dirname(store.directory),
    results = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const tv = (code) => getOverlay().webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (check) => {
    const start = Date.now();
    while (!(await check())) {
      if (Date.now() - start > 20000) throw Error('Large image party timed out');
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  };
  try {
    const state = fixture();
    await run(
      `await commit(()=>{state=TL.normalize(${JSON.stringify(TL.toBackup(state))});},'Large image party');selectedId=state.characters[0].id;view='display';render();`
    );
    await setOverlay(true);
    await wait(() =>
      tv(`return document.querySelectorAll('.hud-option .image-ready').length===120;`)
    );
    await wait(() =>
      run(
        `return document.querySelectorAll('#preview-stage .hud-option .image-ready').length===120;`
      )
    );
    results.push(
      '5,000 definitions and 100 inactive characters load with eight active HUDs, each resolving 31 near-limit shared images; 120 TV thumbnails and 120 DM preview thumbnails decode.'
    );
    const timings = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await run(
        `await commit(()=>{state.characters[0].hp=${i + 1};state.characters[0].resources[0].current=${49 - i};},'Rapid image-party update');`
      );
      await wait(() =>
        tv(
          `return state.characters[0].hp===${i + 1} && document.querySelectorAll('.hud-option .image-ready').length===120;`
        )
      );
      timings.push(Math.round(performance.now() - start));
    }
    assert.equal(getState().characters[1].resources[0].current, 50);
    assert.equal(getState().roster.length, 100);
    assert.equal(store.load().state.characters[0].hp, 5);
    await run(`await undo();`);
    await wait(() => tv(`return state.characters[0].hp===4;`));
    results.push(
      'Rapid HP/resource changes reach both real windows, save successfully, preserve other players, and Undo restores the previous values.'
    );
    fs.writeFileSync(
      path.join(directory, 'ability-icons-performance-results.json'),
      JSON.stringify(
        {
          passed: true,
          results,
          updateToPaintMs: timings,
          mainHeapMiB: Math.round(process.memoryUsage().heapUsed / 1048576),
        },
        null,
        2
      )
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'ability-icons-performance-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
  } finally {
    setOverlay(false);
    app.quit();
  }
};
