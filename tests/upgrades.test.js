/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const TL = require('../core');
const { Store } = require('../storage');
const context = { window: {}, TL };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../hud.js'), 'utf8'), context);
const HUD = context.window.HUD;

test('formats 1–5 default missing upgrades without changing existing ability text or selections', () => {
  for (const version of [1, 2, 3, 4, 5]) {
    const c = TL.character();
    c.items = [
      TL.item({
        description: 'Old rules',
        attack: '+7 or special',
        save: 'User save',
        source: 'Test reference',
      }),
    ];
    delete c.items[0].upgrades;
    c.hud.detailId = c.items[0].id;
    c.hud.rotation = 270;
    const raw = { version, characters: [c], roster: [], conditionLibrary: [] };
    const state = TL.normalize(raw);
    assert.equal(state.version, 11);
    assert.equal(state.library[0].upgrades, '');
    const item = { ...state.characters[0].items[0] };
    delete item.libraryId;
    delete item.upgrades;
    assert.deepEqual(item, c.items[0]);
    assert.deepEqual(state.characters[0].hud, c.hud);
    assert.deepEqual(TL.normalize(TL.toBackup(state)), state);
    assert.equal(raw.characters[0].items[0].upgrades, undefined);
  }
});

test('upgrades remain distinct in legacy matching and accept bounded plain text for every ability type', () => {
  const c = TL.character();
  c.items = ['Upgrade A', 'Upgrade B', 'Upgrade A'].map((upgrades) =>
    TL.item({ name: 'Same ability', upgrades })
  );
  const state = TL.normalize({ version: 1, characters: [c] });
  assert.equal(state.library.length, 2);
  assert.equal(state.characters[0].items[0].libraryId, state.characters[0].items[2].libraryId);
  for (const [kind, level] of [
    ['spell', 0],
    ['spell', 1],
    ['action', null],
    ['feature', null],
  ]) {
    const entry = TL.libraryEntry({ kind, level, upgrades: 'x'.repeat(40001) });
    assert.equal(entry.upgrades.length, 40000);
    assert.equal(entry.kind, kind);
    assert.equal(entry.level, level);
  }
  for (const upgrades of [null, false, 42, {}, []])
    assert.equal(TL.libraryEntry({ upgrades }).upgrades, '');
});

