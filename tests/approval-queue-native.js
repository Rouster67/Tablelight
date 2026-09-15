/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
module.exports = async ({ app, controller, getOverlay, getState, screen, setOverlay, store }) => {
  const dir = path.dirname(store.directory),
    results = [],
    errors = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const hud = (code) => getOverlay().webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (check, message = 'Approval check timed out') => {
    const start = Date.now();
    while (!(await check())) {
      if (Date.now() - start > 10000) throw new Error(message);
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  const click = (selector) =>
    run(
      `const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled)throw Error('Missing '+${JSON.stringify(selector)});el.click();`
    );
  const settle = () => run('await saveQueue;');
  const pending = () => run('return approvalState.pending;');
  const review = (id) => run(`showApprovalRequest(${JSON.stringify(id)});`);
  const denyAll = () =>
    run(
      `for(const r of [...approvalState.pending])await api.approvalCommand(approvalCommand('deny',{requestId:r.id}));closeModal();`
    );
  const shot = async (name, win = controller) => {
    await new Promise((r) => setTimeout(r, 500));
    fs.writeFileSync(path.join(dir, name + '.png'), (await win.webContents.capturePage()).toPNG());
  };
  controller.webContents.on('console-message', (_e, d) => {
    if (d?.level === 'error') errors.push(d.message);
  });
  try {
    await wait(() => run('return !!state;'));
    controller.setBounds({ width: 1100, height: 820 });
    controller.showInactive();
    await run(`commit(()=>{
      state=TL.empty();
      for(let i=0;i<4;i++){
        const c=TL.character(i);c.id='p'+i;c.name='Player '+(i+1);c.notes='PRIVATE DM NOTES';
        c.slots[0]={level:1,current:3,max:3};c.resources=[{id:'pool-'+i,name:'Special casts',current:5,max:5,reset:'long'}];
        Object.assign(c.hud,{expanded:true,visible:i===0,x:50,y:50,rotation:0,scale:0.85});state.characters.push(c);
        for(const [name,economy] of [['Melee attack','action'],['Bonus attack','bonus'],['Quick reaction','reaction']])TL.createLocalItem(state,c.id,{name,economy,damage:'Manual damage',description:'A complete user-written description.',source:'Test reference'});
        TL.createLocalItem(state,c.id,{name:'Special cast',economy:'free',description:'Local rules',source:'Original reference'},{resourceId:'pool-'+i,resourceCost:2});
        TL.createLocalItem(state,c.id,{name:'Guiding light',kind:'spell',level:1,economy:'free',requiresConcentration:true,trigger:'A trigger',range:'60 feet',duration:'1 minute',area:'One target',castingTime:'One moment',components:'V, S',school:'Evocation',attack:'Written attack',save:'Written save',onSave:'Half damage',damage:'Entered damage',upgrades:'Entered upgrades',requirements:'Entered requirements',special:'Entered special',description:'Full description. '.repeat(40),source:'Reference, page 12'},{resourceId:'pool-'+i});
        TL.createLocalItem(state,c.id,{name:'Previous focus',economy:'free',requiresConcentration:true});
      }
      selectedId='p0';state.activeId='p0';state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};state.settings.overlayInteractive=true;
    });await saveQueue;`);
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    await wait(() => hud('return !!state?.approvalSessionId;'));
    const items = getState().characters.map((c) => c.items.map((it) => it.id));
    const initialLayout = await hud(
      `const root=stage.children[0];return {width:root.offsetWidth,height:root.offsetHeight,browser:root.querySelector('.hud-browser').offsetWidth};`
    );
    const request = (person, index) =>
      hud(
        `return window.tablelight.hudCommand({type:'use',characterId:'p${person}',itemId:${JSON.stringify(items[person][index])},sessionId:state.approvalSessionId,commandId:TL.uid()});`
      );
    await request(0, 0);
    await wait(() => run('return !!document.querySelector("[data-approval-detail]");'));
    assert.equal(getState().characters[0].turn.action, true);
    assert.equal(await hud('return state.characters[0].turn.action;'), false);
    assert.ok(await hud('return !!document.querySelector("[data-cancel-request]");'));
    assert.ok(
      await hud(
        `const root=stage.children[0],summary=root.querySelector('.hud-summary'),browser=root.querySelector('.hud-browser'),queue=root.querySelector('.hud-pending-requests');return root.offsetWidth===1150 && root.offsetHeight===${initialLayout.height} && browser.offsetWidth===${initialLayout.browser} && queue.parentElement===browser.parentElement && queue.offsetLeft>=browser.offsetLeft+browser.offsetWidth && !summary.contains(queue) && summary.scrollHeight<=summary.clientHeight+1;`
      )
    );
    await run(`view='display';render();`);
    await wait(() => run(`return !!document.querySelector('#preview-stage .hud-position');`));
    assert.ok(
      await run(
        `const root=document.querySelector('#preview-stage .hud-position');return root.offsetWidth===1150 && !!root.querySelector('.hud-pending-requests') && root.querySelector('[data-cancel-request]').disabled;`
      )
    );
    await run(`view='character';render();`);
    assert.equal(await hud('return state.characters[0].notes;'), undefined);
    assert.ok(
      await run(
        'return document.querySelector("[data-approval-detail]").textContent.includes("Test reference");'
      )
    );
    results.push(
      'Overlay use opens full details, reserves player costs, and leaves DM costs and private notes separate.'
    );
    await click('[data-action="close-modal"]');
    await request(1, 0);
    await request(2, 0);
    assert.equal(await run('return !!document.querySelector(".modal");'), false);
    await hud(`command({type:'use',characterId:'p0',itemId:${JSON.stringify(items[0][1])}});`);
    await wait(() => hud('return !!document.querySelector("[data-request-prompt]");'));
    assert.ok(
      await hud(
        'return document.querySelector("[data-request-prompt]").textContent.includes("DM is super busy");'
      )
    );
    assert.equal((await pending()).length, 3);
    await shot('05-busy-player', getOverlay());
    await hud('document.querySelector("[data-request-prompt-close]").click();');
    for (let i = 0; i < 4; i++) await request(i, 2);
    assert.equal((await pending()).length, 7);
    assert.ok((await pending()).slice(0, 4).every((r) => r.urgent));
    await click('[data-action="dm-queue"]');
    assert.equal(
      await run('return document.querySelectorAll(".dm-queue-entry.urgent").length;'),
      4
    );
    await shot('01-dm-queue');
    results.push(
      'Three ordinary uses fill the global limit; the fourth shows a player popup. Four affordable reactions remain urgent and sort first.'
    );
    const list = await pending();
    await review(list.find((r) => r.characterId === 'p2' && !r.urgent).id);
    await click('[data-action="deny-request"]');
    await settle();
    assert.equal(getState().characters[2].turn.action, true);
    assert.equal(await run('return !!document.querySelector(".modal");'), false);
    await review(list.find((r) => r.characterId === 'p1' && !r.urgent).id);
    await click('[data-action="approve-request"]');
    await settle();
    assert.equal(getState().characters[1].turn.action, false);
    assert.equal(await run('return !!document.querySelector(".modal");'), false);
    const cancel = list.find((r) => r.characterId === 'p0' && r.urgent);
    await hud(`document.querySelector('[data-cancel-request="${cancel.id}"]').click();`);
    await wait(async () => !(await pending()).some((r) => r.id === cancel.id));
    assert.equal(await hud('return state.characters[0].turn.reaction;'), true);
    const viewTarget = (await pending()).find((r) => r.characterId === 'p3');
    await review(viewTarget.id);
    await click('[data-action="request-character"]');
    assert.equal(await run('return selectedId;'), 'p3');
    assert.ok((await pending()).some((r) => r.id === viewTarget.id));
    results.push(
      'DM can approve or deny out of order without advancing the popup. Player Cancel releases just that use; View character minimizes.'
    );
    await denyAll();
    await run(
      `selectedId='p0';await commit(()=>TL.setConcentration(selected(),true,${JSON.stringify(items[0][5])}));editLibraryEntry('', 'p0', ${JSON.stringify(items[0][3])});document.querySelector('[name="source"]').value='Draft reference';`
    );
    await request(0, 3);
    assert.equal(
      await run('return document.querySelector("[name=source]").value;'),
      'Draft reference'
    );
    await click('[data-action="dm-queue"]');
    assert.equal(
      await run('return document.querySelector("[name=source]").value;'),
      'Draft reference'
    );
    await hud(
      `await command({type:'detail',characterId:'p0',itemId:${JSON.stringify(items[0][4])}});useAbility({type:'use',characterId:'p0',itemId:${JSON.stringify(items[0][4])},level:1});`
    );
    await wait(() => hud('return !!document.querySelector("[data-hud-use-confirm]");'));
    await hud('document.querySelector("[data-hud-use-confirm]").click();');
    await wait(async () => (await pending()).length === 2);
    assert.equal(getState().characters[0].concentrationItemId, items[0][5]);
    await click('[form="item-form"]');
    await wait(() => run('return !!pendingGuard;'));
    await shot('02-dependency-warning');
    await click('[data-guard-cancel]');
    await settle();
    assert.equal(
      await run('return document.querySelector("[name=source]").value;'),
      'Draft reference'
    );
    assert.equal((await pending()).length, 2);
    await click('[form="item-form"]');
    await wait(() => run('return !!pendingGuard;'));
    await click('[data-guard-continue]');
    await settle();
    assert.equal((await pending()).length, 1);
    assert.equal(getState().characters[0].items[3].source, 'Draft reference');
    const focusRequest = (await pending())[0];
    await review(focusRequest.id);
    const text = await run('return document.querySelector("[data-approval-detail]").textContent;');
    for (const detail of [
      'A trigger',
      'One target',
      'One moment',
      'Written attack',
      'Written save',
      'Half damage',
      'Entered damage',
      'Entered upgrades',
      'Entered requirements',
      'Entered special',
      'Reference, page 12',
      'Previous focus',
    ])
      assert.ok(text.includes(detail), detail);
    await shot('03-full-request');
    await run('document.querySelector(".modal-body").scrollTop=99999;');
    await shot('06-request-reference');
    await shot('04-player-pending', getOverlay());
    await click('[data-action="approve-request"]');
    await settle();
    assert.equal(getState().characters[0].concentrationItemId, items[0][4]);
    assert.equal(getState().characters[0].slots[0].current, 2);
    assert.equal(getState().characters[0].resources[0].current, 4);
    results.push(
      'Open editor drafts survive arrivals and canceled warnings. Confirmed edits deny only dependencies; concentration and all manual details are reviewed before spending.'
    );
    await run(`useItem(${JSON.stringify(items[0][3])});await saveQueue;`);
    assert.equal((await pending()).length, 0);
    assert.equal(getState().characters[0].resources[0].current, 2);
    await request(0, 0);
    await request(3, 0);
    await click('[data-action="close-modal"]');
    await click('[data-action="start-turn"]');
    await wait(() => run('return !!pendingGuard;'));
    await click('[data-guard-cancel]');
    await settle();
    assert.equal((await pending()).length, 2);
    await click('[data-action="start-turn"]');
    await wait(() => run('return !!pendingGuard;'));
    await click('[data-guard-continue]');
    await settle();
    assert.equal((await pending()).length, 1);
    assert.equal((await pending())[0].characterId, 'p3');
    results.push(
      'DM uses remain immediate. New-turn confirmation expires only that character’s pending requests.'
    );
    await denyAll();
    await request(0, 3);
    await hud(`command({type:'resource',characterId:'p0',resourceId:'pool-0',amount:1});`);
    await wait(() => hud('return !!document.querySelector("[data-request-prompt]");'));
    await hud('document.querySelector("[data-request-prompt-close]").click();');
    await wait(() => hud('return !document.querySelector("[data-request-prompt]");'));
    assert.equal((await pending()).length, 1);
    assert.equal(getState().characters[0].resources[0].current, 2);
    await hud(`command({type:'resource',characterId:'p0',resourceId:'pool-0',amount:1});`);
    await wait(() => hud('return !!document.querySelector("[data-request-prompt]");'));
    await hud('document.querySelector("[data-request-prompt-continue]").click();');
    await wait(async () => !(await pending()).length);
    assert.equal(getState().characters[0].resources[0].current, 3);
    results.push(
      'Player counter changes use their own warning; Cancel changes nothing and Continue denies dependencies before applying the correction.'
    );
    await request(0, 3);
    const count = (await pending()).length;
    controller.webContents.reload();
    await wait(() => run('return typeof state!=="undefined" && !!state && !!approvalState.id;'));
    assert.equal((await pending()).length, count);
    getOverlay().webContents.reload();
    await wait(() => hud('return typeof state!=="undefined" && !!state?.approvalSessionId;'));
    assert.equal(await hud('return state.characters[0].pendingRequests.length;'), 1);
    await assert.rejects(
      hud(`return window.tablelight.approvalCommand({type:'approve'});`),
      /DM window/
    );
    await assert.rejects(hud(`return window.tablelight.changeParty({edited:state});`), /DM window/);
    const disk = JSON.parse(fs.readFileSync(store.file, 'utf8'));
    assert.equal(disk.approvals, undefined);
    assert.equal(disk.session, undefined);
    results.push(
      'Window reloads retain pending requests; saves exclude them; overlay cannot use DM approval or editing commands.'
    );
    await review((await pending())[0].id);
    const originalSave = store.save.bind(store),
      beforeFailure = JSON.parse(JSON.stringify(getState()));
    store.save = () => {
      throw new Error('Synthetic approval save failure');
    };
    try {
      await click('[data-action="approve-request"]');
      await settle();
      assert.deepEqual(getState(), beforeFailure);
      assert.equal((await pending()).length, 1);
      assert.ok(
        await run(
          'return !!document.querySelector("[data-approval-detail]") && !document.querySelector("[data-action=approve-request]").disabled;'
        )
      );
    } finally {
      store.save = originalSave;
    }
    await click('[data-action="approve-request"]');
    await settle();
    assert.equal(
      getState().characters[0].resources[0].current,
      beforeFailure.characters[0].resources[0].current - 2
    );
    assert.equal((await pending()).length, 0);
    results.push(
      'Failed approval saves keep the request, popup, and reservations intact; retry spends once.'
    );
    await denyAll();
    const frame = await hud(
      'const root=stage.children[0];return [root.offsetWidth,root.offsetHeight];'
    );
    assert.equal(frame[0], 880);
    assert.ok(frame[1] >= 650);
    for (const rotation of [0, 90, 180, 270, 35]) {
      await run(`await commit(()=>{selectedId='p0';selected().hud.rotation=${rotation};});`);
      assert.deepEqual(
        await hud('const root=stage.children[0];return [root.offsetWidth,root.offsetHeight];'),
        frame
      );
    }
    results.push('HUD dimensions stay consistent across standard and angled rotations.');
    const layouts = await hud(`
      const fixture=document.createElement('div');document.body.append(fixture);
      const sample=TL.clone(state);sample.characters=sample.characters.slice(0,1);
      const c=sample.characters[0];
      c.name='A character with a long name that wraps onto several lines';
      c.slots=c.slots.map(s=>({...s,max:4,current:3}));
      c.resources=Array.from({length:8},(_,i)=>({id:'layout-'+i,name:'Independent custom resource '+(i+1),current:2,max:3,reset:'manual',icon:'star',color:'#79cbd6'}));
      c.appliedConditions=Array.from({length:4},(_,i)=>({id:'condition-'+i,name:'A condition with a wrapping name '+(i+1),description:'User-written condition details.'}));
      c.pendingRequests=Array.from({length:4},(_,i)=>({id:'request-'+i,name:'A long pending ability name '.repeat(3),slotLevel:i===0?1:0,urgent:i===3}));
      const reports=[];
      for(const angle of [0,35,90,180,270])for(const scale of [0.4,0.75,2.5]){
        c.hud={...c.hud,rotation:angle,scale};
        HUD.mount(fixture,sample,1280,720,1,'','overlay');
        const root=fixture.firstElementChild,summary=root.querySelector('.hud-summary'),browser=root.querySelector('.hud-browser'),queue=root.querySelector('.hud-pending-requests');
        const height=root.offsetHeight;
        browser.querySelector('.hud-section-content').innerHTML='<p>'+('Long ability details. '.repeat(20000))+'</p>';
        reports.push({width:root.offsetWidth,height,afterText:root.offsetHeight,visible:summary.scrollHeight<=summary.clientHeight+1,buttons:summary.querySelector('.hud-size-controls').offsetTop+summary.querySelector('.hud-size-controls').offsetHeight<=summary.offsetTop+summary.offsetHeight+1,right:queue.offsetLeft>=browser.offsetLeft+browser.offsetWidth,scrolls:browser.querySelector('.hud-section-content').scrollHeight>browser.querySelector('.hud-section-content').clientHeight,transform:root.style.transform,angle,scale});
      }
      fixture.remove();return reports;
    `);
    for (const layout of layouts) {
      assert.equal(layout.width, 1150);
      assert.ok(layout.height > initialLayout.height);
      assert.equal(layout.afterText, layout.height);
      assert.ok(
        layout.visible && layout.buttons && layout.right && layout.scrolls,
        JSON.stringify(layout)
      );
      assert.ok(layout.transform.includes(`rotate(${layout.angle}deg) scale(${layout.scale})`));
    }
    results.push(
      'Long names, conditions, all spell slots, resources, and size buttons remain inside the taller frame; the far-right queue and scrolling ability column keep their widths at every tested rotation and scale.'
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(dir, 'approval-queue-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(dir, 'approval-queue-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack, errors }, null, 2)
    );
  } finally {
    app.exit(0);
  }
};
