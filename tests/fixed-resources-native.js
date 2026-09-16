/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
module.exports = async ({ app, controller, getOverlay, getState, screen, setOverlay, store }) => {
  const directory = path.dirname(store.directory),
    results = [];
  let overlay;
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const tv = (code) => overlay.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (fn) => {
    const start = Date.now();
    while (!(await fn())) {
      if (Date.now() - start > 10000) throw Error('Adaptive HUD/resource check timed out');
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  const click = (selector) =>
    run(
      `const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled)throw Error('Unavailable '+${JSON.stringify(selector)});el.click();await saveQueue;`
    );
  const shot = async (name, win) => {
    await new Promise((r) => setTimeout(r, 200));
    fs.writeFileSync(
      path.join(directory, name + '.png'),
      (await win.webContents.capturePage()).toPNG()
    );
  };
  const counts = () => getState().characters[0].resources.map((r) => r.current);
  const zero = () =>
    run(`commit(()=>selected().resources.forEach(r=>r.current=0));await saveQueue;`);
  const geometry = () =>
    tv(
      `const el=document.querySelector('.hud-position'),r=el.getBoundingClientRect();return {width:el.offsetWidth,height:el.offsetHeight,x:r.x,y:r.y,w:r.width,h:r.height,transform:el.style.transform};`
    );
  try {
    await wait(() => run(`return !!document.querySelector('[data-action="add-character"]');`));
    controller.setBounds({ width: 1440, height: 950 });
    await click('[data-action="add-character"]');
    await run(
      `document.querySelector('#character-form [name="name"]').value='Resource keeper';document.querySelector('#character-form [name="slot-1"]').value=4;`
    );
    for (const [i, reset] of ['short', 'long', 'turn', 'manual'].entries()) {
      await click('#resource-editor-add');
      await run(
        `const row=document.querySelector('.resource-editor-row:last-child');row.querySelector('[name="resource-name"]').value=${JSON.stringify('Custom ' + reset + ' resource')};const max=row.querySelector('[name="resource-max"]');max.value=3;max.dispatchEvent(new Event('input',{bubbles:true}));if(row.querySelector('[name="resource-current"]').value!=='3')throw Error('Maximum did not add charges');row.querySelector('[name="resource-reset"]').value=${JSON.stringify(reset)};row.querySelectorAll('[data-resource-icon]')[${i + 1}].click();row.querySelector('[name="resource-color"]').value='#d29bf0';row.querySelector('[name="resource-color"]').dispatchEvent(new Event('input',{bubbles:true}));`
      );
    }
    await run(`document.getElementById('character-form').requestSubmit();await saveQueue;`);
    await wait(() => getState().characters[0]?.resources.length === 4);
    assert.deepEqual(counts(), [3, 3, 3, 3]);
    assert.deepEqual(
      getState().characters[0].resources.map((r) => r.icon),
      ['square', 'diamond', 'triangle', 'hexagon']
    );
    assert.ok(getState().characters[0].resources.every((r) => r.color === '#d29bf0'));
    results.push(
      'Create character adds multiple named resource counters with amount, all four reset rules, shape, and color.'
    );
    const firstId = getState().characters[0].id,
      manual = getState().characters[0].resources[3].id;
    await click('[data-action="add-resource"]');
    assert.equal(
      await run(
        `return !!document.getElementById('resource-form') && !document.getElementById('character-form');`
      ),
      true
    );
    await run(
      `document.querySelector('#resource-form [name="resource-name"]').value='Discard new pool';`
    );
    await click('[data-action="close-modal"]');
    assert.equal(getState().characters[0].resources.length, 4);
    await click('[data-action="add-resource"]');
    await run(
      `const form=document.getElementById('resource-form');form.querySelector('[name="resource-name"]').value='New independent pool';const max=form.querySelector('[name="resource-max"]');max.value=5;max.dispatchEvent(new Event('input',{bubbles:true}));form.querySelector('[data-resource-icon="star"]').click();form.querySelector('[name="resource-color"]').value='#123456';await commit(()=>{selected().resources[0].current=1;selected().hp=7;});form.requestSubmit();await saveQueue;`
    );
    await wait(() => getState().characters[0].resources.length === 5);
    const added = getState().characters[0].resources[4];
    assert.equal(added.name, 'New independent pool');
    assert.equal(added.current, 5);
    assert.equal(added.icon, 'star');
    assert.equal(added.color, '#123456');
    assert.equal(getState().characters[0].resources[0].current, 1);
    assert.equal(getState().characters[0].hp, 7);
    await click('[data-action="undo"]');
    assert.equal(getState().characters[0].resources.length, 4);
    results.push(
      'The dedicated Add resource form supports Cancel, appearance and counts; saving appends only the new pool and preserves live character changes.'
    );
    await run(
      `commit(()=>{selected().hud={...selected().hud,expanded:true,x:50,y:50,scale:1,rotation:0};state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};state.settings.overlayInteractive=true;const other=TL.character();other.name='Other player';other.hud.visible=false;state.characters.push(other);});await saveQueue;`
    );
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    overlay = getOverlay();
    const targetDisplay = screen.getPrimaryDisplay().bounds;
    await wait(() => overlay.isVisible());
    await wait(() =>
      tv(
        `return innerWidth===${targetDisplay.width} && innerHeight===${targetDisplay.height} && parseFloat(document.querySelector('.hud-position')?.style.top)===innerHeight/2;`
      )
    );
    await wait(() =>
      tv(`return document.querySelectorAll('.hud-summary .hud-resource').length===3;`)
    );
    let base = await geometry();
    assert.equal(base.width, 880);
    assert.ok(base.height >= 650);
    const stacks = await tv(
      `const rows=[...document.querySelectorAll('.hud-summary .hud-resource')].map(el=>el.getBoundingClientRect());const slots=document.querySelector('.hud-slots').getBoundingClientRect();return rows.every((r,i)=>r.top>=(i?rows[i-1].bottom:slots.bottom)) && document.querySelectorAll('.hud-summary .resource-icon').length===3;`
    );
    assert.ok(stacks);
    assert.equal(
      await run(
        `return document.querySelectorAll('[data-dm-resource] [data-action="resource-reset"]').length;`
      ),
      1
    );
    await click('[data-dm-list-pages="resources"] [data-amount="1"]');
    await wait(() =>
      tv(`return !!document.querySelector('.hud-summary [data-hud-command*="resource-reset"]');`)
    );
    assert.equal(
      await tv(
        `return document.querySelectorAll('.hud-summary [data-hud-command*="resource-reset"]').length;`
      ),
      1
    );
    results.push(
      'Each page of resources stacks below slots with their icons and counts; only manual counters show Reset on both screens.'
    );

    await zero();
    await click('[data-action="short-rest"]');
    await run(`document.getElementById('rest-form').requestSubmit();await saveQueue;`);
    assert.deepEqual(counts(), [3, 0, 0, 0]);
    await zero();
    await click('[data-action="long-rest"]');
    await run(`document.getElementById('rest-form').requestSubmit();await saveQueue;`);
    assert.deepEqual(counts(), [3, 3, 0, 0]);
    await zero();
    await click('[data-action="start-turn"]');
    assert.deepEqual(counts(), [0, 0, 3, 0]);
    await click('[data-action="resource-reset"]');
    assert.deepEqual(counts(), [0, 0, 3, 3]);
    results.push(
      'DM Short rest, Long rest, Start turn, and manual Reset refill exactly the configured pools.'
    );
    await zero();
    await wait(() => tv(`return state.characters[0].resources[3].current===0;`));
    const p = await tv(
      `const b=document.querySelector('.hud-summary [data-hud-command*="resource-reset"]');b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};`
    );
    overlay.webContents.sendInputEvent({ type: 'mouseMove', ...p });
    await new Promise((r) => setTimeout(r, 100));
    overlay.webContents.sendInputEvent({ type: 'mouseDown', ...p, button: 'left', clickCount: 1 });
    overlay.webContents.sendInputEvent({ type: 'mouseUp', ...p, button: 'left', clickCount: 1 });
    await wait(() => getState().characters[0].resources[3].current === 3);
    results.push(
      'A real pointer click on the TV manual Reset button refills the pool and saves it to the DM.'
    );
    await click('[data-dm-list-pages="resources"] [data-amount="-1"]');
    await zero();
    await tv(
      `await window.tablelight.hudCommand({type:'turn',characterId:state.characters[0].id});`
    );
    assert.deepEqual(counts(), [0, 0, 3, 0]);
    await zero();
    await run(`commit(()=>state.activeId=state.characters[1].id);await saveQueue;`);
    await click('[data-action="next-turn"]');
    assert.deepEqual(counts(), [0, 0, 3, 0]);
    results.push(
      'TV Start turn and DM Next turn also reset per-turn pools for the character whose turn begins.'
    );

    await click('[data-action="edit-character"]');
    await run(
      `const row=document.querySelector('.resource-editor-row');row.querySelector('[name="resource-name"]').value='Renamed charges';row.querySelector('[data-resource-icon="star"]').click();row.querySelector('[name="resource-color"]').value='#79cbd6';`
    );
    await tv(
      `await window.tablelight.hudCommand({type:'resource',characterId:state.characters[0].id,resourceId:state.characters[0].resources[2].id,amount:-1});`
    );
    await run(`document.getElementById('character-form').requestSubmit();await saveQueue;`);
    assert.equal(getState().characters[0].resources[0].name, 'Renamed charges');
    assert.equal(getState().characters[0].resources[0].icon, 'star');
    assert.equal(counts()[2], 2);
    results.push(
      'Saving resource edits preserves live TV spending that happens while Edit character is open.'
    );
    await click('[data-action="edit-character"]');
    await click('#resource-editor-add');
    await run(
      `document.querySelector('.resource-editor-row:last-child [name="resource-name"]').value='Discard this';`
    );
    await click('[data-action="close-modal"]');
    assert.equal(getState().characters[0].resources.length, 4);
    await click('[data-action="edit-character"]');
    await click('.resource-editor-row:last-child [data-resource-remove]');
    await run(`document.getElementById('character-form').requestSubmit();await saveQueue;`);
    assert.equal(getState().characters[0].resources.length, 3);
    await click('[data-action="undo"]');
    assert.equal(getState().characters[0].resources.length, 4);
    assert.equal(getState().characters[0].resources[3].id, manual);
    results.push(
      'Cancel discards new resource drafts; removing a resource saves only with the character and supports Undo.'
    );

    await run(
      `commit(()=>{const c=selected();for(let i=0;i<8;i++)c.items.push(TL.item({name:'User action '+i,kind:'spell',economy:i%2?'bonus':'action',description:('A line of user text.\\n').repeat(150),range:'Long user metadata '.repeat(14),duration:'User duration '.repeat(20)}));c.hud.resourcePage=1;for(let i=4;i<25;i++)c.resources.push({id:'extra-'+i,name:'A long custom resource name for testing wrapping '.repeat(2),max:999,current:i,reset:'manual',icon:'diamond',color:'#bed479'});});await saveQueue;`
    );
    await wait(() => tv('return state.characters[0].resources.length===25;'));
    const shortHeight = base.height;
    base = await geometry();
    assert.ok(base.height > shortHeight);
    assert.ok(
      await tv(
        "const summary=document.querySelector('.hud-summary');return summary.scrollHeight<=summary.clientHeight+1 && summary.scrollTop===0 && summary.contains(document.querySelector('.hud-size-controls'));"
      )
    );
    results.push(
      'The resource page grows for wrapping names; three counters and the size buttons need no scrolling.'
    );
    for (const panel of [
      '',
      'sheet',
      'action',
      'bonus',
      'reaction',
      'free',
      'spell',
      'feature',
      'resources',
    ]) {
      await click(`.current-display [data-panel="${panel}"]`);
      await wait(() => tv(`return state.characters[0].hud.panel===${JSON.stringify(panel)};`));
      assert.equal((await geometry()).width, base.width);
      assert.equal(getState().characters[0].hud.scale, 1);
      assert.ok(
        await tv(
          `const area=document.querySelector('.hud-section-content');return area.scrollHeight<=area.clientHeight+1;`
        )
      );
    }
    results.push(
      'Every DM submenu keeps its width and saved scale while growing enough to show its content.'
    );
    await click('.current-display [data-panel="spell"]');
    await click('.current-display [data-action="hud-detail"]');
    await wait(() => tv(`return !!document.querySelector('.hud-description');`));
    assert.equal((await geometry()).width, base.width);
    await click('.current-display [data-action="hud-page"][data-amount="1"]');
    await wait(() => tv(`return state.characters[0].hud.page===1;`));
    assert.equal((await geometry()).width, base.width);
    results.push('Long ability text and description pages stay within the chosen HUD width.');
    await run(
      `commit(()=>{state.settings.overlayInteractive=false;window.tallResourceFixture=TL.clone(selected().resources);selected().hud.resourcePage=0;selected().resources=selected().resources.slice(0,3);});await saveQueue;`
    );
    await wait(() =>
      tv(`return !state.settings.overlayInteractive && state.characters[0].resources.length===3;`)
    );
    const tallHeight = base.height;
    base = await geometry();
    assert.ok(base.height < tallHeight);
    assert.equal(
      await run(
        `return !!document.querySelector('.current-display [data-action="current-scroll"]');`
      ),
      false
    );
    assert.ok(
      await tv(
        `const area=document.querySelector('.hud-section-content');return area.scrollTop===0 && area.scrollHeight<=area.clientHeight+1;`
      )
    );
    await run(`commit(()=>selected().hp=5);await saveQueue;`);
    await wait(() => tv(`return state.characters[0].hp===5;`));
    assert.equal((await geometry()).width, base.width);
    await shot('01-expanded-click-through', overlay);
    results.push(
      'Ability details grow without scrolling in click-through mode, and live HP updates preserve the frame.'
    );
    await run(
      `const el=document.querySelector('[data-current-size]');el.value='75';el.dispatchEvent(new Event('input',{bubbles:true}));if(document.querySelector('.current-size output').textContent!=='75%')throw Error('Size label stale');el.dispatchEvent(new Event('change',{bubbles:true}));await saveQueue;`
    );
    await wait(() => tv(`return state.characters[0].hud.scale===0.75;`));
    assert.ok((await geometry()).transform.endsWith('scale(0.75)'));
    await click('.current-display [data-action="current-size"][data-amount="10"]');
    assert.equal(getState().characters[0].hud.scale, 0.85);
    await click('.current-display [data-action="current-size"][data-amount="-10"]');
    assert.equal(getState().characters[0].hud.scale, 0.75);
    assert.equal(getState().characters[1].hud.scale, 1);
    await run(`view='display';render();`);
    assert.equal(await run(`return document.getElementById('hud-scale').value;`), '75');
    await run(
      `const el=document.getElementById('hud-scale');el.value='90';el.dispatchEvent(new Event('change',{bubbles:true}));await saveQueue;`
    );
    assert.equal(await run(`return document.querySelector('[data-current-size]').value;`), '90');
    await click('.current-display [data-action="current-size"][data-amount="0"]');
    assert.equal(getState().characters[0].hud.scale, 1);
    results.push(
      'Currently displayed offers an exact size slider, Smaller, Larger, and 100%; it syncs with TV & layout and changes only that player.'
    );
    await run(
      `commit(()=>{selected().resources=window.tallResourceFixture;state.settings.overlayInteractive=true;});await saveQueue;`
    );
    await wait(() =>
      tv(`return state.characters[0].resources.length===25 && state.settings.overlayInteractive;`)
    );
    const exact = await tv(
      `const fixture=document.createElement('div');document.body.append(fixture);const sample=TL.clone(state);sample.characters=sample.characters.slice(0,1);const reports=[];for(const scale of [0.4,0.75,1.5,2.5])for(const angle of [0,45,90,180,270]){sample.characters[0].hud={...sample.characters[0].hud,scale,rotation:angle};HUD.mount(fixture,sample,640,480,1,'','overlay');const el=fixture.firstElementChild;reports.push(el.style.transform.endsWith('scale('+scale+')')&&el.offsetWidth===880&&el.offsetHeight>650&&el.querySelector('.hud-summary').scrollHeight<=el.querySelector('.hud-summary').clientHeight+1);}fixture.remove();return reports.every(Boolean);`
    );
    assert.ok(exact);
    results.push('Small displays and rotations never silently reduce the chosen 40–250% scale.');
    await run(
      `view='character';render();commit(()=>{selected().hud.rotation=90;selected().hud.scale=0.75;state.settings.overlayInteractive=true;});await saveQueue;`
    );
    await wait(() => tv(`return state.characters[0].hud.rotation===90;`));
    const rotated = await geometry();
    await click('.current-display [data-panel="resources"]');
    await wait(() => tv(`return state.characters[0].hud.panel==='resources';`));
    assert.equal((await geometry()).width, rotated.width);
    await click('.current-display [data-action="hud-page"][data-amount="1"]');
    await wait(() => tv(`return state.characters[0].hud.resourcePage===1;`));
    assert.equal((await geometry()).width, rotated.width);
    results.push(
      'Rotated HUDs retain their width while the DM changes sections and resource pages.'
    );
    await run(`commit(()=>{selected().hud.rotation=0;selected().hud.scale=1;});await saveQueue;`);
    await wait(() => tv(`return state.characters[0].hud.rotation===0;`));

    await shot('02-fixed-resources', overlay);
    controller.setBounds({ width: 1100, height: 800 });
    await run(
      `render();document.querySelector('.current-display').scrollIntoView({block:'start'});`
    );
    const overflow = await run(
      `return [...document.querySelectorAll('.current-size,.current-size-buttons,.current-scroll')].some(el=>el.scrollWidth>el.clientWidth+1);`
    );
    assert.equal(overflow, false);
    await shot('03-dm-size-controls', controller);
    await click('[data-action="edit-character"]');
    await run(`document.getElementById('character-resources').scrollIntoView({block:'start'});`);
    await shot('04-resource-editor', controller);
    await click('[data-action="close-modal"]');
    results.push(
      'The DM resize controls fit a smaller laptop window; resource editing remains inside Edit character.'
    );
    const chargeDisplays = await run(`
      const fixture=document.createElement('div');document.body.append(fixture);
      const c=TL.character();c.hud.expanded=true;
      c.resources=[{id:'empty',name:'Empty pool',max:1,current:0,reset:'long'}, {id:'ten',name:'Ten charges',max:10,current:7,reset:'manual'}, {id:'large',name:'Large pool',max:11,current:9,reset:'turn'}];
      fixture.innerHTML=renderCharacterResources(c)+HUD.render(c);
      const reports=['empty','ten','large'].map(id=>{
        const dm=fixture.querySelector('[data-dm-resource="'+id+'"] .resource-charges');
        const tv=fixture.querySelector('[data-resource-id="'+id+'"] .resource-charges');
        return [dm,tv].map(e=>({markers:e.querySelectorAll('.pips i').length,filled:e.querySelectorAll('.filled').length,text:e.textContent.trim(),label:e.getAttribute('aria-label')}));
      });fixture.remove();return reports;
    `);
    for (const display of chargeDisplays[0]) {
      assert.equal(display.markers, 1);
      assert.equal(display.filled, 0);
      assert.equal(display.text, '');
    }
    for (const display of chargeDisplays[1]) {
      assert.equal(display.markers, 10);
      assert.equal(display.filled, 7);
      assert.equal(display.text, '');
      assert.equal(display.label, '7 of 10 charges available');
    }
    for (const display of chargeDisplays[2]) {
      assert.equal(display.markers, 0);
      assert.equal(display.text, '9 / 11');
    }
    assert.ok(
      await tv(
        `return [...document.querySelectorAll('.hud-summary .hud-section-box')].length===3 && [...document.querySelectorAll('.hud-summary .hud-section-box')].every(e=>['Top','Right','Bottom','Left'].every(side=>parseFloat(getComputedStyle(e)['border'+side+'Width'])>=2));`
      )
    );
    results.push(
      'Empty and ten-charge pools show individual filled/empty markers on both screens; larger pools use current/maximum. Conditions, spell slots, and custom resources have full section borders.'
    );
    const disk = JSON.parse(fs.readFileSync(path.join(store.directory, 'party.json'), 'utf8'));
    const saved = disk.characters.find((c) => c.id === firstId);
    assert.equal(saved.resources.length, 25);
    assert.equal(saved.resources[0].icon, 'star');
    assert.equal(saved.resources[0].color, '#79cbd6');
    assert.equal(saved.resources[2].reset, 'turn');
    assert.equal(saved.hud.scale, 1);
    results.push(
      'Disk saves preserve resource appearance, reset rules, counts, and the chosen HUD size.'
    );
    fs.writeFileSync(
      path.join(directory, 'fixed-resources-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'fixed-resources-results.json'),
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
