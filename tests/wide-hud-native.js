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
      `commit(()=>{state=TL.empty();const c=TL.character();Object.assign(c,{name:'Wide HUD test',className:'Homebrew caster',species:'Example',level:8,hp:42,maxHp:58,tempHp:6,ac:16,notes:'PRIVATE DM NOTE'});c.slots[0]={level:1,max:4,current:3};c.slots[1]={level:2,max:3,current:2};c.slots[2]={level:3,max:2,current:1};c.resources=[{id:'custom-pool',name:'Custom pool',max:3,current:2,reset:'long'}];c.hud={...c.hud,expanded:true,panel:'sheet',x:50,y:50};c.items=[TL.item({id:'custom-spell',kind:'spell',level:1,name:'Custom spell',economy:'bonus',range:'User-entered range',duration:'User-entered duration',components:'User-entered components',attack:'User-entered attack',damage:'User-entered damage',save:'User-entered save',description:('User-entered description. ').repeat(80)})];for(let i=0;i<17;i++)c.items.push(TL.item({name:'Custom action '+i,economy:'action'}));state.characters=[c];state.activeId=c.id;selectedId=c.id;state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};state.settings.overlayInteractive=true;view='display';});await saveQueue;`
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
    assert.equal(geometry.width, 880);
    assert.ok(geometry.height >= 600, JSON.stringify(geometry));
    assert.ok(geometry.rightLeft >= geometry.leftRight);
    assert.ok(geometry.panelTop >= geometry.navBottom);
    assert.equal(geometry.skills, 18);
    assert.equal(geometry.saves, 6);
    results.push(
      `Expanded sheet uses two columns (${geometry.width}×${geometry.height}); navigation and all 18 skills and 6 saves are on the right.`
    );
    await shot('01-wide-sheet');
    // The DM preview is painted on its own animation frame after overlay-status updates.
    let preview;
    await wait(async () => {
      preview = await run(
        `const card=document.querySelector('#preview-stage .hud-card');return card?{width:card.offsetWidth,height:card.offsetHeight,columns:getComputedStyle(card).gridTemplateColumns}:null;`
      );
      return preview && preview.width > 0 && preview.height > 0;
    });
    assert.equal(preview.width, geometry.width);
    assert.equal(preview.height, geometry.height);
    results.push('The DM layout preview matches the TV’s wide sheet dimensions.');
    await command('.hud-nav', { type: 'panel', panel: 'action' });
    await wait(() => getState().characters[0].hud.panel === 'action');
    await wait(() =>
      tv(`return document.querySelectorAll('.hud-browser .hud-option').length===15;`)
    );
    await shot('02-fifteen-abilities');
    const density = await tv(`
      const fixture=document.createElement('div');fixture.style.cssText='position:absolute;left:0;top:0';document.body.append(fixture);
      const c=TL.clone(state.characters[0]);
      c.appliedConditions=Array.from({length:8},(_,i)=>({id:'layout-'+i,name:['Blinded','Frightened','Incapacitated','Unconscious','Concentrating','LongUnbrokenConditionNameForWrapping'][i%6],description:'Condition details'}));
      c.resources=Array.from({length:4},(_,i)=>({id:'layout-pool-'+i,name:'Custom resource '+i,max:10,current:7,reset:'manual'}));
      const reports=[];
      for(const interactive of [false,true]) {
        fixture.innerHTML='<div class="hud-position is-expanded">'+HUD.render(c)+'</div>';
        const root=fixture.firstElementChild;
        if(interactive) HUDControls.decorate(root,c,'overlay');
        const cells=[...root.querySelectorAll('[data-condition-id]')];
        reports.push({interactive,rows:new Set(cells.map(e=>e.offsetTop)).size,columns:new Set(cells.map(e=>e.offsetLeft)).size,conditions:cells.length,resources:root.querySelectorAll('.hud-summary .hud-resource').length,abilities:root.querySelectorAll('.hud-option').length,fits:[...root.querySelectorAll('.hud-condition-table,.hud-condition-table td,.hud-summary,.hud-section-content')].every(e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1),scrollbars:[...root.querySelectorAll('*')].some(e=>['auto','scroll'].includes(getComputedStyle(e).overflowY)&&(e.scrollHeight>e.clientHeight+1))});
      }
      fixture.remove();return reports;
    `);
    for (const report of density) {
      assert.equal(report.rows, 2, JSON.stringify(report));
      assert.equal(report.columns, 3, JSON.stringify(report));
      assert.equal(report.conditions, 6);
      assert.equal(report.resources, 3);
      assert.equal(report.abilities, 15);
      assert.ok(report.fits, JSON.stringify(report));
      assert.equal(report.scrollbars, false);
    }
    results.push(
      'Six conditions form two rows of three beside fifteen abilities and three resources, with readable wrapping and no scrollbars in either control mode.'
    );
    assert.ok(
      await tv(
        `const content=document.querySelector('.hud-section-content');return content.scrollHeight<=content.clientHeight+1 && getComputedStyle(content).overflowY==='visible';`
      )
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
    const secondPageId = getState().characters[0].items.find(
      (it) => it.name === 'Custom action 15'
    ).id;
    await command('.hud-options', { type: 'detail', itemId: secondPageId });
    await wait(() => getState().characters[0].hud.detailId === secondPageId);
    assert.equal(
      await tv(`return document.querySelector('.ability-detail-heading h3').textContent;`),
      'Custom action 15'
    );
    results.push(
      'Ability lists show fifteen entries per page and second-page controls open the correct ability.'
    );
    await command('.hud-nav', { type: 'panel', panel: 'bonus' });
    await wait(() => getState().characters[0].hud.panel === 'bonus');
    await wait(() => tv(`return !!document.querySelector('.hud-option');`));
    await command('.hud-options', { type: 'detail', itemId: 'custom-spell' });
    await wait(() => getState().characters[0].hud.detailId === 'custom-spell');
    await wait(() => tv(`return !!document.querySelector('.hud-use-controls');`));
    assert.equal(
      await tv(`return document.querySelectorAll('.hud-browser .hud-metadata>span').length;`),
      7
    );
    assert.ok(
      await tv(
        `const source=document.querySelector('.ability-source'),panel=document.querySelector('.hud-panel'),description=document.querySelector('.hud-description');return source.textContent.includes('x'.repeat(288)) && source.scrollWidth<=source.clientWidth && panel.lastElementChild===source && source.getBoundingClientRect().top>=description.getBoundingClientRect().bottom && getComputedStyle(source).textAlign==='right' && document.querySelector('.hud-position').offsetWidth===880 && document.querySelector('.hud-section-content').scrollHeight<=document.querySelector('.hud-section-content').clientHeight+1;`
      )
    );
    await command('.hud-pagination', { type: 'page', amount: 1 });
    await wait(() => getState().characters[0].hud.page === 1);
    await shot('02-wide-spell');
    await command('.hud-use-controls', { type: 'use', level: 1 });
    await require('./approve-pending')(controller);
    await wait(() => getState().characters[0].slots[0].current === 2);
    assert.equal(getState().characters[0].turn.bonus, false);
    results.push(
      'Descriptions, metadata, pagination, and spell spending work inside the right column.'
    );
    const longUpgrades = (
      'Higher slot: user-written improvements.\n\n' +
      'x'.repeat(800) +
      '\n'
    ).repeat(50);
    await run(
      `commit(()=>{state.library[0].upgrades=${JSON.stringify(longUpgrades)};TL.startTurn(selected());});await saveQueue;`
    );
    const firstUpgradePage = await run(
      `return TL.abilityTextPages(selected().items[0]).findIndex(parts=>parts.some(part=>part.label));`
    );
    while (getState().characters[0].hud.page < firstUpgradePage) {
      const next = getState().characters[0].hud.page + 1;
      await wait(() =>
        tv(
          `return document.querySelector('.hud-pagination span')?.textContent.startsWith('${next} /');`
        )
      );
      await command('.hud-pagination', { type: 'page', amount: 1 });
      await wait(() => getState().characters[0].hud.page === next);
    }
    await wait(() =>
      tv(
        `return document.querySelector('.ability-upgrades')?.textContent.includes('Higher slot:');`
      )
    );
    assert.ok(
      await tv(
        `const section=document.querySelector('.hud-section-content'),upgrade=document.querySelector('.ability-upgrades'),panel=document.querySelector('.hud-panel');section.scrollTop=section.scrollHeight;return upgrade.scrollWidth<=upgrade.clientWidth && panel.lastElementChild.classList.contains('ability-source') && document.querySelector('.hud-position').offsetWidth===880 && document.querySelector('.hud-section-content').scrollHeight<=document.querySelector('.hud-section-content').clientHeight+1;`
      )
    );
    await shot('04-long-upgrades');
    const beforeUse = getState().characters[0];
    const expectedUse = JSON.parse(JSON.stringify(beforeUse));
    expectedUse.slots[2].current -= 1;
    expectedUse.turn.bonus = false;
    await command('.hud-use-controls', { type: 'use', level: 3 });
    await require('./approve-pending')(controller);
    await wait(() => getState().characters[0].slots[2].current === 0);
    assert.deepEqual(getState().characters[0], expectedUse);
    await run(`commit(()=>selected().hud.page=999);await saveQueue;`);
    await wait(() =>
      tv(
        `return document.querySelector('.ability-upgrades h4')?.textContent==='Upcast / upgrades';`
      )
    );
    const lastPage = getState().characters[0].hud.page;
    assert.ok(lastPage > 50);
    await run(
      `commit(()=>state.library[0].upgrades='Short revised improvement.');await saveQueue;`
    );
    const clampedPage = getState().characters[0].hud.page;
    assert.ok(clampedPage < lastPage);
    await wait(() =>
      tv(
        `return document.querySelector('.ability-upgrades')?.textContent.includes('Short revised improvement.');`
      )
    );
    await command('.hud-pagination', { type: 'page', amount: -1 });
    await wait(() => getState().characters[0].hud.page === clampedPage - 1);
    assert.deepEqual(getState().characters[0].hud, { ...expectedUse.hud, page: clampedPage - 1 });
    results.push(
      'Maximum-length upgrade paragraphs and long words remain reachable with repeated headings; higher-slot use only spends its selected slot and turn cost, and shortening open text clamps navigation.'
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
    await wait(() => tv(`return document.querySelectorAll('.hud-nav-label').length===10;`));
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
    await wait(() => tv(`return document.querySelectorAll('.hud-nav button').length===10;`));
    const fits = await tv(
      `const fixture=document.createElement('div');fixture.style.cssText='position:fixed;left:0;top:0;width:1280px;height:720px';document.body.append(fixture);const sample=TL.clone(state);const reports=[];for(const angle of [0,45,90,180,270]){sample.characters[0].hud={...sample.characters[0].hud,x:98,y:98,rotation:angle,scale:0.5};HUD.mount(fixture,sample,1280,720,1,'','overlay');const el=fixture.firstElementChild,r=el.getBoundingClientRect();reports.push({angle,x:r.x,y:r.y,right:r.right,bottom:r.bottom,rotation:el.style.transform.includes('rotate('+angle+'deg)')});}fixture.remove();return reports;`
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
    await run(`await commit(()=>{
      const c=selected(); c.resources=Array.from({length:8},(_,i)=>({id:'pool-'+i,name:'Pool '+i,max:3,current:2,reset:'manual',icon:'star',color:'#79cbd6'}));
      state.conditionLibrary=Array.from({length:8},(_,i)=>TL.conditionEntry({id:'status-'+i,name:'Condition '+i,description:'A condition description. '.repeat(30)}));c.conditionIds=state.conditionLibrary.map(e=>e.id);
      c.hud={...c.hud,panel:'resources',detailId:'',resourcePage:0,conditionPage:0,rotation:90,scale:0.6};
      const other=TL.character(1);other.hud.expanded=true;other.hud.rotation=270;state.characters.push(other);
      const hidden=TL.character(2);hidden.hud.visible=false;state.characters.push(hidden);
      view='character';});await saveQueue;`);
    const owner = getState().characters[0].id;
    const untouched = JSON.stringify(getState().characters.slice(1));
    const root = `[data-hud-id="${owner}"]`;
    await wait(() =>
      tv(
        `return document.querySelectorAll('${root} .hud-summary .hud-resource').length===3 && document.querySelectorAll('${root} [data-condition-id]').length===6;`
      )
    );
    await command(root + ' [data-hud-list-pages="resources"]', {
      type: 'list-page',
      kind: 'resources',
      amount: 1,
    });
    await wait(() => getState().characters[0].hud.resourcePage === 1);
    await wait(() =>
      tv(
        `return document.querySelector('${root} .hud-summary .hud-resource').dataset.resourceId==='pool-3';`
      )
    );
    assert.equal(
      await tv(
        `return document.querySelector('${root} .hud-browser .hud-resource').dataset.resourceId;`
      ),
      'pool-3'
    );
    await command(root + ' .hud-summary [data-resource-id="pool-3"]', {
      type: 'resource',
      resourceId: 'pool-3',
      amount: -1,
    });
    await wait(() => getState().characters[0].resources[3].current === 1);
    await run(`await commit(()=>{state.settings.overlayInteractive=false;});await saveQueue;`);
    await run(
      `document.querySelector('[data-dm-list-pages="conditions"] [data-amount="1"]').click();await saveQueue;document.querySelector('[data-dm-list-pages="resources"] [data-amount="1"]').click();await saveQueue;`
    );
    await wait(() =>
      tv(
        `return document.querySelector('${root} [data-condition-id]').dataset.conditionId==='status-6' && document.querySelectorAll('${root} .hud-summary .hud-resource').length===2;`
      )
    );
    assert.equal(JSON.stringify(getState().characters.slice(1)), untouched);
    assert.equal(getState().characters[0].hud.rotation, 90);
    assert.equal(getState().characters[0].hud.scale, 0.6);
    assert.ok(
      await tv(
        `return [...document.querySelectorAll('${root} .hud-summary,${root} .hud-section-content')].every(e=>e.scrollHeight<=e.clientHeight+1 && e.scrollWidth<=e.clientWidth+1);`
      )
    );
    await run(
      `await commit(()=>{selected().hud.visible=false;selected().hud.expanded=false;});await saveQueue;await commit(()=>{selected().hud.visible=true;});await saveQueue;`
    );
    await wait(() => tv(`return !!document.querySelector('${root} .hud-collapsed');`));
    assert.equal(getState().characters[0].hud.resourcePage, 2);
    assert.equal(getState().characters[0].hud.conditionPage, 1);
    await run(
      `await commit(()=>{selected().hud.expanded=true;state.settings.overlayInteractive=true;});await saveQueue;`
    );
    await wait(() =>
      tv(`return document.querySelectorAll('${root} [data-condition-id]').length===2;`)
    );
    await tv(`document.querySelector('${root} [data-hud-conditions]').click();`);
    await wait(() =>
      tv(
        `return document.querySelectorAll('${root} [data-hud-condition-results] .condition-choice').length===5;`
      )
    );
    await tv(`document.querySelector('${root} [data-condition-picker-page="1"]').click();`);
    assert.ok(
      await tv(
        `const list=document.querySelector('${root} [data-hud-condition-results]');return list.querySelectorAll('.condition-choice').length===3 && list.scrollHeight<=list.clientHeight+1;`
      )
    );
    results.push(
      'Conditions show six per page in two rows; resources show three per page, share resource paging across both columns, target the correct pool, support DM paging in click-through, and retain per-player pages through hiding and collapsing. Condition pickers also use five-item pages.'
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
