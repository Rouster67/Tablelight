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
      name: 'Guiding Bolt',
      kind: 'spell',
      level: 1,
      description: 'Entered rules',
      source: 'My reference',
      upgrades: 'Higher slot text',
      trigger: 'Trigger text',
      area: 'Area text',
      castingTime: '1 action',
      school: 'School text',
      attack: 'Manual attack',
      save: 'Manual save',
      onSave: 'No damage',
      damage: 'User damage',
      requirements: 'Requirement text',
      special: 'Special text',
      requiresConcentration: true,
    }),
  ];
  state.characters = [TL.character(), TL.character(1)];
  for (const [i, c] of state.characters.entries()) {
    c.resources = [{ id: 'pool-' + i, name: 'Special casts', current: 2, max: 2, reset: 'long' }];
    c.slots[0] = { level: 1, current: 3, max: 3 };
    const it = TL.attachItem(state, c.id, state.library[0].id);
    c.hud.detailId = it.id;
    c.hud.rotation = i ? 270 : 90;
  }
  return TL.normalize(state);
}

test('library duplicates copy all details with new IDs and numbered names, without assigning characters', () => {
  const state = fixture(),
    before = TL.clone(state);
  const one = TL.duplicateLibraryEntry(state, state.library[0].id);
  assert.equal(one.name, 'Guiding Bolt (1)');
  assert.notEqual(one.id, state.library[0].id);
  assert.deepEqual(one, { ...before.library[0], id: one.id, name: 'Guiding Bolt (1)' });
  assert.equal(TL.duplicateLibraryEntry(state, one.id).name, 'Guiding Bolt (2)');
  state.library.push(TL.libraryEntry({ name: 'guiding bolt (3)' }));
  assert.equal(TL.duplicateLibraryEntry(state, state.library[0].id).name, 'Guiding Bolt (4)');
  assert.deepEqual(state.characters, before.characters);
  one.description = 'Different version';
  assert.deepEqual(state.library[0], before.library[0]);
  const long = TL.libraryEntry({ name: 'x'.repeat(300) });
  state.library.push(long);
  const copy = TL.duplicateLibraryEntry(state, long.id);
  assert.equal(copy.name.length, 300);
  assert.ok(copy.name.endsWith(' (1)'));
  assert.ok(TL.duplicateLibraryEntry(state, copy.id).name.endsWith(' (2)'));
});

test('local duplicates copy details and cost settings without changing library, resources, selections, or another character', () => {
  const state = fixture(),
    c = state.characters[0],
    original = c.items[0];
  Object.assign(original, { resourceId: 'pool-0', resourceCost: 2, disabled: true });
  TL.setConcentration(c, true, original.id);
  const before = TL.clone(state),
    copy = TL.duplicateLocalItem(state, c.id, original.id);
  assert.deepEqual(copy, {
    ...original,
    id: copy.id,
    libraryId: '',
    local: true,
    name: 'Guiding Bolt (1)',
  });
  assert.notEqual(copy.id, original.id);
  const expected = TL.clone(before);
  expected.characters[0].items.push(copy);
  assert.deepEqual(state, expected);
  assert.equal(TL.duplicateLocalItem(state, c.id, copy.id).name, 'Guiding Bolt (2)');
  assert.equal(
    TL.duplicateLocalItem(state, state.characters[1].id, state.characters[1].items[0].id).name,
    'Guiding Bolt (1)'
  );
  assert.deepEqual(state.library, before.library);
});

