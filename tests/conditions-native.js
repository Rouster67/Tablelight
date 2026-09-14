/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
module.exports = async ({ app, controller, getOverlay, getState, screen, setOverlay, store }) => {
  const dir = path.dirname(store.directory),
    results = [];
  let overlay;
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const tv = (code) => overlay.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (fn) => {
    const start = Date.now();
    while (!(await fn())) {
      if (Date.now() - start > 10000) throw Error('Conditions check timed out');
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  const click = (selector) =>
    run(
      `const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled)throw Error('Missing control '+${JSON.stringify(selector)});el.click();await saveQueue;`
    );
  const fill = (id, values) =>
    run(
      `const form=document.getElementById(${JSON.stringify(id)});for(const [key,value]of Object.entries(${JSON.stringify(values)})){const el=form.elements.namedItem(key);if(el.type==='checkbox')el.checked=value;else el.value=value;}form.requestSubmit();await saveQueue;`
    );
  const shot = async (name, win) => {
    await new Promise((r) => setTimeout(r, 150));
    fs.writeFileSync(path.join(dir, name + '.png'), (await win.webContents.capturePage()).toPNG());
  };
  try {
    await wait(() =>
      run(`return !!document.querySelector('[data-action="view-condition-library"]');`)
    );
    controller.setBounds({ width: 1440, height: 950 });
    await click('[data-action="view-condition-library"]');
    assert.equal(getState().conditionLibrary.length, 0);
    await click('[data-action="condition-new"]');
    await fill('condition-form', {
      name: 'User condition',
      description: 'Original user condition description.',
    });
    await wait(() => getState().conditionLibrary.length === 1);
    const id = getState().conditionLibrary[0].id;
    await run(
      `const el=document.getElementById('condition-search');el.value='not found';el.dispatchEvent(new Event('input',{bubbles:true}));`
    );
    assert.equal(
      await run(`return document.querySelectorAll('.condition-library-row').length;`),
      0
    );
    await run(
      `const el=document.getElementById('condition-search');el.value='original';el.dispatchEvent(new Event('input',{bubbles:true}));`
    );
    assert.equal(
      await run(`return document.querySelectorAll('.condition-library-row').length;`),
      1
    );
    results.push(
      'The empty condition library accepts user names/descriptions and searches their text.'
    );
    await run(
      `const el=document.getElementById('condition-search');el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));`
    );
    await run(
      `commit(()=>{const a=TL.character(),b=TL.character(),c=TL.character();a.name='Active A';b.name='Active B';c.name='Saved C';a.hud={...a.hud,expanded:true,x:50,y:50};b.hud.visible=false;state.characters=[a,b];state.roster=[c];state.activeId=a.id;selectedId=a.id;state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};state.settings.overlayInteractive=true;});await saveQueue;`
    );
    const players = [...getState().characters, ...getState().roster].map((c) => c.id);
    for (const characterId of players) {
      await click('[data-action="condition-assign"]');
      await fill('assign-condition-form', { characterId });
    }
    assert.ok(
      [...getState().characters, ...getState().roster].every((c) => c.conditionIds[0] === id)
    );
    await click('[data-action="condition-edit"]');
    await fill('condition-form', {
      name: 'Renamed condition',
      description: 'A shared custom description. <b>This is text.</b>',
    });
    assert.ok(
      [...getState().characters, ...getState().roster].every(
        (c) => c.appliedConditions[0].name === 'Renamed condition'
      )
    );
    await click('[data-action="condition-delete"]');
    assert.equal(getState().conditionLibrary.length, 1);
    assert.ok(
      await run(`return document.getElementById('toast').textContent.includes('Saved C');`)
    );
    results.push(
      'Conditions can be assigned to active or saved characters; shared edits update all and assigned definitions are protected.'
    );
    await click('[data-action="view-character"]');
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    overlay = getOverlay();
    await wait(() =>
      tv(
        `return document.querySelector('.hud-condition-table td')?.textContent==='Renamed condition';`
      )
    );
    assert.equal(
      await tv(`return document.querySelector('.hud-condition-heading span').textContent;`),
      'Conditions'
    );
    assert.equal(
      await tv(`return document.querySelector('.hud-condition-table td').title;`),
      'A shared custom description. <b>This is text.</b>'
    );
    assert.equal(await tv(`return document.querySelector('.hud-condition-table td b');`), null);
    assert.ok(overlay.isFocusable());
    results.push(
      'The TV lists assigned conditions under Conditions with escaped hover descriptions; interactive HUDs accept keyboard focus.'
    );
    await run(
      `commit(()=>selected().items.push(TL.item({name:'A custom focus',requiresConcentration:true}),TL.item({name:'DM selected focus',kind:'feature',requiresConcentration:true})));await saveQueue;`
    );
    await wait(() => tv(`return state.characters[0].items.length===2;`));
    await tv(`document.querySelector('.concentration-toggle').click();`);
    await wait(() => tv(`return !!document.querySelector('[data-concentration-search]');`));
    assert.equal(getState().characters[0].concentrating, false);
    await tv(`document.querySelector('[data-hud-concentration-pick]').click();`);
    await wait(() => getState().characters[0].concentration === 'A custom focus');
    await wait(() => tv(`return !document.querySelector('.hud-concentration-menu');`));
    assert.equal(
      await tv(`return document.querySelector('.concentration-toggle').title;`),
      'A custom focus'
    );
    assert.equal(getState().characters[1].concentrating, false);
    results.push(
      'The TV concentration icon opens assigned flagged abilities; choosing one lights it and sets its hover tooltip.'
    );
    await tv(`document.querySelector('.concentration-toggle').click();`);
    await wait(() => !getState().characters[0].concentrating);
    await tv(`document.querySelector('.concentration-toggle').click();`);
    await wait(() => tv(`return !!document.querySelector('[data-concentration-search]');`));
    await tv(`document.querySelector('[data-concentration-cancel]').click();`);
    assert.equal(getState().characters[0].concentrating, false);
    assert.equal(getState().characters[0].concentration, '');
    assert.equal(
      await tv(
        `return document.querySelector('.concentration-toggle').classList.contains('is-on');`
      ),
      false
    );
    results.push(
      'Turning concentration off clears it; cancelling the picker leaves concentration off.'
    );
    await tv(`document.querySelector('.concentration-toggle').click();`);
    await wait(() => tv(`return !!document.querySelector('[data-concentration-search]');`));
    await tv(
      `const input=document.querySelector('[data-concentration-search]');input.value='custom';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();input.setSelectionRange(3,3);`
    );
    await run(`commit(()=>selected().hp=7);await saveQueue;`);
    await wait(() => tv(`return state.characters[0].hp===7;`));
    assert.equal(
      await tv(`return document.querySelector('[data-concentration-search]').value;`),
      'custom'
    );
    assert.equal(
      await tv(`return document.querySelector('[data-concentration-search]').selectionStart;`),
      3
    );
    await tv(`document.querySelector('[data-hud-concentration-pick]').click();`);
    await wait(() => getState().characters[0].concentration === 'A custom focus');
    results.push('Live DM updates preserve concentration search text and its cursor.');
    await tv(`document.querySelector('.hud-condition-table tbody button').click();`);
    await wait(() => getState().characters[0].conditionIds.length === 0);
    assert.equal(getState().characters[1].conditionIds.length, 1);
    assert.equal(getState().roster[0].conditionIds.length, 1);
    await click('[data-action="conditions"]');
    await click('[data-action="condition-pick"]');
    await click('[data-action="close-modal"]');
    await wait(() => tv(`return !!document.querySelector('.hud-condition-table tbody button');`));
    await click('[data-action="condition-remove"]');
    assert.equal(getState().characters[0].conditionIds.length, 0);
    await click('[data-action="undo"]');
    assert.equal(getState().characters[0].conditionIds.length, 1);
    results.push(
      'Either screen removes a condition only from its own character; the DM Add menu and Undo work.'
    );
    await click('[data-action="concentration-edit"]');
    await click(
      `[data-action="concentration-pick"][data-id="${getState().characters[0].items[1].id}"]`
    );
    await wait(() =>
      tv(`return document.querySelector('.concentration-toggle').title==='DM selected focus';`)
    );
    const frame = await tv(
      `const el=document.querySelector('.hud-position');return [el.offsetWidth,el.offsetHeight,el.style.transform];`
    );
    await run(`commit(()=>state.settings.overlayInteractive=false);await saveQueue;`);
    await wait(() => tv(`return !state.settings.overlayInteractive;`));
    assert.equal(overlay.isFocusable(), false);
    assert.equal(
      await tv(
        `return document.querySelectorAll('.hud-condition-table button,.hud-status button').length;`
      ),
      0
    );
    assert.equal(
      await tv(`return document.querySelector('[data-concentration-indicator]').title;`),
      'DM selected focus'
    );
    assert.deepEqual(
      await tv(
        `const el=document.querySelector('.hud-position');return [el.offsetWidth,el.offsetHeight,el.style.transform];`
      ),
      frame
    );
    await shot('01-status-click-through', overlay);
    await run(`commit(()=>state.settings.overlayInteractive=true);await saveQueue;`);
    await wait(() => tv(`return !!document.querySelector('.hud-status button');`));
    await shot('02-status-interactive', overlay);
    results.push(
      'DM concentration edits reach the TV; click-through mode keeps indicators and fixed HUD dimensions while disabling input.'
    );
    await click('[data-action="short-rest"]');
    await fill('rest-form', { scope: 'selected' });
    assert.equal(getState().characters[0].concentrating, true);
    await click('[data-action="long-rest"]');
    await fill('rest-form', { scope: 'selected' });
    assert.equal(getState().characters[0].concentrating, false);
    assert.equal(getState().characters[0].conditionIds.length, 1);
    await run(
      `for(const c of TL.allCharacters(state)) { commit(()=>TL.unassignCondition(state,c.id,${JSON.stringify(id)})); }await saveQueue;`
    );
    await click('[data-action="view-condition-library"]');
    await click('[data-action="condition-delete"]');
    await click('[data-action="close-modal"]');
    assert.equal(getState().conditionLibrary.length, 1);
    await click('[data-action="condition-delete"]');
    await click('#confirm-action');
    assert.equal(getState().conditionLibrary.length, 0);
    await click('[data-action="undo"]');
    assert.equal(getState().conditionLibrary.length, 1);
    assert.equal(await run(`return view;`), 'condition-library');
    setOverlay(false);
    controller.show();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await shot('03-condition-library', controller);
    const disk = JSON.parse(fs.readFileSync(store.file, 'utf8'));
    assert.equal(disk.version, 6);
    assert.equal(disk.conditionLibrary.length, 1);
    assert.equal(disk.characters[0].appliedConditions, undefined);
    results.push(
      'Rests preserve conditions, only long rest ends concentration, and condition deletion supports Cancel, Undo, and version-4 saving.'
    );
    fs.writeFileSync(
      path.join(dir, 'conditions-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(dir, 'conditions-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
    try {
      await shot('failure-dm', controller);
      if (overlay) await shot('failure-tv', overlay);
    } catch {}
  } finally {
    setOverlay(false);
    app.quit();
  }
};
