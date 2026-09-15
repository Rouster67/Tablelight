/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { dialog } = require('electron');
const TL = require('../core');
const { png } = require('./icon-fixtures');
module.exports = async ({ app, controller, getOverlay, getState, setOverlay, store }) => {
  const directory = path.dirname(store.directory),
    results = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const tv = (code) => getOverlay().webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (check) => {
    const start = Date.now();
    while (!(await check())) {
      if (Date.now() - start > 10000) throw new Error('Ability image UI check timed out');
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  };
  const click = (selector) =>
    run(
      `const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing '+${JSON.stringify(selector)});el.click();`
    );
  const submit = () => run(`document.getElementById('item-form').requestSubmit();await saveQueue;`);
  const upload = async () => {
    await run(`window.iconJob=document.querySelector('[data-icon-upload]').onclick();`);
    await run(`await window.iconJob;`);
  };
  const shot = async (window, name) => {
    for (let i = 0; ; i++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      try {
        fs.writeFileSync(
          path.join(directory, name + '.png'),
          (await window.webContents.capturePage()).toPNG()
        );
        return;
      } catch (error) {
        if (i === 3) throw error;
      }
    }
  };
  const originalDialog = dialog.showOpenDialog;
  try {
    controller.setBounds({ width: 1440, height: 950 });
    controller.showInactive();
    const redFile = path.join(directory, 'wide-art.png'),
      blueFile = path.join(directory, 'tall-art.png'),
      badFile = path.join(directory, 'damaged.png');
    fs.writeFileSync(redFile, png(600, 300, { pixel: [235, 95, 70, 190] }));
    fs.writeFileSync(blueFile, png(150, 300, { pixel: [60, 170, 245, 180] }));
    fs.writeFileSync(badFile, 'This is not a PNG');
    const choose = (file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    };
    const fixture = TL.empty();
    fixture.characters = [TL.character(), TL.character(1)];
    fixture.roster = [TL.character(2)];
    fixture.settings.overlayInteractive = true;
    fixture.settings.soloExpand = false;
    fixture.library = [
      TL.libraryEntry({
        id: 'shared',
        name: 'Prismatic beacon',
        kind: 'spell',
        economy: 'free',
        description: 'A synthetic ability for image testing.',
        range: 'Self',
      }),
    ];
    for (const [index, c] of TL.allCharacters(fixture).entries()) {
      c.name = ['Arden', 'Bryn', 'Casey'][index];
      c.resources = [
        {
          id: 'focus',
          name: 'Focus',
          max: 10,
          current: 8 - index,
          reset: 'manual',
          color: '#71c6ac',
          icon: 'diamond',
        },
      ];
      TL.attachItem(fixture, c.id, 'shared', {
        resourceId: 'focus',
        resourceCost: index + 1,
        disabled: index === 2,
      });
      Object.assign(c.hud, {
        expanded: true,
        visible: true,
        panel: 'spell',
        rotation: index * 90,
        scale: 0.6,
        x: 25 + index * 35,
        y: 50,
      });
    }
    await run(
      `await commit(()=>{state=TL.normalize(${JSON.stringify(fixture)});},'Image UI fixture');selectedId=state.characters[0].id;view='character';tab='spell';render();editLibraryEntry('shared');`
    );
    choose(redFile);
    await upload();
    await wait(() => run(`return !!document.querySelector('[data-icon-preview] .image-ready');`));
    const red = await run(`return document.querySelector('[data-icon-preview] img').src;`);
    assert.equal(getState().library[0].icon, '');
    assert.equal(
      await run(`return document.querySelector('[data-icon-upload]').textContent;`),
      'Replace image'
    );
    await shot(controller, 'ability-image-editor');
    await submit();
    assert.ok(TL.allCharacters(getState()).every((c) => c.items[0].icon === red));
    results.push(
      'Upload previews the complete image and saves it to two active characters and one inactive linked character.'
    );

    await run(`view='library';render();`);
    await wait(() => run(`return !!document.querySelector('#library-list .image-ready');`));
    await shot(controller, 'ability-image-library');
    await run(`chooseLibraryEntry(state.characters[0].id);`);
    assert.equal(await run(`return document.querySelector('#library-picker-list img').src;`), red);
    await run(`attachLibraryEntry('shared',state.characters[0].id);`);
    assert.equal(
      await run(`return document.querySelector('#attach-form .ability-thumbnail img').src;`),
      red
    );
    await run(
      `closeModal();view='character';render();showItem(state.characters[0].items[0].id);await saveQueue;`
    );
    assert.equal(
      await run(`return document.querySelector('#ability-list .ability-thumbnail img').src;`),
      red
    );
    assert.equal(
      await run(`return document.querySelector('#ability-details .ability-thumbnail img').src;`),
      red
    );
    await run(`closeModal();`);
    await run(
      `await commit(()=>{state.characters[0].hud.detailId='';state.characters[0].hud.panel='spell';},'Show list');`
    );
    await setOverlay(true);
    await wait(() =>
      tv(`return document.querySelectorAll('.hud-option .image-ready').length===2;`)
    );
    await run(
      `await commit(()=>{state.characters[0].hud.detailId=state.characters[0].items[0].id;},'Show details');`
    );
    await wait(() =>
      tv(`return !!document.querySelector('.ability-detail-heading .image-ready');`)
    );
    await shot(getOverlay(), 'ability-image-tv');
    results.push(
      'Library, picker, assignment preview, character list/details, and rotated TV list/details use the same fitted thumbnail.'
    );

    await run(`editLibraryEntry('shared',state.characters[0].id,state.characters[0].items[0].id);`);
    choose(blueFile);
    await upload();
    const blue = await run(`return document.querySelector('[data-icon-preview] img').src;`);
    await run(
      `await commit(()=>{state.characters[0].resources[0].current=3;state.characters[1].items[0].disabled=true;state.characters[0].hud.page=0;},'Live resource change');`
    );
    const live = TL.allCharacters(getState()).map((c) => ({
      resources: c.resources,
      hud: c.hud,
      cost: c.items[0].resourceCost,
      disabled: c.items[0].disabled,
    }));
    await submit();
    assert.ok(TL.allCharacters(getState()).every((c) => c.items[0].icon === blue));
    assert.deepEqual(
      TL.allCharacters(getState()).map((c) => ({
        resources: c.resources,
        hud: c.hud,
        cost: c.items[0].resourceCost,
        disabled: c.items[0].disabled,
      })),
      live
    );
    await run(`editLibraryEntry('shared');`);
    await click('[data-icon-remove]');
    await run(`closeModal();`);
    assert.equal(getState().library[0].icon, blue);
    await run(`editLibraryEntry('shared');`);
    await click('[data-icon-remove]');
    await submit();
    assert.ok(TL.allCharacters(getState()).every((c) => c.items[0].icon === ''));
    await run(`await undo();await saveQueue;`);
    assert.equal(getState().library[0].icon, blue);
    results.push(
      'Replace preserves intervening resource spending and independent costs, availability and HUD settings; Remove, Cancel and Undo retain their expected behavior.'
    );

    await run(`editLibraryEntry('shared');`);
    choose(badFile);
    await upload();
    assert.ok(await run(`return document.querySelector('[data-icon-error]').textContent;`));
    assert.equal(await run(`return document.querySelector('[data-icon-preview] img').src;`), blue);
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
    await upload();
    assert.equal(await run(`return document.querySelector('[data-icon-preview] img').src;`), blue);
    let finishPicker;
    dialog.showOpenDialog = () =>
      new Promise((resolve) => {
        finishPicker = resolve;
      });
    await run(
      `window.iconJob=document.querySelector('[data-icon-upload]').onclick();document.getElementById('item-form').requestSubmit();`
    );
    assert.equal(await run(`return document.querySelector('[form="item-form"]').disabled;`), true);
    await wait(() => Boolean(finishPicker));
    await run(`closeModal();editLibraryEntry('',state.characters[0].id,'',true);`);
    finishPicker({ canceled: false, filePaths: [redFile] });
    await run(`await window.iconJob;`);
    assert.equal(
      await run(`return document.querySelector('[data-icon-preview] img')===null;`),
      true
    );
    assert.equal(getState().library[0].icon, blue);
    await run(
      `closeModal();await commit(()=>TL.copyLibraryItemLocally(state,state.characters[0].id,'shared'),'Local copy');editLibraryEntry('',state.characters[0].id,state.characters[0].items.at(-1).id);`
    );
    await click('[data-icon-remove]');
    await submit();
    assert.equal(getState().characters[0].items.at(-1).icon, '');
    assert.equal(getState().library[0].icon, blue);
    results.push(
      'Invalid input, picker cancellation, and late upload completion leave saved art intact; character-only copies keep independent images.'
    );

    await run(
      `editLibraryEntry('');document.querySelector('#item-form [name=name]').value='New illustrated feature';document.querySelector('#item-form [name=kind]').value='feature';`
    );
    choose(redFile);
    await upload();
    await submit();
    assert.equal(getState().library.find((e) => e.name === 'New illustrated feature').icon, red);
    const geometry = await tv(
      `const frame=document.querySelector('.ability-detail-heading .ability-thumbnail');const card=frame.closest('.hud-card');return [frame.offsetWidth,frame.offsetHeight,card.offsetWidth,card.offsetHeight];`
    );
    await tv(
      `const img=document.querySelector('.ability-detail-heading .ability-thumbnail img');img.src='data:image/png;base64,AAAA';`
    );
    await wait(() =>
      tv(`return document.querySelector('.ability-detail-heading .ability-thumbnail img')===null;`)
    );
    assert.deepEqual(
      await tv(
        `const f=document.querySelector('.ability-detail-heading .ability-thumbnail');const c=f.closest('.hud-card');return [f.offsetWidth,f.offsetHeight,c.offsetWidth,c.offsetHeight];`
      ),
      geometry
    );
    assert.equal(
      await tv(
        `return getComputedStyle(document.querySelector('.ability-detail-heading .ability-thumbnail>span')).visibility;`
      ),
      'visible'
    );
    await run(
      `await commit(()=>{state.characters[0].hud.expanded=false;state.characters[1].hud.visible=false;state.settings.overlayInteractive=false;},'Hidden and click-through check');`
    );
    await wait(() =>
      tv(
        `return document.querySelectorAll('.hud-position').length===1 && !!document.querySelector('.hud-collapsed');`
      )
    );
    assert.equal(await tv(`return document.querySelectorAll('.ability-thumbnail').length;`), 0);
    await assert.rejects(
      getOverlay().webContents.executeJavaScript(
        `window.tablelight.hudCommand({type:'expand',characterId:${JSON.stringify(fixture.characters[0].id)}})`
      ),
      /click-through/
    );
    const copyDirectory = path.join(directory, 'fresh-restore');
    const { Store } = require('../storage');
    const fresh = new Store(copyDirectory);
    fresh.save(TL.toBackup(getState()));
    assert.deepEqual(fresh.load().state, store.load().state);
    results.push(
      'New illustrated entries save correctly; broken art retains its symbol and frame size; hidden/collapsed and click-through overlays remain consistent; a fresh restore retains shared/local images.'
    );

    await run(`await commit(()=>{
      state.characters=Array.from({length:8},(_,i)=>TL.character(i));
      state.settings.overlayInteractive=true;
      for(const [i,c] of state.characters.entries()){
        TL.attachItem(state,c.id,'shared');
        Object.assign(c.hud,{expanded:true,visible:true,panel:'spell',rotation:(i%4)*90,scale:.4+(i%4)*.1,x:15+(i%4)*23,y:25+Math.floor(i/4)*50});
      }
    },'Eight image overlays');view='display';render();`);
    await wait(() =>
      tv(`return document.querySelectorAll('.hud-option .image-ready').length===8;`)
    );
    await wait(() =>
      run(`return document.querySelectorAll('#preview-stage .hud-option .image-ready').length===8;`)
    );
    const shapes = await tv(
      `return [...document.querySelectorAll('.hud-position')].map(el=>({transform:el.style.transform,width:el.querySelector('.ability-thumbnail').offsetWidth,height:el.querySelector('.ability-thumbnail').offsetHeight,fit:getComputedStyle(el.querySelector('.ability-thumbnail img')).objectFit}));`
    );
    assert.ok(shapes.every((s) => s.width === 30 && s.height === 30 && s.fit === 'contain'));
    for (const angle of [0, 90, 180, 270])
      assert.ok(shapes.some((s) => s.transform.includes('rotate(' + angle + 'deg)')));
    await shot(controller, 'ability-image-eight-preview');
    results.push(
      'Eight players and matching DM previews retain 30-pixel thumbnail frames at all four table orientations and several independent scales.'
    );

    fs.writeFileSync(
      path.join(directory, 'ability-icons-ui-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    await shot(controller, 'ability-image-failure').catch(() => {});
    fs.writeFileSync(
      path.join(directory, 'ability-icons-ui-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
  } finally {
    dialog.showOpenDialog = originalDialog;
    setOverlay(false);
    app.quit();
  }
};
