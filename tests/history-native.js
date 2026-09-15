/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
module.exports = async ({ app, controller, getOverlay, getState, screen, setOverlay, store }) => {
  const dir = path.dirname(store.directory),
    results = [],
    errors = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const tv = (code) => getOverlay().webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (check) => {
    const start = Date.now();
    while (!(await check())) {
      if (Date.now() - start > 10000) throw Error('History check timed out');
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  const click = (selector) =>
    run(
      `const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled)throw Error('Unavailable '+${JSON.stringify(selector)});el.click();`
    );
  const settle = () => run('await saveQueue;');
  const close = () => run('closeModal();');
  const history = () => run('return approvalState.history;');
  const pending = () => run('return approvalState.pending;');
  const count = () => getState().characters[0].resources[0].current;
  const status = async (id) => (await history()).find((r) => r.id === id)?.status;
  const detail = async (id) => {
    await close();
    await click('[data-action="dm-history"]');
    await click(`[data-action="review-history"][data-id="${id}"]`);
  };
  const shot = async (name) => {
    await new Promise((r) => setTimeout(r, 200));
    fs.writeFileSync(
      path.join(dir, name + '.png'),
      (await controller.webContents.capturePage()).toPNG()
    );
  };
  controller.webContents.on('console-message', (_e, d) => {
    if (d?.level === 'error') errors.push(d.message);
  });
  try {
    await wait(() => run('return !!state;'));
    controller.setBounds({ width: 1100, height: 820 });
    controller.showInactive();
    await run(`await commit(()=>{
      state=TL.empty();state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};state.settings.overlayInteractive=true;
      for(const id of ['a','b']){
        const c=TL.character();c.id=id;c.name=id==='a'?'Aria':'Bram';c.resources=[{id:'charges',name:'Special casts',current:5,max:5,reset:'long'}];c.hud={...c.hud,expanded:true,visible:id==='a',rotation:35,scale:0.6};state.characters.push(c);
        TL.createLocalItem(state,id,{name:'Guiding spark',economy:'free',trigger:'On your turn',duration:'One round',range:'60 ft',area:'One target',castingTime:'One action',components:'V, S',school:'Evocation',attack:'Written attack',save:'Written save',onSave:'Half damage',damage:'Entered damage',upgrades:'Higher levels add user-written effects',requirements:'A clear path',special:'A special exception',description:'Original ability description. '.repeat(40),source:'Book, page 42'},{resourceId:'charges',resourceCost:2});
        TL.createLocalItem(state,id,{name:'Minor spark',economy:'free'},{resourceId:'charges',resourceCost:1});
        TL.createLocalItem(state,id,{name:'Free gesture',economy:'free'});
        TL.createLocalItem(state,id,{name:'Quick ward',economy:'reaction'});
      }
      selectedId='a';state.activeId='a';
    });`);
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    await wait(() => tv('return !!state?.approvalSessionId;'));
    const ids = getState().characters.map((c) => c.items.map((it) => it.id));
    const request = async (i = 0, character = 'a') =>
      (
        await tv(
          `return window.tablelight.hudCommand({type:'use',characterId:'${character}',itemId:'${ids[character === 'a' ? 0 : 1][i]}',sessionId:state.approvalSessionId,commandId:TL.uid()});`
        )
      ).result.requestId;
    const approve = async (i = 0, character = 'a') => {
      const id = await request(i, character);
      await run(`showApprovalRequest('${id}');`);
      await click('[data-action="approve-request"]');
      await settle();
      return id;
    };
    const denyAll = () =>
      run(
        `for(const r of [...approvalState.pending])await api.approvalCommand(approvalCommand('deny',{requestId:r.id}));closeModal();`
      );
    for (const width of [1440, 1100]) {
      controller.setBounds({ width, height: 820 });
      await new Promise((r) => setTimeout(r, 200));
      assert.ok(
        await run(
          `const history=document.querySelector('[data-action="dm-history"]').getBoundingClientRect(),queue=document.querySelector('[data-action="dm-queue"]').getBoundingClientRect(),sidebar=document.querySelector('.sidebar').getBoundingClientRect();return history.left>sidebar.right && history.right<queue.left && history.bottom<=innerHeight;`
        ),
        'History must stay beside the sidebar without covering its Add character or Setup & help controls.'
      );
    }
    await click('[data-action="dm-history"]');
    assert.ok(
      await run(
        `return document.querySelector('[data-dm-history-list]').textContent.includes('No resolved');`
      )
    );
    const a = await approve(),
      b = await approve(1);
    await run(
      `await commit(()=>{selected().hp=4;selected().turn.movement=15;const it=selected().items[0];it.name='Edited after use';it.resourceCost=4;it.description='Later description';it.source='Later reference';});`
    );
    await click('[data-action="dm-history"]');
    await shot('01-history-list');
    assert.equal(
      await run(`return document.querySelectorAll('[data-action="review-history"]').length;`),
      2
    );
    await click(`[data-action="review-history"][data-id="${a}"]`);
    assert.ok(
      await run(
        `const text=document.querySelector('[data-history-detail]').textContent;return text.includes('Original ability description') && text.includes('Book, page 42') && text.includes('2 Special casts') && text.includes('Higher levels') && text.includes('Half damage') && !!document.querySelector('[data-history-detail] .ability-local-icon');`
      )
    );
    await run(`document.querySelector('.modal-body').scrollTop=99999;`);
    await shot('02-recorded-details');
    await run(`document.querySelector('[data-action="history-undo"]').focus();`);
    await click('[data-action="history-undo"]');
    await settle();
    assert.ok(
      await run(`return document.querySelector('.modal').contains(document.activeElement);`),
      'Resolving a History action must keep keyboard focus inside its dialog.'
    );
    assert.equal(await run(`return document.activeElement.dataset.action;`), 'dm-history');
    await run(
      `document.activeElement.blur();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));`
    );
    assert.ok(
      await run(`return document.querySelector('.modal').contains(document.activeElement);`)
    );
    assert.equal(count(), 4);
    assert.equal(getState().characters[0].hp, 4);
    assert.equal(getState().characters[0].turn.movement, 15);
    assert.equal(await status(a), 'undone');
    assert.equal(await status(b), 'approved');
    assert.equal(
      await run(
        `return !!document.querySelector('[data-action="history-undo"], [data-action="history-reconsider"]');`
      ),
      false
    );
    await detail(b);
    await click('[data-action="history-undo"]');
    await settle();
    assert.equal(count(), 5);
    await close();
    await click('[data-action="undo"]');
    await settle();
    assert.equal(count(), 4);
    assert.equal(await status(b), 'approved');
    await click('[data-action="undo"]');
    await settle();
    assert.equal(count(), 2);
    assert.equal(await status(a), 'approved');
    results.push(
      'History shows recorded full details and actual costs; targeted refunds preserve later uses, HP, movement, and edited definitions, while ordinary Undo restores correct costs and labels.'
    );

    await click('[data-action="long-rest"]');
    await run(`document.getElementById('rest-form').requestSubmit();`);
    await settle();
    await detail(a);
    assert.ok(
      await run(
        `return document.querySelector('[data-action="history-undo"]').disabled && document.querySelector('#history-action-reason').textContent.includes('reset');`
      )
    );
    await shot('03-blocked-refund');
    results.push(
      'A later rest disables the entire refund and displays the reason beside Undo this use.'
    );

    await close();
    const denied = await request();
    await run(`showApprovalRequest('${denied}');`);
    await click('[data-action="deny-request"]');
    await settle();
    await run(
      `await commit(()=>{selected().items[0].name='Latest guiding spark';selected().items[0].resourceCost=1;});`
    );
    await detail(denied);
    const regular = await request(2, 'b'),
      urgent = await request(3, 'b');
    assert.ok(await run(`return !!document.querySelector('[data-history-detail]');`));
    await click('[data-action="history-reconsider"]');
    await settle();
    const reconsidered = (await history()).find((r) => r.id === denied).reconsideredAs;
    assert.ok(
      await run(
        `return approvalOpenId==='${reconsidered}' && document.querySelector('[data-approval-detail]').textContent.includes('Latest guiding spark') && document.querySelector('.approval-costs').textContent.includes('1 Special casts');`
      )
    );
    assert.deepEqual(
      (await pending()).map((r) => r.id),
      [urgent, reconsidered, regular]
    );
    assert.equal(count(), 5);
    assert.equal(await tv('return state.characters[0].resources[0].current;'), 4);
    await click('[data-action="deny-request"]');
    await settle();
    await detail(denied);
    assert.ok(
      await run(
        `return document.querySelector('[data-action="history-reconsider"]').disabled && document.querySelector('#history-action-reason').textContent.includes('already been reconsidered');`
      )
    );
    await denyAll();
    results.push(
      'Reconsider immediately opens current details, reserves current costs once, preserves Urgent priority, and leaves incoming requests queued while History is open.'
    );

    const id = await approve();
    await detail(id);
    const originalSave = store.save.bind(store),
      beforeFailure = JSON.parse(JSON.stringify(getState()));
    store.save = () => {
      throw Error('Synthetic refund save failure');
    };
    try {
      await click('[data-action="history-undo"]');
      await settle();
      assert.deepEqual(getState(), beforeFailure);
      assert.equal(await status(id), 'approved');
      assert.ok(
        await run(
          `return !document.querySelector('[data-action="history-undo"]').disabled && document.querySelector('#form-error').textContent.includes('Synthetic refund');`
        )
      );
    } finally {
      store.save = originalSave;
    }
    await click('[data-action="history-undo"]');
    await settle();
    assert.equal(count(), 5);
    assert.equal(await status(id), 'undone');
    assert.equal(await run(`return document.querySelector('#form-error').textContent;`), '');
    results.push(
      'A failed save keeps the History dialog and recorded costs intact; retry refunds once and clears the error.'
    );

    await close();
    const guarded = await approve(),
      pendingUse = await request(1);
    await detail(guarded);
    await click('[data-action="history-undo"]');
    await wait(() => run('return !!pendingGuard;'));
    assert.ok(await run(`return document.getElementById('dm-history-root').inert;`));
    await shot('04-dependent-request-warning');
    await click('[data-guard-cancel]');
    await settle();
    assert.ok(
      await run(`return document.querySelector('.modal').contains(document.activeElement);`)
    );
    assert.equal(count(), 4);
    assert.equal(await status(guarded), 'approved');
    await click('[data-action="history-undo"]');
    await wait(() => run('return !!pendingGuard;'));
    await click('[data-guard-continue]');
    await settle();
    assert.equal(count(), 5);
    assert.equal(await status(guarded), 'undone');
    assert.equal(await status(pendingUse), 'denied');
    results.push(
      'Refunding data used by a pending request shows the existing warning; Cancel preserves both, and Continue refunds only the selected use and denies the dependent request.'
    );

    await close();
    for (let i = 0; i < 6; i++) await approve(2);
    assert.equal((await history()).length, 5);
    assert.equal(count(), 5);
    await click('[data-action="dm-history"]');
    assert.equal(
      await run(`return document.querySelectorAll('[data-action="review-history"]').length;`),
      5
    );
    const savedHistory = await history();
    controller.reload();
    await wait(() => !controller.webContents.isLoading());
    await wait(() => run('return !!state && approvalState.history.length===5;'));
    assert.deepEqual(await history(), savedHistory);
    await click('[data-action="dm-history"]');
    await shot('05-five-recent-requests');
    assert.equal(await tv('return state.history || state.approvals;'), undefined);
    const disk = JSON.parse(fs.readFileSync(path.join(store.directory, 'party.json'), 'utf8'));
    assert.equal(disk.history, undefined);
    assert.equal(disk.approvals, undefined);
    assert.equal(disk.characters[0].resources[0].current, 5);
    results.push(
      'History retains five resolutions without refunds on eviction, survives renderer reload, and stays out of player data and party saves.'
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(dir, 'history-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(dir, 'history-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack, errors }, null, 2)
    );
    try {
      await shot('failure-dm');
    } catch {}
  } finally {
    app.exit(0);
  }
};
