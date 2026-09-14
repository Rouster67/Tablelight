/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
module.exports = async ({ app, controller, getOverlay, getState, screen, setOverlay, store }) => {
  const dir = path.dirname(store.directory),
    results = [],
    errors = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (check) => {
    const start = Date.now();
    while (!(await check())) {
      if (Date.now() - start > 10000) throw new Error('Library deletion check timed out');
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  const click = (selector) =>
    run(
      `const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled)throw new Error('Missing '+${JSON.stringify(selector)});el.click();await saveQueue;`
    );
  const shot = async (name) => {
    await new Promise((r) => setTimeout(r, 300));
    fs.writeFileSync(
      path.join(dir, name + '.png'),
      (await controller.webContents.capturePage()).toPNG()
    );
  };
  controller.webContents.on('console-message', (_e, d) => {
    if (d?.level === 'error') errors.push(d.message);
  });
  try {
    await wait(() => run(`return !!document.querySelector('[data-action="view-library"]');`));
    controller.setBounds({ width: 1100, height: 800 });
    controller.showInactive();
    await run(`commit(()=>{
      state=TL.empty();state.library=[TL.libraryEntry({name:'Test shared spell',kind:'spell',level:1,description:'Shared rules',source:'Test reference',requiresConcentration:true})];
      for(let i=0;i<3;i++){const c=TL.character(i);c.name=['Player A','Player B','Inactive <player>'][i];c.resources=[{id:'pool-'+i,name:'Charges',current:3,max:4,reset:'long'}];c.slots[0]={level:1,current:3,max:4};state.characters.push(c);const it=TL.attachItem(state,c.id,state.library[0].id,{resourceId:'pool-'+i,resourceCost:i+1,disabled:i===1});TL.createLocalItem(state,c.id,{name:'Existing local',description:'Keep me'});Object.assign(c.hud,{detailId:it.id,panel:'spell',expanded:true,x:25+i*25,y:50,rotation:i*90});TL.setConcentration(c,true,it.id);}
      TL.removeFromParty(state,state.characters[2].id);state.activeId=state.characters[0].id;selectedId=state.activeId;view='library';state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};state.settings.overlayInteractive=true;
    });await saveQueue;`);
    const source = getState().library[0].id,
      [a, b] = getState().characters.map((c) => c.id),
      inactive = getState().roster[0].id;
    const original = getState().characters[0].items[0].id;
    const before = JSON.parse(JSON.stringify(getState()));
    const openDelete = () => click(`[data-action="delete-library-entry"][data-id="${source}"]`);
    await openDelete();
    assert.ok(
      await run(
        `const body=document.querySelector('.modal-body');return ['Player A','Player B','Inactive <player>'].every(name=>body.textContent.includes(name)) && body.textContent.includes('Not in active party') && !body.querySelector('player');`
      )
    );
    assert.ok(
      await run(
        `return [...document.querySelectorAll('.modal-footer button')].every(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;});`
      )
    );
    await shot('01-assigned-warning');
    await click('.modal [data-action="edit-library-entry"]');
    assert.equal(
      await run(`return document.getElementById('modal-title').textContent;`),
      'Edit library entry'
    );
    await click('[data-action="close-modal"]');
    await openDelete();
    await click('#delete-with-local-copies');
    assert.ok(
      await run(
        `const boxes=[...document.querySelectorAll('[name="localCharacter"]')];return boxes.length===3&&boxes.every(el=>el.checked);`
      )
    );
    await click(`[name="localCharacter"][value="${b}"]`);
    await click('#back-library-delete');
    assert.deepEqual(getState(), before);
    await click('#delete-with-local-copies');
    assert.equal(
      await run(`return document.querySelector('[name="localCharacter"][value="${b}"]').checked;`),
      false
    );
    await shot('02-select-local-copies');
    await click('[data-action="close-modal"]');
    assert.deepEqual(getState(), before);
    results.push(
      'The warning names active and inactive characters, escapes their names, offers an Edit instead button, and fits the laptop window. The second dialog defaults all boxes on; Go back preserves choices and Cancel changes nothing.'
    );

    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    const tv = (code) => getOverlay().webContents.executeJavaScript(`(async()=>{${code}})()`);
    await wait(() => tv(`return document.querySelectorAll('.hud-position').length===2;`));
    await openDelete();
    await click('#delete-with-local-copies');
    await click(`[name="localCharacter"][value="${b}"]`);
    // Later gameplay is retained when the final deletion is confirmed.
    await run(
      `commit(()=>{const c=TL.findCharacter(state,${JSON.stringify(a)});TL.setConcentration(c,false);TL.spend(c,c.items[0],1);});await saveQueue;`
    );
    const afterUse = JSON.parse(JSON.stringify(getState()));
    await click('[form="delete-library-form"]');
    assert.equal(getState().library.length, 0);
    const kept = getState().characters[0],
      removed = getState().characters[1];
    assert.ok(kept.items[0].local);
    assert.equal(kept.items[0].id, original);
    assert.equal(kept.items[0].name, 'Test shared spell');
    assert.equal(kept.items[0].libraryId, '');
    assert.equal(kept.resources[0].current, 2);
    assert.equal(kept.slots[0].current, 2);
    assert.equal(kept.turn.action, false);
    assert.equal(kept.concentrationItemId, original);
    assert.equal(removed.items.length, 1);
    assert.equal(removed.items[0].name, 'Existing local');
    assert.equal(removed.hud.detailId, '');
    assert.equal(removed.concentrating, false);
    assert.equal(removed.resources[0].current, 3);
    assert.ok(getState().roster[0].items[0].local);
    assert.equal(getState().roster[0].items[0].resourceCost, 3);
    await wait(() =>
      tv(
        `return !!document.querySelector('[data-hud-id="${a}"] h3 .ability-local-icon') && !document.querySelector('[data-hud-id="${b}"]').textContent.includes('Test shared spell');`
      )
    );
    assert.ok(
      await tv(
        `return [...document.querySelectorAll('.hud-position')].every(el=>el.offsetWidth===880&&el.offsetHeight===650);`
      )
    );
    const deletedState = JSON.parse(JSON.stringify(getState()));
    controller.webContents.reload();
    await wait(() => !controller.webContents.isLoading());
    await wait(() => run(`return !!document.querySelector('[data-action="view-library"]');`));
    assert.deepEqual(store.load().state, deletedState);
    assert.deepEqual(getState(), deletedState);
    results.push(
      'Mixed choices preserve checked active and inactive copies, including names, costs and concentration; unchecked assignments disappear without refunding anything. Later spending, local HUD icons, fixed dimensions, saves and reopening are preserved.'
    );

    // Reload resets session Undo, so establish the same pre-deletion state for Undo and other choices.
    await run(`commit(()=>{state=${JSON.stringify(afterUse)};view='library';});await saveQueue;`);
    await openDelete();
    await click('#confirm-library-delete');
    assert.equal(getState().library.length, 0);
    assert.ok(
      [...getState().characters, ...getState().roster].every(
        (c) => c.items.length === 1 && c.items[0].name === 'Existing local'
      )
    );
    await click('[data-action="undo"]');
    await wait(() => getState().library.length === 1);
    assert.deepEqual(getState(), afterUse);
    await openDelete();
    await click('#delete-with-local-copies');
    await click('[form="delete-library-form"]');
    assert.ok([...getState().characters, ...getState().roster].every((c) => c.items[0].local));
    await click('[data-action="undo"]');
    assert.deepEqual(getState(), afterUse);
    await openDelete();
    await click('#delete-with-local-copies');
    await run(
      `for(const el of document.querySelectorAll('[name="localCharacter"]'))el.checked=false;`
    );
    await click('[form="delete-library-form"]');
    assert.ok([...getState().characters, ...getState().roster].every((c) => c.items.length === 1));
    await click('[data-action="undo"]');
    assert.deepEqual(getState(), afterUse);
    results.push(
      'Remove and delete, all checked and all unchecked apply to every assignment; ordinary Undo restores the library and original assignments together while retaining spending that happened before confirmation.'
    );

    await openDelete();
    await click('#delete-with-local-copies');
    await click(`[name="localCharacter"][value="${b}"]`);
    await run(
      `commit(()=>{const c=TL.character(3);c.name='Newly assigned';state.roster.push(c);TL.attachItem(state,c.id,${JSON.stringify(source)});});await saveQueue;`
    );
    await click('[form="delete-library-form"]');
    assert.equal(getState().library.length, 1);
    assert.ok(
      await run(
        `return document.querySelector('[role="alert"]').textContent.includes('assigned characters changed') && document.querySelectorAll('[name="localCharacter"]').length===4 && !document.querySelector('[name="localCharacter"][value="${b}"]').checked;`
      )
    );
    await click('#back-library-delete');
    await run(
      `commit(()=>{const c=TL.findCharacter(state,${JSON.stringify(inactive)});c.items=c.items.filter(it=>it.libraryId!==${JSON.stringify(source)});});await saveQueue;`
    );
    await click('#confirm-library-delete');
    assert.equal(getState().library.length, 1);
    assert.ok(
      await run(
        `return document.querySelector('[role="alert"]').textContent.includes('assigned characters changed');`
      )
    );
    await click('[data-action="close-modal"]');
    assert.deepEqual(errors, []);
    results.push(
      'New or removed assignments while either dialog is open require reviewing the updated list before deletion; existing checkbox choices are preserved.'
    );
    fs.writeFileSync(
      path.join(dir, 'library-deletion-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(dir, 'library-deletion-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack, errors }, null, 2)
    );
    try {
      await shot('failure');
    } catch {}
  } finally {
    setOverlay(false);
    app.quit();
  }
};
