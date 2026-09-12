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
      if (Date.now() - start > 10000) throw Error('Concentration reminder check timed out');
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  };
  const click = (selector) =>
    run(`const el=document.querySelector(${JSON.stringify(selector)});
      if(!el||el.disabled)throw Error('Missing control '+${JSON.stringify(selector)});
      el.click();await saveQueue;`);
  const submitAmount = (amount) =>
    run(`const form=document.getElementById('amount-form');
      form.elements.amount.value=${amount};form.requestSubmit();await saveQueue;`);
  const shot = async (name, win) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    fs.writeFileSync(path.join(dir, name + '.png'), (await win.webContents.capturePage()).toPNG());
  };
  const geometry = `const button=document.querySelector('[data-action="hp-damage"]');
    const rect=button.getBoundingClientRect();return [rect.x,rect.y,rect.width,rect.height];`;
  const hudGeometry = `return [...stage.children].map(el=>[el.offsetWidth,el.offsetHeight,el.style.transform]);`;
  try {
    await wait(() => run('return !!state;'));
    controller.setBounds({ width: 1440, height: 950 });
    controller.show();
    await run(`commit(()=>{
      const a=TL.character(),b=TL.character();a.name='Focus keeper';b.name='Other player';
      a.maxHp=40;a.hp=30;a.tempHp=8;
      a.items=[TL.item({name:'Focused ward',requiresConcentration:true})];
      a.hud={...a.hud,expanded:true,x:25,y:50,rotation:0,scale:0.8};
      b.hud={...b.hud,expanded:true,x:75,y:50,rotation:30,scale:0.8};
      state.characters=[a,b];selectedId=a.id;state.activeId=a.id;
      state.settings.overlayInteractive=true;
      state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};
    });await saveQueue;`);
    const characterId = getState().characters[0].id,
      itemId = getState().characters[0].items[0].id,
      libraryId = getState().characters[0].items[0].libraryId,
      otherBefore = JSON.stringify(getState().characters[1]);
    const dmFrame = await run(geometry);
    assert.equal(
      await run(
        `return getComputedStyle(document.querySelector('.hp-controls .damage-concentration-reminder')).visibility;`
      ),
      'hidden'
    );
    await click('[data-action="hp-damage"]');
    assert.equal(
      await run(
        `return document.querySelector('#modal-root .damage-concentration-reminder').getAttribute('aria-hidden');`
      ),
      'true'
    );
    await click('#modal-root [data-action="close-modal"]');
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    overlay = getOverlay();
    await wait(() => tv(`return document.querySelectorAll('.hud-vitals-controls').length===2;`));
    const frames = await tv(hudGeometry);
    await click('[data-action="concentration-toggle"]');
    await click(`[data-action="concentration-pick"][data-id="${itemId}"]`);
    await wait(() =>
      tv(`return document.querySelectorAll('.damage-concentration-reminder.is-active').length===1;`)
    );
    assert.deepEqual(await run(geometry), dmFrame);
    assert.deepEqual(await tv(hudGeometry), frames);
    for (const query of [run, tv]) {
      assert.equal(
        await query(
          `return document.querySelector('.damage-concentration-reminder.is-active').title;`
        ),
        'Concentrating: Focused ward'
      );
      assert.equal(
        await query(
          `return document.querySelector('.damage-concentration-reminder.is-active').getAttribute('aria-label');`
        ),
        'Concentrating: Focused ward'
      );
      assert.equal(
        await query(
          `return document.querySelector('.damage-concentration-reminder.is-active').getAttribute('role');`
        ),
        'img'
      );
    }
    assert.deepEqual(
      await tv(
        `return [...stage.firstElementChild.querySelectorAll('.damage-controls button')].map(el=>JSON.parse(el.dataset.hudCommand).amount);`
      ),
      [-1, -5]
    );
    assert.equal(
      await tv(
        `return document.querySelectorAll('.hud-temp-controls .damage-concentration-reminder,.hud-inline-buttons .damage-concentration-reminder').length;`
      ),
      0
    );
    results.push(
      'Only the concentrating character gets an accessible damage reminder; DM controls and differently rotated HUDs retain their geometry.'
    );
    await shot('01-dm-reminder', controller);
    await shot('02-tv-reminder', overlay);

    for (const query of [run, tv]) {
      const pulse =
        await query(`const icon=document.querySelector('.damage-concentration-reminder.is-active > span');
        const animation=icon.getAnimations()[0];if(!animation)throw Error('Missing pulse');
        animation.pause();animation.currentTime=0;
        const before=[getComputedStyle(icon).opacity,icon.getBoundingClientRect().toJSON()];
        animation.currentTime=1000;
        const after=[getComputedStyle(icon).opacity,icon.getBoundingClientRect().toJSON()];
        animation.play();return {before,after};`);
      assert.notEqual(pulse.before[0], pulse.after[0]);
      assert.deepEqual(pulse.before[1], pulse.after[1]);
    }
    for (const win of [controller, overlay]) {
      win.webContents.debugger.attach('1.3');
      await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      });
    }
    for (const query of [run, tv]) {
      assert.equal(
        await query(
          `return getComputedStyle(document.querySelector('.damage-concentration-reminder.is-active > span')).animationName;`
        ),
        'none'
      );
      assert.equal(
        await query(
          `return getComputedStyle(document.querySelector('.damage-concentration-reminder.is-active')).visibility;`
        ),
        'visible'
      );
    }
    for (const win of [controller, overlay]) {
      await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
      win.webContents.debugger.detach();
    }
    results.push(
      'The pulse changes brightness without moving controls, and reduced motion keeps both screens’ icons visible and steady.'
    );

    await click('[data-action="hp-damage"]');
    await run(
      `await new Promise(requestAnimationFrame);document.querySelector('[name="amount"]').value='5';document.querySelector('[name="amount"]').focus();`
    );
    await shot('03-damage-dialog', controller);
    await tv(`stage.firstElementChild.querySelector('.concentration-toggle').click();`);
    await wait(() =>
      run(
        `return !document.querySelector('#modal-root .damage-concentration-reminder').classList.contains('is-active');`
      )
    );
    assert.equal(await run(`return document.querySelector('[name="amount"]').value;`), '5');
    assert.equal(
      await run(`return document.activeElement===document.querySelector('[name="amount"]');`),
      true
    );
    await click('[data-action="undo"]');
    assert.equal(
      await run(
        `return document.querySelector('#modal-root .damage-concentration-reminder').title;`
      ),
      'Concentrating: Focused ward'
    );
    const renamed = 'Ward "<b>steady</b>" & watch';
    await run(
      `commit(()=>state.library.find(e=>e.id===${JSON.stringify(libraryId)}).name=${JSON.stringify(renamed)});await saveQueue;`
    );
    for (const selector of ['.hp-controls', '#modal-root']) {
      assert.equal(
        await run(
          `return document.querySelector(${JSON.stringify(selector + ' .damage-concentration-reminder')}).title;`
        ),
        'Concentrating: ' + renamed
      );
    }
    await wait(() =>
      tv(
        `return document.querySelector('.damage-concentration-reminder.is-active').title===${JSON.stringify('Concentrating: ' + renamed)};`
      )
    );
    assert.equal(
      await run(`return document.querySelectorAll('.damage-concentration-reminder b').length;`),
      0
    );
    assert.equal(await run(`return document.querySelector('[name="amount"]').value;`), '5');
    await submitAmount(5);
    assert.equal(getState().characters[0].tempHp, 3);
    assert.equal(getState().characters[0].hp, 30);
    assert.equal(getState().characters[0].concentrating, true);
    assert.equal(await run(`return document.querySelector('#modal-root').childElementCount;`), 0);
    await click('[data-action="undo"]');
    assert.equal(getState().characters[0].tempHp, 8);
    results.push(
      'An open damage dialog follows HUD concentration changes, Undo and escaped ability renames while preserving its input and focus; damage still applies immediately through temporary HP.'
    );

    await click('[data-action="hp-damage"]');
    await submitAmount(12);
    assert.equal(getState().characters[0].tempHp, 0);
    assert.equal(getState().characters[0].hp, 26);
    assert.equal(getState().characters[0].concentrating, true);
    await click('[data-action="undo"]');
    for (const amount of [-1, -5]) {
      await tv(
        `const button=[...stage.firstElementChild.querySelectorAll('[data-hud-command]')].find(el=>{const c=JSON.parse(el.dataset.hudCommand);return c.type==='hp'&&c.amount===${amount};});button.click();`
      );
      await wait(() => getState().characters[0].tempHp === (amount === -1 ? 7 : 3));
      assert.equal(getState().characters[0].concentrating, true);
      await click('[data-action="undo"]');
      await wait(() => tv(`return state.characters[0].tempHp===8;`));
    }
    const beforeCancel = JSON.stringify(getState());
    await click('[data-action="hp-damage"]');
    await click('#modal-root [data-action="close-modal"]');
    assert.equal(JSON.stringify(getState()), beforeCancel);
    await click('[data-action="hp-damage"]');
    await submitAmount(0);
    assert.equal(JSON.stringify(getState()), beforeCancel);
    await click('[data-action="hp-heal"]');
    assert.equal(
      await run(
        `return document.querySelectorAll('#modal-root .damage-concentration-reminder').length;`
      ),
      0
    );
    await submitAmount(1);
    assert.equal(getState().characters[0].hp, 31);
    assert.equal(getState().characters[0].concentrating, true);
    assert.equal(JSON.stringify(getState().characters[1]), otherBefore);
    results.push(
      'DM damage, both HUD decrement buttons, temporary HP, healing, zero damage, Cancel and Undo preserve their existing behavior and leave other characters alone.'
    );

    await run(
      `commit(()=>{selected().concentrationItemId='';selected().concentration='';selected().concentrating=true;});await saveQueue;`
    );
    assert.equal(
      await run(
        `return document.querySelector('.hp-controls .damage-concentration-reminder').title;`
      ),
      'Concentrating'
    );
    await wait(() =>
      tv(
        `return document.querySelector('.damage-concentration-reminder.is-active').title==='Concentrating';`
      )
    );
    await click('[data-action="concentration-toggle"]');
    await wait(() =>
      tv(`return !document.querySelector('.damage-concentration-reminder.is-active');`)
    );
    assert.deepEqual(await run(geometry), dmFrame);
    await click('[data-action="undo"]');
    await wait(() =>
      tv(`return !!document.querySelector('.damage-concentration-reminder.is-active');`)
    );
    await click('[data-action="long-rest"]');
    await run(`document.getElementById('rest-form').requestSubmit();await saveQueue;`);
    assert.equal(getState().characters[0].concentrating, false);
    await wait(() =>
      tv(`return !document.querySelector('.damage-concentration-reminder.is-active');`)
    );
    await click('[data-action="undo"]');
    await click('[data-action="toggle-interactive"]');
    await wait(() => tv(`return !document.querySelector('.hud-vitals-controls');`));
    assert.equal(
      await tv(`return !!document.querySelector('[data-concentration-indicator].is-on');`),
      true
    );
    await click('[data-action="toggle-interactive"]');
    await wait(() =>
      tv(`return !!document.querySelector('.damage-concentration-reminder.is-active');`)
    );
    assert.deepEqual(await tv(hudGeometry), frames);
    results.push(
      'Unnamed concentration uses a generic tooltip; ending concentration, long rest, Undo and click-through mode update the reminder correctly.'
    );

    controller.setBounds({ width: 940, height: 720 });
    await shot('04-narrow-dm', controller);
    assert.equal(
      await run(
        `const row=document.querySelector('.hp-controls');return row.scrollWidth<=row.clientWidth;`
      ),
      true
    );
    await click('[data-action="hp-damage"]');
    await run(
      `commit(()=>TL.removeFromParty(state,${JSON.stringify(characterId)}));await saveQueue;`
    );
    assert.equal(await run(`return document.getElementById('modal-root').childElementCount;`), 0);
    assert.equal(JSON.stringify(getState().characters[0]), otherBefore);
    results.push(
      'Damage controls fit the minimum DM window width, and removing a dialog’s character closes it instead of damaging another character.'
    );
    fs.writeFileSync(
      path.join(dir, 'concentration-reminder-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(dir, 'concentration-reminder-results.json'),
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
