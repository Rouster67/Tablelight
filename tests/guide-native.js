/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto');
const { dialog, ipcMain } = require('electron');
const { execFileSync } = require('node:child_process');
module.exports = async ({
  app,
  controller,
  getOverlay,
  getState,
  setOverlay,
  store,
  guide,
  screen,
}) => {
  const directory = path.dirname(store.directory),
    results = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (check) => {
    for (let i = 0; i < 200; i++) {
      if (await check()) return;
      await new Promise((r) => setTimeout(r, 40));
    }
    throw Error('Guide test timed out');
  };
  const click = (selector) =>
    run(
      `const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled)throw Error('Missing control');el.click();`
    );
  const crop = async (win, selector, name) => {
    await new Promise((r) => setTimeout(r, 300));
    const rect = await win.webContents.executeJavaScript(
      `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:Math.max(0,Math.floor(r.x)-5),y:Math.max(0,Math.floor(r.y)-5),width:Math.min(innerWidth,Math.ceil(r.width)+10),height:Math.min(innerHeight,Math.ceil(r.height)+10)}})()`
    );
    fs.writeFileSync(path.join(directory, name), (await win.webContents.capturePage(rect)).toPNG());
  };
  const originalOpen = guide.openPath,
    originalRead = guide.readFile,
    originalSaveDialog = dialog.showSaveDialog,
    originalOpenDialog = dialog.showOpenDialog;
  try {
    await wait(() => run(`return !!document.querySelector('[data-action="view-help"]');`));
    controller.setBounds({ width: 1440, height: 1000 });
    controller.showInactive();
    await run(
      `await commit(()=>{state=TL.empty();const c=TL.character();c.id='mira';c.name='Mira';c.className='Lantern keeper';c.hud={...c.hud,expanded:true,panel:'passive',x:50,y:50,scale:1};state.characters=[c];state.activeId=c.id;selectedId=c.id;state.settings.displayId=display().id;state.settings.overlayInteractive=true;state.library=[TL.libraryEntry({id:'lantern',name:'Lantern sense',behavior:'passive',trackPassive:true,description:'While carrying your lantern, you notice the marker described by the DM.'})];const p=TL.attachItem(state,c.id,'lantern');c.hud.detailId=p.id;});view='help';render();document.getElementById('guide-link').scrollIntoView({block:'center'});`
    );
    const before = JSON.stringify(getState()),
      party = fs.readFileSync(store.file),
      undo = await run('return history.length;');
    const help = await run('return document.querySelector(".content").textContent;');
    for (const label of [
      'Use the HUDs directly',
      'Concentration & conditions',
      'Rests & corrections',
    ])
      assert.ok(!help.includes(label), label);
    for (const label of [
      'Extend your display',
      'Build your shared library',
      'Tablelight is a manual tracker',
      'Read license',
      'Keep a backup',
      'Export party backup',
      'Restore backup',
      'Saved party folder',
      'Keyboard controls',
      'Display tips',
    ])
      assert.ok(help.includes(label), label);
    assert.ok(await run(`return !!document.getElementById('updates-panel');`));
    await crop(controller, '#guide-link', 'help-link.png');
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    const overlay = getOverlay();
    await wait(() =>
      overlay.webContents.executeJavaScript(`!!document.querySelector('.hud-browser .hud-panel')`)
    );
    await crop(overlay, '.hud-panel', 'passive-detail.png');
    const root = path.resolve(__dirname, '..');
    if (process.env.TABLELIGHT_TEST_SCENARIO === 'guide-capture') {
      const uiInputs = Object.fromEntries(
        fs
          .readdirSync(root)
          .filter((n) => /\.(js|html|css)$/.test(n))
          .sort()
          .map((n) => [
            n,
            crypto
              .createHash('sha256')
              .update(fs.readFileSync(path.join(root, n)))
              .digest('hex'),
          ])
      );
      fs.writeFileSync(
        path.join(directory, 'captures.json'),
        JSON.stringify(
          {
            fixture: 'guide-native-v1',
            appVersion: app.getVersion(),
            sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
              cwd: root,
              encoding: 'utf8',
              windowsHide: true,
            }).trim(),
            workingTree: 'Milestone 4 guide UI changes; exact source hashes below',
            window: { width: 1440, height: 1000 },
            displays: screen.getAllDisplays().map((d) => ({
              width: d.bounds.width,
              height: d.bounds.height,
              scaleFactor: d.scaleFactor,
            })),
            images: ['help-link.png', 'passive-detail.png'],
            uiInputs,
          },
          null,
          2
        )
      );
      results.push(
        'Captured real Help and passive HUD screenshots using original synthetic text; recorded app version, source hashes, dimensions and scaling.'
      );
    } else {
      results.push(
        'Help removes exactly the three replaced sections and retains setup, manual-tracker notes, backup controls/path, license, updates, shortcuts and display tips.'
      );
      const opened = [];
      let finish;
      guide.openPath = (file) => {
        opened.push(file);
        return new Promise((resolve) => {
          finish = resolve;
        });
      };
      controller.focus();
      controller.webContents.focus();
      await run(`document.querySelector('[data-action="open-guide"]').focus();`);
      controller.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
      controller.webContents.sendInputEvent({ type: 'char', keyCode: '\r' });
      controller.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
      try {
        await wait(() => opened.length === 1);
      } catch (error) {
        throw Error(
          error.message +
            ': ' +
            (await run(
              `return JSON.stringify({feedback:guideFeedback,focus:document.activeElement?.outerHTML,opening:guideOpening,toast:document.getElementById('toast').textContent});`
            ))
        );
      }
      await run(`openUserGuide();openUserGuide();`);
      assert.equal(opened.length, 1);
      assert.equal(
        await run(`return document.querySelector('[data-action="open-guide"]').disabled;`),
        true
      );
      finish('');
      await wait(() => run(`return !guideOpening;`));
      assert.equal(opened[0], path.join(root, 'docs', 'Tablelight-User-Guide.pdf'));
      assert.match(await run('return guideFeedback;'), /sent to your PDF viewer/);
      assert.equal(await run(`return document.activeElement.dataset.action;`), 'open-guide');
      assert.equal(JSON.stringify(getState()), before);
      assert.equal(await run('return history.length;'), undo);
      assert.deepEqual(fs.readFileSync(store.file), party);
      results.push(
        'Keyboard activation opens only this app’s PDF, coalesces repeated clicks, restores focus, and leaves saves and Undo unchanged.'
      );
      for (const code of ['ENOENT', 'EACCES']) {
        guide.readFile = async () => {
          throw Object.assign(Error('synthetic fault'), { code });
        };
        await click('[data-action="open-guide"]');
        await wait(() => run('return !guideOpening;'));
        assert.match(
          await run('return guideFeedback;'),
          code === 'ENOENT' ? /missing.*Reinstall/ : /cannot read.*Check access/
        );
      }
      guide.readFile = originalRead;
      for (const reject of [false, true]) {
        guide.openPath = async () => {
          if (reject) throw Error('synthetic viewer rejection');
          return 'No association';
        };
        await click('[data-action="open-guide"]');
        await wait(() => run('return !guideOpening;'));
        assert.match(await run('return guideFeedback;'), /default PDF app/);
      }
      guide.openPath = async (file) => {
        opened.push(file);
        return '';
      };
      await click('[data-action="open-guide"]');
      await wait(() => run('return !guideOpening;'));
      assert.match(await run('return guideFeedback;'), /sent to your PDF viewer/);
      results.push(
        'Missing/inaccessible files and both forms of viewer failure show actionable feedback; repairing the fault allows retry.'
      );
      assert.match(
        await run(
          `try{await api.openGuide('C:/unrelated.pdf');return '';}catch(e){return e.message;}`
        ),
        /does not accept/
      );
      const invoke = ipcMain._invokeHandlers.get('guide:open');
      assert.throws(
        () =>
          invoke(
            { sender: controller.webContents, senderFrame: controller.webContents.mainFrame },
            { path: 'C:/unrelated.pdf' }
          ),
        /does not accept/
      );
      assert.throws(
        () => invoke({ sender: controller.webContents, senderFrame: null }),
        /main DM page/
      );
      assert.match(
        await overlay.webContents.executeJavaScript(
          `window.tablelight.openGuide().then(()=>'',e=>e.message)`
        ),
        /DM window/
      );
      await run(`const real=api;api={...api,openGuide:undefined};await openUserGuide();api=real;`);
      assert.match(await run('return guideFeedback;'), /browser page is a development preview/);
      await run(
        `const real=api;api={...api,openGuide:async()=>{throw Error('bridge fault')}};await openUserGuide();api=real;`
      );
      assert.match(await run('return guideFeedback;'), /Try again/);
      results.push(
        'Overlay/subframe access and unexpected arguments are rejected; browser previews and failed bridge calls explain recovery.'
      );
      await click('[data-action="show-license"]');
      await wait(() =>
        run(
          `return document.querySelector('.license-text')?.textContent.includes('GNU GENERAL PUBLIC LICENSE');`
        )
      );
      await run('closeModal();');
      const backupFile = path.join(directory, 'synthetic-backup.json');
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: backupFile });
      await click('[data-action="export"]');
      await wait(() => fs.existsSync(backupFile));
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [backupFile] });
      await click('[data-action="import"]');
      await wait(() =>
        run(
          `return document.getElementById('modal-title')?.textContent==='Replace your current party?';`
        )
      );
      await run('closeModal();');
      assert.equal(JSON.stringify(getState()), before);
      assert.deepEqual(fs.readFileSync(store.file), party);
      results.push(
        'Retained license and backup export/restore controls work; canceling restore and opening the guide preserve the party.'
      );
      if (process.env.TABLELIGHT_GUIDE_REAL_VIEWER === '1') {
        guide.openPath = originalOpen;
        const value = await run('return await api.openGuide();');
        assert.equal(value.ok, true, value.message);
        results.push(
          'The Windows default viewer accepted this installed PDF through the real DM bridge.'
        );
      }
    }
    fs.writeFileSync(
      path.join(directory, 'guide-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'guide-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
  } finally {
    guide.openPath = originalOpen;
    guide.readFile = originalRead;
    dialog.showSaveDialog = originalSaveDialog;
    dialog.showOpenDialog = originalOpenDialog;
    setOverlay(false);
    app.quit();
  }
};
