/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
module.exports = async ({ app, controller, getOverlay, getState, screen, setOverlay, store }) => {
  const directory = path.dirname(store.directory),
    results = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (fn) => {
    const start = Date.now();
    while (!(await fn())) {
      if (Date.now() - start > 10000) throw new Error('Roster test timed out');
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  const click = (selector) =>
    run(
      `const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing '+${JSON.stringify(selector)});if(el.disabled)throw new Error('Disabled '+${JSON.stringify(selector)});el.click();await saveQueue;`
    );
  const fill = (id, fields) =>
    run(
      `const form=document.getElementById(${JSON.stringify(id)});for(const [key,value] of Object.entries(${JSON.stringify(fields)})){const el=form.elements.namedItem(key);if(!el)throw new Error('Missing field '+key);if(el.type==='checkbox')el.checked=value;else el.value=value;}form.requestSubmit();await saveQueue;`
    );
  const search = (query) =>
    run(
      `const el=document.getElementById('roster-search');el.value=${JSON.stringify(query)};el.dispatchEvent(new Event('input',{bubbles:true}));`
    );
  const shot = async (name, window = controller) => {
    let error;
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 250));
      try {
        fs.writeFileSync(
          path.join(directory, name + '.png'),
          (await window.webContents.capturePage()).toPNG()
        );
        return;
      } catch (e) {
        error = e;
      }
    }
    throw error;
  };
  try {
    await wait(() =>
      run(`return Boolean(document.querySelector('[data-action="add-character"]'));`)
    );
    controller.setBounds({ width: 1440, height: 950 });
    controller.showInactive();
    for (let i = 1; i <= 8; i++) {
      await click('[data-action="add-character"]');
      await fill('character-form', { name: 'Party player ' + i });
    }
    assert.equal(getState().characters.length, 8);
    assert.equal(await run(`return document.querySelectorAll('.party-entry').length;`), 8);
    results.push('Eight players can be created and loaded in the active party.');
    await click('[data-action="add-character"]');
    assert.equal(
      await run(
        `const el=document.querySelector('[name="addToParty"]');return el.disabled&&!el.checked;`
      ),
      true
    );
    await fill('character-form', { name: 'Saved player nine', hp: 4, tempHp: 6 });
    assert.equal(getState().roster.length, 1);
    const inactiveId = getState().roster[0].id,
      firstId = getState().characters[0].id;
    assert.equal(getState().characters.length, 8);
    assert.equal(await run(`return view;`), 'roster');
    assert.equal(await run(`return document.querySelectorAll('.party-entry').length;`), 8);
    results.push('A full party still allows new players to be saved outside the active session.');
    await search('Saved player nine');
    assert.equal(
      await run(
        `return document.querySelector('.roster-row [data-action="roster-add"]').disabled;`
      ),
      true
    );
    await click('.roster-row [data-action="roster-edit"]');
    await fill('character-form', {
      name: 'Saved player nine edited',
      notes: 'PRIVATE SAVED NOTES',
      'ability-dex': 18,
    });
    assert.equal(getState().roster[0].abilities.dex, 18);
    assert.equal(getState().characters.length, 8);
    results.push(
      'Saved players can be edited without taking a party seat; full-party Add controls are disabled.'
    );
    await run(
      `commit(()=>{state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};state.settings.overlayInteractive=true;state.characters[0].notes='PRIVATE ACTIVE NOTES';const c=state.roster[0];c.turn.action=false;c.hud.rotation=123;c.hud.x=31;c.hud.y=68;c.resources=[{id:'test-pool',name:'User pool',max:5,current:2,reset:'long'}];const entry=TL.libraryEntry({name:'Shared roster ability',description:'User entered example'});state.library.push(entry);TL.attachItem(state,c.id,entry.id,{resourceId:'test-pool',disabled:true});});await saveQueue;`
    );
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    const overlay = getOverlay();
    const tv = (code) => overlay.webContents.executeJavaScript(`(async()=>{${code}})()`);
    await wait(() => tv(`return document.querySelectorAll('.hud-position').length===8;`));
    assert.equal(
      await tv(
        `const data=(await window.tablelight.load()).state;return data.characters.length===8&&!('roster' in data)&&!('library' in data)&&!JSON.stringify(data).includes('PRIVATE');`
      ),
      true
    );
    assert.equal(await tv(`return JSON.stringify(state).includes('Saved player nine');`), false);
    results.push(
      'TV initial load receives only eight active players and excludes the saved roster and private notes.'
    );
    await run('autoLayout();');
    await click('#confirm-action');
    assert.equal(new Set(getState().characters.map((c) => c.hud.x + ',' + c.hud.y)).size, 8);
    await wait(() => tv(`return state.characters[7].hud.rotation===90;`));
    await shot('01-eight-bubbles', overlay);
    results.push(
      'Automatic table layout gives all eight players independent positions and rotations.'
    );
    const savedBefore = JSON.parse(JSON.stringify(getState().roster[0]));
    await search('Party player 1');
    await click('.roster-row [data-action="roster-remove"]');
    assert.equal(getState().characters.length, 7);
    await wait(() => tv(`return document.querySelectorAll('.hud-position').length===7;`));
    await search('Saved player nine');
    await click('.roster-row [data-action="roster-add"]');
    assert.equal(getState().characters.length, 8);
    assert.deepEqual(
      getState().characters.find((c) => c.id === inactiveId),
      savedBefore
    );
    await wait(() => tv(`return state.characters.some(c=>c.id===${JSON.stringify(inactiveId)});`));
    assert.equal(
      await tv(
        `return state.characters.find(c=>c.id===${JSON.stringify(inactiveId)}).hud.rotation;`
      ),
      123
    );
    results.push(
      'Swapping party members updates the TV immediately and retains HP, abilities, spent charges, and rotation.'
    );
    await click('.roster-row [data-action="roster-remove"]');
    await wait(() => tv(`return document.querySelectorAll('.hud-position').length===7;`));
    assert.equal(await tv(`return JSON.stringify(state).includes('Saved player nine');`), false);
    await run(`selectedId=state.characters[0].id;view='character';render();`);
    await click('[data-action="long-rest"]');
    await fill('rest-form', { scope: 'party' });
    assert.deepEqual(
      getState().roster.find((c) => c.id === inactiveId),
      savedBefore
    );
    await click('[data-action="next-turn"]');
    assert.notEqual(getState().activeId, inactiveId);
    results.push('Whole-party rests and turn advancement affect active players only.');
    await run(`view='roster';rosterSearch='Saved player nine';render();`);
    await click('.roster-row [data-action="roster-delete"]');
    await click('[data-action="close-modal"]');
    assert.ok(getState().roster.some((c) => c.id === inactiveId));
    await click('.roster-row [data-action="roster-delete"]');
    await click('#confirm-action');
    assert.ok(!getState().roster.some((c) => c.id === inactiveId));
    assert.equal(getState().library.length, 1);
    await click('[data-action="undo"]');
    assert.deepEqual(
      getState().roster.find((c) => c.id === inactiveId),
      savedBefore
    );
    results.push(
      'Delete player asks for confirmation, keeps shared definitions, and supports Undo.'
    );
    await run(`selectedId=state.characters[0].id;view='character';render();`);
    const deletingId = getState().characters[0].id;
    await click('.hero-tools [data-action="roster-delete"]');
    await click('#confirm-action');
    assert.ok(!getState().characters.some((c) => c.id === deletingId));
    await wait(() => tv(`return !state.characters.some(c=>c.id===${JSON.stringify(deletingId)});`));
    await click('[data-action="undo"]');
    assert.ok(getState().characters.some((c) => c.id === deletingId));
    results.push(
      'An active player can be deleted directly from the DM console and restored with Undo.'
    );
    await run(
      `commit(()=>{for(let i=0;i<45;i++){const c=TL.character();c.name='Reserve '+String(i).padStart(3,'0');state.roster.push(c);}view='roster';rosterSearch='';rosterPage=0;});await saveQueue;`
    );
    assert.equal(await run(`return document.querySelectorAll('.roster-row').length;`), 12);
    const firstPage = await run(
      `return [...document.querySelectorAll('.roster-row')].map(e=>e.dataset.playerId);`
    );
    await click('[data-action="roster-page"][data-amount="1"]');
    const secondPage = await run(
      `return [...document.querySelectorAll('.roster-row')].map(e=>e.dataset.playerId);`
    );
    assert.ok(secondPage.every((id) => !firstPage.includes(id)));
    await search('Reserve 044');
    assert.equal(await run(`return document.querySelectorAll('.roster-row').length;`), 1);
    assert.equal(await run(`return document.activeElement.id;`), '');
    results.push(
      'Large rosters render twelve players per page, with working search and pagination.'
    );
    await search('');
    await run(
      `document.getElementById('roster-filter').value='party';document.getElementById('roster-filter').dispatchEvent(new Event('change',{bubbles:true}));`
    );
    assert.equal(await run(`return document.querySelectorAll('.roster-row').length;`), 7);
    await shot('02-active-party');
    controller.setBounds({ width: 1024, height: 768 });
    await run('render();');
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(await run(`return document.documentElement.scrollWidth<=innerWidth+1;`), true);
    assert.equal(
      await run(
        `const el=document.querySelector('.sidebar');return el.scrollWidth<=el.clientWidth+1;`
      ),
      true
    );
    await shot('03-small-laptop');
    results.push('Roster filters and management controls fit the smaller laptop window.');
    const ids = getState().characters.map((c) => c.id);
    await run(
      `commit(()=>{for(const id of ${JSON.stringify(ids)})TL.removeFromParty(state,id);view='character';});await saveQueue;`
    );
    assert.equal(await run(`return document.querySelectorAll('.party-entry').length;`), 0);
    await wait(() => tv(`return document.querySelectorAll('.hud-position').length===0;`));
    assert.equal(getState().roster.length, 54);
    await run(`commit(()=>TL.addToParty(state,${JSON.stringify(firstId)}));await saveQueue;`);
    assert.equal(getState().characters.length, 1);
    results.push(
      'An empty party leaves every player saved and clears all TV bubbles; a new party can be chosen.'
    );
    const loaded = store.load().state;
    assert.equal(loaded.characters.length, 1);
    assert.equal(loaded.roster.length, 53);
    assert.deepEqual(
      loaded.roster.find((c) => c.id === inactiveId),
      savedBefore
    );
    const raw = JSON.parse(fs.readFileSync(store.file, 'utf8'));
    assert.equal(raw.roster.find((c) => c.id === inactiveId).items[0].description, undefined);
    assert.equal(raw.version, 5);
    results.push(
      'Reload restores the complete roster, active membership, and linked abilities without duplicated rules.'
    );
    fs.writeFileSync(
      path.join(directory, 'roster-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'roster-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
    try {
      await shot('failure');
    } catch {}
  } finally {
    setOverlay(false);
    app.quit();
  }
};
