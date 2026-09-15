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
    const started = Date.now();
    while (!(await fn())) {
      if (Date.now() - started > 10000) throw Error('Concentration use check timed out');
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  };
  const click = (selector) =>
    run(
      `const button=document.querySelector(${JSON.stringify(selector)});if(!button||button.disabled)throw Error('Missing control '+${JSON.stringify(selector)});button.click();await saveQueue;`
    );
  const cast = (level) =>
    run(
      `const form=document.getElementById('cast-form');form.elements.level.value=${JSON.stringify(String(level))};form.requestSubmit();await saveQueue;`
    );
  const hudUse = (level) =>
    tv(
      `const button=[...stage.firstElementChild.querySelectorAll('[data-hud-command]')].find(el=>{const command=JSON.parse(el.dataset.hudCommand);return command.type==='use'&&command.level===${level === undefined ? 'undefined' : level};});if(!button||button.disabled)throw Error('Missing HUD use control');button.click();`
    );
  const shot = async (name, win) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    fs.writeFileSync(path.join(dir, name + '.png'), (await win.webContents.capturePage()).toPNG());
  };
  const character = () => getState().characters[0];
  const costs = () =>
    JSON.stringify({
      turn: character().turn,
      slots: character().slots,
      resources: character().resources,
    });
  const concentration = () => [
    character().concentrating,
    character().concentrationItemId,
    character().concentration,
  ];
  const expectConcentration = async (id, name) => {
    assert.deepEqual(concentration(), [Boolean(id), id, name]);
    await wait(() =>
      tv(
        `return state.characters[0].concentrationItemId===${JSON.stringify(id)}&&state.characters[0].concentration===${JSON.stringify(name)};`
      )
    );
    for (const query of [run, tv]) {
      assert.equal(
        await query(`return document.querySelector('.concentration-toggle').title;`),
        id ? name : 'Not concentrating'
      );
      assert.equal(
        await query(
          `return document.querySelector('.damage-concentration-reminder').classList.contains('is-active');`
        ),
        Boolean(id)
      );
      if (id)
        assert.equal(
          await query(`return document.querySelector('.damage-concentration-reminder').title;`),
          'Concentrating: ' + name
        );
    }
    const saved = store.load().state.characters[0];
    assert.deepEqual(
      [saved.concentrating, saved.concentrationItemId, saved.concentration],
      [Boolean(id), id, name]
    );
  };
  const geometry = `return [...stage.children].map(el=>[el.offsetWidth,el.offsetHeight,el.style.transform]);`;
  try {
    await wait(() => run('return !!state;'));
    controller.setBounds({ width: 1440, height: 950 });
    controller.show();
    await run(`commit(()=>{
      const a=TL.character(),b=TL.character();a.name='Focus keeper';b.name='Other player';
      a.resources=[{id:'focus',name:'Focus charges',current:3,max:3,reset:'manual'}];
      a.slots[0]={level:1,current:3,max:3};a.slots[1]={level:2,current:3,max:3};
      a.items=[
        TL.item({name:'Old ward',requiresConcentration:true,economy:'free'}),
        TL.item({name:'New ward',kind:'spell',level:1,requiresConcentration:true,resourceId:'focus',resourceCost:1}),
        TL.item({name:'Focus feature',kind:'feature',economy:'bonus',requiresConcentration:true,resourceId:'focus',resourceCost:1}),
        TL.item({name:'Ordinary feature',kind:'feature',economy:'free'})
      ];
      TL.setConcentration(a,true,a.items[0].id);
      a.hud={...a.hud,expanded:true,x:25,y:50,rotation:30,scale:0.85,detailId:a.items[1].id};
      b.hud={...b.hud,expanded:true,x:75,y:50,rotation:0,scale:0.7};
      state.characters=[a,b];selectedId=a.id;state.activeId=a.id;
      state.settings.overlayInteractive=true;
      state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};
    });await saveQueue;`);
    const [oldId, spellId, featureId, plainId] = character().items.map((it) => it.id),
      oldLibraryId = character().items[0].libraryId,
      initialCosts = costs(),
      oldConcentration = concentration(),
      otherBefore = JSON.stringify(getState().characters[1]);
    const use = async (id) => {
      await run(`tab=selected().items.find(it=>it.id===${JSON.stringify(id)}).economy;render();`);
      await click(`[data-action="use-item"][data-id="${id}"]`);
    };
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    overlay = getOverlay();
    await wait(() => tv(`return document.querySelectorAll('.hud-card').length===2;`));
    const frames = await tv(geometry);

    await use(spellId);
    await cast(2);
    assert.match(
      await run(`return document.querySelector('.modal-body').textContent;`),
      /Using New ward will end concentration on Old ward/
    );
    assert.equal(costs(), initialCosts);
    await shot('01-dm-warning', controller);
    await click('#modal-root [data-action="close-modal"]');
    assert.equal(costs(), initialCosts);
    assert.deepEqual(concentration(), oldConcentration);
    await use(spellId);
    await cast(2);
    await click('#confirm-action');
    assert.equal(character().turn.action, false);
    assert.equal(character().slots[0].current, 3);
    assert.equal(character().slots[1].current, 2);
    assert.equal(character().resources[0].current, 2);
    await expectConcentration(spellId, 'New ward');
    assert.equal(await run(`return document.getElementById('modal-root').childElementCount;`), 0);
    await run(`document.querySelector('.concentration-toggle').scrollIntoView({block:'center'});`);
    await shot('03-dm-auto-concentration', controller);
    await shot('04-tv-auto-concentration', overlay);
    await run(`window.scrollTo(0,0);`);
    await click('[data-action="undo"]');
    assert.equal(costs(), initialCosts);
    await expectConcentration(oldId, 'Old ward');
    results.push(
      'DM confirmation spends the chosen higher slot and normal costs once, switches concentration and both screens’ reminders, and saves the new ability; one Undo restores the old concentration and all costs.'
    );

    await use(featureId);
    assert.equal(await run(`return !!document.getElementById('confirm-action');`), true);
    assert.equal(await run(`return !!document.getElementById('cast-form');`), false);
    await run(
      `commit(()=>TL.setConcentration(selected(),true,${JSON.stringify(spellId)}));await saveQueue;`
    );
    await click('#confirm-action');
    assert.equal(costs(), initialCosts);
    assert.match(
      await run(`return document.querySelector('.modal-body').textContent;`),
      /end concentration on New ward/
    );
    await click('#confirm-action');
    assert.equal(character().turn.bonus, false);
    assert.equal(character().resources[0].current, 2);
    await expectConcentration(featureId, 'Focus feature');
    await click('[data-action="undo"]');
    await expectConcentration(spellId, 'New ward');
    await run(
      `commit(()=>TL.setConcentration(selected(),true,${JSON.stringify(oldId)}));await saveQueue;`
    );
    await use(oldId);
    assert.equal(await run(`return !!document.getElementById('confirm-action');`), true);
    await click('#modal-root [data-action="close-modal"]');
    await run(`tab='action';render();`);
    await click(`[data-action="view-item"][data-id="${spellId}"]`);
    await click(`#modal-root [data-action="use-item"][data-id="${spellId}"]`);
    await cast(1);
    await run(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));`);
    assert.equal(await run(`return document.getElementById('modal-root').childElementCount;`), 0);
    assert.equal(costs(), initialCosts);
    await expectConcentration(oldId, 'Old ward');
    results.push(
      'Features and repeated use of the current ability also warn; DM detail use and Escape work, and a changed concentration requires reviewing a new warning before spending.'
    );

    await wait(() =>
      tv(
        `return state.characters[0].concentrationItemId===${JSON.stringify(oldId)}&&state.characters[0].hud.detailId===${JSON.stringify(spellId)};`
      )
    );
    await hudUse(2);
    await wait(() => tv(`return !!document.querySelector('.hud-use-warning');`));
    assert.equal(costs(), initialCosts);
    assert.deepEqual(await tv(geometry), frames);
    assert.equal(await tv(`return document.querySelectorAll('.hud-use-warning').length;`), 1);
    assert.equal(await tv(`return !!stage.children[1].querySelector('.hud-use-warning');`), false);
    assert.equal(
      await tv(`return document.activeElement.hasAttribute('data-hud-use-cancel');`),
      true
    );
    await shot('02-rotated-hud-warning', overlay);
    await tv(`document.querySelector('[data-hud-use-cancel]').click();`);
    assert.equal(costs(), initialCosts);
    await expectConcentration(oldId, 'Old ward');
    assert.equal(await tv(`return !!document.querySelector('.hud-use-warning');`), false);
    await hudUse(2);
    await tv(
      `document.querySelector('[data-hud-use-cancel]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));`
    );
    assert.equal(await tv(`return !!document.querySelector('.hud-use-warning');`), false);
    assert.equal(costs(), initialCosts);
    await hudUse(2);
    const renamed = 'Old ward "<b>steady</b>" & watch';
    await run(
      `commit(()=>state.library.find(it=>it.id===${JSON.stringify(oldLibraryId)}).name=${JSON.stringify(renamed)});await saveQueue;`
    );
    await wait(() =>
      tv(
        `return document.querySelector('.hud-use-warning p').textContent.includes(${JSON.stringify(renamed)});`
      )
    );
    assert.equal(await tv(`return document.querySelectorAll('.hud-use-warning p b').length;`), 0);
    assert.equal(
      await tv(`return document.activeElement.hasAttribute('data-hud-use-cancel');`),
      true
    );
    await tv(
      `const button=document.querySelector('[data-hud-use-confirm]');button.click();button.click();`
    );
    await require('./approve-pending')(controller);
    await wait(() => character().slots[1].current === 2);
    assert.equal(character().resources[0].current, 2);
    await expectConcentration(spellId, 'New ward');
    assert.equal(await tv(`return !!document.querySelector('.hud-use-warning');`), false);
    await click('[data-action="undo"]');
    assert.equal(costs(), initialCosts);
    await expectConcentration(oldId, renamed);
    results.push(
      'The TV warning stays inside the acting player’s rotated HUD, supports Cancel and Escape, follows live escaped names, and switches concentration only on successful use; Undo restores the previous named ability.'
    );

    await wait(() => tv(`return state.characters[0].slots[1].current===3;`));
    await hudUse(2);
    await run(`commit(()=>selected().slots[1].current=0);await saveQueue;`);
    await wait(() => tv(`return document.querySelector('[data-hud-use-confirm]').disabled;`));
    assert.equal(character().turn.action, true);
    assert.equal(character().resources[0].current, 3);
    await expectConcentration(oldId, renamed);
    await tv(`document.querySelector('[data-hud-use-cancel]').click();`);
    await click('[data-action="undo"]');
    await wait(() => tv(`return state.characters[0].slots[1].current===3;`));
    await hudUse(2);
    await click('[data-action="toggle-interactive"]');
    await wait(() => tv(`return !document.querySelector('.hud-use-warning');`));
    await click('[data-action="toggle-interactive"]');
    await wait(() => tv(`return !!document.querySelector('.hud-use-controls');`));
    assert.equal(await tv(`return !!document.querySelector('.hud-use-warning');`), false);
    assert.equal(costs(), initialCosts);
    results.push(
      'Spending the selected slot elsewhere disables confirmation; click-through dismisses an unfinished warning without spending or reopening it.'
    );

    await run(
      `commit(()=>{selected().concentrationItemId='';selected().concentration='';selected().concentrating=true;});await saveQueue;`
    );
    await use(featureId);
    assert.match(
      await run(`return document.querySelector('.modal-body').textContent;`),
      /your current ability/
    );
    await click('#modal-root [data-action="close-modal"]');
    await use(plainId);
    assert.equal(await run(`return document.getElementById('modal-root').childElementCount;`), 0);
    assert.equal(character().concentrating, true);
    await run(
      `commit(()=>{TL.setConcentration(selected(),false);selected().hud.detailId=${JSON.stringify(spellId)};});await saveQueue;`
    );
    await use(spellId);
    await cast(1);
    assert.equal(character().slots[0].current, 2);
    await expectConcentration(spellId, 'New ward');
    assert.equal(await run(`return document.getElementById('modal-root').childElementCount;`), 0);
    await click('[data-action="undo"]');
    await expectConcentration('', '');
    await wait(() =>
      tv(`return !state.characters[0].concentrating&&state.characters[0].turn.action;`)
    );
    await hudUse(1);
    await require('./approve-pending')(controller);
    await wait(() => character().slots[0].current === 2);
    assert.equal(await tv(`return !!document.querySelector('.hud-use-warning');`), false);
    await expectConcentration(spellId, 'New ward');
    await run(`commit(()=>selected().hud.detailId=${JSON.stringify(plainId)});await saveQueue;`);
    await wait(() => tv(`return state.characters[0].hud.detailId===${JSON.stringify(plainId)};`));
    await hudUse();
    await require('./approve-pending')(controller);
    await wait(() => tv(`return pendingUses.size===0;`));
    await expectConcentration(spellId, 'New ward');
    assert.equal(JSON.stringify(getState().characters[1]), otherBefore);
    assert.deepEqual(await tv(geometry), frames);
    results.push(
      'First concentration casts start concentration from either screen without a warning; Undo can restore no concentration, and ordinary abilities preserve it while other characters stay unchanged.'
    );
    fs.writeFileSync(
      path.join(dir, 'concentration-use-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(dir, 'concentration-use-results.json'),
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
