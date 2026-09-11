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
      if (Date.now() - start > 10000) throw Error('Condition picker check timed out');
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  const click = (selector) =>
    run(
      `const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled)throw Error('Missing control '+${JSON.stringify(selector)});el.click();await saveQueue;`
    );
  const query = (value) =>
    run(
      `const el=document.getElementById('condition-picker-search');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));`
    );
  const shot = async (name, win) => {
    await new Promise((r) => setTimeout(r, 200));
    fs.writeFileSync(path.join(dir, name + '.png'), (await win.webContents.capturePage()).toPNG());
  };
  try {
    await wait(() => run(`return !!state;`));
    controller.setBounds({ width: 1440, height: 950 });
    await run(
      `commit(()=>{const a=TL.character(),b=TL.character();a.name='First player';b.name='Second player';a.hud={...a.hud,expanded:true,x:50,y:50,rotation:15,scale:0.9};b.hud.visible=false;state.characters=[a,b];state.activeId=a.id;selectedId=a.id;state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};state.conditionLibrary=[TL.conditionEntry({name:'Library condition',description:'A searchable description'})];state.settings.overlayInteractive=true;});await saveQueue;`
    );
    assert.equal(
      await run(`return document.querySelector('[data-action="conditions"]').textContent;`),
      'Add'
    );
    await click('[data-action="conditions"]');
    await query('searchable');
    await click('[data-action="condition-pick"]');
    assert.equal(getState().characters[0].conditionIds.length, 1);
    assert.equal(getState().characters[1].conditionIds.length, 0);
    assert.equal(
      await run(`return document.querySelector('[data-action="condition-pick"]').textContent;`),
      'Added'
    );
    assert.equal(
      await run(`return document.querySelector('[data-action="condition-pick"]').disabled;`),
      true
    );
    await query('Amber glow');
    assert.equal(
      await run(`return document.querySelectorAll('[data-action="condition-pick"]').length;`),
      0
    );
    await click('[data-action="condition-create-for"]');
    assert.equal(
      await run(`return document.querySelector('#condition-form [name="name"]').value;`),
      'Amber glow'
    );
    await click('[data-action="close-modal"]');
    assert.equal(getState().conditionLibrary.length, 1);
    results.push(
      'DM Add searches names and descriptions, marks applied entries Added, and Cancel leaves the library unchanged.'
    );
    await click('[data-action="conditions"]');
    await query('Amber glow');
    await click('[data-action="condition-create-for"]');
    await run(
      `const form=document.getElementById('condition-form');form.elements.description.value='A new custom description';form.requestSubmit();await saveQueue;`
    );
    const created = getState().conditionLibrary.find((e) => e.name === 'Amber glow');
    assert.ok(created);
    assert.ok(getState().characters[0].conditionIds.includes(created.id));
    assert.equal(getState().characters[1].conditionIds.length, 0);
    await click('[data-action="undo"]');
    assert.equal(getState().conditionLibrary.length, 1);
    assert.equal(getState().characters[0].conditionIds.length, 1);
    results.push(
      'Create new saves and applies the condition in one operation; Undo reverses both without affecting another character.'
    );
    await run(
      `commit(()=>{state.conditionLibrary.push(TL.conditionEntry({name:'TV choice',description:'An unassigned saved definition'}));});await saveQueue;`
    );
    const choice = getState().conditionLibrary.find((e) => e.name === 'TV choice');
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    overlay = getOverlay();
    await wait(() => tv(`return !!document.querySelector('[data-hud-conditions]');`));
    const frame = await tv(
      `const el=stage.firstElementChild;return [el.offsetWidth,el.offsetHeight,el.style.transform];`
    );
    await tv(`document.querySelector('[data-hud-conditions]').click();`);
    await wait(() =>
      tv(`return document.querySelectorAll('[data-hud-condition-pick]').length===2;`)
    );
    assert.equal(
      await tv(
        `return document.querySelector('.hud-condition-menu').textContent.includes('Create new');`
      ),
      false
    );
    await wait(() =>
      tv(`return document.activeElement===document.querySelector('[data-hud-condition-search]');`)
    );
    await overlay.webContents.insertText('unassigned');
    await wait(() =>
      tv(`return document.querySelectorAll('[data-hud-condition-pick]').length===1;`)
    );
    assert.equal(
      await tv(
        `return document.querySelector('[data-hud-condition-pick]').dataset.hudConditionPick;`
      ),
      choice.id
    );
    await run(`commit(()=>selected().hp=8);await saveQueue;`);
    await wait(() => tv(`return state.characters[0].hp===8;`));
    assert.equal(
      await tv(`return document.querySelector('[data-hud-condition-search]').value;`),
      'unassigned'
    );
    assert.equal(
      await tv(
        `return document.activeElement===document.querySelector('[data-hud-condition-search]');`
      ),
      true
    );
    await tv(`document.querySelector('[data-hud-condition-pick]').click();`);
    await wait(() => getState().characters[0].conditionIds.includes(choice.id));
    await wait(() =>
      tv(`return document.querySelector('[data-hud-condition-pick]')?.textContent==='Added';`)
    );
    assert.equal(getState().characters[1].conditionIds.length, 0);
    assert.equal(getState().conditionLibrary.length, 2);
    assert.deepEqual(
      await tv(
        `const el=stage.firstElementChild;return [el.offsetWidth,el.offsetHeight,el.style.transform];`
      ),
      frame
    );
    await shot('01-tv-add-conditions', overlay);
    assert.ok(
      await tv(
        `const menu=document.querySelector('.hud-condition-menu').getBoundingClientRect(), summary=document.querySelector('.hud-summary').getBoundingClientRect();return menu.top>=summary.top-1 && menu.bottom<=summary.bottom+1;`
      ),
      'Open Add menu must stay visible after live updates and assignment.'
    );
    results.push(
      'TV Add searches saved conditions, accepts keyboard input, preserves drafts during live updates, prevents duplicates, and keeps HUD size and rotation.'
    );
    await run(
      `commit(()=>state.conditionLibrary.find(e=>e.id===${JSON.stringify(choice.id)}).description='Updated while picker is open');await saveQueue;`
    );
    await wait(() =>
      tv(`return document.querySelectorAll('[data-hud-condition-pick]').length===0;`)
    );
    await tv(
      `const el=document.querySelector('[data-hud-condition-search]');el.value='updated';el.dispatchEvent(new Event('input',{bubbles:true}));`
    );
    await wait(() =>
      tv(`return document.querySelectorAll('[data-hud-condition-pick]').length===1;`)
    );
    assert.ok(
      await tv(
        `try {await window.tablelight.hudCommand({type:'condition-create',characterId:state.characters[0].id,name:'Forbidden creation'});return false;}catch{return true;}`
      )
    );
    assert.equal(getState().conditionLibrary.length, 2);
    await run(`commit(()=>state.settings.overlayInteractive=false);await saveQueue;`);
    await wait(() => tv(`return !state.settings.overlayInteractive;`));
    assert.equal(await tv(`return document.querySelector('[data-hud-conditions]');`), null);
    assert.equal(await tv(`return document.querySelector('.hud-condition-menu');`), null);
    assert.ok(
      await tv(`try{await window.tablelight.searchConditions('');return false;}catch{return true;}`)
    );
    results.push(
      'An open TV picker reflects library edits, cannot create definitions, and closes with all input disabled in click-through mode.'
    );
    setOverlay(false);
    controller.show();
    await click('[data-action="conditions"]');
    await shot('02-dm-add-conditions', controller);
    await click('[data-action="close-modal"]');
    assert.equal(
      JSON.parse(fs.readFileSync(store.file, 'utf8')).characters[0].conditionIds.length,
      2
    );
    fs.writeFileSync(
      path.join(dir, 'condition-picker-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(dir, 'condition-picker-results.json'),
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
