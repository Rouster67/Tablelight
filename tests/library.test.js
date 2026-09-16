/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const TL = require('../core');
const { Store } = require('../storage');

function legacy() {
  const a = TL.character(),
    b = TL.character(1);
  a.resources = [{ id: 'a-pool', name: 'A charges', current: 3, max: 3, reset: 'short' }];
  b.resources = [{ id: 'b-pool', name: 'B charges', current: 2, max: 4, reset: 'long' }];
  a.items = [
    TL.item({
      id: 'a-item',
      name: 'User test feature',
      description: 'Test text',
      kind: 'feature',
      economy: 'bonus',
      resourceId: 'a-pool',
    }),
  ];
  b.items = [
    TL.item({ ...a.items[0], id: 'b-item', resourceId: 'b-pool', resourceCost: 2, disabled: true }),
  ];
  a.hud.detailId = 'a-item';
  a.hud.rotation = 90;
  b.hud.rotation = 270;
  return { version: 1, characters: [a, b] };
}

test('new library is empty and can exist without a character', () => {
  const state = TL.empty();
  assert.deepEqual(state.library, []);
  state.library.push(TL.libraryEntry({ name: 'User entry' }));
  assert.equal(TL.normalize(state).library.length, 1);
});
test('migration deduplicates exact definitions and preserves every character binding and HUD', () => {
  const raw = legacy(),
    state = TL.normalize(raw);
  assert.equal(state.version, 11);
  assert.equal(state.library.length, 1);
  const [a, b] = state.characters;
  assert.equal(a.items[0].libraryId, b.items[0].libraryId);
  assert.equal(a.items[0].id, 'a-item');
  assert.equal(a.hud.detailId, 'a-item');
  assert.equal(a.hud.rotation, 90);
  assert.equal(b.hud.rotation, 270);
  assert.equal(a.items[0].resourceId, 'a-pool');
  assert.equal(b.items[0].resourceId, 'b-pool');
  assert.equal(b.items[0].resourceCost, 2);
  assert.equal(b.items[0].disabled, true);
  assert.equal(raw.characters[0].items[0].libraryId, undefined);
  assert.deepEqual(TL.normalize(state), state);
});
test('migration preserves same-name variations with different rules', () => {
  const raw = legacy();
  raw.characters[1].items[0].description = 'Different homebrew rule';
  const state = TL.normalize(raw);
  assert.equal(state.library.length, 2);
  assert.notEqual(state.characters[0].items[0].libraryId, state.characters[1].items[0].libraryId);
});
test('shared edits update linked characters without resetting live costs or placement', () => {
  let state = TL.normalize(legacy());
  TL.spend(state.characters[0], state.characters[0].items[0]);
  state.library[0].name = 'Edited once';
  state.library[0].description = 'Updated shared rules';
  state.library[0].economy = 'action';
  state = TL.normalize(state);
  for (const c of state.characters) {
    assert.equal(c.items[0].name, 'Edited once');
    assert.equal(c.items[0].description, 'Updated shared rules');
    assert.equal(c.items[0].economy, 'action');
  }
  assert.equal(state.characters[0].turn.bonus, false);
  assert.equal(state.characters[0].resources[0].current, 2);
  assert.equal(state.characters[1].resources[0].current, 2);
  assert.equal(state.characters[1].items[0].disabled, true);
});
test('attachment uses independent IDs, resource links, and turn state', () => {
  const state = TL.empty(),
    a = TL.character(),
    b = TL.character(1);
  state.characters = [a, b];
  const entry = TL.libraryEntry({ name: 'Shared test action' });
  state.library.push(entry);
  const one = TL.attachItem(state, a.id, entry.id),
    two = TL.attachItem(state, b.id, entry.id);
  assert.notEqual(one.id, two.id);
  TL.spend(a, one);
  assert.equal(a.turn.action, false);
  assert.equal(b.turn.action, true);
  assert.equal(two.disabled, false);
  assert.throws(() => TL.attachItem(state, a.id, entry.id), /already has/);
  assert.throws(() => TL.attachItem(state, 'missing', entry.id), /no longer/);
});
test('removing characters or abilities retains the library and referenced deletion is blocked', () => {
  const state = TL.normalize(legacy()),
    id = state.library[0].id;
  assert.throws(() => TL.removeLibraryEntry(state, id), /Remove this entry/);
  state.characters[0].items = [];
  state.characters.splice(1, 1);
  assert.equal(TL.normalize(state).library.length, 1);
  TL.removeLibraryEntry(state, id);
  assert.equal(state.library.length, 0);
});
test('storage writes shared definitions once and can reload linked entries and empty parties', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tablelight-library-'));
  try {
    const store = new Store(dir),
      state = TL.normalize(legacy());
    store.save(state);
    const raw = JSON.parse(fs.readFileSync(store.file, 'utf8'));
    assert.equal(raw.version, 11);
    assert.equal(raw.library[0].description, 'Test text');
    assert.equal(raw.characters[0].items[0].description, undefined);
    assert.deepEqual(store.load().state, state);
    state.characters = [];
    store.save(state);
    assert.equal(store.load().state.library.length, 1);
    fs.writeFileSync(store.file, 'broken');
    const recovered = store.load();
    assert.ok(recovered.warning);
    assert.equal(recovered.state.characters.length, 2);
    assert.equal(recovered.state.library.length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('invalid library links, IDs and data reject the backup without silent data loss', () => {
  const state = TL.normalize(legacy());
  state.characters[0].items[0].libraryId = 'missing';
  assert.throws(() => TL.normalize(state), /missing library entry/);
  assert.throws(() => TL.normalize({ ...TL.empty(), library: {} }), /must be a list/);
  assert.throws(
    () => TL.normalize({ ...TL.empty(), library: [{ id: 'same' }, { id: 'same' }] }),
    /Library IDs/
  );
  assert.throws(() => TL.normalize({ ...TL.empty(), version: 99 }), /supported/);
});
