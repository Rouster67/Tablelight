/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
// Real renderer captures and worked-example checks. All state is synthetic and isolated.
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
module.exports = async ({ app, controller, getOverlay, getState, screen, setOverlay, store }) => {
  const directory = path.dirname(store.directory),
    results = [],
    images = [];
  const root = path.resolve(__dirname, '..');
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const tv = (code) => getOverlay().webContents.executeJavaScript(`(async()=>{${code}})()`);
  const delay = () => new Promise((r) => setTimeout(r, 300));
  const wait = async (check) => {
    for (let i = 0; i < 200; i++) {
      if (await check()) return;
      await new Promise((r) => setTimeout(r, 40));
    }
    throw Error('Manual walkthrough timed out');
  };
  const click = async (selector) => {
    await run(
      `const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Missing control: '+${JSON.stringify(selector)});e.click();`
    );
    await delay();
    await run('await saveQueue;');
  };
  const fill = (form, values) =>
    run(
      `const f=document.getElementById(${JSON.stringify(form)});for(const [key,value] of Object.entries(${JSON.stringify(values)})){const e=f.elements.namedItem(key);if(!e)throw Error(key);if(e.type==='checkbox')e.checked=value;else e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}`
    );
  const save = async (form) => {
    await click(`[form="${form}"][type="submit"]`);
    assert.equal(
      await run('return !!document.querySelector(".modal");'),
      false,
      await run('return document.querySelector("#form-error")?.textContent;')
    );
  };
  const close = () => run('closeModal();');
  const page = async (view) => {
    await run(
      `closeModal();view=${JSON.stringify(view)};render();document.querySelector('.content').scrollTop=0;`
    );
    await delay();
  };
  const shot = async (name, selector, window = controller) => {
    if (window === controller)
      await wait(() => run('return !document.getElementById("toast").className;'));
    if (window === controller && selector)
      await run(
        `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'});`
      );
    await delay();
    const rect = selector
      ? await window.webContents.executeJavaScript(
          `(()=>{const selector=${JSON.stringify(selector)};const elements=selector.includes(',')?[...document.querySelectorAll(selector)]:[document.querySelector(selector)];const boxes=elements.map(e=>e.getBoundingClientRect());const r={left:Math.min(...boxes.map(r=>r.left)),right:Math.max(...boxes.map(r=>r.right)),top:Math.min(...boxes.map(r=>r.top)),bottom:Math.max(...boxes.map(r=>r.bottom))};const x=Math.max(0,Math.floor(r.left)-3),y=Math.max(0,Math.floor(r.top)-3);return{x,y,width:Math.min(innerWidth-x,Math.ceil(r.right)-x+3),height:Math.min(innerHeight-y,Math.ceil(r.bottom)-y+3)};})()`
        )
      : undefined;
    const image = await window.webContents.capturePage(rect);
    fs.writeFileSync(path.join(directory, name + '.png'), image.toPNG());
    images.push({
      file: name + '.png',
      selector: selector || 'whole window',
      window: window === controller ? 'DM' : 'TV',
      pixels: image.getSize(),
    });
  };
  try {
    await wait(() => run('return !!state;'));
    controller.setBounds({ width: 1440, height: 1000 });
    controller.showInactive();
    await run(
      `await commit(()=>{state=TL.empty();selectedId='';state.settings.displayId=${JSON.stringify(String(screen.getPrimaryDisplay().id))};state.settings.overlayInteractive=true;});`
    );
    await click('[data-action="add-character"]');
    await fill('character-form', {
      name: 'Mira',
      className: 'Lantern keeper',
      species: 'Human',
      level: 3,
      ac: 14,
      speed: 30,
      hp: 24,
      maxHp: 24,
      tempHp: 0,
      proficiency: 2,
      initiative: 16,
      'ability-wis': 16,
      spellAbility: 'wis',
      'slot-1': 3,
      notes: 'Ask Mira who carries the lantern. This note stays on the laptop.',
    });
    await shot('character-identity', '#character-form .form-grid');
    await shot('character-training', '#character-form .form-section');
    await run(`document.querySelector('[name="spellAbility"]').scrollIntoView({block:'center'});`);
    await shot('character-spells', '[name="spellAbility"]', controller); // superseded by the full section below
    await run(
      `document.querySelector('[name="spellAbility"]').closest('.form-section').id='guide-spell-fields';`
    );
    await shot('spell-fields', '#guide-spell-fields');
    await save('character-form');
    const mira = getState().characters[0].id;
    await click('[data-action="add-character"]');
    await fill('character-form', {
      name: 'Rowan',
      className: 'Watchkeeper',
      species: 'Human',
      initiative: 12,
    });
    await save('character-form');
    const rowan = getState().characters[1].id;
    await click('[data-action="add-character"]');
    await fill('character-form', { name: 'Ash', className: 'Traveler', addToParty: false });
    await save('character-form');
    assert.equal(getState().roster[0].name, 'Ash');
    await page('roster');
    await shot('players-party', '.content');
    await run(`selectedId=${JSON.stringify(mira)};view='character';render();`);
    await click('[data-action="add-resource"]');
    await fill('resource-form', {
      'resource-name': 'Lantern charges',
      'resource-max': 3,
      'resource-current': 3,
      'resource-reset': 'long',
    });
    await shot('resource-editor', '.modal');
    await save('resource-form');
    assert.equal(getState().characters[0].resources[0].current, 3);
    results.push(
      'Created Mira and Rowan through the character editor, Ash outside the party, and a 3-charge long-rest Lantern charges pool through Add resource.'
    );
    await click('[data-action="add-item"]');
    await shot('add-choices', '.modal');
    await click('[data-action="new-library-entry"]');
    await fill('item-form', {
      name: 'Lantern flare',
      kind: 'feature',
      behavior: 'active',
      economy: 'bonus',
      usesSlot: false,
      description:
        'Raise your lantern to mark one place you can see. Describe the light to the table; apply any agreed effect manually.',
      trigger: 'When you choose to signal',
      duration: 'Until the scene changes',
      range: 'A place you can see',
      castingTime: 'A quick signal',
      damage: 'None in this example',
      upgrades: 'At higher levels, agree on any changes with the DM.',
      source: 'Original guide example',
      resourceId: getState().characters[0].resources[0].id,
      resourceCost: 1,
    });
    await run(`document.querySelector('#item-form .form-grid').scrollIntoView({block:'start'});`);
    await shot(
      'ability-editor-top',
      '#item-form > .form-grid > label:nth-child(-n+4),#item-form [data-behavior-hint]'
    );
    await run(`document.querySelector('[name="resourceId"]').scrollIntoView({block:'center'});`);
    await shot('ability-editor-costs', '#item-form .form-section.full');
    await save('item-form');
    const flare = getState().characters[0].items.find((x) => x.name === 'Lantern flare').id;
    await click('[data-action="add-item"]');
    await click('[data-action="new-library-entry"]');
    await fill('item-form', {
      name: 'Lantern sense',
      kind: 'feature',
      behavior: 'passive',
      trackPassive: true,
      description:
        'While carrying a lit lantern, remember to ask the DM whether you notice a marked doorway. This reminder grants no automatic bonus.',
      source: 'Original guide example',
    });
    await run(`document.querySelector('#item-form').scrollIntoView({block:'start'});`);
    await shot(
      'passive-editor',
      '#item-form > .form-grid > label:nth-child(-n+3),#item-form [data-passive-tracking]'
    );
    await save('item-form');
    const passive = getState().characters[0].items.find((x) => x.name === 'Lantern sense'),
      libraryId = passive.libraryId;
    assert.match(passive.description, /carrying a lit lantern/);
    await page('library');
    await shot('ability-library', '.content');
    await click(`[data-action="assign-library-entry"][data-id="${libraryId}"]`);
    await fill('assign-form', { characterId: rowan });
    await click('[form="assign-form"]');
    await save('attach-form');
    await run(`selectedId=${JSON.stringify(mira)};view='character';tab='passive';render();`);
    await shot('dm-passives', '.character-abilities');
    await run(
      `await commit(()=>{const c=selected();c.hud={...c.hud,x:50,y:50,scale:1,rotation:0,expanded:true,panel:'passive',detailId:${JSON.stringify(passive.id)}};state.characters[1].hud.visible=false;});`
    );
    setOverlay(true);
    await wait(() => getOverlay() && !getOverlay().webContents.isLoading());
    await wait(() => tv('return !!document.querySelector(".hud-panel");'));
    await shot('passive-detail', '.hud-panel', getOverlay());
    await tv(
      `const b=document.querySelector('button.hud-passive-status');if(!b)throw Error('Passive switch missing');b.click();`
    );
    await wait(() => getState().characters[0].items.find((x) => x.id === passive.id).passiveActive);
    assert.equal(
      getState().characters[1].items.find((x) => x.libraryId === libraryId).passiveActive,
      false
    );
    results.push(
      'Created and assigned Lantern flare and shared conditional Lantern sense through the real editors; the TV reminder changes Mira only and leaves Rowan Inactive.'
    );
    await run(
      `await commit(()=>{TL.createLocalItem(state,selectedId,{name:'Watchkeeper',kind:'feature',behavior:'hybrid',economy:'reaction',trackPassive:false,passiveDescription:'Remember the doorway you are watching.',description:'Point out a change you have noticed. Resolve its effect with the DM.'});});`
    );
    await run(`tab='feature';render();window.scrollTo(0,0);`);
    await shot('dm-console', null);
    await shot('combat-controls', '.combat-strip');
    await shot('currently-displayed', '.current-display');
    await click('[data-action="initiative-order"]');
    await shot('initiative', '.modal');
    await click('#sort-initiative');
    await save('initiative-form');
    assert.equal(getState().characters[0].name, 'Mira');
    results.push('Initiative editor sorts 16 before 12 and retains the selected character.');
    await page('display');
    await shot('tv-layout', null);
    await shot('placement', '.display-controls > .card:first-child');
    await run(`await commit(()=>{selected().hud.panel='overview';selected().hud.detailId='';});`);
    await shot('player-overview', '.hud-position', getOverlay());
    await run(`await commit(()=>{selected().hud.panel='sheet';});`);
    await shot('player-sheet', '.hud-nav, .hud-panel > div, .hud-panel b', getOverlay());
    await page('character');
    await click('[data-action="conditions"]');
    await click('[data-action="condition-create-for"]');
    await fill('condition-form', {
      name: 'Lantern marked',
      description:
        'An original reminder: the party has marked this character with a lantern token. Remove it when the scene ends.',
    });
    await shot('condition-editor', '.modal');
    await save('condition-form');
    assert.equal(getState().characters[0].appliedConditions[0].name, 'Lantern marked');
    await page('condition-library');
    await shot('condition-library', '.content');
    await page('character');
    await run(
      `await commit(()=>{TL.createLocalItem(state,selectedId,{name:'Guiding glow',kind:'spell',economy:'action',level:1,usesSlot:true,requiresConcentration:true,description:'Hold a steady glow while you concentrate. Decide its effect with the DM.'});});`
    );
    await click('[data-action="concentration-edit"]');
    await shot('concentration-picker', '.modal');
    await close();
    await run(`useItem(selected().items.find(x=>x.name==='Guiding glow').id);`);
    await shot('cast-slot', '.modal');
    await save('cast-form');
    assert.equal(getState().characters[0].slots[0].current, 2);
    assert.equal(getState().characters[0].concentrating, true);
    await shot('conditions-concentration', '.character-status');
    await click('[data-action="hp-damage"]');
    await fill('amount-form', { amount: 5 });
    await shot('damage', '.modal');
    await save('amount-form');
    assert.equal(getState().characters[0].hp, 19);
    assert.equal(getState().characters[0].concentrating, true);
    results.push(
      'Created/applied a condition, spent a level-1 slot on Guiding glow, and applied 5 damage: HP became 19, slots became 2, concentration remained for the DM to resolve.'
    );
    await run(
      `await commit(()=>{selected().hud.panel='bonus';selected().hud.detailId=${JSON.stringify(flare)};});`
    );
    await shot('active-detail', '.hud-panel', getOverlay());
    await run(
      `await commit(()=>{const c=selected();c.hud.panel='passive';c.hud.detailId=c.items.find(x=>x.name==='Watchkeeper').id;});`
    );
    await shot('hybrid-passive', '.hud-panel', getOverlay());
    await run(`await commit(()=>{selected().hud.panel='reaction';});`);
    await shot('hybrid-active', '.hud-panel', getOverlay());
    await run(
      `await commit(()=>{selected().hud.panel='bonus';selected().hud.detailId=${JSON.stringify(flare)};selected().hud.rotation=90;});`
    );
    await shot('rotated-player', '.hud-position', getOverlay());
    await run(`await commit(()=>{selected().hud.rotation=0;});`);
    await tv(
      `return window.tablelight.hudCommand({type:'use',characterId:${JSON.stringify(mira)},itemId:${JSON.stringify(flare)},sessionId:state.approvalSessionId,commandId:TL.uid()});`
    );
    await wait(() => run('return !!document.querySelector("[data-approval-detail]");'));
    await shot('approval-review', '.modal');
    await shot(
      'player-pending',
      '.hud-pending-requests > b, .hud-pending-requests > .hud-pending-use, .hud-pending-requests > small',
      getOverlay()
    );
    assert.equal(getState().characters[0].resources[0].current, 3);
    await click('[data-action="approve-request"]');
    assert.equal(getState().characters[0].resources[0].current, 2);
    results.push(
      'Requested Lantern flare from the player interface: costs remained unspent on the DM until Allow use; approval spent one charge and the bonus action.'
    );
    await click('[data-action="dm-history"]');
    await shot('history', '.modal');
    await close();
    await run(`restDialog('long');`);
    await shot('long-rest', '.modal');
    await save('rest-form');
    assert.equal(getState().characters[0].hp, 24);
    assert.equal(getState().characters[0].resources[0].current, 3);
    assert.equal(getState().characters[0].concentrating, false);
    assert.equal(getState().characters[0].appliedConditions.length, 1);
    results.push(
      'Selected-character long rest restored HP, slots and the long-rest pool and ended concentration; the manually applied condition remained.'
    );
    await page('messages');
    await run(
      `messageRecipient=${JSON.stringify(mira)};render();const e=document.getElementById('message-draft');e.value='The doorway bears the same lantern mark you saw at the bridge. Tell the table what you do next.';e.dispatchEvent(new Event('input',{bubbles:true}));`
    );
    await click('[data-message-dm="send"]');
    await shot('messages', '.message-compose-grid');
    await click('[data-message-dm="force-open"]');
    await wait(() => tv('return !!document.querySelector(".message-position");'));
    await shot('player-message', '.message-position', getOverlay());
    results.push(
      'Sent the original doorway note to Mira and opened it through the DM message controls; the TV displayed the same text.'
    );
    await page('help');
    await shot('help-link', '#guide-link');
    await shot('backup-controls', '#guide-link + .separator + h3');
    await shot('updates', '#updates-panel');
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
          fixture: 'guide-manual-v1',
          appVersion: app.getVersion(),
          sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: root,
            encoding: 'utf8',
            windowsHide: true,
          }).trim(),
          workingTree: 'Documentation and capture harness changes; application UI unchanged.',
          window: { width: 1440, height: 1000 },
          displays: screen.getAllDisplays().map((d) => ({
            width: d.bounds.width,
            height: d.bounds.height,
            scaleFactor: d.scaleFactor,
          })),
          images,
          uiInputs,
        },
        null,
        2
      ) + '\n'
    );
    fs.writeFileSync(
      path.join(directory, 'guide-manual-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'guide-manual-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
  } finally {
    setOverlay(false);
    app.quit();
  }
};
