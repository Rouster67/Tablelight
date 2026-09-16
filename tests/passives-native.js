/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const TL = require('../core');
module.exports = async ({ app, controller, getOverlay, getState, setOverlay, store }) => {
  const directory = path.dirname(store.directory),
    results = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (check) => {
    const start = Date.now();
    while (!(await check())) {
      if (Date.now() - start > 10000) throw Error('Passive foundation test timed out.');
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  };
  try {
    await wait(() => run('return !!document.querySelector(\'[data-action="add-character"]\');'));
    await run(`
      await commit(() => {
        state=TL.empty();
        state.settings.displayId=display().id;
        state.library=[TL.libraryEntry({id:'shared',name:'Lantern sense',behavior:'passive',trackPassive:true,description:'Original reminder',passiveDescription:'Retained hybrid text'})];
        const a=TL.character(), b=TL.character(1);
        a.id='mira'; b.id='rowan';
        Object.assign(a.hud,{expanded:true,rotation:90,scale:0.8});
        state.characters=[a]; state.roster=[b];
        TL.attachItem(state,a.id,'shared'); TL.attachItem(state,b.id,'shared');
        TL.createLocalItem(state,a.id,{name:'Local reminder',behavior:'passive',trackPassive:true});
        state.activeId=a.id; selectedId=a.id; view='character';
      });
    `);
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    const overlay = getOverlay();
    const tv = (code) => overlay.webContents.executeJavaScript(`(async()=>{${code}})()`);
    await wait(() => tv("return !!state?.characters?.find(c=>c.id==='mira');"));
    const before = TL.clone(getState()),
      itemId = before.characters[0].items[0].id;
    await tv(
      `return window.tablelight.hudCommand({type:'passive',characterId:'mira',itemId:${JSON.stringify(itemId)},active:true});`
    );
    const expected = TL.clone(before);
    expected.characters[0].items[0].passiveActive = true;
    assert.deepEqual(getState(), expected);
    assert.deepEqual(store.load().state, expected);
    await wait(() => run('return state.characters[0].items[0].passiveActive;'));
    assert.equal(getState().roster[0].items[0].passiveActive, false);
    assert.equal(JSON.parse(fs.readFileSync(store.file, 'utf8')).version, 11);
    results.push(
      'The real overlay bridge saves only the selected passive reminder and preserves the inactive player, all values, and HUD settings.'
    );

    const rejected = await tv(
      `try { await window.tablelight.hudCommand({type:'use',characterId:'mira',itemId:${JSON.stringify(itemId)}}); return ''; } catch(error) {return error.message;}`
    );
    assert.match(rejected, /Passive abilities/);
    assert.deepEqual(getState(), expected);
    await run('await undo();');
    assert.deepEqual(getState(), before);
    results.push(
      'Passive use is rejected by the actual approval route; session Undo restores the reminder without spending costs.'
    );

    await run("editLibraryEntry('shared');");
    await tv(
      `await window.tablelight.hudCommand({type:'passive',characterId:'mira',itemId:${JSON.stringify(itemId)},active:true});`
    );
    await run(
      `const form=document.getElementById('item-form'); form.elements.namedItem('description').value='Edited while reading'; form.requestSubmit(); await saveQueue;`
    );
    await wait(() => getState().library[0].description === 'Edited while reading');
    expected.library[0].description = 'Edited while reading';
    assert.deepEqual(getState(), TL.normalize(expected));
    await run(
      `const c=state.characters[0]; editLibraryEntry('',c.id,c.items[1].id); const form=document.getElementById('item-form'); form.elements.namedItem('description').value='Local text'; form.requestSubmit(); await saveQueue;`
    );
    await wait(() => getState().characters[0].items[1].description === 'Local text');
    assert.equal(getState().characters[0].items[1].behavior, 'passive');
    assert.equal(getState().characters[0].items[1].trackPassive, true);
    results.push(
      'Existing shared and local editors retain the new fields, including a reminder changed while the editor is open.'
    );

    const saved = TL.clone(getState());
    controller.webContents.reload();
    await wait(() => !controller.webContents.isLoading());
    await wait(() =>
      run(
        "return typeof state !== 'undefined' && state.characters[0]?.items[0]?.passiveActive === true;"
      )
    );
    assert.deepEqual(store.load().state, saved);
    assert.deepEqual(await run('return TL.toBackup(state);'), TL.toBackup(saved));
    results.push(
      'Reloading the real DM renderer and reopening the disk save preserve shared/local passive data and character settings.'
    );
    fs.writeFileSync(
      path.join(directory, 'passives-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'passives-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
  } finally {
    setOverlay(false);
    app.quit();
  }
};
