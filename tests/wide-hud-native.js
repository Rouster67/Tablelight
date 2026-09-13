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
      if (Date.now() - start > 10000) throw new Error('Wide HUD test timed out');
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  let overlay;
  const tv = (code) => overlay.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const command = (scope, match) =>
    tv(
      `const el=[...document.querySelectorAll(${JSON.stringify(scope + ' [data-hud-command]')})].find(el=>Object.entries(${JSON.stringify(match)}).every(([key,value])=>JSON.parse(el.dataset.hudCommand)[key]===value));if(!el||el.disabled)throw new Error('HUD control unavailable');el.click();`
    );
  const shot = async (name) => {
    await new Promise((r) => setTimeout(r, 300));
    const rect = await tv(
      `const r=document.querySelector('.hud-position').getBoundingClientRect();return {x:Math.floor(r.x),y:Math.floor(r.y),width:Math.ceil(r.width),height:Math.ceil(r.height)};`
    );
    fs.writeFileSync(
      path.join(directory, name + '.png'),
      (await overlay.webContents.capturePage(rect)).toPNG()
    );
  };
  try {
    await wait(() => run(`return !!document.querySelector('[data-action="add-character"]');`));
    controller.setBounds({ width: 1440, height: 950 });
    await run(
      `commit(()=>{state=TL.empty();const c=TL.character();Object.assign(c,{name:'Wide HUD test',className:'Homebrew caster',species:'Example',level:8,hp:42,maxHp:58,tempHp:6,ac:16,notes:'PRIVATE DM NOTE'});c.slots[0]={level:1,max:4,current:3};c.slots[1]={level:2,max:3,current:2};c.slots[2]={level:3,max:2,current:1};c.resources=[{id:'custom-pool',name:'Custom pool',max:3,current:2,reset:'long'}];c.hud={...c.hud,expanded:true,panel:'sheet',x:50,y:50};c.items=[TL.item({id:'custom-spell',kind:'spell',level:1,name:'Custom spell',economy:'bonus',range:'User-entered range',duration:'User-entered duration',components:'User-entered components',attack:'User-entered attack',damage:'User-entered damage',save:'User-entered save',description:('User-entered description. ').repeat(80)})];for(let i=0;i<7;i++)c.items.push(TL.item({name:'Custom action '+i,economy:'action'}));state.characters=[c];state.activeId=c.id;selectedId=c.id;state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};state.settings.overlayInteractive=true;view='display';});await saveQueue;`
    );
    await run(
      `commit(()=>{state.library[0].source='Test source '+'x'.repeat(288);});await saveQueue;`
    );
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    overlay = getOverlay();
    await wait(() => tv(`return !!document.querySelector('.hud-browser .hud-skills');`));
    const geometry = await tv(
      `const card=document.querySelector('.hud-card'),left=document.querySelector('.hud-summary').getBoundingClientRect(),right=document.querySelector('.hud-browser').getBoundingClientRect(),nav=document.querySelector('.hud-nav').getBoundingClientRect(),panel=document.querySelector('.hud-panel').getBoundingClientRect();return {width:card.offsetWidth,height:card.offsetHeight,leftRight:left.right,rightLeft:right.left,navTop:nav.top,navBottom:nav.bottom,panelTop:panel.top,skills:document.querySelectorAll('.hud-skills>span').length,saves:document.querySelectorAll('.hud-saves>span').length};`
    );
    assert.ok(geometry.width > geometry.height * 1.25, JSON.stringify(geometry));
    assert.ok(geometry.rightLeft >= geometry.leftRight);
    assert.ok(geometry.panelTop >= geometry.navBottom);
    assert.equal(geometry.skills, 18);
    assert.equal(geometry.saves, 6);
    results.push(
      `Expanded sheet uses two columns (${geometry.width}×${geometry.height}); navigation and all 18 skills and 6 saves are on the right.`
    );
    await shot('01-wide-sheet');
    const preview = await run(
      `const card=document.querySelector('#preview-stage .hud-card');return {width:card.offsetWidth,height:card.offsetHeight,columns:getComputedStyle(card).gridTemplateColumns};`
    );
    assert.equal(preview.width, geometry.width);
    assert.equal(preview.height, geometry.height);
    results.push('The DM layout preview matches the TV’s wide sheet dimensions.');
    await command('.hud-nav', { type: 'panel', panel: 'action' });
    await wait(() => getState().characters[0].hud.panel === 'action');
    await wait(() =>
      tv(`return document.querySelectorAll('.hud-browser .hud-option').length===5;`)
    );
    await command('.hud-pagination', { type: 'page', amount: 1 });
    await wait(() => getState().characters[0].hud.page === 1);
    await wait(() =>
      tv(`return document.querySelectorAll('.hud-browser .hud-option').length===2;`)
    );
    assert.equal(
      await tv(`return document.querySelector('.hud-summary .hud-option')===null;`),
      true
    );
    results.push('Action lists and their page controls stay below the right-hand navigation.');
    await command('.hud-nav', { type: 'panel', panel: 'bonus' });
    await wait(() => getState().characters[0].hud.panel === 'bonus');
    await wait(() => tv(`return !!document.querySelector('.hud-option');`));
    await command('.hud-options', { type: 'detail', itemId: 'custom-spell' });
    await wait(() => getState().characters[0].hud.detailId === 'custom-spell');
    await wait(() => tv(`return !!document.querySelector('.hud-use-controls');`));
    assert.equal(
      await tv(`return document.querySelectorAll('.hud-browser .hud-metadata>span').length;`),
      6
    );
    assert.ok(
      await tv(
        `const source=document.querySelector('.ability-source'),panel=document.querySelector('.hud-panel'),description=document.querySelector('.hud-description');return source.textContent.includes('x'.repeat(288)) && source.scrollWidth<=source.clientWidth && panel.lastElementChild===source && source.getBoundingClientRect().top>=description.getBoundingClientRect().bottom && getComputedStyle(source).textAlign==='right' && document.querySelector('.hud-position').offsetWidth===880 && document.querySelector('.hud-position').offsetHeight===650;`
      )
    );
    await command('.hud-pagination', { type: 'page', amount: 1 });
    await wait(() => getState().characters[0].hud.page === 1);
    await shot('02-wide-spell');
    await command('.hud-use-controls', { type: 'use', level: 1 });
    await wait(() => getState().characters[0].slots[0].current === 2);
    assert.equal(getState().characters[0].turn.bonus, false);
    results.push(
      'Descriptions, metadata, pagination, and spell spending work inside the right column.'
    );
    await command('.hud-nav', { type: 'panel', panel: 'resources' });
    await wait(() => getState().characters[0].hud.panel === 'resources');
    await wait(() => tv(`return !!document.querySelector('.hud-browser .hud-resource');`));
    await command('.hud-resource', { type: 'resource', resourceId: 'custom-pool', amount: -1 });
    await wait(() => getState().characters[0].resources[0].current === 1);
    await run(
      `view='character';render();document.querySelector('.current-display [data-panel="sheet"]').click();await saveQueue;`
    );
    await wait(() => tv(`return !!document.querySelector('.hud-browser .hud-skills');`));
    await command('.hud-skills [data-rank-name="Stealth"]', { type: 'proficiency', rank: 2 });
    await wait(() => getState().characters[0].skills.Stealth.rank === 2);
    results.push(
      'Resources, expertise bubbles, and the DM’s Currently displayed controls still update the same character.'
    );
    await command('.hud-nav', { type: 'panel', panel: '' });
    await wait(() => getState().characters[0].hud.panel === '');
    await wait(() => tv(`return !!document.querySelector('.hud-browser .hud-overview');`));
    assert.equal(
      await tv(
        `return document.querySelector('.hud-browser').innerText.includes('Homebrew caster');`
      ),
      true
    );
    assert.equal(await tv(`return document.body.innerText.includes('PRIVATE');`), false);
    results.push(
      'Overview displays character details in the right column while private DM notes stay off the TV.'
    );
    await run(
      `commit(()=>{selected().hud.panel='sheet';state.settings.overlayInteractive=false;});await saveQueue;`
    );
    await wait(() => tv(`return document.querySelectorAll('.hud-nav-label').length===9;`));
    assert.equal(
      await tv(`return document.querySelectorAll('.hud-card button,.hud-toolstrip').length;`),
      0
    );
    assert.equal(
      await tv(`return document.querySelector('.hud-nav-label.chosen').textContent;`),
      'Sheet'
    );
    await shot('03-wide-click-through');
    results.push(
      'Click-through mode retains the wide layout and selected section without interactive controls.'
    );
    await run(`commit(()=>state.settings.overlayInteractive=true);await saveQueue;`);
    await wait(() => tv(`return document.querySelectorAll('.hud-nav button').length===9;`));
    const fits = await tv(
      `const fixture=document.createElement('div');fixture.style.cssText='position:fixed;left:0;top:0;width:1280px;height:720px';document.body.append(fixture);const sample=TL.clone(state);const reports=[];for(const angle of [0,45,90,180,270]){sample.characters[0].hud={...sample.characters[0].hud,x:98,y:98,rotation:angle,scale:0.6};HUD.mount(fixture,sample,1280,720,1,'','overlay');const el=fixture.firstElementChild,r=el.getBoundingClientRect();reports.push({angle,x:r.x,y:r.y,right:r.right,bottom:r.bottom,rotation:el.style.transform.includes('rotate('+angle+'deg)')});}fixture.remove();return reports;`
    );
    for (const r of fits)
      assert.ok(
        r.x >= -1 && r.y >= -1 && r.right <= 1281 && r.bottom <= 721 && r.rotation,
        JSON.stringify(r)
      );
    const before = getState().characters[0].hud.rotation;
    await command('.hud-toolstrip', { type: 'expand' });
    await wait(() => !getState().characters[0].hud.expanded);
    await wait(() => tv(`return !!document.querySelector('.hud-collapsed');`));
    assert.ok(await tv(`return document.querySelector('.hud-position').offsetWidth<=142;`));
    await command('.bubble-controls', { type: 'expand' });
    await wait(() => getState().characters[0].hud.expanded);
    assert.equal(getState().characters[0].hud.rotation, before);
    results.push(
      'Both columns fit within a 1280×720 display at multiple rotations; collapsing still returns to the small portrait bubble.'
    );
    fs.writeFileSync(
      path.join(directory, 'wide-hud-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'wide-hud-results.json'),
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