test('local edits and shared edits stay independent, and deleting the source leaves local copies usable', () => {
  let state = fixture();
  const c = state.characters[0],
    copy = TL.duplicateLocalItem(state, c.id, c.items[0].id),
    copyId = copy.id,
    sharedId = state.library[0].id;
  Object.assign(copy, {
    usesSlot: false,
    resourceId: 'pool-0',
    description: 'Only my character',
    name: 'Private version',
  });
  state.library[0].description = 'Shared revision';
  state = TL.normalize(state);
  assert.ok(state.characters.every((c) => c.items[0].description === 'Shared revision'));
  assert.equal(state.characters[0].items[1].description, 'Only my character');
  for (const c of state.characters) c.items = c.items.filter((it) => it.local);
  TL.removeLibraryEntry(state, sharedId);
  state = TL.normalize(TL.toBackup(state));
  assert.equal(state.library.length, 0);
  assert.equal(state.characters[0].items[0].id, copyId);
  TL.spend(state.characters[0], state.characters[0].items[0]);
  assert.equal(state.characters[0].resources[0].current, 1);
  assert.equal(state.characters[0].slots[0].current, 3);
});

test('local variants survive inactive roster, save/export/import, and recovery without becoming library entries', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tablelight-duplicates-'));
  try {
    let state = fixture();
    const c = state.characters[0],
      copy = TL.duplicateLocalItem(state, c.id, c.items[0].id);
    // Even an exact match stays local; matching old unlinked entries still migrate normally.
    copy.name = c.items[0].name;
    c.hud.detailId = copy.id;
    TL.setConcentration(c, true, copy.id);
    TL.removeFromParty(state, c.id);
    const store = new Store(dir);
    state = store.save(state);
    const raw = JSON.parse(fs.readFileSync(store.file, 'utf8'));
    assert.equal(raw.version, 9);
    assert.equal(raw.library.length, 1);
    assert.equal(raw.roster[0].items[1].local, true);
    assert.equal(raw.roster[0].items[1].special, 'Special text');
    assert.equal(raw.roster[0].items[0].special, undefined);
    assert.deepEqual(store.load().state, state);
    assert.deepEqual(TL.normalize(TL.toBackup(state)), state);
    store.save(state);
    fs.writeFileSync(store.file, 'broken');
    const recovered = store.load();
    assert.ok(recovered.warning);
    assert.deepEqual(recovered.state, state);
    TL.addToParty(state, c.id);
    state = TL.normalize(state);
    assert.equal(TL.findCharacter(state, c.id).hud.detailId, copy.id);
    assert.equal(TL.findCharacter(state, c.id).concentrationItemId, copy.id);
    assert.equal(state.library.length, 1);
    const old = TL.toBackup(fixture());
    old.version = 8;
    const upgraded = TL.normalize(old);
    assert.equal(upgraded.version, 9);
    assert.equal(upgraded.characters[0].items[0].local, undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('two special-resource casts leave slots intact while the original spends a slot and long rest restores the pool', () => {
  let state = fixture(),
    c = state.characters[0];
  const copy = TL.duplicateLocalItem(state, c.id, c.items[0].id);
  Object.assign(copy, {
    usesSlot: false,
    resourceId: 'pool-0',
    resourceCost: 1,
    requiresConcentration: false,
  });
  c.items[0].requiresConcentration = false;
  state.library[0].requiresConcentration = false;
  TL.spend(c, copy);
  TL.startTurn(c);
  TL.spend(c, copy);
  assert.equal(c.resources[0].current, 0);
  assert.equal(c.slots[0].current, 3);
  TL.startTurn(c);
  assert.match(TL.availability(c, copy), /Not enough/);
  TL.spend(c, c.items[0], 1);
  assert.equal(c.slots[0].current, 2);
  assert.equal(c.resources[0].current, 0);
  assert.equal(state.characters[1].slots[0].current, 3);
  TL.rest(c, 'long');
  assert.equal(c.resources[0].current, 2);
  assert.equal(c.slots[0].current, 3);
  state = TL.normalize(TL.toBackup(state));
  assert.equal(state.library.length, 1);
  assert.equal(state.characters[0].items[1].usesSlot, false);
});

test('new local abilities preserve manual fields and character costs without creating library entries', () => {
  const state = fixture(),
    before = TL.clone(state),
    c = state.characters[0];
  const definition = { ...state.library[0], name: '<Local ability>', usesSlot: false };
  const local = TL.createLocalItem(state, c.id, definition, {
    resourceId: 'pool-0',
    resourceCost: 2,
  });
  assert.equal(local.local, true);
  assert.equal(local.libraryId, '');
  assert.notEqual(local.id, definition.id);
  for (const key of TL.definitionFields) assert.deepEqual(local[key], definition[key]);
  const expected = TL.clone(before);
  expected.characters[0].items.push(local);
  assert.deepEqual(state, expected);
  assert.equal(local.resourceCost, 2);
  assert.equal(local.resourceId, 'pool-0');
  assert.deepEqual(TL.normalize(TL.toBackup(state)), state);
});

test('copying directly from the library works with or without an assignment and keeps independent names and costs', () => {
  const state = fixture(),
    c = state.characters[0],
    entry = state.library[0],
    library = TL.clone(state.library);
  c.items[0].resourceId = 'pool-0';
  c.items[0].disabled = true;
  const numbered = TL.copyLibraryItemLocally(state, c.id, entry.id);
  assert.equal(numbered.name, 'Guiding Bolt (1)');
  assert.equal(numbered.resourceId, '');
  assert.equal(numbered.disabled, false);
  assert.equal(numbered.usesSlot, true);
  c.items = [];
  c.hud.detailId = '';
  const copy = TL.copyLibraryItemLocally(state, c.id, entry.id);
  assert.equal(copy.name, entry.name);
  copy.description = 'Only this character';
  assert.equal(TL.copyLibraryItemLocally(state, c.id, entry.id).name, 'Guiding Bolt (1)');
  assert.deepEqual(state.library, library);
  assert.equal(state.characters[1].items.length, 1);
  assert.deepEqual(TL.normalize(TL.toBackup(state)), state);
});

test('new local abilities reject missing destinations, invalid resource links and full characters without mutation', () => {
  const state = fixture(),
    c = state.characters[0],
    before = TL.clone(state);
  assert.throws(() => TL.createLocalItem(state, 'missing'), /no longer/);
  assert.throws(() => TL.copyLibraryItemLocally(state, c.id, 'missing'), /no longer/);
  assert.throws(() => TL.createLocalItem(state, c.id, {}, { resourceId: 'pool-1' }), /belonging/);
  assert.deepEqual(state, before);
  c.items = Array.from({ length: 500 }, (_, i) => ({ ...c.items[0], id: String(i) }));
  const full = TL.clone(state);
  assert.throws(() => TL.createLocalItem(state, c.id), /500 abilities/);
  assert.throws(() => TL.copyLibraryItemLocally(state, c.id, state.library[0].id), /500 abilities/);
  assert.deepEqual(state, full);
});

test('invalid duplication requests and ambiguous local links fail before changing saved state', () => {
  const state = fixture(),
    before = TL.clone(state),
    c = state.characters[0];
  assert.throws(() => TL.duplicateLocalItem(state, 'missing', c.items[0].id), /no longer/);
  assert.throws(() => TL.duplicateLocalItem(state, c.id, 'missing'), /no longer/);
  assert.throws(() => TL.duplicateLibraryEntry(state, 'missing'), /no longer/);
  assert.deepEqual(state, before);
  const ambiguous = TL.clone(state);
  ambiguous.characters[0].items[0].local = true;
  assert.throws(() => TL.normalize(ambiguous), /cannot also link/);
  ambiguous.characters[0].items[0].local = 'true';
  assert.throws(() => TL.normalize(ambiguous), /true or false/);
  c.items = Array.from({ length: 500 }, (_, i) => ({ ...c.items[0], id: String(i) }));
  assert.throws(() => TL.duplicateLocalItem(state, c.id, '0'), /500 abilities/);
  state.library = Array.from({ length: 5000 }, (_, i) => ({ ...state.library[0], id: String(i) }));
  assert.throws(() => TL.duplicateLibraryEntry(state, '0'), /5,000/);
});
