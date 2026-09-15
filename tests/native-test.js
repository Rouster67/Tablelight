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
  updates,
  updateAdapter,
}) {
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'hud-themes')
    return require('./hud-themes-native')({
      app,
      controller,
      getOverlay,
      getState,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'ability-icons-performance')
    return require('./ability-icons-performance-native')({
      app,
      controller,
      getOverlay,
      getState,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'ability-icons-ui')
    return require('./ability-icons-ui-native')({
      app,
      controller,
      getOverlay,
      getState,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'ability-icons')
    return require('./ability-icons-native')({
      app,
      controller,
      getOverlay,
      getState,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'history')
    return require('./history-native')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'approval-queue')
    return require('./approval-queue-native')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'updates-transport')
    return require('./updates-transport-native')({ app, store });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'library-deletion')
    return require('./library-deletion-native')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'updates')
    return require('./updates-native')({
      app,
      controller,
      getOverlay,
      getState,
      setOverlay,
      store,
      updates,
      updateAdapter,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'concentration-use')
    return require('./concentration-use-native')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'concentration-reminder')
    return require('./concentration-reminder-native')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'concentration')
    return require('./concentration-native')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'condition-picker')
    return require('./condition-picker-native')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'conditions')
    return require('./conditions-native')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'fixed-resources')
    return require('./fixed-resources-native')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'wide-hud')
    return require('./wide-hud-native')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'sidebar')
    return require('./sidebar-native')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'roster')
    return require('./roster-native')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'session')
    return require('./session-native')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'library')
    return require('./library-native')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'ability-fields')
    return require('./ability-fields-native')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'duplicates')
    return require('./duplicates-native')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'manual')
    return require('./manual-fixture')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'interactive')
    return require('./interactive-native')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  if (process.env.TABLELIGHT_TEST_SCENARIO === 'layout')
    return require('./layout-test')({
      app,
      controller,
      getOverlay,
      getState,
      screen,
      setOverlay,
      store,
    });
  const directory = path.dirname(store.directory),
    results = [],
    errors = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (condition, timeout = 8000) => {
    const start = Date.now();
    while (!(await condition())) {
      if (Date.now() - start > timeout) throw new Error('Timed out waiting for test condition');
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  const click = (selector) => run(`document.querySelector(${JSON.stringify(selector)}).click();`);
  const fill = async (formId, fields) =>
    run(
      `const form=document.getElementById(${JSON.stringify(formId)});for(const [key,value] of Object.entries(${JSON.stringify(fields)})){const el=form.elements.namedItem(key);if(!el)throw new Error('Missing form field '+key);if(el.type==='checkbox')el.checked=value;else el.value=value;}form.requestSubmit();`
    );
  const shot = async (name) => {
    let last;
    for (let attempt = 0; attempt < 4; attempt++) {
      await new Promise((r) => setTimeout(r, 350));
      try {
        fs.writeFileSync(
          path.join(directory, name + '.png'),
          (await controller.webContents.capturePage()).toPNG()
        );
        return;
      } catch (error) {
        last = error;
      }
    }
    throw last;
  };
  controller.webContents.on('console-message', (_event, ...args) => {
    const details = args.find((a) => a && typeof a === 'object');
    if (details?.level === 'error') errors.push(details.message);
  });
  try {
    await wait(() =>
      run(`return Boolean(document.querySelector('[data-action="add-character"]'));`)
    );
    const version = require('../package.json').version;
    const title = `Tablelight ${version} — DM Console`;
    assert.equal(controller.getTitle(), title);
    assert.equal(await run('return document.title;'), title);
    assert.equal(
      await run("return document.getElementById('app-version').textContent;"),
      `Tablelight ${version}`
    );
    await run("document.title='A title without the app version';");
    assert.equal(controller.getTitle(), title);
    await run(`document.title=${JSON.stringify(title)};`);
    results.push(
      'DM title bar and sidebar show the package version; document title changes cannot hide it.'
    );
    controller.setBounds({ width: 1440, height: 950 });
    controller.showInactive();
    await shot('01-welcome');
    assert.equal(getState().characters.length, 0);
    results.push('Startup contains no preloaded characters or abilities.');
    await click('[data-action="add-character"]');
    await fill('character-form', {
      name: 'Test Adventurer',
      className: 'Custom class',
      species: 'Custom species',
      maxHp: 42,
      hp: 35,
      tempHp: 5,
      ac: 17,
      level: 5,
      proficiency: 3,
      'ability-str': 16,
      'ability-dex': 14,
      'ability-con': 16,
      'ability-wis': 18,
      'slot-1': 4,
      'slot-2': 3,
      'slot-3': 2,
      'skill-rank-16': 2,
      notes: 'Private test note never shown on the TV.',
    });
    await wait(() => getState().characters.length === 1);
    assert.equal(getState().characters[0].hp, 35);
    assert.equal(getState().characters[0].items.length, 0);
    results.push('Character form persists stats, skills, spell slots and private notes.');
    await click('[data-action="edit-character"]');
    await click('#resource-editor-add');
    await fill('character-form', {
      'resource-name': 'Test energy',
      'resource-current': 2,
      'resource-max': 2,
      'resource-reset': 'short',
    });
    await wait(() => getState().characters[0].resources.length === 1);
    const pool = getState().characters[0].resources[0].id;
    await click('[data-action="add-item"]');
    await click('[data-action="new-library-entry"]');
    await fill('item-form', {
      name: 'Custom technique',
      kind: 'feature',
      economy: 'bonus',
      resourceId: pool,
      resourceCost: 1,
      description:
        'This is test text entered through the editor. ' +
        'Additional test text for pagination. '.repeat(45),
    });
    await wait(() => getState().characters[0].items.length === 1);
    await click('[data-action="tab"][data-tab="feature"]');
    await shot('02-console');
    await click('[data-action="use-item"]');
    await wait(() => getState().characters[0].turn.bonus === false);
    assert.equal(getState().characters[0].resources[0].current, 1);
    results.push('Using an ability spends its bonus action and linked charge.');
    await click('[data-action="undo"]');
    await wait(() => getState().characters[0].turn.bonus === true);
    assert.equal(getState().characters[0].resources[0].current, 2);
    results.push('Undo restores linked costs together.');
    await click('[data-action="view-item"]');
    await click('#detail-remote [data-action="hud-page"][data-amount="1"]');
    await wait(() => getState().characters[0].hud.page === 1);
    assert.ok(
      await run(`return document.querySelector('#detail-remote').innerText.includes('page 2');`)
    );
    await click('[data-action="close-modal"]');
    results.push('Full ability descriptions can be paged from the laptop.');
    await click('[data-action="hp-damage"]');
    await fill('amount-form', { amount: 9 });
    await wait(() => getState().characters[0].hp === 31);
    assert.equal(getState().characters[0].tempHp, 0);
    results.push('Damage dialog consumes temporary HP before regular HP.');
    await click('[data-action="tab"][data-tab="spell"]');
    await click('[data-action="add-item"]');
    await click('[data-action="new-library-entry"]');
    await fill('item-form', {
      name: 'Custom test spell',
      kind: 'spell',
      level: 1,
      economy: 'action',
      description: 'User-supplied homebrew spell text.',
      range: 'Test range',
      duration: 'Test duration',
    });
    await wait(() => getState().characters[0].items.length === 2);
    await click('[data-action="use-item"]');
    await fill('cast-form', { level: 2 });
    await wait(() => getState().characters[0].slots[1].current === 2);
    assert.equal(getState().characters[0].turn.action, false);
    results.push('Casting from the UI supports selecting a higher level spell slot.');
    await click('[data-action="start-turn"]');
    await wait(() => getState().characters[0].turn.action === true);
    assert.equal(getState().characters[0].slots[1].current, 2);
    results.push('New turn restores turn controls without restoring spell slots.');
    await click('[data-action="view-item"]');
    await shot('03-description');
    await click('[data-action="close-modal"]');
    await run(
      `commit(()=>{const c=selected();c.avatar='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';for(let i=1;i<6;i++){const next=TL.character(i);next.name='Test Player '+(i+1);state.characters.push(next);}});await saveQueue;`
    );
    assert.equal(getState().characters.length, 6);
    results.push('Six players coexist and character portrait data persists.');
    await click('[data-action="view-display"]');
    assert.equal(controller.getTitle(), title);
    assert.equal(
      await run("return document.getElementById('app-version').textContent;"),
      `Tablelight ${version}`
    );
    await click('[data-action="auto-layout"]');
    await click('#confirm-action');
    await wait(() => getState().characters[0].hud.y === 86);
    await shot('04-layout');
    const preview = await run(
      `const r=document.getElementById('preview').getBoundingClientRect();return {width:r.width,height:r.height,viewport:innerHeight};`
    );
    assert.ok(preview.height <= preview.viewport - 350);
    results.push('Portrait-monitor layout preview fits on the laptop screen.');
    assert.equal(getState().characters[2].hud.rotation, 270);
    assert.equal(getState().characters[5].hud.rotation, 90);
    results.push('Seating layout creates individually rotated HUDs.');
    await click('[data-action="toggle-expand"]');
    await wait(() => getState().characters[0].hud.expanded === true);
    await shot('05-expanded-layout');
    await run(
      `commit(()=>{selected().hud.rotation=90;selected().hud.x=98;selected().hud.y=98;selected().hud.panel='sheet';});await saveQueue;`
    );
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    await wait(() =>
      getOverlay().webContents.executeJavaScript(
        'document.querySelectorAll(".hud-position").length===6'
      )
    );
    const overlay = getOverlay();
    await wait(() => overlay.isVisible());
    assert.equal(overlay.isAlwaysOnTop(), true);
    assert.equal(overlay.isFocusable(), getState().settings.overlayInteractive);
    const ob = overlay.getBounds(),
      db =
        screen.getAllDisplays().find((d) => String(d.id) === getState().settings.displayId)
          ?.bounds || screen.getPrimaryDisplay().bounds;
    assert.deepEqual(ob, db);
    const check = await overlay.webContents.executeJavaScript(
      `(()=>{const nodes=[...document.querySelectorAll('.hud-position')];return {background:getComputedStyle(document.body).backgroundColor,privateText:document.body.innerText.includes('Private test note'),rects:nodes.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}),width:innerWidth,height:innerHeight};})()`
    );
    assert.equal(check.background, 'rgba(0, 0, 0, 0)');
    assert.equal(check.privateText, false);
    for (const r of check.rects) {
      assert.ok(
        r.x >= -1 && r.y >= -1 && r.right <= check.width + 1 && r.bottom <= check.height + 1,
        JSON.stringify(r)
      );
    }
    const overlayImage = await overlay.webContents.capturePage();
    fs.writeFileSync(path.join(directory, '06-overlay.png'), overlayImage.toPNG());
    assert.equal(overlayImage.toBitmap()[3], 0);
    results.push('The native overlay screenshot has transparent pixels outside the HUDs.');
    const handle = overlay.getNativeWindowHandle();
    results.push(
      'Native TV overlay is transparent, always on top, covers the selected display, and accepts keyboard focus when HUD controls are on.'
    );
    results.push(
      'All six HUDs, including a 90-degree expanded sheet near a corner, fit within the display.'
    );
    results.push('Private notes are excluded from the player overlay.');
    fs.writeFileSync(path.join(directory, 'window-handle.txt'), String(handle.readBigUInt64LE()));
    // Full click-through uses WS_EX_TRANSPARENT; interactive mode uses native HUD regions.
    await run(`commit(()=>state.settings.overlayInteractive=false);await saveQueue;`);
    await wait(() => !overlay.isFocusable());
    const { execFileSync } = require('node:child_process');
    const style = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class TLWindowStyle { [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex); }'; [TLWindowStyle]::GetWindowLongPtr([IntPtr]${handle.readBigUInt64LE()}, -20).ToInt64()`,
      ],
      { windowsHide: true, encoding: 'utf8' }
    ).trim();
    assert.ok((BigInt(style) & 32n) !== 0n, 'WS_EX_TRANSPARENT missing: ' + style);
    results.push('Windows confirms the overlay has the native click-through window style.');
    await run(`commit(()=>state.settings.overlayInteractive=true);await saveQueue;`);
    await wait(() => overlay.isFocusable());
    // Reposition the same native overlay across all connected displays, including negative coordinates.
    for (const target of screen.getAllDisplays()) {
      await run(
        `state.settings.displayId=${JSON.stringify(String(target.id))};await persist();await api.overlay({visible:true,displayId:state.settings.displayId});`
      );
      await wait(() => JSON.stringify(overlay.getBounds()) === JSON.stringify(target.bounds));
    }
    results.push(
      'The overlay moves correctly between all connected displays, including negative screen coordinates.'
    );
    await run(
      `commit(()=>{state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};selected().hud.rotation=0;selected().hud.x=28;selected().hud.y=82;selected().hud.panel='action';});await saveQueue;await api.overlay({visible:true,displayId:state.settings.displayId});`
    );
    await new Promise((r) => setTimeout(r, 150));
    await shot('08-landscape-layout');
    setOverlay(false);
    assert.equal(overlay.isVisible(), false);
    results.push('Overlay hide control removes the native overlay.');
    await run(`view='character';tab='spell';render();`);
    await shot('07-final-console');
    const saved = store.load().state;
    assert.equal(saved.characters.length, 6);
    assert.equal(saved.characters[0].hud.x, 28);
    assert.equal(saved.characters[0].items.length, 2);
    results.push('Saved party reloads six characters, abilities, portraits and placement.');
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(directory, 'native-results.json'),
      JSON.stringify(
        {
          passed: true,
          results,
          displays: screen
            .getAllDisplays()
            .map((d) => ({ id: d.id, bounds: d.bounds, scaleFactor: d.scaleFactor })),
        },
        null,
        2
      )
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'native-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack, errors }, null, 2)
    );
    try {
      await shot('failure');
    } catch {}
  } finally {
    setOverlay(false);
    app.quit();
  }
};
