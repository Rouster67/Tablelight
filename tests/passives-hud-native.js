/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const TL = require('../core');
const { hudRegions } = require('../window-shape');
module.exports = async ({ app, controller, getOverlay, getState, setOverlay, store }) => {
  const directory = path.dirname(store.directory),
    results = [];
  let overlay;
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const tv = (code) => overlay.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (check) => {
    const start = Date.now();
    while (!(await check())) {
      if (Date.now() - start > 10000) throw Error('Passive HUD test timed out.');
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  };
  const root = '[data-hud-id="player-0"]';
  const command = async (match) => {
    const code = `const el=[...document.querySelectorAll('${root} [data-hud-command]')].find(el=>Object.entries(${JSON.stringify(match)}).every(([k,v])=>JSON.parse(el.dataset.hudCommand)[k]===v));`;
    await wait(() => tv(code + 'return !!el && !el.disabled;'));
    await tv(code + 'el.click();');
  };
  const click = (selector) =>
    run(
      `const el=document.querySelector(${JSON.stringify(selector)}); if(!el)throw Error('Missing '+${JSON.stringify(selector)}); el.click(); await saveQueue;`
    );
  const shot = async (name) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const rect = await tv(
      `const r=document.querySelector('${root}').getBoundingClientRect(); return {x:Math.max(0,Math.floor(r.x)),y:Math.max(0,Math.floor(r.y)),width:Math.min(innerWidth,Math.ceil(r.width)),height:Math.min(innerHeight,Math.ceil(r.height))};`
    );
    fs.writeFileSync(
      path.join(directory, name + '.png'),
      (await overlay.webContents.capturePage(rect)).toPNG()
    );
  };
  try {
    await wait(() => run(`return !!document.querySelector('[data-action="add-character"]');`));
    controller.setBounds({ width: 1440, height: 950 });
    await run(`await commit(()=>{
      state=TL.empty(); state.settings.displayId=display().id;
      state.settings.overlayInteractive=true; state.settings.soloExpand=false;
      state.library=[
        TL.libraryEntry({id:'passive',name:'Lantern sense',behavior:'passive',trackPassive:true,description:'Read the marker <only> while carrying a lantern.',economy:'bonus',level:2,usesSlot:true,requiresConcentration:true}),
        TL.libraryEntry({id:'hybrid',name:'Watchkeeper',kind:'feature',behavior:'hybrid',trackPassive:true,passiveDescription:'Notice a quiet signal. '.repeat(85),description:'Send a bright signal.',economy:'reaction',level:1,usesSlot:true}),
        TL.libraryEntry({id:'always',name:'Steady footing',behavior:'passive',description:'Keep your footing on familiar paths.'})
      ];
      state.characters=[TL.character(),TL.character(1),TL.character(2)];
      state.roster=[TL.character(3)];
      TL.allCharacters(state).forEach((c,i)=>{
        c.id='player-'+i;c.name=['Mira','Rowan','Hidden player','Saved player'][i];
        c.resources=[{id:'pool-'+i,name:'Signal charges',current:3,max:5,reset:'long'}];
        c.slots[0]={level:1,current:2,max:3};
        Object.assign(c.hud,{expanded:i===0,visible:i!==2,panel:'passive',x:i===0?40:85,y:50,rotation:i*90,scale:i===0?0.85:0.5});
        for(const entry of state.library)TL.attachItem(state,c.id,entry.id,{resourceId:'pool-'+i,resourceCost:1});
      });
      selectedId='player-0';state.activeId='player-0';view='character';tab='passive';
    });`);
    const first = TL.clone(getState()),
      passiveId = first.characters[0].items[0].id,
      hybridId = first.characters[0].items[1].id,
      alwaysId = first.characters[0].items[2].id;
    const others = TL.clone(first.characters.slice(1));
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    overlay = getOverlay();
    await wait(() =>
      tv(`return document.querySelectorAll('${root} .hud-passive-option').length===3;`)
    );
    assert.equal(await tv(`return document.querySelector('${root} .hud-card').offsetWidth;`), 880);
    assert.equal(await tv(`return !!document.querySelector('[data-hud-id="player-2"]');`), false);
    assert.match(
      await tv(`return document.querySelector('${root} .hud-panel').textContent;`),
      /Always applies/
    );
    assert.doesNotMatch(
      await tv(`return document.querySelector('${root} .hud-panel').textContent;`),
      /Ready|Spent|Signal charges|Use ability/
    );
    await shot('01-player-passives');
    results.push(
      'Players see Passives beside Features; conditional and always-applying reminders have no costs or Use control, at the existing 880px width.'
    );

    await command({ type: 'passive', itemId: passiveId, active: true });
    await wait(() => getState().characters[0].items[0].passiveActive);
    const toggled = TL.clone(first);
    toggled.characters[0].items[0].passiveActive = true;
    assert.deepEqual(getState(), toggled);
    assert.deepEqual(store.load().state, toggled);
    await command({ type: 'detail', itemId: passiveId, effect: 'passive' });
    await wait(() =>
      tv(
        `return document.querySelector('${root} .hud-description')?.textContent.includes('<only>');`
      )
    );
    assert.equal(
      await tv(`return document.querySelectorAll('${root} .hud-panel .hud-use-controls').length;`),
      0
    );
    await command({ type: 'passive', itemId: passiveId, active: false });
    await wait(() => !getState().characters[0].items[0].passiveActive);
    assert.equal(getState().characters[0].hud.detailId, passiveId);
    await command({ type: 'panel', panel: 'passive' });
    await wait(() => !getState().characters[0].hud.detailId);
    results.push(
      'Player list and detail switches change only that assignment, save immediately, and leave spending, conditions, placement and other characters unchanged.'
    );

    await command({ type: 'detail', itemId: hybridId, effect: 'passive' });
    await wait(() =>
      tv(
        `return document.querySelector('${root} .hud-description')?.textContent.includes('quiet signal');`
      )
    );
    await command({ type: 'page', amount: 1 });
    await wait(() => getState().characters[0].hud.page === 1);
    await wait(() =>
      run(
        `return document.querySelector('.current-description')?.textContent===TL.abilityTextPages(selected().items[1],'passive')[1][0].text;`
      )
    );
    assert.equal(
      await run(`return document.querySelector('.current-description').textContent;`),
      await tv(`return document.querySelector('${root} .hud-description').textContent;`)
    );
    const reading = TL.clone(getState().characters[0].hud);
    await run(`await commit(()=>selected().hp--);`);
    assert.deepEqual(getState().characters[0].hud, reading);
    await command({ type: 'detail', itemId: hybridId, effect: 'active' });
    await wait(() => tv(`return !!document.querySelector('${root} .hud-use-controls');`));
    assert.match(
      await tv(`return document.querySelector('${root} .hud-panel').textContent;`),
      /Send a bright signal/
    );
    assert.doesNotMatch(
      await tv(`return document.querySelector('${root} .hud-panel').textContent;`),
      /quiet signal/
    );
    await command({ type: 'use', itemId: hybridId, level: 1 });
    await wait(() => tv(`return !!document.querySelector('${root} .hud-pending-requests');`));
    await command({ type: 'detail', itemId: hybridId, effect: 'passive' });
    await wait(() => tv(`return !document.querySelector('${root} .hud-use-controls');`));
    await command({ type: 'passive', itemId: hybridId, active: true });
    await wait(() => getState().characters[0].items[1].passiveActive);
    assert.equal(await tv(`return document.querySelector('${root} .hud-card').offsetWidth;`), 1150);
    assert.equal(getState().characters[0].slots[0].current, 2);
    assert.equal(getState().characters[0].turn.reaction, true);
    await shot('02-hybrid-passive-with-request');
    await tv(`document.querySelector('${root} [data-cancel-request]').click();`);
    await wait(() => tv(`return !document.querySelector('${root} .hud-pending-requests');`));
    results.push(
      'Hybrid effects have separate text and controls, matching DM page previews; reminder changes preserve a pending active request and the 1150px pending-column width.'
    );

    await run(`await commit(()=>{state.settings.overlayInteractive=false;});`);
    await wait(() => tv(`return document.querySelectorAll('${root} .hud-nav-label').length===10;`));
    assert.equal(await tv(`return document.querySelectorAll('${root} button').length;`), 0);
    assert.match(
      await tv(`return document.querySelector('${root} .hud-passive-status').textContent;`),
      /^Active$/
    );
    await click('.current-display [data-action="set-passive"]');
    await wait(() =>
      tv(`return document.querySelector('${root} .hud-passive-status')?.textContent==='Inactive';`)
    );
    await click('.current-display [data-action="hud-page"][data-amount="1"]');
    await wait(() => getState().characters[0].hud.page === 1);
    await shot('03-click-through-passive');
    await click('.current-display [data-action="hud-detail"][data-effect="active"]');
    await wait(() =>
      tv(
        `return document.querySelector('${root} .hud-description')?.textContent.includes('bright signal');`
      )
    );
    await click('.current-display [data-action="hud-detail"][data-effect="passive"]');
    await wait(() => getState().characters[0].hud.panel === 'passive');
    await run(`showPassiveItem(${JSON.stringify(passiveId)},'player-0');`);
    await click('#modal-root [data-action="hud-detail"][data-effect="passive"]');
    await wait(() => getState().characters[0].hud.detailId === passiveId);
    await run('closeModal();');
    assert.deepEqual(getState().characters.slice(1), others);
    results.push(
      'Click-through displays passive text and status without buttons; the DM can page, change reminders, switch effects, and explicitly send a passive to TV.'
    );

    await run(
      `await commit(()=>{state.settings.overlayInteractive=true;state.library[1].description='';state.library[1].passiveDescription='<lantern>'+'x'.repeat(39991);TL.hudCommand(state,{type:'detail',characterId:'player-0',itemId:${JSON.stringify(hybridId)},effect:'passive'});});`
    );
    await wait(() =>
      tv(
        `return document.querySelector('${root} .hud-description')?.textContent.startsWith('<lantern>');`
      )
    );
    const total = TL.hudPageCount(getState().characters[0]);
    assert.ok(total > 50);
    await run(
      `await commit(()=>TL.hudCommand(state,{type:'page',characterId:'player-0',amount:999}));`
    );
    await wait(() => tv(`return state.characters[0].hud.page===${total - 1};`));
    assert.equal(
      await tv(
        `const p=document.querySelector('${root} .hud-section-content');return p.scrollWidth<=p.clientWidth+1&&p.scrollHeight<=p.clientHeight+1;`
      ),
      true
    );
    await run(`await commit(()=>state.library[1].passiveDescription='Short revised passive.');`);
    await wait(() =>
      tv(
        `return document.querySelector('${root} .hud-description')?.textContent==='Short revised passive.';`
      )
    );
    assert.equal(getState().characters[0].hud.page, 0);
    results.push(
      'An empty hybrid active description does not hide its passive; maximum-length text is paged to the end and shortening it safely clamps the current page.'
    );

    const layouts =
      await tv(`const fixture=document.createElement('div');fixture.style.cssText='position:fixed;left:0;top:0';document.body.append(fixture);
      const sample=TL.clone(state);sample.characters=[sample.characters[0]];const c=sample.characters[0],reports=[];
      for(const rotation of [0,45,90,180,270])for(const scale of [0.4,0.85,2.5])for(const interactive of [false,true]){
        Object.assign(c.hud,{rotation,scale,x:50,y:50});
        HUD.mount(fixture,sample,8000,8000,1,'',interactive?'overlay':'');
        const el=fixture.firstElementChild,card=el.querySelector('.hud-card'),content=el.querySelector('.hud-section-content'),r=el.getBoundingClientRect();
        reports.push({rotation,scale,interactive,width:card.offsetWidth,fits:content.scrollWidth<=content.clientWidth+1&&content.scrollHeight<=content.clientHeight+1,transform:el.style.transform,frame:{cx:r.x+r.width/2,cy:r.y+r.height/2,width:el.offsetWidth*scale,height:el.offsetHeight*scale,rotation}});
      }fixture.remove();return reports;`);
    for (const report of layouts) {
      assert.equal(report.width, 880);
      assert.equal(report.fits, true);
      assert.ok(report.transform.includes('rotate(' + report.rotation + 'deg)'));
      assert.ok(report.transform.includes('scale(' + report.scale + ')'));
      const regions = hudRegions([report.frame], 8000, 8000);
      assert.ok(
        regions.some(
          (r) =>
            report.frame.cx >= r.x &&
            report.frame.cx < r.x + r.width &&
            report.frame.cy >= r.y &&
            report.frame.cy < r.y + r.height
        )
      );
      assert.equal(
        regions.some((r) => r.x === 0 && r.y === 0),
        false
      );
    }
    await run(`await commit(()=>{selected().hud.rotation=45;selected().hud.scale=0.65;});`);
    await wait(() => tv(`return state.characters[0].hud.rotation===45;`));
    await shot('04-rotated-passive');
    const saved = TL.clone(getState());
    await command({ type: 'expand' });
    await wait(() => tv(`return !!document.querySelector('${root} .hud-collapsed');`));
    assert.ok(await tv(`return document.querySelector('${root}').offsetWidth<=142;`));
    await command({ type: 'expand' });
    await wait(() => getState().characters[0].hud.expanded);
    assert.deepEqual(getState(), saved);
    overlay.webContents.reload();
    await wait(() => !overlay.webContents.isLoading());
    await wait(() =>
      tv(
        `return document.querySelector('${root} .hud-description')?.textContent==='Short revised passive.';`
      )
    );
    assert.deepEqual(store.load().state, saved);
    assert.deepEqual(TL.normalize(TL.toBackup(saved)), saved);
    results.push(
      'Thirty layout combinations retain widths, rotation and scale with no content scrollbars; hit regions exclude empty map space, and collapse, reload and backup preserve reading state.'
    );

    await run(
      `await commit(()=>{const c=selected();c.hud.rotation=0;c.hud.scale=0.75;c.items=[];TL.hudCommand(state,{type:'panel',characterId:c.id,panel:'passive'});});`
    );
    await wait(() =>
      tv(
        `return document.querySelector('${root} .hud-panel')?.textContent.includes('No passives assigned');`
      )
    );
    await run(`await commit(()=>TL.attachItem(state,selectedId,'always'));`);
    await wait(() => tv(`return document.querySelectorAll('${root} .hud-option').length===1;`));
    assert.equal(
      await tv(`return document.querySelectorAll('${root} [role="switch"]').length;`),
      0
    );
    await run(
      `await commit(()=>{for(let i=0;i<15;i++)TL.createLocalItem(state,selectedId,{name:i===0?'LongUnbrokenName'.repeat(20):'Local reminder '+i,behavior:'passive',trackPassive:true,description:'Example reminder'});});`
    );
    await wait(() => tv(`return document.querySelectorAll('${root} .hud-option').length===15;`));
    assert.equal(
      await tv(
        `const p=document.querySelector('${root} .hud-section-content');return p.scrollWidth<=p.clientWidth+1&&p.scrollHeight<=p.clientHeight+1;`
      ),
      true
    );
    await command({ type: 'page', amount: 1 });
    await wait(() => tv(`return document.querySelectorAll('${root} .hud-option').length===1;`));
    const last = getState().characters[0].items.at(-1).id;
    await command({ type: 'detail', itemId: last, effect: 'passive' });
    await wait(() => getState().characters[0].hud.detailId === last);
    await command({ type: 'passive', itemId: last, active: true });
    await wait(() => getState().characters[0].items.at(-1).passiveActive);
    results.push(
      'Zero, one and many passives have valid empty/list/detail views; long names wrap, always-applying entries have no switch, and second-page actions target the correct assignment.'
    );
    fs.writeFileSync(
      path.join(directory, 'passives-hud-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'passives-hud-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
    try {
      if (overlay) await shot('failure');
    } catch {}
  } finally {
    setOverlay(false);
    app.quit();
  }
};
