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

test('formats 1–4 migrate with blank sources and preserve legacy text, IDs, and HUD choices', () => {
  for (const version of [1, 2, 3, 4]) {
    const c = TL.character();
    c.items = [
      TL.item({
        id: 'legacy',
        attack: '+7 or special roll',
        save: 'User save text',
        description: 'Full old description',
      }),
    ];
    delete c.items[0].source;
    c.hud.detailId = 'legacy';
    c.hud.rotation = 270;
    const raw = { version, characters: [c], roster: [], conditionLibrary: [] };
    const state = TL.normalize(raw);
    assert.equal(state.version, 10);
    assert.equal(state.library[0].source, '');
    for (const key of ['id', 'attack', 'save', 'description'])
      assert.equal(state.characters[0].items[0][key], c.items[0][key]);
    assert.deepEqual(state.characters[0].hud, c.hud);
    assert.deepEqual(TL.normalize(TL.toBackup(state)), state);
    assert.equal(raw.characters[0].items[0].source, undefined);
  }
  assert.throws(
    () => TL.normalize({ version: 5, characters: [], roster: [] }),
    /condition library/
  );
  assert.throws(() => TL.normalize({ ...TL.empty(), version: 11 }), /supported/);
});

test('source references distinguish legacy definitions without combining different editions', () => {
  const c = TL.character();
  c.items = ['Test edition A', 'Test edition B', 'Test edition A'].map((source) =>
    TL.item({ name: 'Same name', description: 'Same description', source })
  );
  const state = TL.normalize({ version: 1, characters: [c] });
  assert.equal(state.library.length, 2);
  const [a, b, again] = state.characters[0].items;
  assert.notEqual(a.libraryId, b.libraryId);
  assert.equal(a.libraryId, again.libraryId);
  assert.deepEqual(
    state.characters[0].items.map((it) => it.id),
    c.items.map((it) => it.id)
  );
  assert.equal(TL.libraryEntry({ source: 12 }).source, '');
  assert.equal(TL.libraryEntry({ source: 'x'.repeat(301) }).source.length, 300);
});

test('shared source edits survive storage and export with independent active and inactive characters', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tablelight-sources-'));
  try {
    const store = new Store(directory);
    let state = TL.empty();
    const a = TL.character(),
      b = TL.character();
    a.resources = [{ id: 'a-pool', name: 'A pool', current: 4, max: 4, reset: 'long' }];
    b.resources = [{ id: 'b-pool', name: 'B pool', current: 2, max: 6, reset: 'manual' }];
    state.characters = [a];
    state.roster = [b];
    state.library = [
      TL.libraryEntry({ name: 'Shared test', source: 'First reference' }),
      TL.libraryEntry({ name: 'Unused test', source: 'Unused reference' }),
    ];
    const libraryId = state.library[0].id;
    TL.attachItem(state, a.id, libraryId, { resourceId: 'a-pool', resourceCost: 2 });
    TL.attachItem(state, b.id, libraryId, {
      resourceId: 'b-pool',
      resourceCost: 1,
      disabled: true,
    });
    a.hud.detailId = a.items[0].id;
    a.hud.rotation = 90;
    b.hud.rotation = 270;
    TL.spend(a, a.items[0]);
    state = TL.normalize(state);
    const before = TL.clone(state);
    const source = 'Updated test reference <not markup> "page 42"';
    state.library[0].source = source;
    state = store.save(state);
    assert.deepEqual(store.load().state, state);
    for (const [i, c] of TL.allCharacters(state).entries()) {
      const original = TL.allCharacters(before)[i];
      const expected = TL.clone(original);
      expected.items[0].source = source;
      assert.deepEqual(c, expected);
    }
    const exported = JSON.parse(fs.readFileSync(store.file, 'utf8'));
    assert.equal(exported.library[0].source, source);
    assert.equal(exported.library[1].source, 'Unused reference');
    assert.ok(TL.allCharacters(exported).every((c) => !Object.hasOwn(c.items[0], 'source')));
    assert.deepEqual(TL.normalize(exported), state);
    assert.ok(!JSON.stringify(TL.overlayState(state)).includes('Unused reference'));
    state.library[0].source = '';
    state = store.save(state);
    assert.ok(TL.allCharacters(store.load().state).every((c) => c.items[0].source === ''));
    assert.equal(store.load().state.characters[0].resources[0].current, 2);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('DM and HUD details share escaped sources without replacing descriptions or changing paging', () => {
  const c = TL.character();
  const description = 'Synthetic description text. '.repeat(60);
  const source = '<img src=x onerror=alert(1)> "Test manual" & notes';
  c.items = [TL.item({ source, description, attack: 'Original attack', save: 'Original save' })];
  c.hud.expanded = true;
  c.hud.detailId = c.items[0].id;
  c.hud.page = 1;
  const details = HUD.abilityDetails(c.items[0]);
  assert.equal(details.description, description);
  assert.equal(details.source, source);
  assert.ok(!details.metadata.some(([label]) => label === 'Reference'));
  const pages = HUD.countPages(c);
  for (const html of [HUD.renderAbilityDetails(c.items[0]), HUD.render(c)]) {
    assert.ok(html.includes(HUD.esc(source)));
    assert.ok(!html.includes('<img src=x'));
    assert.ok(html.includes('Original attack'));
    assert.ok(html.includes('Original save'));
    assert.ok(html.indexOf('ability-source') > html.indexOf('description'));
  }
  c.items[0].source = '';
  assert.ok(!HUD.renderAbilityDetails(c.items[0]).includes('<small>Reference</small>'));
  assert.ok(!HUD.render(c).includes('<small>Reference</small>'));
  assert.equal(HUD.countPages(c), pages);
  assert.ok(HUD.render(c).includes(HUD.esc(HUD.pages(description)[1])));
});
