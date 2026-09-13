/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const TL = require('../core');
const { Store } = require('../storage');

test('old parties migrate intact to an eight-seat party with an empty saved roster', () => {
  for (const version of [1, 2]) {
    const chars = Array.from({ length: 6 }, (_, i) => TL.character(i));
    const legacy = {
      version,
      characters: chars,
      activeId: chars[2].id,
      settings: { partyOrderVersion: 1 },
    };
    const state = TL.normalize(legacy);
    assert.equal(state.version, 5);
    assert.deepEqual(state.characters, chars);
    assert.deepEqual(state.roster, []);
    assert.equal(state.activeId, chars[2].id);
  }
});
test('thousands of saved players survive normalization while party membership is capped at eight', () => {
  const state = TL.empty();
  state.roster = Array.from({ length: 1500 }, (_, i) => TL.character(i));
  for (let i = 0; i < 8; i++) TL.addToParty(state, state.roster[0].id);
  const before = TL.clone(state);
  assert.throws(() => TL.addToParty(state, state.roster[0].id), /full/);
  assert.deepEqual(state, before);
  const normalized = TL.normalize(state);
  assert.equal(normalized.characters.length, 8);
  assert.equal(TL.allCharacters(normalized).length, 1500);
  assert.equal(new Set(TL.allCharacters(normalized).map((c) => c.id)).size, 1500);
  assert.throws(() => TL.addToParty(state, state.characters[0].id), /already/);
});
test('removing and rejoining a player preserves every character field and the turn order', () => {
  const state = TL.empty();
  const c = TL.character();
  c.hp = 3;
  c.tempHp = 7;
  c.turn.action = false;
  c.hud.rotation = 237;
  c.hud.x = 43;
  c.hud.expanded = true;
  c.resources.push({ id: 'charges', name: 'User pool', max: 5, current: 2, reset: 'manual' });
  c.slots[0] = { level: 1, max: 4, current: 1 };
  c.items.push(TL.item({ name: 'User ability', resourceId: 'charges' }));
  state.characters = [c, TL.character(), TL.character()];
  const normalized = TL.normalize(state);
  normalized.activeId = c.id;
  const before = TL.clone(normalized.characters[0]);
  TL.removeFromParty(normalized, c.id);
  assert.deepEqual(normalized.roster[0], before);
  assert.equal(normalized.activeId, normalized.characters[0].id);
  assert.throws(
    () => TL.hudCommand(normalized, { type: 'hp', characterId: c.id, amount: -1 }),
    /no longer in the party/
  );
  TL.addToParty(normalized, c.id);
  assert.deepEqual(normalized.characters[2], before);
  assert.deepEqual(normalized.roster, []);
});
test('shared definitions update inactive players and remain protected from deletion', () => {
  let state = TL.empty();
  const c = TL.character();
  state.roster.push(c);
  const entry = TL.libraryEntry({
    name: 'Shared spell',
    kind: 'spell',
    level: 1,
    description: 'Original',
  });
  state.library.push(entry);
  TL.attachItem(state, c.id, entry.id, { disabled: true });
  state.library[0].description = 'Edited once';
  state = TL.normalize(state);
  assert.equal(state.roster[0].items[0].description, 'Edited once');
  assert.equal(state.roster[0].items[0].disabled, true);
  assert.throws(() => TL.removeLibraryEntry(state, entry.id), /Remove this entry/);
  TL.deletePlayer(state, c.id);
  assert.equal(state.library.length, 1);
});
test('TV payload excludes inactive players, shared library, and private notes', () => {
  const state = TL.empty();
  state.characters = [TL.character()];
  state.roster = [TL.character()];
  state.characters[0].notes = 'private DM notes';
  state.roster[0].name = 'Inactive private player';
  const payload = TL.overlayState(state);
  assert.equal(payload.characters.length, 1);
  assert.equal(payload.roster, undefined);
  assert.equal(payload.library, undefined);
  assert.ok(!JSON.stringify(payload).includes('private'));
  payload.characters[0].hp = 0;
  assert.equal(state.characters[0].hp, 10);
});
test('deleting the current, last, or inactive player keeps other saved players and library', () => {
  const state = TL.empty();
  state.characters = [TL.character(), TL.character()];
  state.roster = [TL.character()];
  state.activeId = state.characters[1].id;
  const savedId = state.roster[0].id;
  TL.deletePlayer(state, state.activeId);
  assert.equal(state.activeId, state.characters[0].id);
  TL.deletePlayer(state, state.activeId);
  assert.equal(state.activeId, '');
  assert.equal(state.characters.length, 0);
  assert.equal(state.roster[0].id, savedId);
  TL.deletePlayer(state, savedId);
  assert.equal(TL.allCharacters(state).length, 0);
});
test('whole-party turn changes leave saved players untouched', () => {
  const state = TL.empty();
  state.characters = [TL.character(), TL.character()];
  state.roster = [TL.character()];
  state.roster[0].turn.action = false;
  state.roster[0].hp = 1;
  const saved = TL.clone(state.roster);
  for (let i = 0; i < 5; i++) TL.nextTurn(state);
  state.characters.forEach((c) => TL.rest(c, 'long'));
  assert.deepEqual(state.roster, saved);
});
test('save and backup round trips preserve both collections and write each shared definition once', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tablelight-roster-'));
  try {
    const state = TL.empty(),
      store = new Store(dir);
    state.characters = [TL.character()];
    state.roster = [TL.character()];
    const entry = TL.libraryEntry({ name: 'Homebrew', description: 'Only one stored definition' });
    state.library.push(entry);
    for (const c of TL.allCharacters(state)) TL.attachItem(state, c.id, entry.id);
    store.save(state);
    const raw = fs.readFileSync(store.file, 'utf8');
    assert.equal(raw.split(entry.description).length - 1, 1);
    const loaded = store.load().state;
    assert.equal(loaded.roster[0].items[0].description, entry.description);
    assert.deepEqual(TL.normalize(TL.toBackup(loaded)), loaded);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
test('invalid or duplicated roster data is rejected rather than silently dropped', () => {
  const c = TL.character();
  assert.throws(() => TL.normalize({ version: 3, characters: [] }), /roster/);
  assert.throws(() => TL.normalize({ version: 3, characters: [c], roster: [c] }), /unique/);
  assert.throws(() => TL.normalize({ version: 3, characters: [], roster: [c, c] }), /unique/);
  assert.throws(() => TL.normalize({ version: 3, characters: [], roster: [null] }));
});
