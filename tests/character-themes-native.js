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
module.exports = async ({ app, controller, getOverlay, getState, setOverlay, store }) => {
  const directory = path.dirname(store.directory),
    results = [];
  const restarted = process.env.TABLELIGHT_TEST_RESTART === '1';
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const tv = (code) => getOverlay().webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (check) => {
    const start = Date.now();
    while (!(await check())) {
      if (Date.now() - start > 10000) throw Error('Character theme check timed out');
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  };
  const fill = (fields) =>
    run(`const form=document.getElementById('character-form');
    for(const [key,value] of Object.entries(${JSON.stringify(fields)}))form.elements.namedItem(key).value=value;`);
  const save = async () => {
    await run(`document.getElementById('character-form').requestSubmit();await saveQueue;`);
    await wait(() => run(`return !document.getElementById('character-form');`));
  };
  const edit = (id) => run(`editCharacter(false,${JSON.stringify(id)});`);
  const choose = async (id, theme) => {
    await edit(id);
    await fill({ theme });
    await save();
  };
  const pose = `return [...document.querySelectorAll('.hud-position')].map(el=>({id:el.dataset.hudId,left:el.style.left,top:el.style.top,transform:el.style.transform,width:el.offsetWidth,height:el.offsetHeight}));`;
  const renderedThemes = `return [...document.querySelectorAll('.hud-position')].map(el=>[el.dataset.hudId,el.dataset.hudTheme||'default']);`;
  const showOverlay = async () => {
    await setOverlay(true);
    await wait(() => getOverlay().isVisible());
    const { width, height } = getOverlay().getContentBounds();
    await wait(() => tv(`return innerWidth===${width}&&innerHeight===${height}&&!!state;`));
    await tv('paint();');
  };
  const shot = async (win, name) => {
    for (let attempt = 0; ; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      try {
        fs.writeFileSync(
          path.join(directory, name + '.png'),
          (await win.webContents.capturePage()).toPNG()
        );
        return;
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }
  };
  const originalOpen = dialog.showOpenDialog,
    originalSave = dialog.showSaveDialog;
  try {
    await wait(() => run('return Boolean(state);'));
    controller.setBounds({ width: 1440, height: 950 });
    controller.showInactive();
    if (restarted) {
      const expected = JSON.parse(
        fs.readFileSync(path.join(directory, 'character-themes-expected.json'), 'utf8')
      );
      assert.deepEqual(getState(), expected);
      await showOverlay();
      const first = getState().characters[0];
      await edit(first.id);
      assert.equal(
        await run(`return document.querySelector('[name="theme"]').value;`),
        first.theme
      );
      assert.deepEqual(
        await tv(renderedThemes),
        expected.characters
          .filter((c) => c.hud.visible)
          .map((c) => [c.id, Themes.get(c.theme) ? c.theme : 'default'])
      );
      results.push(
        'A fresh desktop process reloads all active/inactive theme choices and shared artwork, with matching dropdowns and player overlays.'
      );
    } else {
      await run(`await commit(()=>{state=TL.empty();},'Empty theme fixture');`);
      for (const choice of Themes.choices) {
        const before = TL.clone(getState());
        await run('editCharacter(true);');
        assert.deepEqual(
          await run(
            `return [...document.querySelector('[name="theme"]').options].map(o=>({id:o.value,name:o.textContent}));`
          ),
          Themes.choices
        );
        assert.equal(
          await run(`return document.querySelector('[name="theme"]').value;`),
          'default'
        );
        await fill({
          name: 'Synthetic ' + choice.name,
          className: 'Same entered class',
          theme: choice.id,
        });
        await run(`document.querySelector('[data-action="close-modal"]').click();`);
        assert.deepEqual(getState(), before);
        await run('editCharacter(true);');
        await fill({
          name: 'Synthetic ' + choice.name,
          className: 'Same entered class',
          theme: choice.id,
        });
        if (choice.id === 'artificer') await shot(controller, 'character-theme-create');
        await save();
        const c = getState().characters[0];
        assert.equal(c.theme, choice.id);
        const saved = TL.clone(getState());
        const alternate = choice.id === 'default' ? 'wizard' : 'default';
        await edit(c.id);
        await fill({ theme: alternate });
        await run(`document.querySelector('[data-action="close-modal"]').click();`);
        assert.deepEqual(getState(), saved);
        await edit(c.id);
        await fill({ theme: alternate, className: 'Different homebrew class' });
        await save();
        assert.equal(getState().characters[0].theme, alternate);
        await run('await undo();');
        assert.deepEqual(getState(), saved);
        await run('await undo();');
        assert.deepEqual(getState(), before);
      }
      results.push(
        'All 14 choices work in Create and Edit, including Cancel and Undo; class text never selects a palette.'
      );

      const fixture = TL.empty();
      fixture.settings.hudControlsVersion = 1;
      fixture.settings.soloExpand = false;
      fixture.settings.overlayInteractive = true;
      fixture.characters = Array.from({ length: 8 }, (_, i) => {
        const c = TL.character(i);
        Object.assign(c, {
          name: 'Theme player ' + (i + 1),
          className: 'Same entered class',
          theme: Themes.choices[i + 1].id,
        });
        c.resources = [
          {
            id: 'focus',
            name: 'Focus',
            max: 8,
            current: 6,
            reset: 'long',
            icon: 'star',
            color: '#192233',
          },
        ];
        Object.assign(c.hud, {
          expanded: i === 0,
          visible: i !== 7,
          panel: 'action',
          scale: 0.6,
          rotation: (i % 4) * 90,
          x: i === 0 ? 30 : 75,
          y: i === 0 ? 50 : 10 + i * 10,
        });
        return c;
      });
      fixture.roster = [
        { ...TL.character(), name: 'Saved future theme', theme: 'future-"<palette>' },
      ];
      fixture.library = [
        TL.libraryEntry({
          id: 'illustrated',
          name: 'Synthetic shared ability',
          economy: 'free',
          icon: dataUrl(png(2, 1)),
          description: 'Synthetic ability. '.repeat(100),
        }),
      ];
      for (const c of TL.allCharacters(fixture))
        TL.attachItem(fixture, c.id, 'illustrated', {
          resourceId: c.resources[0]?.id || '',
          resourceCost: 1,
        });
      await run(
        `await commit(()=>{state=TL.normalize(${JSON.stringify(fixture)});},'Eight themes');view='display';render();`
      );
      await showOverlay();
      await wait(() => tv(`return document.querySelectorAll('.hud-position').length===7;`));
      const beforePose = await tv(pose);
      for (const [i, c] of fixture.characters.entries()) {
        const expected = TL.clone(getState());
        expected.characters[i].theme = Themes.choices[i + 2].id;
        await choose(c.id, expected.characters[i].theme);
        assert.deepEqual(getState(), expected);
        await wait(() =>
          tv(
            `return state.characters[${i}].theme===${JSON.stringify(expected.characters[i].theme)};`
          )
        );
        assert.deepEqual(await tv(pose), beforePose);
      }
      assert.equal(getState().characters[7].hud.visible, false);
      await run(
        `await commit(()=>{state.characters[7].hud.visible=true;});view='display';render();`
      );
      await wait(() => tv(`return document.querySelectorAll('.hud-position').length===8;`));
      assert.deepEqual(await run(renderedThemes), await tv(renderedThemes));
      assert.equal(new Set((await tv(renderedThemes)).map(([, theme]) => theme)).size, 8);
      await shot(controller, 'character-theme-eight-previews');
      await shot(getOverlay(), 'character-theme-eight-overlays');
      results.push(
        'Eight same-class players keep independent palettes, colors, shared images, resources and geometry; hidden/collapsed bubbles and all four rotations retain their settings.'
      );

      const playerId = fixture.characters[0].id;
      await edit(playerId);
      await fill({ theme: 'wizard' });
      await tv(
        `await window.tablelight.hudCommand({type:'hp',characterId:${JSON.stringify(playerId)},amount:-2,sessionId:state.approvalSessionId,commandId:TL.uid()});`
      );
      await tv(
        `await window.tablelight.hudCommand({type:'use',characterId:${JSON.stringify(playerId)},itemId:state.characters[0].items[0].id,sessionId:state.approvalSessionId,commandId:TL.uid()});`
      );
      const afterSpending = TL.clone(getState());
      const pending = await run('return approvalState.pending;');
      await save();
      const expected = TL.clone(afterSpending);
      expected.characters[0].theme = 'wizard';
      assert.deepEqual(getState(), expected);
      assert.deepEqual(await run('return approvalState.pending;'), pending);
      await wait(() => tv(`return state.characters[0].theme==='wizard';`));
      const reservedBefore = await tv('return state.characters[0].resources[0].current;');
      assert.equal(reservedBefore, 5);
      await run('await undo();');
      assert.deepEqual(getState(), afterSpending);
      assert.deepEqual(await run('return approvalState.pending;'), pending);
      await choose(playerId, 'wizard');
      results.push(
        'Saving and undoing a theme edit preserves later player HP changes and pending ability reservations.'
      );

      const savedId = fixture.roster[0].id;
      await edit(savedId);
      assert.equal(
        await run(`return document.querySelector('[name="theme"]').value;`),
        fixture.roster[0].theme
      );
      assert.equal(
        await run(
          `return document.querySelector('[name="theme"]').selectedOptions[0].textContent;`
        ),
        'Default (saved theme unavailable)'
      );
      await fill({ name: 'Renamed saved player' });
      await save();
      assert.equal(TL.findCharacter(getState(), savedId).theme, fixture.roster[0].theme);
      await run(
        `await commit(()=>{TL.removeFromParty(state,state.characters[7].id);TL.addToParty(state,${JSON.stringify(savedId)});});`
      );
      await wait(() => tv(`return Boolean(document.querySelector('[data-hud-id="${savedId}"]'));`));
      assert.equal(
        await tv(
          `return document.querySelector('[data-hud-id="${savedId}"]').dataset.hudTheme||'default';`
        ),
        'default'
      );
      await choose(savedId, 'default');
      assert.equal(TL.findCharacter(getState(), savedId).theme, 'default');
      await run('await undo();');
      assert.equal(TL.findCharacter(getState(), savedId).theme, fixture.roster[0].theme);
      await run(
        `await commit(()=>{TL.removeFromParty(state,${JSON.stringify(savedId)});TL.addToParty(state,${JSON.stringify(fixture.characters[7].id)});});`
      );
      results.push(
        'Unknown saved choices safely display Default, survive unrelated edits and remove/rejoin, and can be explicitly replaced with Default or recovered with Undo.'
      );

      await setOverlay(false);
      await choose(playerId, 'artificer');
      assert.equal(getOverlay().isVisible(), false);
      await showOverlay();
      await wait(() => tv(`return state.characters[0].theme==='artificer';`));
      await run(`await commit(()=>{state.settings.overlayInteractive=false;});`);
      await choose(playerId, 'wizard');
      await wait(() =>
        tv(`return state.characters[0].theme==='wizard'&&!state.settings.overlayInteractive;`)
      );
      await assert.rejects(
        tv(
          `return window.tablelight.hudCommand({type:'expand',characterId:${JSON.stringify(playerId)}});`
        ),
        /click-through/
      );
      assert.equal(getState().settings.overlayInteractive, false);
      assert.ok(
        getState()
          .characters.slice(1)
          .every((c) => !c.hud.expanded)
      );
      results.push(
        'Hidden TV windows stay hidden during theme edits; DM changes reach click-through overlays without changing interaction mode or collapsed state.'
      );

      const backupFile = path.join(directory, 'theme-export.json');
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: backupFile });
      assert.equal(await run('return api.exportParty();'), true);
      const exported = fs.readFileSync(backupFile, 'utf8');
      assert.equal(exported.split(getState().library[0].icon).length - 1, 1);
      const exportedState = TL.normalize(JSON.parse(exported));
      await choose(playerId, 'default');
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [backupFile] });
      await run(
        `const imported=await api.importParty();window.themeRestore=commit(()=>{state=imported;},'Restore themes',true,[],true);`
      );
      await wait(() => run(`return !!document.querySelector('[data-guard-continue]');`));
      await run(
        `document.querySelector('[data-guard-continue]').click();await window.themeRestore;`
      );
      assert.deepEqual(getState(), exportedState);
      assert.deepEqual(new Store(store.directory).load().state, exportedState);
      assert.equal(TL.findCharacter(getState(), savedId).theme, fixture.roster[0].theme);
      fs.writeFileSync(
        path.join(directory, 'character-themes-expected.json'),
        JSON.stringify(getState())
      );
      results.push(
        'Native backup export/import restores active/inactive themes and unknown IDs while storing the shared image once.'
      );
    }
    fs.writeFileSync(
      path.join(
        directory,
        restarted ? 'character-themes-restart-results.json' : 'character-themes-results.json'
      ),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    await shot(controller, 'character-theme-failure').catch(() => {});
    fs.writeFileSync(
      path.join(
        directory,
        restarted ? 'character-themes-restart-results.json' : 'character-themes-results.json'
      ),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
  } finally {
    dialog.showOpenDialog = originalOpen;
    dialog.showSaveDialog = originalSave;
    setOverlay(false);
    app.quit();
  }
};
