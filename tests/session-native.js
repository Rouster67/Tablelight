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
      if (Date.now() - start > 10000) throw new Error('Session control test timed out');
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
  const shot = async (name) => {
    let error;
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 250));
      try {
        fs.writeFileSync(
          path.join(directory, name + '.png'),
          (await controller.webContents.capturePage()).toPNG()
        );
        return;
      } catch (e) {
        error = e;
      }
    }
    throw error;
  };
  const checkCharacterLayout = async () => {
    const layout = await run(`
      const rect = selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};
      };
      const tiles = [...document.querySelectorAll('.combat-tile')];
      return {
        turn:rect('.character-turn-tools'), hero:rect('.character-hero'),
        tools:rect('.hero-tools'), combat:rect('.combat-strip'),
        scores:rect('.character-scores'), display:rect('.current-display'),
        abilities:rect('.character-abilities'),
        slots:rect('.character-resources > section:first-child'),
        resources:rect('.character-resources > section:last-child'),
        heading:document.querySelector('.character-scores h3').textContent,
        counters:tiles.length,
        controlsFit:tiles.every(tile => [...tile.querySelectorAll('button')].every(button => {
          const r=button.getBoundingClientRect(), p=tile.getBoundingClientRect();
          return r.left>=p.left && r.right<=p.right+1 && r.top>=p.top && r.bottom<=p.bottom+1;
        })),
        noHorizontalScroll:document.documentElement.scrollWidth<=innerWidth+1
      };
    `);
    assert.equal(layout.heading, 'Abilities');
    assert.equal(layout.counters, 5);
    assert.ok(layout.turn.bottom <= layout.hero.top, 'Turn/rest controls sit above the portrait');
    assert.ok(layout.display.top <= layout.hero.top, 'The display controls start at the top');
    assert.ok(layout.display.left >= layout.tools.right, 'Character controls stay on the left');
    assert.ok(layout.scores.top >= layout.combat.bottom, 'Ability scores follow the counters');
    assert.ok(layout.abilities.top >= layout.scores.bottom, 'Ability tabs follow ability scores');
    assert.ok(layout.slots.left >= layout.abilities.right, 'Spell slots stay beside ability tabs');
    assert.ok(Math.abs(layout.slots.top - layout.abilities.top) <= 1);
    assert.ok(layout.resources.top >= layout.slots.bottom, 'Custom resources follow spell slots');
    assert.ok(layout.controlsFit, 'Counter controls stay inside their tiles');
    assert.ok(layout.noHorizontalScroll, 'The character workspace fits the window');
  };
  let overlay;
  try {
    await wait(() =>
      run(`return Boolean(document.querySelector('[data-action="add-character"]'));`)
    );
    controller.setBounds({ width: 1440, height: 950 });
    controller.showInactive();
    await click('[data-action="add-character"]');
    await fill('character-form', { name: 'Session player A', proficiency: 3, 'ability-dex': 16 });
    await wait(() => getState().characters.length === 1);
    const a = getState().characters[0].id;
    await click('[data-action="add-item"]');
    await click('[data-action="new-library-entry"]');
    assert.equal(
      await run(`return document.querySelector('#item-form select[name="level"]').value;`),
      ''
    );
    assert.equal(
      await run(
        `return document.querySelector('#item-form select[name="level"]').selectedOptions[0].textContent;`
      ),
      'None'
    );
    await fill('item-form', { name: 'No-level action' });
    await wait(() => getState().characters[0].items.length === 1);
    assert.equal(getState().characters[0].items[0].level, null);
    results.push('New actions default to None and save without a spell level.');
    await click('[data-action="temp-hp"]');
    await fill('amount-form', { amount: 7 });
    await wait(() => getState().characters[0].tempHp === 7);
    await click('[data-action="hp-damage"]');
    await fill('amount-form', { amount: 5 });
    await wait(() => getState().characters[0].tempHp === 2);
    assert.equal(getState().characters[0].hp, 10);
    results.push('The main HP area sets temporary HP, and damage uses it first.');
    await click('[data-action="edit-character"]');
    await click(
      '#character-form [data-action="rank-toggle"][data-kind="skill"][data-name="Stealth"][data-which="p"]'
    );
    await click(
      '#character-form [data-action="rank-toggle"][data-kind="skill"][data-name="Stealth"][data-which="e"]'
    );
    await click(
      '#character-form [data-action="rank-toggle"][data-kind="save"][data-name="wis"][data-which="e"]'
    );
    await shot('01-training-editor');
    await fill('character-form', {});
    await wait(() => getState().characters[0].saveExpertise.includes('wis'));
    assert.equal(getState().characters[0].skills.Stealth.rank, 2);
    results.push('Character editor provides separate P and E bubbles for skills and saves.');
    await click('[data-action="tab"][data-tab="sheet"]');
    await click('.training-saves [data-name="wis"][data-which="e"]');
    await wait(() => !getState().characters[0].saveExpertise.includes('wis'));
    assert.ok(getState().characters[0].saves.includes('wis'));
    results.push('DM sheet bubbles switch expertise to proficiency directly.');
    await click('[data-action="add-character"]');
    await fill('character-form', { name: 'Session player B' });
    await wait(() => getState().characters.length === 2);
    await click('[data-action="add-character"]');
    await fill('character-form', { name: 'Session player C' });
    await wait(() => getState().characters.length === 3);
    const b = getState().characters[1].id,
      c = getState().characters[2].id,
      placements = Object.fromEntries(getState().characters.map((x) => [x.id, x.hud]));
    await click('[data-action="initiative-order"]');
    await run(
      `const f=document.getElementById('initiative-form');for(const [id,value] of Object.entries(${JSON.stringify({ [a]: 7, [b]: 25, [c]: 14 })}))f.elements.namedItem('initiative-'+id).value=value;`
    );
    await click('#sort-initiative');
    await shot('02-initiative');
    await fill('initiative-form', {});
    await wait(() => getState().characters[0].id === b);
    assert.deepEqual(
      getState().characters.map((x) => x.id),
      [b, c, a]
    );
    assert.equal(getState().activeId, a);
    for (const x of getState().characters) assert.deepEqual(x.hud, placements[x.id]);
    results.push(
      'Initiative rolls can sort the sidebar while retaining current turn and TV seating.'
    );
    await click('[data-action="next-turn"]');
    await wait(() => getState().activeId === b);
    results.push('Next turn follows the visible party order.');
    await click(`[data-action="party-move"][data-id="${a}"][data-amount="-1"]`);
    await wait(() => getState().characters[1].id === a);
    assert.equal(getState().activeId, b);
    results.push('Sidebar arrows move a player independently of initiative score.');
    await run(
      `const from=document.querySelector('[data-party-id="${a}"]'),to=document.querySelector('[data-party-id="${b}"]'),transfer=new DataTransfer();from.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));const rect=to.getBoundingClientRect();to.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer,clientY:rect.top+2}));to.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer,clientY:rect.top+2}));document.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:transfer}));await saveQueue;`
    );
    assert.deepEqual(
      getState().characters.map((x) => x.id),
      [a, b, c]
    );
    results.push('Sidebar drag-and-drop changes the saved party sequence.');
    await click(`[data-action="select"][data-id="${a}"]`);
    await run(
      `commit(()=>{const c=selected();c.items=[];for(const economy of ['action','bonus','reaction','free'])for(const kind of ['action','spell','feature'])c.items.push(TL.item({name:economy+' '+kind,kind,economy,level:kind==='spell'?0:null,description:('Long description test. ').repeat(80)}));for(let i=0;i<4;i++)c.items.push(TL.item({name:'Extra action '+i,economy:'action'}));c.hud.expanded=true;c.hud.rotation=90;c.hud.x=50;c.hud.y=50;c.hud.panel='action';state.characters.slice(1).forEach(x=>x.hud.expanded=false);state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};tab='action';});await saveQueue;`
    );
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    overlay = getOverlay();
    await wait(() =>
      overlay.webContents.executeJavaScript(`Boolean(document.querySelector('.hud-nav'))`)
    );
    const overlayRun = (code) => overlay.webContents.executeJavaScript(`(()=>{${code}})()`);
    const overlayCommand = (scope, match) =>
      overlayRun(
        `const button=[...document.querySelectorAll(${JSON.stringify(scope + ' [data-hud-command]')})].find(el=>{const value=JSON.parse(el.dataset.hudCommand);return Object.entries(${JSON.stringify(match)}).every(([key,v])=>value[key]===v);});if(!button)throw new Error('HUD button not found');button.click();`
      );
    const root = `.hud-position[data-hud-id="${a}"]`;
    for (const economy of ['action', 'bonus', 'reaction', 'free']) {
      await click(`.current-display [data-action="panel"][data-panel="${economy}"]`);
      await wait(() => getState().characters[0].hud.panel === economy);
      await wait(() =>
        overlayRun(
          `return document.querySelector(${JSON.stringify(root)})?.innerText.includes(${JSON.stringify(economy + ' spell')});`
        )
      );
      const names = await overlayRun(
        `return [...document.querySelectorAll(${JSON.stringify(root + ' .hud-option b')})].map(x=>x.textContent);`
      );
      assert.ok(names.includes(economy + ' spell'));
      assert.ok(names.includes(economy + ' feature'));
      assert.ok(names.includes(economy + ' action'));
    }
    results.push(
      'All four action-cost tabs show matching actions, features, and spells on the TV.'
    );
    await click('.current-display [data-action="panel"][data-panel="action"]');
    await click('.current-display [data-action="hud-page"][data-amount="1"]');
    await wait(() => getState().characters[0].hud.page === 1);
    await wait(() =>
      overlayRun(
        `return document.querySelector(${JSON.stringify(root)})?.innerText.includes('Extra action 3');`
      )
    );
    results.push('Currently displayed can page through the player’s complete action list.');
    await click('.current-display [data-action="hud-page"][data-amount="-1"]');
    await click('.current-display [data-action="hud-detail"]');
    await wait(() => Boolean(getState().characters[0].hud.detailId));
    await click('.current-display [data-action="hud-page"][data-amount="1"]');
    await wait(() => getState().characters[0].hud.page === 1);
    await wait(() =>
      overlayRun(
        `return document.querySelector(${JSON.stringify(root + ' .hud-page')})?.innerText.includes('2 /');`
      )
    );
    results.push('DM controls open a listed ability and page its description on the TV.');
    await overlayCommand(root + ' .hud-nav', { type: 'panel', panel: 'bonus' });
    await wait(() => getState().characters[0].hud.panel === 'bonus');
    assert.equal(
      await run(
        `return document.querySelector('.current-display [data-panel="bonus"]').getAttribute('aria-pressed');`
      ),
      'true'
    );
    results.push('Clicking TV navigation immediately updates Currently displayed on the DM side.');
    await overlayCommand(root + ' .hud-temp-controls', { type: 'temp-hp', amount: 5 });
    await wait(() => getState().characters[0].tempHp === 7);
    assert.equal(getState().characters[1].tempHp, 0);
    results.push('Temporary HP can also be adjusted directly from the TV overlay.');
    await click('.current-display [data-panel="sheet"]');
    await wait(() =>
      overlayRun(`return Boolean(document.querySelector(${JSON.stringify(root + ' .hud-saves')}));`)
    );
    await overlayRun(
      `document.querySelector(${JSON.stringify(root + ' .hud-saves [data-rank-name="wis"]')}+' button[aria-label^="Expertise"]').click();`
    );
    await wait(() => getState().characters[0].saveExpertise.includes('wis'));
    results.push('The TV sheet shows P/E bubbles and supports direct proficiency changes.');
    const bubbleStyles = await overlayRun(
      `const all=[...document.querySelectorAll(${JSON.stringify(root + ' .rank-bubble')})],filled=all.find(b=>b.classList.contains('filled')),empty=all.find(b=>!b.classList.contains('filled'));return {radius:getComputedStyle(filled).borderRadius,filled:getComputedStyle(filled).backgroundColor,empty:getComputedStyle(empty).backgroundColor};`
    );
    assert.equal(bubbleStyles.radius, '50%');
    assert.notEqual(bubbleStyles.filled, bubbleStyles.empty);
    await click('[data-action="edit-character"]');
    await click('#character-form [data-kind="save"][data-name="dex"][data-which="e"]');
    await overlayCommand(root + ' .hud-saves', {
      type: 'proficiency',
      kind: 'save',
      name: 'str',
      rank: 1,
    });
    await wait(() => getState().characters[0].saves.includes('str'));
    await fill('character-form', {});
    await wait(() => getState().characters[0].saveExpertise.includes('dex'));
    assert.ok(getState().characters[0].saves.includes('str'));
    assert.ok(getState().characters[0].saveExpertise.includes('wis'));
    results.push(
      'Training bubbles are round with distinct filled states; editor saves preserve other changes made on the TV.'
    );
    await click('[data-action="tab"][data-tab="sheet"]');
    await shot('03-dm-sheet');
    assert.equal(getState().characters[0].hud.rotation, 90);
    await wait(() => overlay.isVisible());
    fs.writeFileSync(
      path.join(directory, '04-tv-sheet.png'),
      (await overlay.webContents.capturePage()).toPNG()
    );
    await click('.current-display [data-panel="bonus"]');
    await run('window.scrollTo(0,0);');
    await checkCharacterLayout();
    await shot('05-currently-displayed');
    controller.setBounds({ width: 1024, height: 768 });
    await run('render();');
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(await run('return document.documentElement.scrollWidth<=innerWidth+1;'), true);
    assert.equal(
      await run(
        'const side=document.querySelector(".sidebar");return side.scrollWidth<=side.clientWidth+1;'
      ),
      true
    );
    await shot('06-small-window');
    await checkCharacterLayout();
    controller.setBounds({ width: 940, height: 768 });
    await run('render();window.scrollTo(0,0);');
    await new Promise((r) => setTimeout(r, 250));
    await checkCharacterLayout();
    await shot('07-minimum-window');
    results.push(
      'At wide, laptop, and minimum widths, turn controls lead the character, the display controls sit upper right, Abilities follows all five counters, and spell slots/resources sit beside the ability tabs without clipping.'
    );
    results.push('New controls fit the small laptop window and preserve overlay rotation.');
    const restored = store.load().state;
    assert.deepEqual(
      restored.characters.map((x) => x.id),
      [a, b, c]
    );
    assert.equal(restored.characters[0].tempHp, 7);
    assert.equal(restored.characters[0].skills.Stealth.rank, 2);
    assert.ok(restored.characters[0].saveExpertise.includes('wis'));
    results.push('Party order, temporary HP, and expertise survive a saved-party reload.');
    fs.writeFileSync(
      path.join(directory, 'session-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'session-results.json'),
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
