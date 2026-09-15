/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const TL = require('../core'),
  Themes = require('../hud-themes'),
  { pages } = require('../message-client');
const { hudRegions } = require('../window-shape');
const nativeInput = require('./window-input-native');
module.exports = async ({ app, controller, getOverlay, getState, screen, setOverlay, store }) => {
  const directory = path.dirname(store.directory),
    results = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const tv = (code) => getOverlay().webContents.executeJavaScript(`(async()=>{${code}})()`);
  const wait = async (check, label = 'Message UI') => {
    const start = Date.now();
    while (!(await check())) {
      if (Date.now() - start > 10000) throw Error(label + ' timed out');
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  const snapshot = () => run('return api.messages();');
  const meta = async (id = 'p0') => (await snapshot()).messages.find((m) => m.characterId === id);
  const select = async (id = 'p0') =>
    run(
      `const select=document.getElementById('message-recipient');select.value=${JSON.stringify(id)};select.dispatchEvent(new Event('change',{bubbles:true}));`
    );
  const fill = (text) =>
    run(
      `const field=document.getElementById('message-draft');field.value=${JSON.stringify(text)};field.dispatchEvent(new Event('input',{bubbles:true}));`
    );
  const click = (action) =>
    run(
      `const b=document.querySelector('[data-message-dm="${action}"]');if(!b||b.disabled)throw Error('Unavailable control: ${action}');b.click();`
    );
  const panel = (id) => `.message-position[data-message-character="${id}"]`;
  const pose = `return [...document.querySelectorAll('.hud-position')].map(e=>({id:e.dataset.hudId,width:e.offsetWidth,height:e.offsetHeight,left:e.style.left,top:e.style.top,transform:e.style.transform}));`;
  const shot = async (win, name) => {
    await new Promise((r) => setTimeout(r, 150));
    fs.writeFileSync(
      path.join(directory, name + '.png'),
      (await win.webContents.capturePage()).toPNG()
    );
  };
  const show = async () => {
    await setOverlay(true);
    await wait(async () => getOverlay()?.isVisible() && (await snapshot()).overlay.connected);
    const b = getOverlay().getContentBounds();
    await wait(() => tv(`return !!state&&innerWidth===${b.width}&&innerHeight===${b.height};`));
    await tv('paint();');
  };
  const mouseClick = async (selector) => {
    const p = await tv(
      `const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing click target');const r=e.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};`
    );
    const web = getOverlay().webContents;
    web.sendInputEvent({ type: 'mouseMove', ...p });
    web.sendInputEvent({ type: 'mouseDown', ...p, button: 'left', clickCount: 1 });
    web.sendInputEvent({ type: 'mouseUp', ...p, button: 'left', clickCount: 1 });
  };
  const opened = () =>
    wait(async () => (await meta())?.bodyVisible === true, 'Visible message acknowledgement');
  try {
    controller.setBounds({ width: 1440, height: 1000 });
    controller.showInactive();
    await wait(() => run('return !!state&&!!messageClient?.state.sessionId;'));
    const fixture = TL.empty();
    fixture.settings.hudControlsVersion = 1;
    fixture.settings.displayId = String(screen.getPrimaryDisplay().id);
    fixture.settings.overlayInteractive = true;
    fixture.settings.soloExpand = false;
    fixture.characters = Array.from({ length: 8 }, (_, i) => {
      const c = TL.character(i);
      c.id = 'p' + i;
      c.name = i < 2 ? 'Same name' : 'Synthetic player ' + (i + 1);
      c.theme = Themes.choices[i + 1].id;
      Object.assign(c.hud, {
        x: 20 + (i % 4) * 20,
        y: i < 4 ? 25 : 75,
        expanded: i === 1,
        visible: i < 2,
        rotation: 0,
        scale: i === 1 ? 0.5 : 1,
      });
      return c;
    });
    await run(
      `await commit(()=>{state=${JSON.stringify(fixture)};selectedId='p0';view='messages';messageRecipient='p0';});`
    );
    await show();
    const before = TL.clone(getState()),
      beforePose = await tv(pose);
    const first =
      'SYNTHETIC_PRIVATE_ALPHA\n<script>literal text only</script>\n' +
      '漢字'.repeat(700) +
      ' 🪄 final line.';
    await fill(' \n ');
    assert.equal(
      await run(`return document.querySelector('[data-message-dm="send"]').disabled;`),
      true
    );
    await fill('x'.repeat(2001));
    assert.equal(
      await run(`return document.querySelector('[data-message-dm="send"]').disabled;`),
      true
    );
    await fill('Draft for first player');
    await select('p1');
    await fill('Draft for second player');
    await select();
    assert.equal(
      await run('return document.getElementById("message-draft").value;'),
      'Draft for first player'
    );
    await fill(first);
    await click('send');
    await wait(async () => (await meta())?.deliveredAt, 'Envelope delivery');
    assert.equal((await meta()).unread, true);
    assert.equal(
      await tv(
        `return !!document.querySelector('[data-message-badge="p0"]')&&!document.querySelector('[data-message-badge="p1"]')&&!document.querySelector('.message-panel');`
      ),
      true
    );
    assert.equal(
      await tv(`return document.documentElement.outerHTML.includes('SYNTHETIC_PRIVATE_ALPHA');`),
      false
    );
    assert.deepEqual(getState(), before);
    assert.deepEqual(await tv(pose), beforePose);
    await shot(controller, '01-message-composer');
    await shot(getOverlay(), '02-unread-envelope');
    await click('review');
    await wait(() => run(`return !!document.querySelector('[data-message-review]').textContent;`));
    assert.equal((await meta()).unread, true);
    assert.equal(
      await run(`return document.querySelector('[data-message-review]').textContent;`),
      first
    );
    assert.equal(
      await tv(
        `return getComputedStyle(document.querySelector('[data-message-badge="p0"]')).animationIterationCount;`
      ),
      '5'
    );
    const debuggerApi = getOverlay().webContents.debugger;
    debuggerApi.attach('1.3');
    await debuggerApi.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    assert.equal(
      await tv(
        `return getComputedStyle(document.querySelector('[data-message-badge="p0"]')).animationName;`
      ),
      'none'
    );
    await debuggerApi.sendCommand('Emulation.setEmulatedMedia', { features: [] });
    debuggerApi.detach();
    await new Promise((resolve) => setTimeout(resolve, 5200));
    assert.equal(
      await tv(
        `return document.querySelector('[data-message-badge="p0"]').getAnimations().some(a=>a.playState==='running');`
      ),
      false
    );
    results.push(
      'Independent drafts survive recipient changes; sending targets one same-name player, delivers an unread envelope without any text preview, and changes no HUD or party settings.'
    );

    await mouseClick('[data-message-badge="p0"]');
    await opened();
    assert.equal((await meta()).openedBy, 'player');
    assert.equal(
      await tv(`return document.querySelector('${panel('p0')} .message-text').textContent;`),
      pages(first)[0]
    );
    assert.equal(await tv(`return !!document.querySelector('${panel('p0')} script');`), false);
    assert.equal(await tv('return gesture.isDragging;'), false);
    await click('next');
    await wait(async () => (await meta()).page === 1);
    await opened();
    assert.equal(
      await tv(`return document.querySelector('${panel('p0')} .message-text').textContent;`),
      pages(first)[1]
    );
    await run(`await commit(()=>{state.settings.overlayInteractive=false;});`);
    const through = TL.clone(getState());
    await click('next');
    await wait(async () => (await meta()).page === 2);
    await opened();
    await click('scroll-down');
    await wait(
      () => tv(`return document.querySelector('${panel('p0')} .message-text').scrollTop>0;`),
      'DM scrolling'
    );
    const scroll = await tv(
      `return document.querySelector('${panel('p0')} .message-text').scrollTop;`
    );
    await run(`await commit(()=>{state.settings.overlayInteractive=true;});`);
    await wait(() => tv('return state.settings.overlayInteractive;'));
    assert.equal((await meta()).page, 2);
    assert.equal(
      await tv(`return document.querySelector('${panel('p0')} .message-text').scrollTop;`),
      scroll
    );
    await mouseClick(`${panel('p0')} [data-message-action="close"]`);
    await wait(async () => !(await meta()).open);
    assert.equal((await meta()).unread, false);
    assert.deepEqual(await tv(pose), beforePose);
    assert.deepEqual(getState().characters, through.characters);
    results.push(
      'Native mail clicks open literal text without movement. Player Close and DM paging/scrolling work; toggling click-through preserves the reading page, scroll, ownership and saved geometry.'
    );

    await fill('SYNTHETIC_PRIVATE_REPLACEMENT');
    await click('send');
    assert.equal(
      await run(`return !!document.querySelector('[data-message-dm="confirm-replace"]');`),
      true
    );
    assert.equal((await meta()).unread, false);
    await click('cancel-replace');
    assert.equal(
      await run('return document.getElementById("message-draft").value;'),
      'SYNTHETIC_PRIVATE_REPLACEMENT'
    );
    await click('send');
    await click('confirm-replace');
    await wait(async () => (await meta()).unread && (await meta()).page === 0);
    await click('force-open');
    await opened();
    assert.equal((await meta()).openedBy, 'dm');
    await run(`view='display';render();`);
    await wait(() => run(`return !!document.querySelector('[data-message-preview]');`));
    assert.equal(
      await run(
        `return document.querySelector('#preview-stage').outerHTML.includes('SYNTHETIC_PRIVATE_');`
      ),
      false
    );
    await run(`view='messages';render();`);
    await click('dismiss');
    await wait(async () => !(await meta()));
    await wait(() =>
      tv(
        `return !document.querySelector('[data-message-badge="p0"]')&&!document.querySelector('${panel('p0')}');`
      )
    );
    await select('p1');
    assert.equal(
      await run('return document.getElementById("message-draft").value;'),
      'Draft for second player'
    );
    await run(
      `window.messageOriginalApi=messageClient.api;messageClient.api={...api,messageCommand:async()=>{throw Error('Synthetic temporary delivery failure');}};`
    );
    await click('send');
    await wait(() => run(`return !messageDraft().busy&&!!messageDraft().error;`));
    assert.equal(
      await run('return document.getElementById("message-draft").value;'),
      'Draft for second player'
    );
    await run('messageClient.api=window.messageOriginalApi;');
    await click('send');
    await wait(async () => !!(await meta('p1')));
    await select();
    results.push(
      'Replacement requires named confirmation; Cancel retains the draft, replacements start unread, preview badges expose no text, Dismiss removes the correct message, and failed sends keep retryable drafts.'
    );

    await fill('SYNTHETIC_DELAYED_OLD_BODY');
    await click('send');
    await wait(async () => !!(await meta()));
    await tv(
      `window.realMessageApi=playerMessages.api;playerMessages.api={...window.tablelight,messageBody:async request=>{const response=await window.tablelight.messageBody(request);await new Promise(resolve=>window.releaseOldMessage=resolve);return response;}};`
    );
    await click('force-open');
    await wait(() => tv("return typeof window.releaseOldMessage==='function';"));
    await fill('SYNTHETIC_FRESH_BODY');
    await click('send');
    await click('confirm-replace');
    await wait(async () => !(await meta()).open);
    await tv('playerMessages.api=window.realMessageApi;window.releaseOldMessage();');
    await wait(() =>
      tv(`return !document.querySelector('.message-panel[data-message-character="p0"]');`)
    );
    assert.equal(
      await tv(`return document.documentElement.outerHTML.includes('SYNTHETIC_DELAYED_OLD_BODY');`),
      false
    );
    await tv(
      `playerMessages.api={...window.tablelight,messageBody:async()=>{throw Error('Synthetic body failure');}};`
    );
    await click('force-open');
    await wait(() =>
      tv(`return !!document.querySelector('${panel('p0')} [data-message-action="retry"]');`)
    );
    assert.equal((await meta()).unread, true);
    await tv('playerMessages.api=window.realMessageApi;');
    await mouseClick(`${panel('p0')} [data-message-action="retry"]`);
    await opened();
    assert.equal(
      await tv(`return document.querySelector('${panel('p0')} .message-text').textContent;`),
      'SYNTHETIC_FRESH_BODY'
    );
    results.push(
      'Late fetched text cannot reappear after replacement. A failed body load stays unread and presents Retry; only the current visibly rendered response acknowledges opening.'
    );

    for (const rotation of [0, 90, 180, 270, 35]) {
      await run(
        `await commit(()=>{const c=state.characters.find(c=>c.id==='p0');c.hud.rotation=${rotation};c.hud.x=98;c.hud.y=98;});`
      );
      await wait(() =>
        tv(
          `return document.querySelector('${panel('p0')}').style.transform.includes('rotate(${rotation}deg)');`
        )
      );
      assert.equal(
        await tv(
          `const r=document.querySelector('${panel('p0')}').getBoundingClientRect();return r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;`
        ),
        true
      );
      assert.equal(getState().characters.find((c) => c.id === 'p0').hud.x, 98);
    }
    await shot(getOverlay(), '03-rotated-message');
    const ratio = (a, b) => {
      const lum = (value) =>
        value
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number)
          .map((v) => v / 255)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      const x = lum(a),
        y = lum(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    for (const choice of Themes.choices) {
      await run(
        `await commit(()=>{state.characters.find(c=>c.id==='p0').theme=${JSON.stringify(choice.id)};});`
      );
      await wait(() =>
        tv(
          `return (document.querySelector('${panel('p0')}').dataset.hudTheme||'default')===${JSON.stringify(choice.id)};`
        )
      );
      const colors = await tv(
        `const p=document.querySelector('${panel('p0')} .message-panel'),s=getComputedStyle(p),t=getComputedStyle(p.querySelector('.message-text')),b=getComputedStyle(p.querySelector('button'));return {background:s.backgroundColor,text:t.color,border:s.borderTopColor,button:b.color,control:b.backgroundColor};`
      );
      assert.ok(ratio(colors.text, colors.background) >= 4.5, choice.id + ' text contrast');
      assert.ok(ratio(colors.button, colors.control) >= 4.5, choice.id + ' control contrast');
      assert.ok(ratio(colors.border, colors.background) >= 3, choice.id + ' border contrast');
    }
    results.push(
      'Cards follow 0°, 90°, 180°, 270° and arbitrary rotation near display edges without rewriting saved position. Default and all 13 themes meet message text/control and border contrast targets.'
    );

    await run(
      `await commit(()=>{for(const c of state.characters){c.hud.visible=true;c.hud.expanded=false;c.hud.scale=.6;c.hud.x=12+Number(c.id.slice(1))%4*25;c.hud.y=Number(c.id.slice(1))<4?25:75;c.hud.rotation=[0,90,180,270,35,0,90,180][Number(c.id.slice(1))];}});`
    );
    for (let i = 0; i < 8; i++) {
      await select('p' + i);
      if (!(await meta('p' + i))) {
        await fill('Synthetic note for player ' + i);
        await click('send');
        await wait(async () => !!(await meta('p' + i)));
      }
      await click('force-open');
    }
    await wait(() => tv('return document.querySelectorAll(".message-panel").length===8;'));
    await tv('notice("Synthetic geometry notice");');
    const geometry = await tv('return JSON.parse(publishedRegions);');
    assert.equal(geometry[2].length, 17);
    const rects = hudRegions(geometry[2], geometry[0], geometry[1]);
    for (const frame of geometry[2])
      assert.ok(
        rects.some(
          (r) =>
            frame.cx >= r.x &&
            frame.cx < r.x + r.width &&
            frame.cy >= r.y &&
            frame.cy < r.y + r.height
        )
      );
    assert.ok(
      nativeInput(
        getOverlay(),
        geometry[2].map((f) => ({ x: f.cx, y: f.cy }))
      ).hits.every(Boolean)
    );
    await shot(getOverlay(), '04-eight-messages');
    await select();
    await click('close');
    assert.equal((await snapshot()).messages.filter((m) => m.open).length, 7);
    await click('force-open');
    await opened();
    await run(`await commit(()=>{state.characters.find(c=>c.id==='p0').hud.visible=false;});`);
    await wait(() => tv(`return !document.querySelector('${panel('p0')}');`));
    assert.equal((await meta()).open, false);
    await run(`await commit(()=>{state.characters.find(c=>c.id==='p0').hud.visible=true;});`);
    await wait(() => tv(`return !!document.querySelector('[data-message-badge="p0"]');`));
    assert.equal((await meta()).open, false);
    await click('force-open');
    await opened();
    await setOverlay(false);
    assert.equal((await meta()).open, false);
    await show();
    assert.equal((await meta()).open, false);
    await run(
      `await commit(()=>{for(const c of state.characters){c.hud.visible=['p0','p1'].includes(c.id);c.hud.expanded=false;c.hud.x=50;c.hud.y=50;c.hud.rotation=0;c.hud.scale=1;}});`
    );
    await click('force-open');
    await opened();
    await select('p1');
    await click('force-open');
    await wait(async () => (await meta('p1')).bodyVisible);
    assert.equal(
      await tv(
        `return document.elementFromPoint(innerWidth/2,innerHeight/2).closest('[data-message-character]').dataset.messageCharacter;`
      ),
      'p1'
    );
    await select();
    await click('force-open');
    await wait(() =>
      tv(
        `return document.elementFromPoint(innerWidth/2,innerHeight/2).closest('[data-message-character]').dataset.messageCharacter==='p0';`
      )
    );
    assert.equal((await meta('p1')).open, true);
    await run(
      `await commit(()=>{for(const c of state.characters)c.hud.visible=c.id==='p0';const c=state.characters[0];c.hud.expanded=false;c.hud.rotation=35;c.hud.scale=1;c.hud.x=50;c.hud.y=50;});`
    );
    await click('force-open');
    await opened();
    await tv(
      `clearTimeout(document.getElementById('overlay-notice').timer);document.getElementById('overlay-notice').classList.remove('visible');publishRegions();`
    );
    const points = await tv(`const f=playerMessages.frames()[0],a=f.rotation*Math.PI/180;
      return [{x:f.cx+180*Math.cos(a),y:f.cy+180*Math.sin(a)}, {x:f.cx+f.width*.55,y:f.cy-f.height*.7}, {x:3,y:3}];`);
    assert.deepEqual(nativeInput(getOverlay(), points).hits, [true, false, false]);
    const single = TL.clone(getState().characters[0]);
    await run(`await commit(()=>{state.settings.overlayInteractive=false;});`);
    await wait(() => !getOverlay().isFocusable());
    assert.equal(nativeInput(getOverlay(), points).transparent, true);
    await click('close');
    await wait(async () => !(await meta()).open);
    await click('force-open');
    await opened();
    assert.deepEqual(getState().characters[0], single);
    await run(`await commit(()=>{state.settings.overlayInteractive=true;});`);
    await click('close');
    await wait(() => tv('return playerMessages.frames().length===0;'));
    assert.deepEqual(nativeInput(getOverlay(), points).hits, [false, false, false]);
    // Expanded reading stays inside the original frame, including maximum scale.
    for (const scale of [0.4, 2.5]) {
      await run(
        `await commit(()=>{const c=state.characters[0];c.hud.expanded=true;c.hud.rotation=90;c.hud.scale=${scale};});`
      );
      const oldPose = await tv(pose);
      await click('force-open');
      await opened();
      assert.deepEqual(await tv(pose), oldPose);
      assert.equal(await tv(`return playerMessages.frames().length;`), 0);
      assert.equal(
        await tv(
          `const r=document.querySelector('${panel('p0')}').getBoundingClientRect(),h=document.querySelector('.hud-position[data-hud-id="p0"]').getBoundingClientRect();return r.left>=h.left-1&&r.right<=h.right+1&&r.top>=h.top-1&&r.bottom<=h.bottom+1&&r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;`
        ),
        true
      );
      await click('close');
    }
    await run(`await commit(()=>{const c=state.characters[0];c.hud.rotation=0;c.hud.scale=.7;});`);
    await click('force-open');
    await opened();
    const dragPoint = await tv(
      `const r=document.querySelector('.hud-drag-handle').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};`
    );
    const dragContents = getOverlay().webContents;
    dragContents.sendInputEvent({ type: 'mouseDown', ...dragPoint, button: 'left', clickCount: 1 });
    dragContents.sendInputEvent({
      type: 'mouseMove',
      x: dragPoint.x + 60,
      y: dragPoint.y + 20,
      button: 'left',
    });
    dragContents.sendInputEvent({
      type: 'mouseUp',
      x: dragPoint.x + 60,
      y: dragPoint.y + 20,
      button: 'left',
      clickCount: 1,
    });
    await wait(
      async () => !(await meta()).open && getState().characters[0].hud.x !== 50,
      'Dragging closes message'
    );
    await wait(() => tv('return !gesture.isDragging;'));
    assert.deepEqual(nativeInput(getOverlay(), [{ x: 3, y: 3 }]).hits, [false]);
    results.push(
      'Windows confirms all 17 input frames, empty rotated corners, click-through, and cleanup after Close and native dragging. Overlapping cards can be raised independently. Expanded cards stay within unchanged HUD frames at 40% and 250% scale; reduced motion disables the pulse, which otherwise ends after five seconds.'
    );
    await run(`await commit(()=>{TL.removeFromParty(state,'p0');});`);
    assert.equal((await snapshot()).messages.length, 7);
    assert.equal(
      await run(`return document.querySelector('[data-message-dm="send"]').disabled;`),
      true
    );
    assert.equal(fs.readFileSync(store.file, 'utf8').includes('SYNTHETIC_PRIVATE_'), false);
    results.push(
      'Eight simultaneous messages produce all 17 native frames including a notice. Closing/hiding affects only the intended player, showing restores no open text, and recipient removal disables sending without choosing another player.'
    );
    fs.writeFileSync(
      path.join(directory, 'player-messages-ui-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    await shot(controller, 'message-ui-failure-dm').catch(() => {});
    if (getOverlay()) await shot(getOverlay(), 'message-ui-failure-tv').catch(() => {});
    fs.writeFileSync(
      path.join(directory, 'player-messages-ui-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
  } finally {
    setOverlay(false);
    app.quit();
  }
};
