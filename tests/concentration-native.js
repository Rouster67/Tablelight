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
      if (Date.now() - start > 10000) throw Error('Concentration check timed out');
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  const click = (selector) =>
    run(
      `const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled)throw Error('Missing control '+${JSON.stringify(selector)});el.click();await saveQueue;`
    );
  const fill = (values) =>
    run(
      `const form=document.getElementById('item-form');for(const [key,value]of Object.entries(${JSON.stringify(values)})){const el=form.elements.namedItem(key);if(el.type==='checkbox')el.checked=value;else el.value=value;}form.requestSubmit();await saveQueue;`
    );
  const shot = async (name, win) => {
    await new Promise((r) => setTimeout(r, 200));
    fs.writeFileSync(path.join(dir, name + '.png'), (await win.webContents.capturePage()).toPNG());
  };
  try {
    await wait(() => run(`return !!state;`));
    controller.setBounds({ width: 1440, height: 950 });
    await run(
      `commit(()=>{const a=TL.character(),b=TL.character();a.name='Focus keeper';b.name='Other player';a.hud={...a.hud,expanded:true,x:50,y:50,rotation:30,scale:0.9};b.hud.visible=false;state.characters=[a,b];selectedId=a.id;state.activeId=a.id;state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};});await saveQueue;`
    );
    await click('[data-action="concentration-toggle"]');
    assert.equal(
      await run(`return document.querySelectorAll('[data-action="concentration-pick"]').length;`),
      0
    );
    assert.ok(
      await run(
        `return document.getElementById('concentration-picker-list').textContent.includes('Requires concentration');`
      )
    );
    await click('[data-action="close-modal"]');
    assert.equal(getState().characters[0].concentrating, false);
    results.push(
      'An empty concentration menu explains how to flag abilities; Cancel makes no state change.'
    );
    for (const [name, kind, economy, flag] of [
      ['Focus action', 'action', 'action', true],
      ['Focus bonus spell', 'spell', 'bonus', true],
      ['Focus reaction feature', 'feature', 'reaction', true],
      ['Ordinary action', 'action', 'action', false],
    ]) {
      await click('[data-action="add-item"]');
      await click('[data-action="new-library-entry"]');
      assert.equal(
        await run(`return document.querySelector('[name="requiresConcentration"]').checked;`),
        false
      );
      await fill({
        name,
        kind,
        economy,
        requiresConcentration: flag,
        description: 'User-defined ' + name,
      });
      assert.equal(getState().characters[0].items.at(-1).requiresConcentration, flag);
    }
    const a = getState().characters[0],
      ids = a.items.slice(0, 3).map((it) => it.id),
      spellLibrary = a.items[1].libraryId;
    await run(
      `commit(()=>{state.library.push(TL.libraryEntry({name:'Unassigned focus',requiresConcentration:true}));const other=state.characters[1];other.items.push(TL.item({name:'Another player only',requiresConcentration:true}));TL.attachItem(state,other.id,${JSON.stringify(spellLibrary)});selected().turn.action=false;});await saveQueue;`
    );
    await click('[data-action="concentration-toggle"]');
    assert.deepEqual(
      await run(
        `return [...document.querySelectorAll('[data-action="concentration-pick"]')].map(el=>el.dataset.id);`
      ),
      ids
    );
    controller.show();
    await shot('01-dm-choose-concentration', controller);
    const before = JSON.stringify(getState().characters[0].turn);
    await click(`[data-action="concentration-pick"][data-id="${ids[1]}"]`);
    assert.equal(getState().characters[0].concentrationItemId, ids[1]);
    assert.equal(getState().characters[0].concentration, 'Focus bonus spell');
    assert.equal(JSON.stringify(getState().characters[0].turn), before);
    assert.equal(getState().characters[1].concentrating, false);
    results.push(
      'Every ability kind can be flagged; DM selection includes only assigned flagged entries across action costs and does not spend resources.'
    );
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    overlay = getOverlay();
    await wait(() => tv(`return !!document.querySelector('.concentration-toggle');`));
    await wait(() => overlay.isVisible());
    await tv(`document.querySelector('.concentration-toggle').click();`);
    await wait(() => !getState().characters[0].concentrating);
    await tv(`document.querySelector('.concentration-toggle').click();`);
    await wait(() => tv(`return !!document.querySelector('[data-concentration-search]');`));
    assert.deepEqual(
      await tv(
        `return [...document.querySelectorAll('[data-hud-concentration-pick]')].map(el=>el.dataset.hudConcentrationPick);`
      ),
      ids
    );
    const frame = await tv(
      `const el=stage.firstElementChild;return [el.offsetWidth,el.offsetHeight,el.style.transform];`
    );
    await shot('02-tv-choose-concentration', overlay);
    await wait(() =>
      tv(`return document.activeElement===document.querySelector('[data-concentration-search]');`)
    );
    await overlay.webContents.insertText('bonus');
    assert.equal(
      await tv(`return document.querySelectorAll('[data-hud-concentration-pick]').length;`),
      1
    );
    await run(`commit(()=>selected().hp=7);await saveQueue;`);
    await wait(() => tv(`return state.characters[0].hp===7;`));
    assert.equal(
      await tv(`return document.querySelector('[data-concentration-search]').value;`),
      'bonus'
    );
    assert.equal(
      await tv(
        `return document.activeElement===document.querySelector('[data-concentration-search]');`
      ),
      true
    );
    assert.deepEqual(
      await tv(
        `const el=stage.firstElementChild;return [el.offsetWidth,el.offsetHeight,el.style.transform];`
      ),
      frame
    );
    await tv(`document.querySelector('[data-hud-concentration-pick]').click();`);
    await wait(() => getState().characters[0].concentrationItemId === ids[1]);
    await wait(() => tv(`return !document.querySelector('.hud-concentration-menu');`));
    assert.equal(
      await tv(`return document.querySelector('.concentration-toggle').title;`),
      'Focus bonus spell'
    );
    results.push(
      'The TV uses the same assigned-only list, supports search through live updates, retains size and rotation, and shows the chosen name on hover.'
    );
    await click('[data-action="view-library"]');
    await click(`[data-action="edit-library-entry"][data-id="${spellLibrary}"]`);
    assert.equal(
      await run(`return document.querySelector('[name="requiresConcentration"]').checked;`),
      true
    );
    await fill({ name: 'Renamed focus spell' });
    await wait(() =>
      tv(`return document.querySelector('.concentration-toggle').title==='Renamed focus spell';`)
    );
    assert.equal(getState().characters[0].concentrationItemId, ids[1]);
    assert.ok(
      getState().characters[1].items.some(
        (it) => it.name === 'Renamed focus spell' && it.requiresConcentration
      )
    );
    await click(`[data-action="edit-library-entry"][data-id="${spellLibrary}"]`);
    await fill({ requiresConcentration: false });
    await wait(() => !getState().characters[0].concentrating);
    await wait(() =>
      tv(`return !document.querySelector('.concentration-toggle').classList.contains('is-on');`)
    );
    await click('[data-action="undo"]');
    await wait(() => getState().characters[0].concentrating);
    assert.equal(getState().characters[0].concentrationItemId, ids[1]);
    results.push(
      'Shared renames update the active tooltip; removing the flag ends affected concentration, and Undo restores it.'
    );
    await click('[data-action="view-character"]');
    await click('[data-action="concentration-edit"]');
    await click(`[data-action="concentration-pick"][data-id="${ids[2]}"]`);
    await wait(() =>
      tv(`return document.querySelector('.concentration-toggle').title==='Focus reaction feature';`)
    );
    const saved = JSON.parse(fs.readFileSync(store.file, 'utf8'));
    assert.equal(saved.characters[0].concentrationItemId, ids[2]);
    assert.ok(saved.library.find((e) => e.id === spellLibrary).requiresConcentration);
    assert.equal(saved.characters[0].items[0].requiresConcentration, undefined);
    results.push(
      'The DM can change the selected ability, and backups persist shared flags once plus the character’s selected binding.'
    );
    fs.writeFileSync(
      path.join(dir, 'concentration-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(dir, 'concentration-results.json'),
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
