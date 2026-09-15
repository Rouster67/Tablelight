/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
module.exports = async ({ app, controller, getOverlay, getState, screen, setOverlay, store }) => {
  const directory = path.dirname(store.directory),
    results = [],
    errors = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (check) => {
    const start = Date.now();
    while (!(await check())) {
      if (Date.now() - start > 10000) throw new Error('Manual ability test timed out');
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  };
  const click = (selector) =>
    run(
      `const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing '+${JSON.stringify(selector)});el.click();`
    );
  const edit = (fields) =>
    run(
      `const form=document.getElementById('item-form');for(const [key,value] of Object.entries(${JSON.stringify(fields)})){const el=form.elements.namedItem(key);if(!el)throw new Error('Missing field '+key);if(el.type==='checkbox')el.checked=value;else el.value=value;}`
    );
  const submit = () => run(`document.getElementById('item-form').requestSubmit();await saveQueue;`);
  const shot = async (name) => {
    for (let attempt = 0; ; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      try {
        fs.writeFileSync(
          path.join(directory, name + '.png'),
          (await controller.webContents.capturePage()).toPNG()
        );
        return;
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }
  };
  const metadata = (root) =>
    Object.fromEntries(
      [...root.querySelectorAll('.detail-meta>div,.hud-metadata>span')].map((el) => {
        const label = el.querySelector('small').textContent;
        return [label, el.textContent.slice(label.length)];
      })
    );
  let overlay;
  const tv = (code) => overlay.webContents.executeJavaScript(`(async()=>{${code}})()`);
  controller.webContents.on('console-message', (_event, details) => {
    if (details?.level === 'error') errors.push(details.message);
  });
  try {
    await wait(() => run(`return !!document.querySelector('[data-action="add-character"]');`));
    controller.setBounds({ width: 1440, height: 950 });
    controller.showInactive();
    await run(
      `commit(()=>{state=TL.empty();for(let i=0;i<2;i++){const c=TL.character(i);Object.assign(c,{name:i?'Player B':'Player A',proficiency:i?2:6,spellAttack:i?4:18,spellDC:i?12:22});c.resources=[{id:'pool-'+i,name:'Pool '+i,current:4,max:4,reset:'long'}];Object.assign(c.hud,{x:i?75:25,y:50,expanded:true,rotation:i?180:0});state.characters.push(c);}state.activeId=state.characters[0].id;selectedId=state.activeId;view='library';state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};state.settings.overlayInteractive=true;});await saveQueue;`
    );
    const [a, b] = getState().characters.map((c) => c.id);
    await click('[data-action="new-library-entry"]');
    const labels = await run(
      `return [...document.querySelectorAll('#item-form label')].map(el=>el.querySelector('span')?.textContent||el.textContent.trim());`
    );
    for (const label of [
      'Name',
      'Type',
      'Trigger',
      'Duration',
      'Range',
      'Area',
      'Casting Time',
      'Spell Level',
      'Components',
      'School',
      'Attack',
      'Save',
      'On Save',
      'Damage / Healing',
      'Upcast / Upgrades',
      'Requirements',
      'Special',
      'Description',
      'Reference',
      'Linked resource pool',
      'Charges spent per use',
      'Spend a standard spell slot',
      'Concentration',
    ])
      assert.ok(labels.includes(label), label);
    assert.ok(
      !labels.some((label) => /optional|Attack bonus|Save DC|Target saving|override/i.test(label))
    );
    assert.ok(
      await run(
        `return !document.querySelector('#item-form [required]') && document.querySelector('[name="attack"]').type==='text' && document.querySelector('[name="save"]').type==='text';`
      )
    );
    assert.ok(
      await run(
        `const damage=document.querySelector('[name="damage"]').closest('label'),upgrade=document.querySelector('[name="upgrades"]').closest('label');return damage.nextElementSibling===upgrade;`
      )
    );
    await shot('01-manual-editor-top');
    await edit({
      name: 'Manual test ability',
      kind: 'feature',
      economy: 'free',
      level: 2,
      usesSlot: false,
      requiresConcentration: true,
      trigger: 'When an ally falls',
      duration: '1 minute',
      range: '60 ft',
      area: '20 ft radius',
      castingTime: '1 action',
      components: 'V, S',
      school: 'Example school',
      attack: 'Roll +X as written',
      save: 'DEX 15',
      onSave: 'Half damage',
      damage: 'User damage',
      upgrades: 'User upgrades',
      requirements: 'A free hand',
      special: '<img src=x onerror=bad()> special note',
      description: 'Base rules for testing.',
      source: 'Example reference p. 42',
    });
    await run(`document.querySelector('[name="source"]').scrollIntoView({block:'end'});`);
    await shot('02-manual-editor-bottom');
    assert.ok(
      await run(
        `const source=document.querySelector('[name="source"]').closest('label'),description=document.querySelector('[name="description"]').closest('label');return source.previousElementSibling===description && getComputedStyle(source.querySelector('span')).textAlign==='right';`
      )
    );
    await submit();
    await wait(() => getState().library.length === 1);
    results.push(
      'Every requested field is present; Attack and Save are plain text, upgrades follow damage, and Reference follows Description at the bottom right.'
    );
    await run(
      `commit(()=>{for(let i=0;i<2;i++){const c=state.characters[i];const it=TL.attachItem(state,c.id,state.library[0].id,{resourceId:'pool-'+i,resourceCost:i?1:2});c.hud.detailId=it.id;c.hud.panel='feature';}});await saveQueue;`
    );
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    overlay = getOverlay();
    await wait(() => tv(`return document.querySelectorAll('.hud-metadata').length===2;`));
    const readTV = (id) =>
      tv(`return (${metadata.toString()})(document.querySelector('[data-hud-id="${id}"]'));`);
    for (const id of [a, b]) {
      const meta = await readTV(id);
      assert.equal(meta.Attack, 'Roll +X as written');
      assert.equal(meta.Save, 'DEX 15');
      assert.equal(meta['On Save'], 'Half damage');
      assert.equal(meta.Trigger, 'When an ally falls');
      assert.equal(meta['Casting Time'], '1 action');
      assert.equal(meta['Linked resource pool'], id === a ? 'Pool 0' : 'Pool 1');
      assert.equal(meta['Charges spent per use'], id === a ? '2' : '1');
    }
    await click(`[data-action="select"][data-id="${a}"]`);
    await click('[data-action="tab"][data-tab="feature"]');
    await click('[data-action="view-item"]');
    assert.deepEqual(
      await run(`return (${metadata.toString()})(document.querySelector('#ability-details'));`),
      await readTV(a)
    );
    assert.ok(
      await run(
        `return document.querySelector('#ability-details').textContent.includes('A free hand') && document.querySelector('#ability-details').textContent.includes('<img src=x onerror=bad()> special note') && !document.querySelector('#ability-details img');`
      )
    );
    await shot('03-manual-details');
    await click('[data-action="close-modal"]');
    results.push(
      'The DM and both player HUDs show the same entered details with each character’s own pool and charge cost.'
    );
    await click('[data-action="edit-item"]');
    await edit({ onSave: 'No damage' });
    const bItem = getState().characters[1].items[0].id;
    await tv(
      `const el=[...document.querySelectorAll('[data-hud-id="${b}"] [data-hud-command]')].find(el=>{const command=JSON.parse(el.dataset.hudCommand);return command.type==='use'&&command.itemId==='${bItem}';});if(!el||el.disabled)throw new Error('Missing use control');el.click();`
    );
    await require('./approve-pending')(controller);
    await wait(() => getState().characters[1].resources[0].current === 3);
    await submit();
    await wait(() => getState().characters.every((c) => c.items[0].onSave === 'No damage'));
    assert.equal(getState().characters[0].resources[0].current, 4);
    assert.equal(getState().characters[1].resources[0].current, 3);
    assert.equal(getState().characters[1].concentrationItemId, bItem);
    assert.deepEqual(
      getState().characters.map((c) => c.items[0].resourceCost),
      [2, 1]
    );
    results.push(
      'Saving text after a later player use preserves the spent charge, concentration, and both independent resource bindings.'
    );
    const legacyAttack = '  Manual attack\nPreserve spacing  ';
    await run(
      `commit(()=>state.library[0].attack=${JSON.stringify(legacyAttack)});await saveQueue;`
    );
    await click('[data-action="edit-item"]');
    await edit({ school: 'Edited school' });
    await submit();
    assert.equal(getState().library[0].attack, legacyAttack);
    await click('[data-action="view-library"]');
    await run(
      `const el=document.getElementById('library-search');el.value='free hand';el.dispatchEvent(new Event('input',{bubbles:true}));`
    );
    assert.equal(
      await run(`return document.querySelectorAll('#library-list .library-row').length;`),
      1
    );
    results.push(
      'Unchanged legacy text retains whitespace and line breaks, and the new fields are searchable.'
    );
    await run(
      `commit(()=>{Object.assign(state.library[0],{requirements:'r'.repeat(40000),special:'s'.repeat(40000)});for(const c of state.characters)c.hud.page=80;});await saveQueue;`
    );
    await wait(() =>
      tv(
        `return [...document.querySelectorAll('.hud-pagination')].every(el=>el.textContent.includes('81 /'));`
      )
    );
    assert.ok(
      await tv(
        `return [...document.querySelectorAll('.hud-position')].every(el=>el.offsetWidth===880&&el.offsetHeight>=650 && el.querySelector('.hud-summary').scrollHeight<=el.querySelector('.hud-summary').clientHeight+1) && [...document.querySelectorAll('.hud-panel')].every(el=>el.lastElementChild.classList.contains('ability-source'));`
      )
    );
    assert.deepEqual(
      getState().characters.map((c) => c.hud.rotation),
      [0, 180]
    );
    await run(
      `commit(()=>Object.assign(state.library[0],{requirements:'',special:''}));await saveQueue;`
    );
    await wait(() => getState().characters.every((c) => c.hud.page === 0));
    assert.deepEqual(
      getState().characters.map((c) => c.hud.rotation),
      [0, 180]
    );
    results.push(
      'Long Requirements and Special text can be paged; shortening it keeps valid pages and fixed HUD size and rotation.'
    );
    const saved = store.load().state;
    assert.equal(saved.library[0].attack, legacyAttack);
    assert.equal(saved.library[0].onSave, 'No damage');
    assert.equal(saved.characters[1].resources[0].current, 3);
    const raw = JSON.parse(fs.readFileSync(store.file, 'utf8'));
    assert.equal(raw.version, 9);
    assert.equal(raw.characters[0].items[0].onSave, undefined);
    assert.deepEqual(errors, []);
    results.push(
      'Reopening saved data restores manual text and spent resources; the shared definition is stored once.'
    );
    fs.writeFileSync(
      path.join(directory, 'ability-fields-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'ability-fields-results.json'),
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
