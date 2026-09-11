/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
module.exports = async ({ app, controller, getState, store }) => {
  const directory = path.dirname(store.directory),
    results = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const click = (selector) =>
    run(
      `const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled)throw new Error('Unavailable '+${JSON.stringify(selector)});el.click();await saveQueue;`
    );
  const names = (scope) =>
    run(
      `return [...document.querySelectorAll(${JSON.stringify(scope + ' .party-name')})].map(el=>el.textContent);`
    );
  const shot = async (name) => {
    await new Promise((r) => setTimeout(r, 300));
    fs.writeFileSync(
      path.join(directory, name + '.png'),
      (await controller.webContents.capturePage()).toPNG()
    );
  };
  try {
    for (let i = 0; i < 100; i++) {
      if (await run(`return Boolean(document.querySelector('.sidebar-party'));`)) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    controller.setBounds({ width: 1440, height: 950 });
    controller.showInactive();
    await run(
      `commit(()=>{state=TL.empty();state.characters=['Zora','Mira','Bram'].map((name,i)=>({...TL.character(i),name,initiative:100-i}));state.roster=['Zelda','amber','Dorian','Cora'].map((name,i)=>({...TL.character(i),name}));state.activeId=state.characters[0].id;selectedId=state.activeId;state.round=900;});await saveQueue;`
    );
    assert.deepEqual(await names('.sidebar-party'), ['Zora', 'Mira', 'Bram']);
    assert.deepEqual(await names('.sidebar-saved'), ['amber', 'Cora', 'Dorian', 'Zelda']);
    assert.equal(
      await run(`return document.querySelector('.topbar').textContent.includes('ROUND');`),
      false
    );
    assert.equal(getState().round, undefined);
    results.push(
      'Party keeps DM order; All characters below it contains only inactive characters in alphabetical order. The round counter is absent.'
    );
    for (const [scope, action] of [
      ['.sidebar-party', 'roster-remove'],
      ['.sidebar-saved', 'roster-add'],
    ]) {
      assert.equal(
        await run(
          `return [...document.querySelectorAll('${scope} [data-action="${action}"]')].length;`
        ),
        scope === '.sidebar-party' ? 3 : 4
      );
      assert.equal(
        await run(
          `return [...document.querySelectorAll('${scope} [data-action="roster-delete"]')].every(b=>b.textContent==='Delete character');`
        ),
        true
      );
    }
    const amber = getState().roster.find((c) => c.name === 'amber').id;
    const mira = getState().characters.find((c) => c.name === 'Mira').id;
    const bram = getState().characters.find((c) => c.name === 'Bram').id;
    const zora = getState().characters.find((c) => c.name === 'Zora').id;
    await click(`.sidebar-saved [data-id="${amber}"][data-action="roster-add"]`);
    assert.deepEqual(await names('.sidebar-party'), ['Zora', 'Mira', 'Bram', 'amber']);
    assert.deepEqual(await names('.sidebar-saved'), ['Cora', 'Dorian', 'Zelda']);
    await click(`.sidebar-party [data-id="${bram}"][data-action="party-move"][data-amount="-1"]`);
    assert.deepEqual(await names('.sidebar-party'), ['Zora', 'Bram', 'Mira', 'amber']);
    results.push(
      'Sidebar Add to party appends at the bottom, removes the saved-list entry, and preserves arrow-based initiative ordering.'
    );
    await run(
      `commit(()=>{const c=TL.findCharacter(state,${JSON.stringify(mira)});c.hp=5;c.tempHp=2;c.turn.action=false;c.hud.rotation=270;});await saveQueue;`
    );
    const beforeMira = JSON.parse(JSON.stringify(getState().characters.find((c) => c.id === mira)));
    await click(`.sidebar-party [data-id="${mira}"][data-action="roster-remove"]`);
    assert.deepEqual(await names('.sidebar-party'), ['Zora', 'Bram', 'amber']);
    assert.deepEqual(await names('.sidebar-saved'), ['Cora', 'Dorian', 'Mira', 'Zelda']);
    assert.deepEqual(
      getState().roster.find((c) => c.id === mira),
      beforeMira
    );
    await click(`.sidebar-saved [data-id="${mira}"][data-action="roster-add"]`);
    assert.deepEqual(await names('.sidebar-party'), ['Zora', 'Bram', 'amber', 'Mira']);
    results.push(
      'Remove from party returns the character to the alphabetic saved list without resetting their stats or HUD; rejoining appends last.'
    );
    await click(`.sidebar-party [data-id="${zora}"][data-action="roster-delete"]`);
    await click('[data-action="close-modal"]');
    assert.ok(getState().characters.some((c) => c.id === zora));
    await click(`.sidebar-party [data-id="${zora}"][data-action="roster-delete"]`);
    await click('#confirm-action');
    assert.ok(!getState().characters.some((c) => c.id === zora));
    await click('[data-action="undo"]');
    assert.deepEqual(await names('.sidebar-party'), ['Zora', 'Bram', 'amber', 'Mira']);
    const cora = getState().roster.find((c) => c.name === 'Cora').id;
    await click(`.sidebar-saved [data-id="${cora}"][data-action="roster-delete"]`);
    await click('#confirm-action');
    assert.ok(!getState().roster.some((c) => c.id === cora));
    await click('[data-action="undo"]');
    assert.deepEqual(await names('.sidebar-saved'), ['Cora', 'Dorian', 'Zelda']);
    results.push(
      'Both sidebar Delete character buttons target the correct character, support cancellation, and preserve order through Undo.'
    );
    await click(`.sidebar-saved [data-id="${cora}"][data-action="roster-edit"]`);
    await run(
      `const form=document.getElementById('character-form');form.elements.namedItem('name').value='Aaron';form.requestSubmit();await saveQueue;`
    );
    assert.deepEqual(await names('.sidebar-saved'), ['Aaron', 'Dorian', 'Zelda']);
    assert.equal(getState().characters.length, 4);
    results.push(
      'Clicking a saved name opens its editor without joining the party; renaming updates alphabetic placement.'
    );
    await run(
      `commit(()=>{for(let i=0;i<20;i++){const c=TL.character();c.name='Reserve '+String(i).padStart(2,'0');state.roster.push(c);}for(let i=0;i<4;i++)TL.addToParty(state,state.roster.find(c=>c.name==='Reserve '+String(i).padStart(2,'0')).id);view='character';});await saveQueue;`
    );
    assert.equal(getState().characters.length, 8);
    assert.equal(
      await run(
        `return [...document.querySelectorAll('.sidebar-saved [data-action="roster-add"]')].every(b=>b.disabled);`
      ),
      true
    );
    const first = await names('.sidebar-saved');
    assert.equal(first.length, 12);
    await click('[data-action="sidebar-page"][data-amount="1"]');
    const next = await names('.sidebar-saved');
    assert.ok(next.every((name) => !first.includes(name)));
    results.push(
      'A full eight-character party disables sidebar Add buttons; large alphabetical lists remain available through paging.'
    );
    await run(
      `const input=document.getElementById('sidebar-search');input.focus();input.value='Zelda';input.dispatchEvent(new Event('input',{bubbles:true}));`
    );
    assert.deepEqual(await names('.sidebar-saved'), ['Zelda']);
    await run(`commit(()=>{state.characters[0].hp=9;});await saveQueue;`);
    assert.equal(await run(`return document.activeElement.id;`), 'sidebar-search');
    assert.equal(await run(`return document.activeElement.value;`), 'Zelda');
    await run(
      `const input=document.getElementById('sidebar-search');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.blur();`
    );
    results.push(
      'Sidebar search finds saved characters and retains focus and text through live updates.'
    );
    await shot('01-sidebar-lists');
    for (const size of [
      { width: 1024, height: 768 },
      { width: 980, height: 660 },
    ]) {
      controller.setBounds(size);
      await new Promise((r) => setTimeout(r, 200));
      assert.equal(await run(`return document.documentElement.scrollWidth<=innerWidth+1;`), true);
      assert.equal(
        await run(
          `const side=document.querySelector('.sidebar'),party=document.querySelector('.sidebar-party').getBoundingClientRect(),saved=document.querySelector('.sidebar-saved').getBoundingClientRect(),footer=document.querySelector('.sidebar-footer').getBoundingClientRect();return side.scrollWidth<=side.clientWidth+1&&saved.top>=party.bottom&&footer.bottom<=innerHeight+1&&document.getElementById('sidebar-party-list').clientHeight>=60&&document.getElementById('sidebar-saved-list').clientHeight>=60;`
        ),
        true
      );
      await shot('02-sidebar-' + size.height);
    }
    await run(
      `document.getElementById('sidebar-party-list').scrollTop=100;document.getElementById('sidebar-saved-list').scrollTop=100;render();`
    );
    assert.equal(await run(`return document.getElementById('sidebar-party-list').scrollTop;`), 100);
    assert.equal(await run(`return document.getElementById('sidebar-saved-list').scrollTop;`), 100);
    results.push(
      'Both character lists stay visible and independently scrollable on small laptops, retaining their scroll after updates.'
    );
    await run(`commit(()=>{state.activeId=state.characters.at(-1).id;});await saveQueue;`);
    await click('[data-action="next-turn"]');
    assert.equal(getState().activeId, getState().characters[0].id);
    assert.equal(getState().round, undefined);
    const loaded = store.load().state;
    assert.deepEqual(
      loaded.characters.map((c) => c.id),
      getState().characters.map((c) => c.id)
    );
    assert.deepEqual(
      loaded.roster.map((c) => c.id),
      getState().roster.map((c) => c.id)
    );
    assert.equal(loaded.round, undefined);
    results.push(
      'Next turn wraps to the top without counting rounds; saves preserve membership and initiative order.'
    );
    fs.writeFileSync(
      path.join(directory, 'sidebar-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'sidebar-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
    try {
      await shot('failure');
    } catch {}
  } finally {
    app.quit();
  }
};
