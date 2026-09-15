/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { BrowserWindow, dialog } = require('electron');
const TL = require('../core');
module.exports = async ({ app, controller, getOverlay, getState, screen, setOverlay, store }) => {
  const directory = path.dirname(store.directory),
    results = [];
  const restarted = process.env.TABLELIGHT_TEST_RESTART === '1';
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const tv = (code) => getOverlay().webContents.executeJavaScript(`(async()=>{${code}})()`);
  const snapshot = () => run('return window.tablelight.messages();');
  const target = async (characterId = 'p0') => {
    const s = await snapshot();
    return {
      sessionId: s.sessionId,
      ...s.messages.find((m) => m.characterId === characterId),
      characterId,
    };
  };
  const invoke = (request, actor = 'dm') =>
    (actor === 'dm' ? run : tv)(
      `return window.tablelight.messageCommand(${JSON.stringify(request)});`
    );
  const command = async (type, characterId = 'p0', extra = {}, actor = 'dm') =>
    invoke({ ...(await target(characterId)), requestId: TL.uid(), type, ...extra }, actor);
  const body = async (actor = 'player', selected = null) =>
    (actor === 'dm' ? run : tv)(
      `return window.tablelight.messageBody(${JSON.stringify(selected || (await target()))});`
    );
  const wait = async (check) => {
    const start = Date.now();
    while (!(await check())) {
      if (Date.now() - start > 10000) throw Error('Player message desktop check timed out');
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  };
  const show = async () => {
    await setOverlay(true);
    await wait(async () => (await snapshot()).overlay.connected && getOverlay().isVisible());
    const { width, height } = getOverlay().getContentBounds();
    await wait(() => tv(`return !!state&&innerWidth===${width}&&innerHeight===${height};`));
    await tv('paint();');
  };
  // The reading UI belongs to milestone 6. These explicit renderer acknowledgements
  // exercise the bridge contract without presenting a test widget as production UI.
  const acknowledgeOpen = async () => {
    const response = await body();
    await command('ack-opened', 'p0', { bodyToken: response.bodyToken }, 'player');
    return response;
  };
  const originalSave = dialog.showSaveDialog,
    originalOpen = dialog.showOpenDialog;
  let stranger;
  try {
    await wait(() => run('return !!state;'));
    if (restarted) {
      const expected = JSON.parse(
        fs.readFileSync(path.join(directory, 'player-messages-expected.json'), 'utf8')
      );
      assert.deepEqual(getState(), expected.state);
      assert.notEqual((await snapshot()).sessionId, expected.sessionId);
      assert.deepEqual((await snapshot()).messages, []);
      await show();
      assert.deepEqual(await tv('return (await window.tablelight.messages()).messages;'), []);
      results.push(
        'A fresh installed/source desktop process preserves party settings and starts with no messages or old session receipts.'
      );
    } else {
      const fixture = TL.empty();
      fixture.settings.hudControlsVersion = 1;
      fixture.settings.soloExpand = false;
      fixture.settings.overlayInteractive = true;
      fixture.settings.displayId = String(screen.getPrimaryDisplay().id);
      fixture.characters = Array.from({ length: 8 }, (_, i) => {
        const c = TL.character(i);
        c.id = 'p' + i;
        c.name = 'Same synthetic name';
        c.theme = i % 2 ? 'wizard' : 'artificer';
        Object.assign(c.hud, { expanded: i % 2 === 1, visible: i !== 7, rotation: (i % 4) * 90 });
        return c;
      });
      fixture.roster = [{ ...TL.character(), id: 'inactive' }];
      await run(`await commit(()=>{state=${JSON.stringify(fixture)};});`);
      await show();
      for (const windowRun of [run, tv])
        await windowRun(
          `window.messageEvents=[];window.stopMessageEvents=window.tablelight.onMessages(s=>window.messageEvents.push(s));`
        );
      const unchanged = TL.clone(getState());
      const undoCount = await run('return (await api.load()).undoCount;');
      await Promise.all(
        fixture.characters.map((c) =>
          command('send', c.id, {
            body: 'SYNTHETIC_MESSAGE_' + c.id + '\n<script>literal</script>',
          })
        )
      );
      assert.equal((await snapshot()).messages.length, 8);
      assert.deepEqual(getState(), unchanged);
      assert.equal(await run('return (await api.load()).undoCount;'), undoCount);
      for (let i = 0; i < 8; i++) {
        const t = await target('p' + i);
        assert.equal(
          (await body('dm', t)).body,
          'SYNTHETIC_MESSAGE_p' + i + '\n<script>literal</script>'
        );
        await assert.rejects(body('player', t), /Open this message/);
      }
      await assert.rejects(
        command('send', 'inactive', { body: 'Invalid recipient' }),
        /active party/
      );
      await assert.rejects(
        command('send', 'p0', { body: 'Wrong role' }, 'player'),
        /not available/
      );
      await assert.rejects(command('ack-indicator'), /not available/);
      stranger = new BrowserWindow({
        show: false,
        webPreferences: {
          preload: path.join(__dirname, '..', 'preload.js'),
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      await stranger.loadURL('about:blank');
      await assert.rejects(
        stranger.webContents.executeJavaScript('window.tablelight.messages()'),
        /Unknown Tablelight message window/
      );
      stranger.destroy();
      stranger = null;
      for (const windowRun of [run, tv]) {
        assert.equal(
          await windowRun(
            `return JSON.stringify(window.messageEvents).includes('SYNTHETIC_MESSAGE_');`
          ),
          false
        );
        assert.equal(
          await windowRun(`return document.body.textContent.includes('SYNTHETIC_MESSAGE_');`),
          false
        );
      }
      assert.equal(
        await tv(
          `return JSON.stringify(await window.tablelight.load()).includes('SYNTHETIC_MESSAGE_');`
        ),
        false
      );
      results.push(
        'Eight same-name recipients receive distinct ID-targeted messages; broadcasts, ordinary loads and both screens omit bodies; wrong roles and unknown windows are rejected.'
      );

      await run(
        `await commit(()=>{state.characters.reverse();state.characters.find(c=>c.id==='p0').name='Renamed recipient';});`
      );
      assert.match((await body('dm')).body, /^SYNTHETIC_MESSAGE_p0/);
      await assert.rejects(command('send', 'p0', { body: 'Implicit overwrite' }), /Choose Replace/);
      const old = await target();
      const replacement = {
        ...old,
        type: 'send',
        requestId: TL.uid(),
        body: 'SYNTHETIC_MESSAGE_replacement',
        replaceMessageId: old.messageId,
      };
      await invoke(replacement);
      const after = await snapshot();
      assert.equal((await invoke(replacement)).result.replayed, true);
      assert.deepEqual(await snapshot(), after);
      for (const type of ['force-open', 'close', 'dismiss'])
        await assert.rejects(
          invoke({ ...old, type, requestId: TL.uid() }),
          /changed or was dismissed/
        );
      await assert.rejects(
        body('dm', { ...(await target()), characterId: 'p1' }),
        /changed or was dismissed/
      );
      assert.equal((await target()).unread, true);
      assert.equal((await target()).deliveredAt, null);
      await command('ack-indicator', 'p0', {}, 'player');
      assert.ok((await target()).deliveredAt);
      await command('force-open');
      assert.equal((await target()).unread, true);
      await assert.rejects(
        command('ack-opened', 'p0', { bodyToken: 'not-fetched' }, 'player'),
        /Fetch and display/
      );
      await acknowledgeOpen();
      assert.equal((await target()).openedBy, 'dm');
      assert.equal((await target()).unread, false);
      results.push(
        'Reordering, explicit replacement and duplicate/stale requests preserve correct ownership. Sent, delivered and opened advance only through the current view acknowledgements.'
      );

      await assert.rejects(command('force-open', 'p7'), /Show this player/);
      const placement = getState().characters.map((c) => [c.id, TL.clone(c.hud)]);
      await run(`await commit(()=>{state.settings.overlayInteractive=false;});`);
      await assert.rejects(command('close', 'p0', {}, 'player'), /click-through/);
      await command('close');
      await assert.rejects(command('open', 'p0', {}, 'player'), /click-through/);
      await command('force-open');
      await acknowledgeOpen();
      assert.equal(getState().settings.overlayInteractive, false);
      assert.deepEqual(
        getState().characters.map((c) => [c.id, c.hud]),
        placement
      );
      await run(`await commit(()=>{state.settings.overlayInteractive=true;});`);
      await command('close');
      await command('open', 'p0', {}, 'player');
      await acknowledgeOpen();
      assert.equal((await target()).openedBy, 'player');
      results.push(
        'Collapsed recipients can be forced open; hidden recipients cannot. DM controls and acknowledgements work in click-through while player commands are rejected, without changing any saved placement.'
      );

      for (const expanded of [true, false]) {
        await command('force-open');
        await run(
          `await commit(()=>{state.characters.find(c=>c.id==='p0').hud.expanded=${expanded};});`
        );
        assert.equal((await target()).open, false);
      }
      await command('force-open');
      await run(`await commit(()=>{state.characters.find(c=>c.id==='p0').hud.visible=false;});`);
      assert.equal((await target()).open, false);
      await run(`await commit(()=>{state.characters.find(c=>c.id==='p0').hud.visible=true;});`);
      for (const event of ['hide', 'reload', 'display-change', 'renderer-exit']) {
        await command('force-open');
        const stale = await target();
        const fetched = await body();
        if (event === 'hide') {
          await setOverlay(false);
          await show();
        }
        if (event === 'reload') {
          await new Promise((resolve) => {
            getOverlay().webContents.once('did-finish-load', resolve);
            getOverlay().webContents.reload();
          });
          await show();
        }
        // Exercise actual app event handlers without unplugging the user's monitor
        // or intentionally crashing a graphics process shared by unrelated windows.
        if (event === 'display-change')
          screen.emit('display-removed', {}, screen.getPrimaryDisplay());
        if (event === 'renderer-exit') {
          getOverlay().webContents.emit('render-process-gone', {}, { reason: 'crashed' });
          assert.equal((await snapshot()).overlay.connected, false);
          getOverlay().webContents.emit('did-finish-load');
        }
        assert.equal((await target()).open, false, event);
        assert.equal((await target()).unread, false, event);
        await assert.rejects(
          invoke(
            { ...stale, type: 'ack-opened', bodyToken: fetched.bodyToken, requestId: TL.uid() },
            'player'
          ),
          /changed/
        );
      }
      await show();
      assert.equal((await target()).open, false);
      results.push(
        'Hide/show, collapse/expand, real renderer reload and simulated display/renderer-loss events close exposed text, preserve read history and reject late acknowledgements without automatic reopening.'
      );

      await run(`await commit(()=>{TL.removeFromParty(state,'p0');});`);
      assert.equal(
        (await snapshot()).messages.some((m) => m.characterId === 'p0'),
        false
      );
      await run('await undo();');
      assert.equal(
        (await snapshot()).messages.some((m) => m.characterId === 'p0'),
        false
      );
      await invoke(replacement);
      assert.equal(
        (await snapshot()).messages.some((m) => m.characterId === 'p0'),
        false
      );
      const exportFile = path.join(directory, 'message-party-export.json');
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: exportFile });
      await run('await api.exportParty();await api.flush();');
      for (const file of [store.file, store.backup, exportFile])
        assert.equal(fs.readFileSync(file, 'utf8').includes('SYNTHETIC_MESSAGE_'), false);
      const previousSession = (await snapshot()).sessionId;
      dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
      assert.equal(await run('return api.importParty();'), null);
      assert.equal((await snapshot()).sessionId, previousSession);
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [exportFile] });
      await run(
        `const imported=await api.importParty();await commit(()=>{state=imported;},'Restore synthetic message party',true,[],true);`
      );
      assert.notEqual((await snapshot()).sessionId, previousSession);
      assert.deepEqual((await snapshot()).messages, []);
      await run('await undo();');
      assert.deepEqual((await snapshot()).messages, []);
      await command('send', 'p0', { body: 'SYNTHETIC_MESSAGE_restart' });
      fs.writeFileSync(
        path.join(directory, 'player-messages-expected.json'),
        JSON.stringify({ state: getState(), sessionId: (await snapshot()).sessionId })
      );
      results.push(
        'Ordinary saves retain messages. Removal and Undo cannot resurrect them; native backup export excludes text, cancelled import retains the session, and successful restore clears it.'
      );
    }
    fs.writeFileSync(
      path.join(directory, 'player-messages' + (restarted ? '-restart' : '') + '-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'player-messages' + (restarted ? '-restart' : '') + '-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
  } finally {
    stranger?.destroy();
    dialog.showSaveDialog = originalSave;
    dialog.showOpenDialog = originalOpen;
    setOverlay(false);
    app.quit();
  }
};
