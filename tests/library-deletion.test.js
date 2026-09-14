/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const TL = require('../core'),
  { Store } = require('../storage');

function fixture() {
  const state = TL.empty();
  state.library = [
    TL.libraryEntry({
      name: 'Shared spell',
      kind: 'spell',
      level: 1,
      description: 'Manual rules',
      source: 'My reference',
      upgrades: 'My upgrade',
      attack: 'Manual attack',
      save: 'Manual save',
      onSave: 'Half damage',
      requiresConcentration: true,
    }),
    TL.libraryEntry({ name: 'Unrelated spell' }),
  ];
  for (let i = 0; i < 3; i++) {
    const c = TL.character(i);
    c.resources = [{ id: 'pool-' + i, name: 'Charges', current: 3, max: 4, reset: 'long' }];
    c.slots[0] = { level: 1, current: 3, max: 4 };
    state.characters.push(c);
    const it = TL.attachItem(state, c.id, state.library[0].id, {
      resourceId: 'pool-' + i,
      resourceCost: i + 1,
      disabled: i === 1,
    });
    TL.attachItem(state, c.id, state.library[1].id);
    TL.createLocalItem(state, c.id, {
      name: 'Shared spell',
      description: 'Existing local version',
    });
    Object.assign(c.hud, { panel: 'spell', detailId: it.id, rotation: i * 90, scale: 1.25 });
    TL.setConcentration(c, true, it.id);
  }
  TL.removeFromParty(state, state.characters[2].id);
  return TL.normalize(state);
}

test('deleting with all local copies preserves names, assignments, costs, concentration and HUDs across party and roster', () => {
  const state = fixture(),
    id = state.library[0].id,
    before = TL.clone(state);
  TL.deleteLibraryEntry(
    state,
    id,
    TL.allCharacters(state).map((c) => c.id),
    TL.libraryAssignments(state, id)
  );
  assert.equal(state.library.length, 1);
  assert.equal(state.library[0].id, before.library[1].id);
  for (const [index, c] of TL.allCharacters(state).entries()) {
    const old = TL.allCharacters(before)[index];
    assert.equal(c.items.length, old.items.length);
    assert.deepEqual(c.items[0], { ...old.items[0], libraryId: '', local: true });
    assert.deepEqual(c.items.slice(1), old.items.slice(1));
    assert.deepEqual({ ...c, items: old.items }, old);
  }
  assert.deepEqual(TL.normalize(TL.toBackup(state)), state);
});

test('mixed choices remove unchecked assignments, retain existing locals, and clear only removed HUD and concentration links', () => {
  const state = fixture(),
    before = TL.clone(state),
    [a, b, inactive] = TL.allCharacters(state);
  TL.deleteLibraryEntry(state, state.library[0].id, [a.id, inactive.id]);
  assert.ok(a.items[0].local && inactive.items[0].local);
  assert.deepEqual(b.items, before.characters[1].items.slice(1));
  assert.equal(b.hud.detailId, '');
  assert.equal(b.concentrating, false);
  assert.equal(b.concentrationItemId, '');
  assert.equal(b.hud.rotation, before.characters[1].hud.rotation);
  assert.deepEqual(b.resources, before.characters[1].resources);
  assert.deepEqual(b.slots, before.characters[1].slots);
  assert.deepEqual(b.turn, before.characters[1].turn);
  assert.deepEqual(TL.normalize(TL.toBackup(state)), state);
});

test('remove and delete affects all assigned characters but leaves unrelated concentration and selected abilities alone', () => {
  const state = fixture(),
    before = TL.clone(state),
    b = state.characters[1];
  b.hud.detailId = b.items[1].id;
  state.library[1].requiresConcentration = true;
  for (const c of TL.allCharacters(state)) c.items[1].requiresConcentration = true;
  TL.setConcentration(b, true, b.items[1].id);
  TL.deleteLibraryEntry(state, state.library[0].id);
  assert.ok(TL.allCharacters(state).every((c) => c.items.length === 2));
  assert.equal(b.hud.detailId, before.characters[1].items[1].id);
  assert.equal(b.concentrationItemId, b.hud.detailId);
  assert.ok(b.concentrating);
  assert.ok(
    TL.allCharacters(state).every((c) => c.items[1].description === 'Existing local version')
  );
  assert.deepEqual(TL.normalize(TL.toBackup(state)), state);
});

test('confirmation uses the latest shared details and resource values without spending or refunding costs', () => {
  const state = fixture(),
    id = state.library[0].id,
    c = state.characters[0],
    reviewed = TL.libraryAssignments(state, id);
  TL.setConcentration(c, false);
  TL.spend(c, c.items[0], 1);
  state.library[0].description = 'Edited while the dialog was open';
  c.items[0].resourceCost = 2;
  TL.deleteLibraryEntry(state, id, [c.id], reviewed);
  assert.equal(c.resources[0].current, 2);
  assert.equal(c.slots[0].current, 2);
  assert.equal(c.turn.action, false);
  assert.equal(c.items[0].resourceCost, 2);
  assert.equal(c.items[0].description, 'Edited while the dialog was open');
  assert.ok(c.concentrating);
  assert.deepEqual(TL.normalize(TL.toBackup(state)), state);
});

test('changed assignments and invalid destinations reject deletion before any mutation', () => {
  const state = fixture(),
    id = state.library[0].id,
    reviewed = TL.libraryAssignments(state, id),
    c = state.characters[0];
  c.items = c.items.filter((it) => it.libraryId !== id);
  TL.attachItem(state, c.id, id);
  const before = TL.clone(state);
  assert.throws(
    () => TL.deleteLibraryEntry(state, id, [c.id], reviewed),
    /assigned characters changed/
  );
  assert.throws(() => TL.deleteLibraryEntry(state, id, ['missing']), /no longer has/);
  assert.throws(() => TL.deleteLibraryEntry(state, 'missing'), /no longer exists/);
  assert.deepEqual(state, before);
});

test('conversion works at the character limit and survives disk save, backup import and recovery', () => {
  const state = fixture(),
    c = state.characters[0];
  while (c.items.length < 500) TL.createLocalItem(state, c.id, { name: 'Other ' + c.items.length });
  TL.deleteLibraryEntry(
    state,
    state.library[0].id,
    TL.allCharacters(state).map((c) => c.id)
  );
  assert.equal(c.items.length, 500);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tablelight-library-delete-'));
  try {
    const store = new Store(dir),
      saved = store.save(state);
    assert.deepEqual(store.load().state, saved);
    assert.deepEqual(TL.normalize(TL.toBackup(saved)), saved);
    store.save(saved);
    fs.writeFileSync(store.file, 'broken');
    const recovered = store.load();
    assert.ok(recovered.warning);
    assert.deepEqual(recovered.state, saved);
    assert.equal(recovered.state.library.length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
