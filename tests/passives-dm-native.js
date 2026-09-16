/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const TL = require('../core');
module.exports = async ({ app, controller, getState, store }) => {
  const directory = path.dirname(store.directory),
    results = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (check) => {
    const start = Date.now();
    while (!(await check())) {
      if (Date.now() - start > 10000) throw Error('DM passives test timed out.');
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  };
  const click = (selector) =>
    run(
      `const el=document.querySelector(${JSON.stringify(selector)}); if(!el)throw Error('Missing control: '+${JSON.stringify(selector)}); el.click(); await saveQueue;`
    );
  const edit = (fields) =>
    run(
      `const form=document.getElementById('item-form'); for(const [key,value] of Object.entries(${JSON.stringify(fields)})){const el=form.elements.namedItem(key); if(el.type==='checkbox')el.checked=value; else el.value=value; el.dispatchEvent(new Event('change',{bubbles:true}));}`
    );
  const submit = async (id = 'item-form') => {
    await run(`document.getElementById(${JSON.stringify(id)}).requestSubmit(); await saveQueue;`);
    await wait(() => run(`return !document.getElementById(${JSON.stringify(id)});`));
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
    controller.setBounds({ width: 1440, height: 950 });
    controller.showInactive();
    await run(`await commit(()=>{
      state=TL.empty();
      state.settings.displayId=display().id;
      state.library=[
        TL.libraryEntry({id:'passive',name:'Lantern sense',kind:'feature',behavior:'passive',trackPassive:true,description:'Read the marker <only> while carrying a lantern.',trigger:'While carrying a lantern',source:'Our table notes',economy:'bonus',level:2,usesSlot:true,requiresConcentration:true}),
        TL.libraryEntry({id:'hybrid',name:'Watchkeeper',kind:'spell',behavior:'hybrid',trackPassive:true,passiveDescription:'Notice a quiet signal.',description:'Send a bright signal.',economy:'reaction',level:1,usesSlot:true}),
        TL.libraryEntry({id:'always',name:'Steady footing',behavior:'passive',description:''}),
        TL.libraryEntry({id:'active',name:'Quick step',economy:'bonus'})
      ];
      state.characters=[TL.character(),TL.character(1)]; state.roster=[TL.character(2)];
      TL.allCharacters(state).forEach((c,i)=>{
        c.id='player-'+i; c.name=['Mira','Rowan','Saved player'][i]; c.hp=7;
        c.resources=[{id:'pool-'+i,name:'Signal charges '+i,current:3,max:5,reset:'long'}];
        c.slots[0]={level:1,max:3,current:2};
        Object.assign(c.hud,{expanded:true,rotation:i*90,scale:0.8+i/10,panel:'reaction'});
        for(const entry of state.library) TL.attachItem(state,c.id,entry.id,{resourceId:'pool-'+i,resourceCost:i+1,disabled:i===2});
      });
      state.activeId='player-0'; selectedId='player-0'; view='character'; tab='passive';
    });`);
    const initial = TL.clone(getState()),
      a = initial.characters[0],
      passiveId = a.items[0].id,
      hybridId = a.items[1].id;
    const row = `[data-passive-id="${passiveId}"]`;
    const list = await run(
      `const list=document.getElementById('ability-list'); return {count:list.querySelectorAll('.passive-row').length,text:list.textContent,use:list.querySelectorAll('[data-action="use-item"],.spent').length,html:list.innerHTML};`
    );
    assert.equal(list.count, 3);
    assert.equal(list.use, 0);
    assert.match(list.text, /Always applies/);
    assert.match(list.text, /Inactive/);
    assert.doesNotMatch(list.text, /Signal charges|Ready|Spell slot/);
    assert.match(list.html, /&lt;only&gt;/);
    assert.equal(await run('return !!document.querySelector(\'[data-panel="passive"]\');'), false);
    await run("document.querySelector('[data-tab=\"passive\"]').scrollIntoView({block:'start'});");
    await shot('01-dm-passives');
    results.push(
      'The DM Passives tab shows passive and mixed entries with readable inactive reminders and no use/cost controls.'
    );

    await click(row + ' [data-action="set-passive"]');
    const toggled = TL.clone(initial);
    toggled.characters[0].items[0].passiveActive = true;
    assert.deepEqual(getState(), toggled);
    assert.deepEqual(store.load().state, toggled);
    await click(row + ' [data-action="view-passive"]');
    assert.deepEqual(getState(), toggled);
    assert.equal(
      await run(
        'return document.querySelectorAll(\'#modal-root [data-action="use-item"],#modal-root [name="level"],#detail-remote\').length;'
      ),
      0
    );
    assert.match(
      await run("return document.getElementById('passive-details').textContent;"),
      /Our table notes/
    );
    await shot('02-passive-details');
    await click('#passive-details [data-action="set-passive"]');
    assert.equal(getState().characters[0].items[0].passiveActive, false);
    await run('await undo();');
    assert.deepEqual(getState(), toggled);
    await run('closeModal();');
    results.push(
      'DM switches change only one assignment, save immediately, support Undo, and work without changing the displayed HUD or spending anything.'
    );

    await run("chooseLibraryEntry('player-0');");
    assert.equal(
      await run("return document.getElementById('library-picker-filter').value;"),
      'passive'
    );
    assert.deepEqual(
      await run("return matchingLibrary('quiet signal','passive').map(it=>it.id);"),
      ['hybrid']
    );
    assert.deepEqual(await run("return matchingLibrary('','bonus').map(it=>it.id);"), ['active']);
    await run('closeModal(); editLibraryEntry();');
    assert.equal(
      await run('return document.querySelector(\'[name="behavior"]\').value;'),
      'active'
    );
    await run("closeModal(); editLibraryEntry(undefined,'player-0');");
    assert.equal(
      await run('return document.querySelector(\'[name="behavior"]\').value;'),
      'passive'
    );
    assert.equal(
      await run('return document.querySelector(\'[name="trackPassive"]\').checked;'),
      false
    );
    await edit({
      name: 'Shared lookout',
      description: '<script>example only</script>',
      trackPassive: true,
    });
    await submit();
    const created = getState().library.find((it) => it.name === 'Shared lookout');
    assert.ok(created);
    assert.equal(created.behavior, 'passive');
    assert.equal(created.trackPassive, true);
    assert.equal(getState().characters[0].items.at(-1).passiveActive, false);
    await run(`attachLibraryEntry(${JSON.stringify(created.id)},'player-1');`);
    assert.equal(
      await run(
        'return document.querySelectorAll(\'#attach-form [name="resourceId"],#attach-form [name="resourceCost"]\').length;'
      ),
      0
    );
    assert.equal(await run("return document.querySelectorAll('#attach-form script').length;"), 0);
    await submit('attach-form');
    assert.equal(getState().characters[1].items.at(-1).libraryId, created.id);
    results.push(
      'Passives creation defaults correctly, the library searches mixed passive text, and assignment reuses shared definitions without presenting spending controls.'
    );

    await run(`editLibraryEntry('hybrid','player-0',${JSON.stringify(hybridId)});`);
    assert.deepEqual(
      await run(
        "return ['description','passiveDescription'].map(name=>{const el=document.querySelector('[name=\"'+name+'\"]');return [el.closest('label').querySelector('span').textContent,el.checkVisibility()];});"
      ),
      [
        ['Active effect', true],
        ['Passive effect', true],
      ]
    );
    await edit({ passiveDescription: 'Watch the doorway <carefully>.', behavior: 'passive' });
    await edit({ behavior: 'active' });
    await edit({ behavior: 'hybrid' });
    assert.equal(
      await run('return document.querySelector(\'[name="passiveDescription"]\').value;'),
      'Watch the doorway <carefully>.'
    );
    await run(
      `await commit(()=>{const c=state.characters[0]; TL.setPassiveActive(c,${JSON.stringify(hybridId)},true); TL.damage(c,1); c.resources[0].current=2;});`
    );
    const concurrent = TL.clone(getState());
    await submit();
    concurrent.library.find((it) => it.id === 'hybrid').passiveDescription =
      'Watch the doorway <carefully>.';
    assert.deepEqual(getState(), TL.normalize(concurrent));
    for (const c of TL.allCharacters(getState())) {
      assert.equal(c.items[1].description, 'Send a bright signal.');
      assert.equal(c.items[1].passiveDescription, 'Watch the doorway <carefully>.');
    }
    await run(`editLibraryEntry('hybrid','player-0',${JSON.stringify(hybridId)});`);
    await edit({ trackPassive: false, passiveDescription: 'Cancel this text' });
    const beforeCancel = TL.clone(getState());
    await run('closeModal();');
    assert.deepEqual(getState(), beforeCancel);
    results.push(
      'Mixed effects retain separate text through behavior changes; shared editing preserves live HP, spending, and independent reminders, while Cancel changes nothing.'
    );

    const beforeView = TL.clone(getState());
    await run(`showPassiveItem(${JSON.stringify(hybridId)});`);
    const passiveContent = await run(
      "return document.getElementById('passive-details').textContent;"
    );
    assert.match(passiveContent, /Watch the doorway/);
    assert.doesNotMatch(
      passiveContent,
      /Send a bright signal|Signal charges|Concentration|Charges spent/
    );
    assert.equal(
      await run(
        'return document.querySelectorAll(\'#modal-root [data-action="use-item"]\').length;'
      ),
      0
    );
    await click('[data-action="view-active-effect"]');
    const activeContent = await run(
      "return document.getElementById('ability-details').textContent;"
    );
    assert.match(activeContent, /Send a bright signal/);
    assert.doesNotMatch(activeContent, /Watch the doorway/);
    assert.ok(
      await run('return !!document.querySelector(\'#modal-root [data-action="use-item"]\');')
    );
    await click('[data-action="view-passive"]');
    assert.deepEqual(getState(), beforeView);
    await run('closeModal();');
    results.push(
      'View active effect / View passive effect show the correct text without spending, changing HUDs, or duplicating assignments; only the active view offers Use.'
    );

    for (const panel of ['action', 'bonus', 'reaction', 'free', 'spell', 'feature']) {
      const ids = await run(
        `tab=${JSON.stringify(panel)}; render(); return filteredItems(selected()).map(it=>it.libraryId);`
      );
      assert.ok(!ids.includes('passive') && !ids.includes('always') && !ids.includes(created.id));
    }
    await run(
      `await commit(()=>{const c=state.characters[0]; c.hud.detailId=c.items[3].id; c.hud.panel='bonus';}); editLibraryEntry('active');`
    );
    const beforeConversion = TL.clone(getState());
    await edit({ behavior: 'passive' });
    await submit();
    assert.equal(getState().characters[0].hud.detailId, '');
    assert.equal(getState().characters[0].hud.panel, 'bonus');
    assert.deepEqual(getState().characters[1].hud, beforeConversion.characters[1].hud);
    assert.equal(
      getState().characters[0].hud.rotation,
      beforeConversion.characters[0].hud.rotation
    );
    await run('await undo(); tab="passive"; render();');
    assert.deepEqual(getState(), beforeConversion);
    results.push(
      'Passive-only entries leave ordinary action/type lists; converting a displayed ability returns only that HUD to its list, and Undo restores the previous selection.'
    );

    await run('tab="passive"; render();');
    const beforeRemove = TL.clone(getState());
    await click(row + ' [data-action="delete-item"]');
    await click('#confirm-action');
    await wait(() => !getState().characters[0].items.some((it) => it.id === passiveId));
    assert.ok(getState().library.some((it) => it.id === 'passive'));
    assert.deepEqual(getState().characters[1], beforeRemove.characters[1]);
    await run('await undo();');
    assert.deepEqual(getState(), beforeRemove);
    await run(`chooseLocalCopiesBeforeDelete(${JSON.stringify(created.id)});`);
    await submit('delete-library-form');
    assert.ok(!getState().library.some((it) => it.id === created.id));
    for (const c of getState().characters) {
      const local = c.items.find((it) => it.name === 'Shared lookout');
      assert.ok(local.local);
      assert.equal(local.trackPassive, true);
      assert.equal(local.behavior, 'passive');
    }
    results.push(
      'Removing one passive preserves other assignments and supports Undo; deleting a shared definition can retain independent passive copies.'
    );

    await run(`editLibraryEntry('', 'player-0',state.characters[0].items.at(-1).id);`);
    await edit({ description: 'Only Mira sees this local definition.', trackPassive: false });
    await submit();
    assert.equal(getState().characters[0].items.at(-1).trackPassive, false);
    assert.equal(getState().characters[1].items.at(-1).trackPassive, true);
    assert.equal(
      getState().characters[1].items.at(-1).description,
      '<script>example only</script>'
    );
    results.push('Character-only passive text and tracking settings stay independent.');

    await run(
      `await commit(()=>{for(let i=0;i<24;i++)TL.createLocalItem(state,'player-0',{name:i===0?'L'.repeat(300):'Extra reminder '+i,behavior:'passive',description:i===0?'Very long <reminder> '.repeat(1500):''});}); tab='passive'; render();`
    );
    controller.setBounds({ width: 940, height: 660 });
    await run("document.querySelector('[data-tab=\"passive\"]').scrollIntoView({block:'start'});");
    assert.ok(await run('return document.documentElement.scrollWidth<=innerWidth;'));
    await shot('03-passives-minimum-size');
    await run("showPassiveItem(state.characters[0].items.find(it=>it.name==='L'.repeat(300)).id);");
    assert.ok(
      await run(
        "return document.getElementById('passive-details').textContent.includes('Very long <reminder>');"
      )
    );
    assert.ok(
      await run(
        "const body=document.querySelector('.modal-body');return body.scrollWidth<=body.clientWidth && !body.querySelector('reminder');"
      )
    );
    await shot('04-long-passive-details');
    assert.ok(
      await run(
        `const close=document.querySelector('.modal-header [data-action="close-modal"]').getBoundingClientRect(); return close.right<=innerWidth && close.left>=0;`
      )
    );
    await run('closeModal();');
    results.push(
      'Many entries, blank descriptions, long unbroken names, and long HTML-like text remain readable without horizontal overflow at the minimum window size.'
    );

    const saved = TL.clone(getState());
    assert.deepEqual(store.load().state, saved);
    const exported = TL.toBackup(saved);
    await run(
      `await commit(()=>{state=TL.normalize(${JSON.stringify(exported)});},'',true,[],true);`
    );
    assert.deepEqual(getState(), saved);
    controller.webContents.reload();
    await wait(() => !controller.webContents.isLoading());
    await wait(() =>
      run("return typeof state !== 'undefined' && state.characters[0]?.items.length > 20;")
    );
    assert.deepEqual(await run('return TL.toBackup(state);'), exported);
    results.push(
      'Export/restore, real disk saving, and renderer reload preserve passive text, per-character reminders, shared/local definitions, and HUD settings.'
    );
    fs.writeFileSync(
      path.join(directory, 'passives-dm-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'passives-dm-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
  } finally {
    app.quit();
  }
};
