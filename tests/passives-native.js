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
      if (Date.now() - start > 10000) throw Error('Passive ability test timed out.');
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  };
  const edit = (fields) =>
    run(`const form=document.getElementById('item-form');
      for(const [key,value] of Object.entries(${JSON.stringify(fields)})) {
        const el=form.elements.namedItem(key);
        if(el.type==='checkbox') el.checked=value; else el.value=value;
        el.dispatchEvent(new Event('change',{bubbles:true}));
      }`);
  const submit = async () => {
    await run("document.getElementById('item-form').requestSubmit(); await saveQueue;");
    await wait(() => run("return !document.getElementById('item-form');"));
  };
  const shot = async (name) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    fs.writeFileSync(
      path.join(directory, name + '.png'),
      (await controller.webContents.capturePage()).toPNG()
    );
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
        a.name='Mira'; b.name='Rowan';
        a.resources=[{id:'pool-a',name:'Lantern charges',current:3,max:5,reset:'long'}];
        b.resources=[{id:'pool-b',name:'Beacon charges',current:1,max:4,reset:'short'}];
        Object.assign(a.hud,{expanded:true,rotation:90,scale:0.8});
        state.characters=[a]; state.roster=[b];
        TL.attachItem(state,a.id,'shared',{resourceId:'pool-a',resourceCost:2});
        TL.attachItem(state,b.id,'shared',{resourceId:'pool-b',resourceCost:3,disabled:true});
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

    controller.setBounds({ width: 1440, height: 950 });
    controller.showInactive();
    await run('editLibraryEntry();');
    assert.equal(
      await run(
        "return document.getElementById('item-form').elements.namedItem('behavior').value;"
      ),
      'active'
    );
    await edit({ name: 'Unsaved draft', kind: 'spell', behavior: 'passive' });
    await run('closeModal();');
    assert.deepEqual(getState(), saved);
    results.push('New abilities start Active; canceling a behavior/type draft changes nothing.');

    for (const [kind, economy] of [
      ['action', 'free'],
      ['spell', 'reaction'],
      ['feature', 'bonus'],
    ]) {
      for (const behavior of ['active', 'passive', 'hybrid']) {
        const beforeEdit = TL.clone(getState());
        await run(`editLibraryEntry('shared','mira',${JSON.stringify(itemId)});`);
        await edit({
          kind,
          behavior,
          economy,
          level: 2,
          usesSlot: true,
          requiresConcentration: true,
          castingTime: 'As described by the DM',
        });
        const fields = await run(`const form=document.getElementById('item-form');
          const cost=form.elements.namedItem('economy'), behavior=form.elements.namedItem('behavior');
          const box=behavior.getBoundingClientRect(), costBox=cost.getBoundingClientRect();
          return {
            visible:cost.checkVisibility(),
            beside:box.top===costBox.top && box.right<costBox.left,
            values:new FormData(form).get('economy'),
            options:[...cost.options].map(option=>option.value),
            fields:['level','usesSlot','requiresConcentration','resourceId','resourceCost','castingTime','attack','save','description'].every(key=>{
              const el=form.elements.namedItem(key); return el.checkVisibility() && !el.disabled;
            })
          };`);
        assert.equal(fields.visible, behavior !== 'passive');
        if (behavior !== 'passive') assert.equal(fields.beside, true);
        assert.equal(fields.values, economy);
        assert.deepEqual(fields.options, ['action', 'bonus', 'reaction', 'free']);
        assert.equal(fields.fields, true, kind + ' must retain all fields and costs');
        if (kind === 'feature') await shot('editor-' + behavior);
        await submit();
        Object.assign(beforeEdit.library[0], {
          kind,
          behavior,
          economy,
          level: 2,
          usesSlot: true,
          requiresConcentration: true,
          castingTime: 'As described by the DM',
        });
        assert.deepEqual(getState(), TL.normalize(beforeEdit));
        assert.deepEqual(store.load().state, getState());
      }
    }
    results.push(
      'All three types save all three behaviors with unrestricted spell, resource, concentration, and turn costs; shared edits preserve each active/inactive character and HUD.'
    );

    const beforeToggle = TL.clone(getState());
    await run(`editLibraryEntry('shared','mira',${JSON.stringify(itemId)});`);
    await edit({ economy: 'reaction', description: 'Keep this draft text', behavior: 'passive' });
    await edit({ behavior: 'active' });
    assert.deepEqual(
      await run(
        `const form=document.getElementById('item-form'); return ['economy','description','resourceId','resourceCost'].map(key=>form.elements.namedItem(key).value);`
      ),
      ['reaction', 'Keep this draft text', 'pool-a', '2']
    );
    await submit();
    await run('await undo();');
    assert.deepEqual(getState(), beforeToggle);
    results.push(
      'Switching behavior retains unsaved text and dormant costs; Undo restores the complete prior state.'
    );

    await run("const c=state.characters[0]; editLibraryEntry('',c.id,c.items[1].id);");
    await edit({ behavior: 'hybrid', economy: 'reaction', kind: 'spell' });
    await submit();
    const local = getState().characters[0].items[1];
    assert.equal(local.behavior, 'hybrid');
    assert.equal(local.economy, 'reaction');
    assert.equal(local.kind, 'spell');
    assert.equal(local.trackPassive, true);
    assert.deepEqual(getState().library, beforeToggle.library);
    assert.deepEqual(getState().roster, beforeToggle.roster);
    results.push(
      'The same controls save a character-only ability independently of the shared library and other characters.'
    );

    controller.setBounds({ width: 940, height: 660 });
    await run("editLibraryEntry('shared');");
    assert.ok(
      await run(`const modal=document.querySelector('.modal'), body=document.querySelector('.modal-body');
      const fields=['kind','behavior','economy'].map(key=>document.querySelector('[name="'+key+'"]').getBoundingClientRect());
      const frame=body.getBoundingClientRect();
      return body.scrollWidth<=body.clientWidth && modal.getBoundingClientRect().right<=innerWidth && fields.every(box=>box.top>=frame.top && box.bottom<=frame.bottom && box.right<=frame.right);`)
    );
    await shot('editor-minimum-size');
    await run('closeModal();');
    results.push(
      'Type, Behavior, and Turn cost remain visible without horizontal overflow at the 940 × 660 minimum window size.'
    );

    await run(
      "await commit(()=>{const c=state.roster[0]; TL.setConcentration(c,true,c.items[0].id);}); editLibraryEntry('shared');"
    );
    const concentrating = TL.clone(getState());
    await edit({ behavior: 'passive' });
    await run("document.getElementById('item-form').requestSubmit(); await saveQueue;");
    await wait(() =>
      run(
        "return document.getElementById('form-error').textContent.includes('End or change concentration');"
      )
    );
    assert.deepEqual(getState(), concentrating);
    assert.equal(
      await run(
        "return document.getElementById('item-form').elements.namedItem('behavior').value;"
      ),
      'passive'
    );
    await run('closeModal();');
    results.push(
      'The editor explains a blocked passive conversion while an inactive character concentrates; the draft stays open and saved state stays intact.'
    );

    controller.webContents.reload();
    await wait(() => !controller.webContents.isLoading());
    await wait(() =>
      run(
        "return typeof state !== 'undefined' && state.characters[0]?.items[1]?.behavior === 'hybrid';"
      )
    );
    assert.deepEqual(store.load().state, concentrating);
    assert.deepEqual(await run('return TL.toBackup(state);'), TL.toBackup(concentrating));
    results.push(
      'Editor-created behavior and turn costs survive reload along with independent character settings.'
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
