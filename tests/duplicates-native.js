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
      if (Date.now() - start > 10000) throw new Error('Duplicate check timed out');
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  const click = (selector) =>
    run(
      `const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled)throw new Error('Unavailable '+${JSON.stringify(selector)});el.click();`
    );
  const edit = (fields) =>
    run(
      `const form=document.getElementById('item-form');for(const [key,value]of Object.entries(${JSON.stringify(fields)})){const el=form.elements.namedItem(key);if(!el)throw new Error('Missing field '+key);if(el.type==='checkbox')el.checked=value;else el.value=value;}`
    );
  const submit = () => run(`document.getElementById('item-form').requestSubmit();await saveQueue;`);
  const shot = async (name) => {
    for (let i = 0; ; i++) {
      await new Promise((r) => setTimeout(r, 300));
      try {
        fs.writeFileSync(
          path.join(dir, name + '.png'),
          (await controller.webContents.capturePage()).toPNG()
        );
        return;
      } catch (e) {
        if (i === 3) throw e;
      }
    }
  };
  let overlay;
  const tv = (code) => overlay.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const hudUse = async (id) => {
    await tv(
      `const el=[...document.querySelectorAll('[data-hud-command]')].find(el=>{const command=JSON.parse(el.dataset.hudCommand);return command.type==='use'&&command.itemId===${JSON.stringify(id)};});if(!el||el.disabled)throw new Error('Missing use control');el.click();`
    );
    await require('./approve-pending')(controller);
  };
  controller.webContents.on('console-message', (_e, d) => {
    if (d?.level === 'error') errors.push(d.message);
  });
  try {
    await wait(() => run(`return !!document.querySelector('[data-action="add-character"]');`));
    controller.setBounds({ width: 1440, height: 950 });
    controller.showInactive();
    await run(
      `commit(()=>{state=TL.empty();state.library=[TL.libraryEntry({name:'Guiding Bolt',kind:'spell',level:1,description:'Synthetic rules text',source:'Test reference',upgrades:'Entered upgrades',special:'Entered special'})];for(let i=0;i<2;i++){const c=TL.character(i);c.name='Player '+i;c.slots[0]={level:1,current:3,max:3};c.resources=[{id:'pool-'+i,name:'Special casts',current:2,max:2,reset:'long'}];Object.assign(c.hud,{x:i?75:25,y:50,rotation:i?180:0,expanded:true});state.characters.push(c);TL.attachItem(state,c.id,state.library[0].id);}state.activeId=state.characters[0].id;selectedId=state.activeId;view='library';state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};state.settings.overlayInteractive=true;});await saveQueue;`
    );
    const [a, b] = getState().characters.map((c) => c.id),
      source = getState().library[0].id,
      original = getState().characters[0].items[0].id;
    await click(`[data-action="duplicate-library-entry"][data-id="${source}"]`);
    await wait(() => getState().library.length === 2);
    assert.equal(
      await run(`return document.querySelector('[name="name"]').value;`),
      'Guiding Bolt (1)'
    );
    await edit({ description: 'Library variant' });
    await submit();
    assert.equal(getState().library[0].description, 'Synthetic rules text');
    assert.ok(getState().characters.every((c) => c.items.length === 1));
    await click(`[data-action="duplicate-library-entry"][data-id="${source}"]`);
    assert.equal(
      await run(`return document.querySelector('[name="name"]').value;`),
      'Guiding Bolt (2)'
    );
    await click('[data-action="close-modal"]');
    await click('[data-action="undo"]');
    await wait(() => getState().library.length === 2);
    assert.equal(getState().library[1].name, 'Guiding Bolt (1)');
    controller.setBounds({ width: 1100, height: 800 });
    assert.ok(
      await run(
        `return [...document.querySelectorAll('#library-list button')].every(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;});`
      )
    );
    await shot('01-library-duplicate');
    controller.setBounds({ width: 1440, height: 950 });
    results.push(
      'Library Duplicate creates numbered independent definitions, opens the copy for editing, stays within a laptop window, and supports Undo.'
    );
    await click(`[data-action="select"][data-id="${a}"]`);
    await click('[data-action="tab"][data-tab="spell"]');
    controller.setBounds({ width: 1100, height: 800 });
    assert.ok(
      await run(
        `const button=document.querySelector('#ability-list [data-action="duplicate-local-item"]'),group=button.closest('.character-ability-controls'),children=[...group.children],rects=children.map(el=>el.getBoundingClientRect()),r=button.getBoundingClientRect();return button.textContent==='' && button.title==='Duplicate locally only' && button.getAttribute('aria-label')==='Duplicate locally only' && !!button.querySelector('svg[aria-hidden="true"]') && children.map(el=>el.dataset.action).join(',')==='view-item,use-item,duplicate-local-item,edit-item,delete-item' && rects.slice(0,4).every(rect=>Math.abs(rect.top-r.top)<1) && rects[4].top>=r.bottom && r.width===32 && r.left>=0 && rects[3].right<=innerWidth && !document.querySelector('#ability-details');`
      )
    );
    await shot('02-duplicate-local-button');
    controller.setBounds({ width: 1440, height: 950 });
    await run(
      `document.querySelector('[data-action="duplicate-local-item"][data-id="${original}"] svg').dispatchEvent(new MouseEvent('click',{bubbles:true}));`
    );
    await wait(() => getState().characters[0].items.length === 2);
    const copy = getState().characters[0].items[1].id;
    assert.equal(getState().characters[0].items[1].name, 'Guiding Bolt (1)');
    assert.equal(getState().library.length, 2);
    assert.ok(
      await run(
        `return document.getElementById('modal-title').textContent==='Edit character-only ability' && document.querySelector('#item-form .note').textContent.includes('Only for Player 0');`
      )
    );
    await edit({
      usesSlot: false,
      resourceId: 'pool-0',
      resourceCost: 1,
      description: 'Character-only rules',
      special: 'Local special <img src=x onerror=bad()>',
    });
    await submit();
    assert.equal(getState().characters[0].items[0].usesSlot, true);
    assert.equal(getState().characters[1].items.length, 1);
    assert.equal(getState().library[0].description, 'Synthetic rules text');
    assert.ok(
      await run(
        `const local=document.querySelector('[data-action="view-item"][data-id="${copy}"]').closest('.ability-row').querySelector('.ability-main b');return local.firstElementChild?.classList.contains('ability-local-icon') && local.textContent==='Guiding Bolt (1)' && !document.querySelector('[data-action="view-item"][data-id="${original}"]').closest('.ability-row').querySelector('.ability-local-icon');`
      )
    );
    await click(`[data-action="view-item"][data-id="${copy}"]`);
    assert.ok(
      await run(`return !document.querySelector('.modal [data-action="duplicate-local-item"]');`)
    );
    assert.ok(
      await run(
        `return document.querySelector('#ability-details').textContent.includes('Character-only rules') && !document.querySelector('#ability-details img') && !!document.querySelector('#modal-title > .ability-local-icon');`
      )
    );
    await shot('03-local-details');
    await click('[data-action="close-modal"]');
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    overlay = getOverlay();
    await wait(() =>
      tv(
        `return document.querySelector('[data-hud-id="${a}"]').textContent.includes('Character-only rules');`
      )
    );
    assert.ok(
      await tv(
        `return [...document.querySelectorAll('.hud-position')].every(el=>el.offsetWidth===880&&el.offsetHeight>=650 && el.querySelector('.hud-summary').scrollHeight<=el.querySelector('.hud-summary').clientHeight+1) && !!document.querySelector('[data-hud-id="${a}"] h3 .ability-local-icon');`
      )
    );
    results.push(
      'Character rows show View, Use, a compact copy icon with tooltip, and Edit on one line, with Remove below. The icon creates an independent local copy; details have no duplicate control.'
    );
    // A use arrives after the local editor opens: saving its text must retain that spending.
    await click(`[data-action="edit-item"][data-id="${copy}"]`);
    await edit({ requirements: 'Edited while in use' });
    await hudUse(copy);
    await wait(() => getState().characters[0].resources[0].current === 1);
    await submit();
    assert.equal(getState().characters[0].resources[0].current, 1);
    assert.equal(getState().characters[0].slots[0].current, 3);
    await run(`commit(()=>TL.startTurn(state.characters[0]));await saveQueue;`);
    await hudUse(copy);
    await wait(() => getState().characters[0].resources[0].current === 0);
    await run(`commit(()=>TL.startTurn(state.characters[0]));await saveQueue;`);
    await wait(() =>
      tv(
        `const controls=[...document.querySelectorAll('[data-hud-id="${a}"] [data-hud-command]')];return controls.some(el=>JSON.parse(el.dataset.hudCommand).type==='use'&&el.disabled);`
      )
    );
    assert.equal(getState().characters[0].slots[0].current, 3);
    await click(`[data-action="use-item"][data-id="${original}"]`);
    await click('[form="cast-form"][type="submit"]');
    await wait(() => getState().characters[0].slots[0].current === 2);
    assert.equal(getState().characters[0].resources[0].current, 0);
    assert.equal(getState().characters[1].slots[0].current, 3);
    await run(`commit(()=>TL.rest(state.characters[0],'long'));await saveQueue;`);
    await wait(() => getState().characters[0].resources[0].current === 2);
    results.push(
      'Two approved HUD uses spend the special pool without slots; the original spends a slot, later editor saves preserve spending, and long rest restores the pool.'
    );
    await click('[data-action="view-library"]');
    await click(`[data-action="edit-library-entry"][data-id="${source}"]`);
    await edit({ description: 'Revised shared rules' });
    await submit();
    assert.ok(
      getState().characters.every((c) => c.items[0].description === 'Revised shared rules')
    );
    assert.equal(getState().characters[0].items[1].description, 'Character-only rules');
    const libraryBefore = JSON.parse(JSON.stringify(getState().library));
    await click(`[data-action="select"][data-id="${a}"]`);
    await click('[data-action="tab"][data-tab="spell"]');
    await click(`[data-action="duplicate-local-item"][data-id="${copy}"]`);
    assert.equal(
      await run(`return document.querySelector('[name="name"]').value;`),
      'Guiding Bolt (2)'
    );
    await click('[data-action="close-modal"]');
    await click('[data-action="undo"]');
    await wait(() => getState().characters[0].items.length === 2);
    await click(`[data-action="delete-item"][data-id="${copy}"]`);
    assert.ok(
      await run(
        `return document.querySelector('.modal-body').textContent.includes('character-only copy');`
      )
    );
    await click('#confirm-action');
    await wait(() => getState().characters[0].items.length === 1);
    await click('[data-action="undo"]');
    await wait(() => getState().characters[0].items.length === 2);
    assert.deepEqual(getState().library, libraryBefore);
    results.push(
      'Shared edits leave local text intact. Local copies can be duplicated, removed, and restored with Undo without changing the library.'
    );
    await run(`commit(()=>TL.removeFromParty(state,${JSON.stringify(a)}));await saveQueue;`);
    assert.equal(store.load().state.roster[0].items[1].id, copy);
    await run(`commit(()=>TL.addToParty(state,${JSON.stringify(a)}));await saveQueue;`);
    const disk = JSON.parse(fs.readFileSync(store.file, 'utf8')),
      saved = store.load().state;
    assert.equal(disk.version, 11);
    assert.equal(disk.library.length, 2);
    const rawLocal = disk.characters.find((c) => c.id === a).items.find((it) => it.id === copy);
    assert.equal(rawLocal.local, true);
    assert.equal(rawLocal.libraryId, '');
    assert.equal(rawLocal.requirements, 'Edited while in use');
    assert.equal(saved.characters.find((c) => c.id === a).items[1].usesSlot, false);
    controller.webContents.reload();
    await wait(() => !controller.webContents.isLoading());
    await wait(() => run(`return !!document.querySelector('[data-action="view-library"]');`));
    await click(`[data-action="select"][data-id="${a}"]`);
    await click('[data-action="tab"][data-tab="spell"]');
    await click(`[data-action="edit-item"][data-id="${copy}"]`);
    assert.ok(
      await run(
        `return document.getElementById('modal-title').textContent==='Edit character-only ability' && !document.querySelector('[name="usesSlot"]').checked && document.querySelector('[name="resourceId"]').value==='pool-0';`
      )
    );
    await shot('04-reopened-local-editor');
    await click('[data-action="close-modal"]');
    assert.deepEqual(errors, []);
    results.push(
      'Local copies survive moving out of the party, rejoining, disk save, and reopening the app, with their details stored only on the character.'
    );
    const beforeLocalCreate = JSON.parse(JSON.stringify(getState()));
    await click('[data-action="add-item"]');
    controller.setBounds({ width: 1100, height: 800 });
    assert.ok(
      await run(
        `return [...document.querySelectorAll('.library-choice-group')].length===2 && [...document.querySelectorAll('.library-choice-group')].every(group=>{const main=group.querySelector('.library-choice'),small=group.querySelector('.library-local-choice'),m=main.getBoundingClientRect(),s=small.getBoundingClientRect();return s.top>=m.bottom&&s.height<m.height&&Math.abs(s.width-m.width)<1&&s.right<=innerWidth&&small.title.includes('library');});`
      )
    );
    await shot('05-add-local-options');
    await click('[data-action="new-local-item"]');
    assert.equal(
      await run(`return document.getElementById('modal-title').textContent;`),
      'Create a character-only ability'
    );
    await edit({ name: 'Cancelled local ability' });
    await click('[data-action="close-modal"]');
    assert.deepEqual(getState(), beforeLocalCreate);
    controller.setBounds({ width: 1440, height: 950 });
    await click('[data-action="add-item"]');
    await click('[data-action="new-local-item"]');
    await edit({
      name: 'Local <ability>',
      kind: 'spell',
      usesSlot: false,
      description: 'New local rules',
      resourceId: 'pool-0',
      resourceCost: 2,
    });
    await submit();
    const created = getState()
      .characters.find((c) => c.id === a)
      .items.find((it) => it.name === 'Local <ability>');
    assert.ok(created?.local);
    assert.equal(created.libraryId, '');
    assert.equal(created.resourceCost, 2);
    assert.deepEqual(getState().library, beforeLocalCreate.library);
    assert.deepEqual(
      getState().characters.find((c) => c.id === b),
      beforeLocalCreate.characters.find((c) => c.id === b)
    );
    await click(`[data-action="view-item"][data-id="${created.id}"]`);
    assert.ok(
      await run(
        `const title=document.getElementById('modal-title');return title.textContent==='Local <ability>'&&title.firstElementChild?.classList.contains('ability-local-icon')&&!title.querySelector('ability');`
      )
    );
    await click('[data-action="close-modal"]');
    await shot('06-local-name-icons');
    results.push(
      'Add shows two small local options below their shared choices with explanatory tooltips. Creating locally saves only to the character; cancelling a blank draft changes nothing. Local names have an accessible prefix icon and escaped, unchanged text.'
    );
    await click('[data-action="add-item"]');
    await click('[data-action="choose-local-library-entry"]');
    await run(
      `const search=document.getElementById('library-picker-search'),filter=document.getElementById('library-picker-filter');search.value='Guiding';search.dispatchEvent(new Event('input',{bubbles:true}));filter.value='spell';filter.dispatchEvent(new Event('change',{bubbles:true}));`
    );
    assert.ok(
      await run(
        `return !!document.querySelector('[data-action="copy-library-locally"][data-id="${source}"]:not(:disabled)') && !document.querySelector('#library-picker-list [data-action="edit-library-entry"]') && !document.querySelector('#library-picker-list [data-action="attach-library-entry"]');`
      )
    );
    await click(`[data-action="copy-library-locally"][data-id="${source}"]`);
    assert.equal(
      await run(`return document.querySelector('[name="name"]').value;`),
      'Guiding Bolt (2)'
    );
    await click('[data-action="close-modal"]');
    await run('await saveQueue;');
    const copied = getState()
      .characters.find((c) => c.id === a)
      .items.find((it) => it.name === 'Guiding Bolt (2)');
    assert.ok(copied.local);
    assert.equal(copied.libraryId, '');
    assert.equal(copied.resourceId, '');
    assert.deepEqual(getState().library, beforeLocalCreate.library);
    assert.ok(
      store
        .load()
        .state.characters.find((c) => c.id === a)
        .items.some((it) => it.id === created.id && it.local)
    );
    assert.ok(
      store
        .load()
        .state.characters.find((c) => c.id === a)
        .items.some((it) => it.id === copied.id && it.local)
    );
    await click('[data-action="undo"]');
    await wait(
      () =>
        !getState()
          .characters.find((c) => c.id === a)
          .items.some((it) => it.id === copied.id)
    );
    assert.ok(
      getState()
        .characters.find((c) => c.id === a)
        .items.some((it) => it.id === created.id)
    );
    assert.deepEqual(getState().library, beforeLocalCreate.library);
    assert.deepEqual(errors, []);
    results.push(
      'The local library picker preserves its mode through searching and filtering, permits copying an already assigned spell, numbers collisions and saves the independent copy only on the character. Undo removes that copy while retaining the earlier new local ability.'
    );
    fs.writeFileSync(
      path.join(dir, 'duplicates-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(dir, 'duplicates-results.json'),
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
