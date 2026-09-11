/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
module.exports = async function ({
  app,
  controller,
  getOverlay,
  getState,
  screen,
  setOverlay,
  store,
}) {
  const directory = path.dirname(store.directory),
    results = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (fn) => {
    const start = Date.now();
    while (!(await fn())) {
      if (Date.now() - start > 6000) throw new Error('Layout check timed out');
      await new Promise((r) => setTimeout(r, 50));
    }
  };
  try {
    await wait(() =>
      run(`return Boolean(document.querySelector('[data-action="add-character"]'));`)
    );
    controller.showInactive();
    await run(
      `commit(()=>{state.characters=[TL.character()];selectedId=state.characters[0].id;state.activeId=selectedId;state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};selected().hud.x=35;selected().hud.y=50;view='display';});await saveQueue;`
    );
    await wait(() => run(`return Boolean(document.querySelector('.preview .hud-position'));`));
    const point = await run(
      `const r=document.querySelector('.preview .hud-position').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};`
    );
    controller.webContents.sendInputEvent({ type: 'mouseMove', ...point });
    controller.webContents.sendInputEvent({
      type: 'mouseDown',
      ...point,
      button: 'left',
      clickCount: 1,
    });
    controller.webContents.sendInputEvent({
      type: 'mouseMove',
      x: point.x + 50,
      y: point.y + 30,
      button: 'left',
    });
    controller.webContents.sendInputEvent({
      type: 'mouseUp',
      x: point.x + 50,
      y: point.y + 30,
      button: 'left',
      clickCount: 1,
    });
    await wait(() => getState().characters[0].hud.x > 35);
    assert.ok(getState().characters[0].hud.y > 50);
    results.push('Dragging a portrait with native mouse input changes and saves its position.');
    await run(
      `commit(()=>{selected().hud.expanded=true;selected().hud.rotation=270;selected().hud.panel='sheet';});await saveQueue;`
    );
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    const expected = screen.getPrimaryDisplay().bounds;
    await wait(() => JSON.stringify(getOverlay().getBounds()) === JSON.stringify(expected));
    await wait(() =>
      getOverlay().webContents.executeJavaScript('Boolean(document.querySelector(".hud-card"))')
    );
    const previewHeight = await run(
      'return document.querySelector("#preview-stage .hud-card").offsetHeight;'
    );
    const tvHeight = await getOverlay().webContents.executeJavaScript(
      'document.querySelector(".hud-card").offsetHeight'
    );
    assert.equal(previewHeight, tvHeight);
    results.push(
      'The laptop preview uses the same expanded HUD dimensions and controls as the TV.'
    );
    setOverlay(false);
    setOverlay(true);
    assert.deepEqual(getOverlay().getBounds(), expected);
    results.push('Hiding and reopening the same overlay preserves full display coverage.');
    setOverlay(false);
    controller.setBounds({ width: 960, height: 720 });
    await new Promise((r) => setTimeout(r, 250));
    const layout = await run(
      `return {scroll:document.documentElement.scrollWidth,width:innerWidth,preview:document.getElementById('preview').getBoundingClientRect().width};`
    );
    assert.ok(layout.scroll <= layout.width + 1);
    assert.ok(layout.preview > 0);
    results.push('The placement page fits a small laptop window without horizontal overflow.');
    fs.writeFileSync(
      path.join(directory, 'small-layout.png'),
      (await controller.webContents.capturePage()).toPNG()
    );
    await run(`view='character';render();`);
    await new Promise((r) => setTimeout(r, 200));
    assert.ok(await run(`return document.documentElement.scrollWidth<=innerWidth+1;`));
    fs.writeFileSync(
      path.join(directory, 'small-console.png'),
      (await controller.webContents.capturePage()).toPNG()
    );
    results.push('The DM console fits a small laptop window without horizontal overflow.');
    fs.writeFileSync(
      path.join(directory, 'layout-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'layout-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
  } finally {
    setOverlay(false);
    app.quit();
  }
};
