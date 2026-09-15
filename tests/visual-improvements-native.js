/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { dialog } = require('electron');
const TL = require('../core'),
  Themes = require('../hud-themes');
const { Store } = require('../storage');
const { png, dataUrl } = require('./icon-fixtures');
const nativeInput = require('./window-input-native');

module.exports = async ({ app, controller, getOverlay, getState, screen, setOverlay, store }) => {
  const directory = path.dirname(store.directory),
    results = [],
    configurations = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const tv = (code) => getOverlay().webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (check, label = 'Combined review') => {
    const started = Date.now();
    while (!(await check())) {
      if (Date.now() - started > 10000) throw Error(label + ' timed out');
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  };
  const snapshot = () => run('return api.messages();');
  const command = (type, id = 'p0', fields = {}) =>
    run(
      `await messageClient.refresh();return messageClient.command(${JSON.stringify(type)},${JSON.stringify(id)},${JSON.stringify(fields)});`
    );
  const opened = (id = 'p0') =>
    wait(
      async () => (await snapshot()).messages.find((m) => m.characterId === id)?.bodyVisible,
      'Message rendered'
    );
  const pose = `return [...document.querySelectorAll('.hud-position')].map(e=>({id:e.dataset.hudId,width:e.offsetWidth,height:e.offsetHeight,left:e.style.left,top:e.style.top,transform:e.style.transform}));`;
  const show = async () => {
    await setOverlay(true);
    await wait(async () => getOverlay()?.isVisible() && (await snapshot()).overlay.connected);
    const b = getOverlay().getContentBounds();
    await wait(() => tv(`return !!state&&innerWidth===${b.width}&&innerHeight===${b.height};`));
    await tv('paint();');
  };
  const shot = async (name) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    fs.writeFileSync(
      path.join(directory, name + '.png'),
      (await getOverlay().webContents.capturePage()).toPNG()
    );
  };
  const originalOpen = dialog.showOpenDialog,
    originalSave = dialog.showSaveDialog;
  const displays = screen.getAllDisplays().map((d) => ({
    primary: d.id === screen.getPrimaryDisplay().id,
    boundsDIP: d.bounds,
    sizeDIP: d.size,
    scaleFactor: d.scaleFactor,
    rotation: d.rotation,
  }));
  try {
    controller.setBounds({ width: 1440, height: 1000 });
    controller.showInactive();
    await wait(() => run('return !!state&&!!messageClient?.state.sessionId;'));
    await run(
      `await commit(()=>{state=TL.empty();state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};state.settings.overlayInteractive=true;view='messages';});`
    );
    await show();
    assert.equal(
      await tv(
        `return document.querySelectorAll('.hud-position,.message-position,.message-badge').length;`
      ),
      0
    );
    assert.deepEqual((await snapshot()).messages, []);
    await assert.rejects(
      command('send', 'missing', { body: 'Synthetic absent recipient' }),
      /active|party|character/i
    );
    results.push(
      'An empty party has no HUD/mail regions or recipient; sending to an absent character fails.'
    );

    const originalArt = dataUrl(png(32, 16)),
      localArt = dataUrl(png(16, 32, { pixel: [200, 100, 40, 255] }));
    const fixture = TL.empty();
    Object.assign(fixture.settings, {
      hudControlsVersion: 1,
      soloExpand: false,
      overlayInteractive: true,
      displayId: String(screen.getPrimaryDisplay().id),
    });
    fixture.library = [
      TL.libraryEntry({
        id: 'shared',
        name: 'Synthetic shared beacon with a long descriptive name',
        kind: 'spell',
        economy: 'free',
        icon: originalArt,
        description: 'Synthetic description. '.repeat(150),
        upgrades: 'Synthetic higher-level detail. '.repeat(50),
        source: 'Original test fixture',
        requirements: 'Synthetic requirements',
        special: 'Synthetic special detail',
      }),
      TL.libraryEntry({
        id: 'unused',
        name: 'Unassigned shared feature',
        kind: 'feature',
        icon: localArt,
      }),
    ];
    fixture.conditionLibrary = [
      TL.conditionEntry({
        id: 'condition',
        name: 'Synthetic focus',
        description: 'Synthetic condition description',
      }),
      TL.conditionEntry({ id: 'unused-condition', name: 'Unassigned condition' }),
    ];
    const characters = Array.from({ length: 9 }, (_, i) => {
      const c = TL.character(i);
      Object.assign(c, {
        id: 'p' + i,
        name: i < 2 ? 'Same name' : 'Synthetic player ' + (i + 1),
        theme: Themes.choices[i + 1].id,
        notes: 'SYNTHETIC_DM_NOTE_' + i,
      });
      c.resources = Array.from({ length: i === 0 ? 10 : 2 }, (_, j) => ({
        id: 'pool' + j,
        name: 'Independent resource ' + (j + 1),
        current: 6,
        max: 8,
        reset: 'long',
        icon: 'star',
        color: j % 2 ? '#f0d48b' : '#192233',
      }));
      Object.assign(c.hud, {
        expanded: i === 0,
        visible: true,
        panel: 'spell',
        scale: 0.6,
        rotation: i === 1 ? 35 : 0,
        x: i === 0 ? 30 : 75,
        y: 50,
      });
      return c;
    });
    fixture.characters = [characters[0]];
    fixture.roster = characters.slice(1);
    for (const c of characters) {
      TL.attachItem(fixture, c.id, 'shared', {
        resourceId: 'pool0',
        resourceCost: c.id === 'p0' ? 1 : 2,
      });
      TL.assignCondition(fixture, c.id, 'condition');
      TL.createLocalItem(fixture, c.id, {
        name: 'Independent local action',
        icon: localArt,
        economy: 'free',
      });
    }
    characters[0].hud.detailId = characters[0].items[0].id;
    await run(
      `await commit(()=>{state=TL.normalize(${JSON.stringify(fixture)});selectedId='p0';view='display';});`
    );
    await wait(() =>
      tv(
        `return !!document.querySelector('.ability-detail-heading .image-ready')&&document.querySelectorAll('.hud-position').length===1;`
      )
    );
    const onePose = await tv(pose),
      oneState = TL.clone(getState());
    assert.equal(onePose[0].width, 880);
    const body = 'SYNTHETIC_COMBINED_MESSAGE_p0\n' + 'A synthetic table message. '.repeat(40);
    await command('send', 'p0', { body });
    await command('force-open');
    await opened();
    assert.deepEqual(await tv(pose), onePose);
    assert.deepEqual(getState(), oneState);
    assert.equal(
      await tv(`return document.body.textContent.includes('SYNTHETIC_DM_NOTE_');`),
      false
    );
    await shot('combined-one-player');
    results.push(
      'One themed HUD with artwork, long manual details and ten resources keeps its 880-pixel width and exact saved settings while reading a message; DM notes remain absent.'
    );

    await run(`await commit(()=>{TL.addToParty(state,'p1');});`);
    await wait(() => tv(`return document.querySelectorAll('.hud-position').length===2;`));
    await command('send', 'p1', { body: 'SYNTHETIC_COMBINED_MESSAGE_p1' });
    await wait(
      async () => (await snapshot()).messages.find((m) => m.characterId === 'p1')?.deliveredAt
    );
    const twoPose = await tv(pose);
    const personal = () =>
      TL.allCharacters(getState()).map((c) => ({
        id: c.id,
        theme: c.theme,
        color: c.color,
        resources: c.resources,
        hud: c.hud,
        assignments: c.items.map((it) => ({
          id: it.id,
          libraryId: it.libraryId,
          resourceId: it.resourceId,
          resourceCost: it.resourceCost,
          disabled: it.disabled,
        })),
        localIcon: c.items[1].icon,
      }));
    const personalBefore = personal(),
      messagesBefore = await snapshot();
    const replacement = path.join(directory, 'replacement.png');
    fs.writeFileSync(replacement, png(600, 300, { pixel: [60, 170, 245, 180] }));
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [replacement] });
    await run(
      `editLibraryEntry('shared');window.combinedUpload=document.querySelector('[data-icon-upload]').onclick();`
    );
    await run(
      `await window.combinedUpload;document.getElementById('item-form').requestSubmit();await saveQueue;`
    );
    await wait(() => run(`return !document.getElementById('item-form');`));
    const replacedArt = getState().library[0].icon;
    assert.notEqual(replacedArt, originalArt);
    assert.ok(TL.allCharacters(getState()).every((c) => c.items[0].icon === replacedArt));
    assert.deepEqual(personal(), personalBefore);
    await wait(() =>
      tv(
        `return document.querySelector('.ability-detail-heading img')?.src===${JSON.stringify(replacedArt)};`
      )
    );
    assert.deepEqual(await tv(pose), twoPose);
    assert.deepEqual(await snapshot(), messagesBefore);
    assert.equal(
      await run(`return document.querySelectorAll('#preview-stage .message-panel').length;`),
      0
    );
    await shot('combined-two-players');
    results.push(
      'Replacing a shared icon through the editor updates active and inactive assignments; local art, personal costs/themes, exact HUD geometry and two same-name recipients remain independent.'
    );

    await run(`editCharacter(false,'p0');document.querySelector('[name="theme"]').value='wizard';`);
    // Independent player actions reach main while the older character editor is still open.
    await tv(
      `await Promise.all(state.characters.map(c=>window.tablelight.hudCommand({type:'hp',characterId:c.id,amount:-1,sessionId:state.approvalSessionId,commandId:TL.uid()})));`
    );
    await tv(
      `const c=state.characters[0];await window.tablelight.hudCommand({type:'use',characterId:c.id,itemId:c.items[0].id,sessionId:state.approvalSessionId,commandId:TL.uid()});`
    );
    await wait(() => run('return approvalState.pending.length===1;'));
    const spending = TL.clone(getState()),
      pending = await run('return approvalState.pending;');
    await run(`document.getElementById('character-form').requestSubmit();await saveQueue;`);
    await wait(() => run(`return !document.getElementById('character-form');`));
    spending.characters[0].theme = 'wizard';
    assert.deepEqual(getState(), spending);
    assert.deepEqual(await run('return approvalState.pending;'), pending);
    await wait(() =>
      tv(
        `return document.querySelector('[data-hud-id="p0"]').offsetWidth===1150&&state.characters[0].theme==='wizard';`
      )
    );
    assert.equal((await snapshot()).messages.find((m) => m.characterId === 'p0').open, true);
    assert.equal(getState().characters[0].resources[0].current, 6);
    assert.equal(await tv('return state.characters[0].resources[0].current;'), 5);
    await command('force-open', 'p1');
    await opened('p1');
    await run(`await commit(()=>{state.settings.overlayInteractive=false;});`);
    await wait(() => tv('return !state.settings.overlayInteractive;'));
    await tv('paint();');
    const pendingPose = await tv(pose);
    assert.equal(pendingPose[0].width, 1150);
    assert.equal(pendingPose[1].width, 78);
    assert.equal(pendingPose[1].height, 78);
    await command('page', 'p0', { page: 1 });
    await opened();
    assert.deepEqual(await tv(pose), pendingPose);
    assert.equal(nativeInput(getOverlay(), []).transparent, true);
    assert.equal((await snapshot()).messages.find((m) => m.characterId === 'p1').page, 0);
    await shot('combined-pending-click-through');
    results.push(
      'A stale theme editor preserves simultaneous HP changes and a pending reservation. The 1150-pixel pending HUD and both messages survive a mode switch; DM paging targets only one recipient while Windows click-through stays on.'
    );

    const exportFile = path.join(directory, 'combined-backup.json');
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: exportFile });
    assert.equal(await run('return api.exportParty();'), true);
    await run('await api.flush();');
    const exported = fs.readFileSync(exportFile, 'utf8'),
      backup = TL.normalize(JSON.parse(exported));
    assert.equal(exported.split(replacedArt).length - 1, 1);
    assert.equal(backup.library.length, 2);
    assert.equal(backup.conditionLibrary.length, 2);
    assert.equal(backup.roster.length, 7);
    for (const file of [exportFile, store.file, store.backup])
      assert.equal(fs.readFileSync(file, 'utf8').includes('SYNTHETIC_COMBINED_MESSAGE_'), false);
    // Shared definition edits retain the existing pending-use review, including icon changes.
    const beforeIconReview = await snapshot();
    await run(`window.combinedIconChange=commit(()=>{state.library[0].icon='';});`);
    await wait(() => run(`return !!document.querySelector('[data-guard-cancel]');`));
    await run(
      `document.querySelector('[data-guard-cancel]').click();await window.combinedIconChange;`
    );
    assert.equal(getState().library[0].icon, replacedArt);
    assert.deepEqual(await run('return approvalState.pending;'), pending);
    assert.deepEqual(await snapshot(), beforeIconReview);
    await run(`await commit(()=>{state.characters[0].theme='druid';});`);
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [exportFile] });
    const restore = () =>
      run(
        `const imported=await api.importParty();window.combinedRestore=commit(()=>{state=imported;},'Restore combined fixture',true,[],true);`
      );
    const beforeRestore = await snapshot();
    await restore();
    await wait(() => run(`return !!document.querySelector('[data-guard-cancel]');`));
    await run(
      `document.querySelector('[data-guard-cancel]').click();await window.combinedRestore;`
    );
    assert.deepEqual(await snapshot(), beforeRestore);
    assert.equal(getState().characters[0].theme, 'druid');
    await restore();
    await wait(() => run(`return !!document.querySelector('[data-guard-continue]');`));
    await run(
      `document.querySelector('[data-guard-continue]').click();await window.combinedRestore;`
    );
    assert.deepEqual(getState(), backup);
    assert.deepEqual(new Store(store.directory).load().state, backup);
    assert.notEqual((await snapshot()).sessionId, beforeRestore.sessionId);
    assert.deepEqual((await snapshot()).messages, []);
    await wait(() => tv(`return !document.querySelector('.message-position,.message-badge');`));
    results.push(
      'Export includes both libraries, inactive characters, shared/local art and personal themes once per definition. Cancelling a guarded restore retains messages; accepting restores the full party and clears messages and their cards. No text enters current, previous or exported saves.'
    );

    await run(
      `await commit(()=>{for(let i=2;i<8;i++)TL.addToParty(state,'p'+i);state.settings.overlayInteractive=true;for(const [i,c] of state.characters.entries())Object.assign(c.hud,{expanded:i%2===0,visible:i!==7,rotation:[0,90,180,270,35,0,90,180][i],scale:[0.4,1,2.5][i%3],x:15+(i%4)*23,y:i<4?25:75});});view='display';render();`
    );
    await wait(() => tv(`return document.querySelectorAll('.hud-position').length===7;`));
    for (let i = 0; i < 8; i++)
      await command('send', 'p' + i, { body: 'SYNTHETIC_COMBINED_MESSAGE_p' + i });
    await wait(() => tv(`return document.querySelectorAll('.message-badge').length===7;`));
    const visibleBadges = await tv(
      `return [...document.querySelectorAll('.message-badge')].filter(e=>playerMessages.visible(e)).map(e=>e.dataset.messageBadge);`
    );
    await wait(async () => {
      const messages = (await snapshot()).messages;
      return visibleBadges.every((id) => messages.find((m) => m.characterId === id)?.deliveredAt);
    });
    for (const m of (await snapshot()).messages)
      if (!visibleBadges.includes(m.characterId)) assert.equal(m.deliveredAt, null);
    assert.equal((await snapshot()).messages.find((m) => m.characterId === 'p7').available, false);
    assert.equal(await tv(`return !!document.querySelector('[data-message-badge="p7"]');`), false);
    const settings = TL.clone(getState());
    // Resize only this isolated test window. These are viewport simulations, not OS display changes.
    for (const [width, height] of [
      [1280, 720],
      [1920, 1080],
      [2560, 1440],
    ]) {
      await setOverlay(false);
      await show();
      getOverlay().setBounds({ ...getOverlay().getBounds(), width, height });
      await wait(() => tv(`return innerWidth===${width}&&innerHeight===${height};`));
      await tv('paint();');
      const beforeCards = await tv(pose);
      for (let i = 0; i < 7; i++) {
        await command('force-open', 'p' + i);
        await opened('p' + i);
      }
      assert.deepEqual(await tv(pose), beforeCards);
      const mapping = await tv(
        `return [...document.querySelectorAll('.message-position')].map(e=>({id:e.dataset.messageCharacter,theme:e.dataset.hudTheme||'default',text:e.querySelector('.message-text').textContent,rect:(()=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};})()}));`
      );
      assert.equal(mapping.length, 7);
      for (const entry of mapping) {
        const c = getState().characters.find((c) => c.id === entry.id);
        assert.equal(entry.theme, c.theme);
        assert.equal(entry.text, 'SYNTHETIC_COMBINED_MESSAGE_' + c.id);
        assert.ok(Object.values(entry.rect).every(Number.isFinite));
        // Collapsed cards fit on screen even at high scale/arbitrary rotation.
        if (!c.hud.expanded)
          assert.ok(
            entry.rect.left >= -1 &&
              entry.rect.top >= -1 &&
              entry.rect.right <= width + 1 &&
              entry.rect.bottom <= height + 1
          );
      }
      assert.deepEqual(getState(), settings);
      configurations.push({
        width,
        height,
        players: 8,
        visible: 7,
        hudScales: [0.4, 1, 2.5],
        rotations: [0, 90, 180, 270, 35],
      });
      if (width === 1920) await shot('combined-eight-players');
    }
    results.push(
      'Eight distinct recipients with mixed visibility/expansion, scales 40/100/250% and five rotations retain exact saved settings across three simulated viewports. Seven visible cards show only their own text and theme; the hidden recipient remains unread.'
    );

    fs.writeFileSync(
      path.join(directory, 'visual-improvements-results.json'),
      JSON.stringify({ passed: true, results, displays, configurations }, null, 2)
    );
  } catch (error) {
    await shot('combined-failure').catch(() => {});
    fs.writeFileSync(
      path.join(directory, 'visual-improvements-results.json'),
      JSON.stringify(
        { passed: false, results, displays, configurations, error: error.stack },
        null,
        2
      )
    );
  } finally {
    dialog.showOpenDialog = originalOpen;
    dialog.showSaveDialog = originalSave;
    setOverlay(false);
    app.quit();
  }
};
