/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
module.exports = async function ({
  app,
  controller,
  getOverlay,
  getState,
  screen,
  setOverlay,
  store,
}) {
  const dir = path.dirname(store.directory),
    results = [],
    errors = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (fn) => {
    const start = Date.now();
    while (!(await fn())) {
      if (Date.now() - start > 10000) throw new Error('Library check timed out');
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  const click = (selector) =>
    run(
      `const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing '+${JSON.stringify(selector)});el.click();`
    );
  const fill = (id, fields) =>
    run(
      `const form=document.getElementById(${JSON.stringify(id)});for(const [key,value] of Object.entries(${JSON.stringify(fields)})){const el=form.elements.namedItem(key);if(!el)throw new Error('Missing field '+key);if(el.type==='checkbox')el.checked=value;else el.value=value;}form.requestSubmit();`
    );
  const input = (id, value) =>
    run(
      `const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));`
    );
  const shot = async (name) => {
    let error;
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 250));
      try {
        fs.writeFileSync(
          path.join(dir, name + '.png'),
          (await controller.webContents.capturePage()).toPNG()
        );
        return;
      } catch (e) {
        error = e;
      }
    }
    throw error;
  };
  controller.webContents.on('console-message', (_event, details) => {
    if (details?.level === 'error') errors.push(details.message);
  });
  try {
    await wait(() =>
      run(`return Boolean(document.querySelector('[data-action="view-library"]'));`)
    );
    controller.setBounds({ width: 1440, height: 950 });
    controller.showInactive();
    assert.deepEqual(getState().library, []);
    results.push('A fresh app has no preloaded library content.');
    await click('[data-action="view-library"]');
    await click('[data-action="new-library-entry"]');
    await fill('item-form', {
      name: 'Shared test technique',
      kind: 'feature',
      economy: 'bonus',
      source: 'Test manual p. 42 <img src=x onerror=window.invalidTest=true>',
      description: 'Original user rules. <script>window.invalidTest=true</script>',
      range: 'Self',
    });
    await wait(() => getState().library.length === 1);
    assert.equal(getState().characters.length, 0);
    results.push('A library entry can be created and saved before adding any characters.');
    await click('#library-list [data-action="delete-library-entry"]');
    await click('[data-action="close-modal"]');
    assert.equal(getState().library.length, 1);
    await click('#library-list [data-action="delete-library-entry"]');
    await click('#confirm-action');
    await wait(() => getState().library.length === 0);
    await click('[data-action="undo"]');
    await wait(() => getState().library.length === 1);
    results.push('The library row Delete button supports Cancel, confirmed deletion, and Undo.');
    controller.setBounds({ width: 1100, height: 800 });
    assert.ok(
      await run(
        `const edit=document.querySelector('#library-list [data-action="edit-library-entry"]').getBoundingClientRect(),del=document.querySelector('#library-list [data-action="delete-library-entry"]').getBoundingClientRect();return Math.abs(edit.y-del.y)<1 && del.x>=edit.right && del.right<innerWidth;`
      )
    );
    controller.setBounds({ width: 1440, height: 950 });
    results.push('Delete stays beside Edit within the row on a smaller laptop window.');
    await input('library-search', 'no matches');
    assert.equal(
      await run(`return document.querySelectorAll('#library-list .library-row').length;`),
      0
    );
    await input('library-search', 'original user');
    assert.equal(
      await run(`return document.querySelectorAll('#library-list .library-row').length;`),
      1
    );
    await input('library-search', '');
    await input('library-search', 'manual 42');
    assert.equal(
      await run(`return document.querySelectorAll('#library-list .library-row').length;`),
      1
    );
    await input('library-search', '');
    assert.equal(await run('return window.invalidTest;'), undefined);
    results.push(
      'Search matches descriptions and source references; entered HTML remains harmless text.'
    );
    await click('[data-action="add-character"]');
    await fill('character-form', { name: 'Test player A' });
    await wait(() => getState().characters.length === 1);
    const a = getState().characters[0].id;
    await click(`[data-action="select"][data-id="${a}"]`);
    await click('[data-action="edit-character"]');
    await click('#resource-editor-add');
    await fill('character-form', {
      'resource-name': 'A charges',
      'resource-current': 3,
      'resource-max': 3,
      'resource-reset': 'short',
    });
    await wait(() => getState().characters[0].resources.length === 1);
    const pool = getState().characters[0].resources[0].id;
    await click('[data-action="add-item"]');
    await shot('01-add-choice');
    await click('[data-action="choose-library-entry"]');
    await input('library-picker-search', 'technique');
    await click('[data-action="attach-library-entry"]');
    assert.ok(
      await run(
        `return document.querySelector('#attach-form .detail-meta').textContent.includes('Test manual p. 42 <img');`
      )
    );
    assert.equal(
      await run(`return document.querySelectorAll('#attach-form .detail-meta img').length;`),
      0
    );
    await fill('attach-form', { resourceId: pool, resourceCost: 2 });
    await wait(() => getState().characters[0].items.length === 1);
    assert.equal(getState().library.length, 1);
    results.push(
      'Choose existing attaches a saved definition with character-specific resource costs.'
    );
    await click('[data-action="add-character"]');
    await fill('character-form', { name: 'Test player B' });
    await wait(() => getState().characters.length === 2);
    const b = getState().characters[1].id;
    await click('[data-action="add-item"]');
    await click('[data-action="choose-library-entry"]');
    await click('[data-action="attach-library-entry"]');
    await fill('attach-form', { resourceCost: 1, disabled: true });
    await wait(() => getState().characters[1].items.length === 1);
    assert.equal(getState().library.length, 1);
    assert.equal(getState().characters[1].items[0].resourceId, '');
    results.push(
      'A second character reuses the same entry without copying the first character’s resource pool.'
    );
    await click('[data-action="add-item"]');
    await click('[data-action="choose-library-entry"]');
    assert.equal(
      await run(`return document.querySelector('[data-action="attach-library-entry"]').disabled;`),
      true
    );
    await click('[data-action="close-modal"]');
    results.push('The picker prevents accidental duplicate attachments.');
    await click(`[data-action="select"][data-id="${a}"]`);
    await click('[data-action="tab"][data-tab="feature"]');
    await click('[data-action="use-item"]');
    await wait(() => getState().characters[0].resources[0].current === 1);
    assert.equal(getState().characters[0].turn.bonus, false);
    assert.equal(getState().characters[1].turn.bonus, true);
    assert.equal(getState().characters[1].items[0].disabled, true);
    results.push('Spending shared abilities only changes the acting character.');
    await click('[data-action="view-library"]');
    await shot('02-library');
    await click('[data-action="edit-library-entry"]');
    await shot('03-shared-editor');
    await fill('item-form', {
      name: 'Revised test technique',
      source: 'Revised manual p. 84 <img src=x onerror=window.invalidTest=true>',
      description: 'Changed once for both players.',
    });
    await wait(() =>
      getState().characters.every((c) => c.items[0].name === 'Revised test technique')
    );
    assert.equal(getState().characters[0].resources[0].current, 1);
    assert.equal(getState().characters[1].items[0].disabled, true);
    assert.ok(
      getState().characters.every((c) => c.items[0].source.startsWith('Revised manual p. 84'))
    );
    results.push('Editing the library updates all linked characters and preserves spent state.');
    await click('#library-list [data-action="delete-library-entry"]');
    assert.ok(
      await run(`return document.getElementById('toast').innerText.includes('Test player A');`)
    );
    assert.equal(getState().library.length, 1);
    results.push('Deleting an in-use definition is blocked and names affected characters.');
    await click(`[data-action="select"][data-id="${b}"]`);
    await click('[data-action="tab"][data-tab="feature"]');
    await click('[data-action="edit-item"]');
    await fill('item-form', { disabled: false });
    await wait(() => getState().characters[1].items[0].disabled === false);
    assert.equal(getState().characters[0].items[0].resourceCost, 2);
    results.push('The character editor keeps local settings separate from shared text.');
    await click('[data-action="add-item"]');
    await click('[data-action="new-library-entry"]');
    await fill('item-form', {
      name: 'Second test spell',
      kind: 'spell',
      economy: 'action',
      level: 0,
      description: 'Synthetic spell text for testing.',
    });
    await wait(() => getState().library.length === 2);
    assert.equal(getState().characters[1].items.length, 2);
    results.push(
      'Create new saves to the library and attaches to the selected character in one step.'
    );
    await run(
      `commit(()=>{for(const c of state.characters){c.hud.expanded=true;c.hud.panel='feature';c.hud.detailId=c.items[0].id;c.hud.y=50;}state.characters[0].hud.x=25;state.characters[1].hud.x=75;state.characters[1].hud.rotation=180;state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};});await saveQueue;`
    );
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    const overlay = getOverlay();
    await wait(() =>
      overlay.webContents.executeJavaScript(
        `document.body.innerText.includes('Changed once for both players.')`
      )
    );
    assert.equal(getState().characters[1].hud.rotation, 180);
    results.push('Updated shared descriptions reach the TV while preserving individual rotation.');
    await wait(() =>
      overlay.webContents.executeJavaScript(
        `document.querySelectorAll('.hud-metadata').length===2 && [...document.querySelectorAll('.hud-metadata')].every(el=>el.textContent.includes('Revised manual p. 84 <img'))`
      )
    );
    assert.equal(
      await overlay.webContents.executeJavaScript(
        `document.querySelectorAll('.hud-metadata img').length`
      ),
      0
    );
    assert.ok(
      await overlay.webContents.executeJavaScript(
        `[...document.querySelectorAll('.hud-position')].every(el=>el.offsetWidth===880 && el.offsetHeight===650)`
      )
    );
    await click(`[data-action="select"][data-id="${a}"]`);
    await click('[data-action="tab"][data-tab="feature"]');
    await click('[data-action="view-item"]');
    assert.ok(
      await run(
        `return document.querySelector('.modal-body .detail-meta').textContent.includes('Revised manual p. 84 <img');`
      )
    );
    assert.equal(
      await run(`return document.querySelectorAll('.modal-body .detail-meta img').length;`),
      0
    );
    await shot('06-source-details');
    await click('[data-action="close-modal"]');
    // Save an already-open shared editor after another character spends from the HUD.
    await click('[data-action="edit-item"]');
    assert.equal(
      await run(`return document.querySelector('#item-form [name="source"]').maxLength;`),
      300
    );
    await overlay.webContents.executeJavaScript(
      `window.tablelight.hudCommand({type:'use',characterId:${JSON.stringify(b)},itemId:${JSON.stringify(getState().characters[1].items[0].id)}})`
    );
    await fill('item-form', { source: '' });
    await wait(() => getState().library[0].source === '');
    assert.equal(getState().characters[1].turn.bonus, false);
    assert.equal(getState().characters[0].resources[0].current, 1);
    await wait(() =>
      overlay.webContents.executeJavaScript(
        `![...document.querySelectorAll('.hud-metadata small')].some(el=>el.textContent==='Source')`
      )
    );
    await click('[data-action="edit-item"]');
    await fill('item-form', { source: 'Final test reference p. 86' });
    await wait(() => getState().library[0].source === 'Final test reference p. 86');
    assert.equal(getState().characters[1].hud.rotation, 180);
    results.push(
      'Source references match DM, assignment preview, and rotated fixed-size HUDs; clearing hides the row and stale editor saves preserve HUD spending.'
    );
    await wait(() =>
      overlay.webContents.executeJavaScript(
        `document.body.innerText.includes('Final test reference p. 86')`
      )
    );
    fs.writeFileSync(
      path.join(dir, '07-source-hud.png'),
      (await overlay.webContents.capturePage()).toPNG()
    );
    await click('[data-action="view-library"]');
    await run(
      `const el=document.getElementById('library-filter');el.value='spell';el.dispatchEvent(new Event('change',{bubbles:true}));`
    );
    assert.equal(
      await run(`return document.querySelectorAll('#library-list .library-row').length;`),
      1
    );
    await shot('04-filtered-library');
    results.push('Library type filters separate spells from features.');
    await click(`[data-action="select"][data-id="${b}"]`);
    await click('[data-action="tab"][data-tab="feature"]');
    await shot('05-character-ability-controls');
    await click('#ability-list [data-action="delete-item"]');
    await click('#confirm-action');
    await wait(() => getState().characters[1].items.length === 1);
    assert.equal(getState().library.length, 2);
    results.push('Removing an ability from a character leaves its library definition intact.');
    const saved = store.load().state;
    assert.equal(saved.library.length, 2);
    assert.equal(saved.characters[0].items[0].description, 'Changed once for both players.');
    assert.equal(saved.characters[0].items[0].source, 'Final test reference p. 86');
    const raw = JSON.parse(fs.readFileSync(store.file, 'utf8'));
    assert.equal(raw.characters[0].items[0].description, undefined);
    assert.equal(raw.characters[0].items[0].source, undefined);
    assert.equal(raw.version, 5);
    results.push('Reload restores linked abilities; disk stores each definition once.');
    await click('[data-action="view-help"]');
    await click('[data-action="show-license"]');
    await wait(() =>
      run(
        `return document.querySelector('.license-text')?.innerText.includes('GNU GENERAL PUBLIC LICENSE');`
      )
    );
    assert.ok(
      await run(
        `return document.querySelector('.license-text').innerText.includes('Version 3, 29 June 2007');`
      )
    );
    results.push('The full GPL license is accessible inside the app.');
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(dir, 'library-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(dir, 'library-results.json'),
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
