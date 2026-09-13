/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
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
  const dir = path.dirname(store.directory),
    results = [];
  let overlay;
  const run = (win, code) => win.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (fn) => {
    const start = Date.now();
    while (!(await fn())) {
      if (Date.now() - start > 10000) throw new Error('Interactive check timed out');
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  const pause = () => new Promise((r) => setTimeout(r, 120));
  const center = async (win, selector) =>
    run(
      win,
      `const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing '+${JSON.stringify(selector)});el.scrollIntoView({block:'nearest',inline:'nearest'});const r=el.getBoundingClientRect();return{x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};`
    );
  async function mouseClick(win, selector) {
    const p = await center(win, selector);
    win.webContents.sendInputEvent({ type: 'mouseMove', ...p });
    await pause();
    win.webContents.sendInputEvent({ type: 'mouseDown', ...p, button: 'left', clickCount: 1 });
    win.webContents.sendInputEvent({ type: 'mouseUp', ...p, button: 'left', clickCount: 1 });
    await pause();
  }
  async function drag(win, selector, dx, dy) {
    const p = await center(win, selector);
    win.webContents.sendInputEvent({ type: 'mouseMove', ...p });
    await pause();
    win.webContents.sendInputEvent({ type: 'mouseDown', ...p, button: 'left', clickCount: 1 });
    for (let n = 1; n <= 5; n++) {
      win.webContents.sendInputEvent({
        type: 'mouseMove',
        x: Math.round(p.x + (dx * n) / 5),
        y: Math.round(p.y + (dy * n) / 5),
        button: 'left',
      });
      await new Promise((r) => setTimeout(r, 20));
    }
    win.webContents.sendInputEvent({
      type: 'mouseUp',
      x: p.x + dx,
      y: p.y + dy,
      button: 'left',
      clickCount: 1,
    });
    await pause();
  }
  const root = (id) => `.hud-position[data-hud-id="${id}"]`;
  const commandSelector = (id, type, extra = '') =>
    root(id) + ` button[data-hud-command*='"type":"${type}"']` + extra;
  try {
    await wait(() =>
      run(controller, `return Boolean(document.querySelector('[data-action="add-character"]'));`)
    );
    controller.setBounds({ width: 1440, height: 1000 });
    controller.showInactive();
    await run(
      controller,
      `commit(()=>{state.characters=Array.from({length:6},(_,i)=>{const c=TL.character(i);c.name='Player '+(i+1);c.hud.x=18+(i%3)*32;c.hud.y=i<3?25:74;c.hud.rotation=[0,90,180,270,30,315][i];return c;});selectedId=state.characters[0].id;state.activeId=selectedId;state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};state.settings.overlayInteractive=true;state.settings.soloExpand=false;view='display';});await saveQueue;`
    );
    const ids = getState().characters.map((c) => c.id);
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    overlay = getOverlay();
    await wait(() =>
      run(overlay, `return document.querySelectorAll('.bubble-controls').length===6;`)
    );
    await wait(() => overlay.isVisible());
    results.push('Six independent bubbles and six sets of rotation controls appear on the TV.');
    fs.writeFileSync(
      path.join(dir, '01-six-bubbles.png'),
      (await overlay.webContents.capturePage()).toPNG()
    );
    const untouched = JSON.stringify(getState().characters.slice(1));
    await drag(overlay, root(ids[0]) + ' .portrait', 140, 80);
    await wait(() => getState().characters[0].hud.x > 18);
    assert.equal(JSON.stringify(getState().characters.slice(1)), untouched);
    results.push(
      'Native mouse drag on one TV bubble moves only that character and saves its position.'
    );
    await mouseClick(
      overlay,
      commandSelector(ids[1], 'rotate', `[data-hud-command*='"amount":15']`)
    );
    await wait(() => getState().characters[1].hud.rotation === 105);
    assert.equal(getState().characters[0].hud.rotation, 0);
    results.push('A second character rotates independently using its own TV button.');
    await run(
      overlay,
      `window.testEvents=[];for(const name of ['pointerdown','pointerup','pointercancel','lostpointercapture','mouseup'])document.addEventListener(name,e=>window.testEvents.push({name,target:e.target.className,id:e.pointerId}),true);`
    );
    const beforeRotation = getState().characters[2].hud.rotation;
    await drag(overlay, root(ids[2]) + ' .hud-rotate-handle', 70, 45);
    await wait(() => getState().characters[2].hud.rotation !== beforeRotation);
    results.push('The rotation handle supports direct drag rotation on the TV.');
    await mouseClick(overlay, root(ids[0]) + ' .portrait');
    await wait(() => getState().characters[0].hud.expanded);
    await mouseClick(overlay, commandSelector(ids[1], 'expand'));
    await wait(() => getState().characters[1].hud.expanded);
    assert.equal(getState().characters[0].hud.expanded, true);
    assert.equal(getState().characters[1].hud.rotation, 105);
    assert.ok(
      await run(
        overlay,
        `return document.querySelector(${JSON.stringify(root(ids[1]))}).style.transform.includes('rotate(105deg)');`
      )
    );
    results.push('Two HUDs stay expanded simultaneously with their own rotations preserved.');
    const otherPose = TLClone(getState().characters[1].hud);
    await drag(overlay, root(ids[0]) + ' .hud-drag-handle', 80, 15);
    assert.deepEqual(getState().characters[1].hud, otherPose);
    results.push('Dragging an expanded HUD leaves the other expanded HUD in place.');
    // Leave room for both landscape cards before exercising their controls with real mouse input.
    await run(
      controller,
      `commit(()=>{state.characters[0].hud.x=25;state.characters[1].hud.x=77;for(const c of state.characters.slice(0,2))c.hud.scale=${Math.min(1, screen.getPrimaryDisplay().bounds.width / 2200)};});await saveQueue;`
    );
    await mouseClick(
      overlay,
      commandSelector(ids[0], 'economy', `[data-hud-command*='"key":"action"']`)
    );
    await wait(() => getState().characters[0].turn.action === false);
    assert.equal(getState().characters[1].turn.action, true);
    assert.equal(await run(controller, `return state.characters[0].turn.action;`), false);
    results.push(
      'TV turn controls update the correct character and immediately synchronize to the DM console.'
    );
    let shapeUpdates = 0;
    const setShape = overlay.setShape.bind(overlay);
    overlay.setShape = (regions) => {
      shapeUpdates++;
      return setShape(regions);
    };
    try {
      await mouseClick(overlay, commandSelector(ids[0], 'hp', `[data-hud-command*='"amount":-1']`));
      await wait(() => run(overlay, 'return state.characters[0].hp === 9;'));
      assert.equal(getState().characters[0].hp, 9);
      assert.equal(shapeUpdates, 0, 'HP updates must not rebuild unchanged native HUD regions.');
    } finally {
      overlay.setShape = setShape;
    }
    results.push('HP can be adjusted directly on an expanded TV HUD.');
    results.push('Live HP updates preserve the native clickable regions without rebuilding them.');
    await run(
      controller,
      `commit(()=>{const c=state.characters[0];c.resources=[{id:'test-energy',name:'Custom energy',current:2,max:2,reset:'manual'}];c.items=[TL.item({id:'test-option',name:'Custom option',economy:'bonus',resourceId:'test-energy',description:'User-entered test description.'})];});await saveQueue;`
    );
    await mouseClick(
      overlay,
      commandSelector(ids[0], 'panel', `[data-hud-command*='"panel":"bonus"']`)
    );
    await wait(() => getState().characters[0].hud.panel === 'bonus');
    await mouseClick(overlay, commandSelector(ids[0], 'detail'));
    await wait(() => getState().characters[0].hud.detailId === 'test-option');
    await mouseClick(overlay, commandSelector(ids[0], 'use'));
    await wait(() => getState().characters[0].resources[0].current === 1);
    assert.equal(getState().characters[0].turn.bonus, false);
    results.push(
      'An option can be opened and used entirely from the TV, consuming its linked action and charge.'
    );
    await mouseClick(overlay, commandSelector(ids[1], 'hide'));
    await wait(() => !getState().characters[1].hud.visible);
    assert.equal(
      await run(overlay, `return document.querySelectorAll('.hud-position').length;`),
      5
    );
    results.push('Each HUD can be hidden independently from its own controls.');
    const beforePreview = getState().characters[3].hud.rotation;
    await run(controller, `view='display';render();`);
    await pause();
    await mouseClick(
      controller,
      commandSelector(ids[3], 'rotate', `[data-hud-command*='"amount":15']`)
    );
    await wait(() => getState().characters[3].hud.rotation === (beforePreview + 15) % 360);
    results.push('Rotation controls also work independently in the laptop preview.');
    await drag(controller, root(ids[4]) + ' .portrait', 15, -12);
    results.push('Laptop preview portraits remain draggable with the new shared controls.');
    await run(controller, `commit(()=>state.settings.overlayInteractive=false);await saveQueue;`);
    await wait(() =>
      run(overlay, `return !document.body.classList.contains('overlay-interactive');`)
    );
    assert.equal(
      await run(
        overlay,
        `return document.querySelectorAll('.bubble-controls,.hud-toolstrip').length;`
      ),
      0
    );
    const before = JSON.stringify(getState());
    await drag(overlay, root(ids[0]) + ' .portrait', 10, 10);
    assert.equal(JSON.stringify(getState()), before);
    results.push('Click-through mode removes TV controls and prevents overlay interaction.');
    await run(controller, `commit(()=>state.settings.overlayInteractive=true);await saveQueue;`);
    await wait(() =>
      run(overlay, `return document.body.classList.contains('overlay-interactive');`)
    );
    const p = await center(overlay, root(ids[0]) + ' .portrait');
    overlay.webContents.sendInputEvent({ type: 'mouseMove', ...p });
    await pause();
    assert.equal(await run(overlay, 'return lastHit;'), true);
    overlay.webContents.sendInputEvent({ type: 'mouseMove', x: 5, y: 5 });
    await pause();
    assert.equal(await run(overlay, 'return lastHit;'), false);
    results.push('HUD hit testing captures clicks over a character and releases empty map space.');
    const saved = store.load().state;
    assert.deepEqual(
      saved.characters.map((c) => c.hud),
      getState().characters.map((c) => c.hud)
    );
    results.push(
      'Every character’s final position, rotation, expansion and visibility survive a save/reload.'
    );
    fs.writeFileSync(
      path.join(dir, '02-interactive-hud.png'),
      (await overlay.webContents.capturePage()).toPNG()
    );
    setOverlay(false);
    await run(controller, `view='display';render();`);
    await pause();
    fs.writeFileSync(
      path.join(dir, '03-laptop-layout.png'),
      (await controller.webContents.capturePage()).toPNG()
    );
    fs.writeFileSync(
      path.join(dir, 'results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    let debug;
    try {
      debug = overlay
        ? await run(
            overlay,
            `return {active:gesture.activeId,hit:lastHit,events:window.testEvents,notice:document.getElementById('overlay-notice').innerText,rotations:state.characters.map(c=>c.hud.rotation)};`
          )
        : null;
    } catch {}
    fs.writeFileSync(
      path.join(dir, 'results.json'),
      JSON.stringify({ passed: false, results, error: error.stack, debug }, null, 2)
    );
    try {
      fs.writeFileSync(
        path.join(dir, 'failure.png'),
        (await (overlay || controller).webContents.capturePage()).toPNG()
      );
    } catch {}
  } finally {
    setOverlay(false);
    app.quit();
  }
};
function TLClone(value) {
  return JSON.parse(JSON.stringify(value));
}