test('shared upgrades save once and preserve independent active/inactive character state, including later spending', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tablelight-upgrades-'));
  try {
    const store = new Store(directory);
    let state = TL.empty();
    const a = TL.character(),
      b = TL.character();
    a.resources = [{ id: 'a-pool', name: 'A pool', current: 4, max: 4, reset: 'long' }];
    b.resources = [{ id: 'b-pool', name: 'B pool', current: 1, max: 6, reset: 'manual' }];
    state.characters = [a];
    state.roster = [b];
    state.library = [
      TL.libraryEntry({ name: 'Shared', description: 'Base rules', source: 'Test source' }),
      TL.libraryEntry({ name: 'Unused', upgrades: 'Unused upgrades' }),
    ];
    TL.attachItem(state, a.id, state.library[0].id, { resourceId: 'a-pool', resourceCost: 2 });
    TL.attachItem(state, b.id, state.library[0].id, { resourceId: 'b-pool', disabled: true });
    a.hud.detailId = a.items[0].id;
    a.hud.rotation = 90;
    b.hud.rotation = 270;
    state = TL.normalize(state);
    let original = TL.clone(state.library[0]);
    TL.spend(state.characters[0], state.characters[0].items[0]);
    const afterSpend = TL.clone(state);
    for (const upgrades of ['Short improvements', 'x'.repeat(40000), '']) {
      state.library[0] = TL.mergeChanges(original, { ...original, upgrades }, state.library[0]);
      state = store.save(state);
      assert.deepEqual(store.load().state, state);
      const backup = TL.toBackup(state);
      assert.equal(backup.library[0].upgrades, upgrades);
      assert.equal(backup.library[1].upgrades, 'Unused upgrades');
      for (const c of [...backup.characters, ...backup.roster])
        assert.equal(Object.hasOwn(c.items[0], 'upgrades'), false);
      for (const [index, c] of TL.allCharacters(state).entries()) {
        const expected = TL.clone(TL.allCharacters(afterSpend)[index]);
        expected.items[0].upgrades = upgrades;
        assert.deepEqual(c, expected);
      }
      assert.deepEqual(TL.normalize(JSON.parse(JSON.stringify(backup))), state);
      assert.equal(TL.overlayState(state).characters[0].items[0].upgrades, upgrades);
      assert.equal(TL.overlayState(state).roster, undefined);
      original = TL.clone(state.library[0]);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('DM and HUD details preserve ordered, escaped sections and reach all long upgrade text', () => {
  for (const [description, upgrades] of [
    ['', ''],
    ['Base description', 'Short improvement'],
    ['', 'Upgrades without base text'],
    ['d'.repeat(40000), 'u'.repeat(40000)],
    ['Paragraph.\n'.repeat(160), 'Higher slot.\n\n' + 'longword'.repeat(240)],
  ]) {
    const it = TL.item({ description, upgrades, source: 'Final source' });
    const c = TL.character();
    c.items = [it];
    c.hud.expanded = true;
    c.hud.detailId = it.id;
    const sections = TL.abilityTextSections(it),
      pages = TL.abilityTextPages(it);
    assert.equal(HUD.countPages(c), pages.length);
    for (const section of sections) {
      const restored = pages
        .flat()
        .filter((part) => part.label === section.label)
        .map((part) => part.text)
        .join('');
      assert.equal(restored.replace(/\s/g, ''), section.text.replace(/\s/g, ''));
    }
    for (const [page, parts] of pages.entries()) {
      c.hud.page = page;
      const html = HUD.render(c);
      for (const part of parts) {
        assert.ok(html.includes(HUD.esc(part.text)));
        if (part.label) assert.ok(html.includes('<h4>Upcast / upgrades</h4>'));
      }
      assert.ok(html.indexOf('ability-source') > html.lastIndexOf('hud-description'));
    }
    if (description.length + upgrades.length < 500) assert.equal(pages.length, 1);
  }
  const it = TL.item({
    description: 'BASE',
    upgrades: '<img src=x onerror=bad()>\n"Level 5" & more',
    source: 'SOURCE',
  });
  const html = HUD.renderAbilityDetails(it);
  assert.ok(html.indexOf('BASE') < html.indexOf('Upcast / upgrades'));
  assert.ok(html.indexOf('Upcast / upgrades') < html.indexOf('SOURCE'));
  assert.ok(html.includes('&lt;img src=x onerror=bad()&gt;\n&quot;Level 5&quot; &amp; more'));
  assert.ok(!html.includes('<img'));
  assert.ok(!HUD.renderAbilityDetails(TL.item({ upgrades: '  \n ' })).includes('ability-upgrades'));
});

test('shortening open details clamps only invalid pages while preserving layout and other selections', () => {
  let state = TL.empty();
  state.library = [
    TL.libraryEntry({ description: 'Base', upgrades: 'u'.repeat(40000) }),
    TL.libraryEntry({ description: 'Other '.repeat(700) }),
  ];
  state.characters = [TL.character(), TL.character()];
  for (const [index, c] of state.characters.entries()) {
    TL.attachItem(state, c.id, state.library[index].id);
    Object.assign(c.hud, {
      detailId: c.items[0].id,
      page: index ? 2 : 40,
      rotation: index ? 270 : 90,
      scale: 0.7,
      x: 32,
      y: 61,
      expanded: true,
    });
  }
  state = TL.normalize(state);
  const before = TL.clone(state);
  state.library[0].upgrades = 'Short upgrade';
  state = TL.normalize(state);
  assert.equal(state.characters[0].hud.page, 0);
  assert.deepEqual(state.characters[0].hud, { ...before.characters[0].hud, page: 0 });
  assert.deepEqual(state.characters[1], before.characters[1]);
});
