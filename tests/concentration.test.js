/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test'),
  assert = require('node:assert/strict'),
  TL = require('../core');
test('concentration flags are shared across all ability kinds and saved characters, defaulting off', () => {
  const s = TL.empty(),
    a = TL.character(),
    b = TL.character();
  s.characters = [a];
  s.roster = [b];
  for (const kind of ['action', 'spell', 'feature']) {
    assert.equal(TL.libraryEntry({ kind }).requiresConcentration, false);
    const entry = TL.libraryEntry({ name: kind, kind, requiresConcentration: true });
    s.library.push(entry);
    TL.attachItem(s, a.id, entry.id);
    TL.attachItem(s, b.id, entry.id);
  }
  const saved = TL.toBackup(s),
    loaded = TL.normalize(saved);
  assert.ok(saved.library.every((e) => e.requiresConcentration));
  assert.equal(saved.characters[0].items[0].requiresConcentration, undefined);
  assert.ok(
    [...loaded.characters, ...loaded.roster].every((c) =>
      c.items.every((it) => it.requiresConcentration)
    )
  );
  loaded.library[0].requiresConcentration = false;
  assert.ok(TL.allCharacters(TL.normalize(loaded)).every((c) => !c.items[0].requiresConcentration));
});
test('concentration choices include every assigned flagged turn cost regardless of spent costs', () => {
  const c = TL.character();
  c.turn.action = false;
  c.slots[0] = { level: 1, current: 0, max: 2 };
  c.items = ['action', 'bonus', 'reaction', 'free'].map((economy, i) =>
    TL.item({
      name: 'Option ' + i,
      kind: i % 2 ? 'spell' : 'feature',
      economy,
      requiresConcentration: true,
      disabled: true,
      description: 'Shared keyword',
    })
  );
  c.items.push(TL.item({ name: 'Not flagged' }));
  assert.equal(TL.concentrationChoices(c).length, 4);
  assert.equal(TL.concentrationChoices(c, 'KEYWORD 2')[0].name, 'Option 2');
  const before = TL.clone({ turn: c.turn, slots: c.slots, resources: c.resources });
  TL.setConcentration(c, true, c.items[0].id);
  assert.deepEqual({ turn: c.turn, slots: c.slots, resources: c.resources }, before);
  assert.throws(() => TL.setConcentration(c, true, c.items[4].id));
  assert.throws(() => TL.setConcentration(c, true, 'typed spell name'));
});
test('concentration follows its character binding and shared renames, ending if removed or unflagged', () => {
  let s = TL.empty();
  const a = TL.character(),
    b = TL.character();
  s.characters = [a, b];
  const e = TL.libraryEntry({ name: 'Same name', requiresConcentration: true });
  s.library.push(e);
  const first = TL.attachItem(s, a.id, e.id),
    second = TL.attachItem(s, b.id, e.id);
  TL.hudCommand(s, { type: 'concentration', characterId: a.id, active: true, itemId: first.id });
  assert.throws(() =>
    TL.hudCommand(s, { type: 'concentration', characterId: a.id, active: true, itemId: second.id })
  );
  assert.throws(() =>
    TL.hudCommand(s, {
      type: 'concentration',
      characterId: a.id,
      active: true,
      text: 'A free note',
    })
  );
  s.library[0].name = 'Renamed focus';
  s = TL.normalize(TL.toBackup(s));
  assert.equal(s.characters[0].concentration, 'Renamed focus');
  assert.equal(s.characters[0].concentrationItemId, first.id);
  assert.equal(s.characters[1].concentrating, false);
  TL.setConcentration(s.characters[1], true, second.id);
  s.characters[0].items = [];
  s = TL.normalize(s);
  assert.equal(s.characters[0].concentrating, false);
  assert.equal(s.characters[1].concentrating, true);
  s.library[0].requiresConcentration = false;
  s = TL.normalize(s);
  assert.equal(s.characters[1].concentrating, false);
  assert.equal(s.characters[1].concentrationItemId, '');
});
test('legacy concentration notes survive without guessing ability flags or binding by name', () => {
  const c = TL.character();
  delete c.concentrationItemId;
  c.concentrating = true;
  c.concentration = 'Existing saved note';
  c.items = [TL.item({ name: 'Existing saved note' })];
  const s = TL.normalize({ version: 4, characters: [c], roster: [], conditionLibrary: [] });
  assert.equal(s.characters[0].concentration, 'Existing saved note');
  assert.equal(s.characters[0].concentrating, true);
  assert.equal(s.characters[0].concentrationItemId, '');
  assert.equal(s.library[0].requiresConcentration, false);
  TL.setConcentration(s.characters[0], false);
  assert.equal(TL.normalize(TL.toBackup(s)).characters[0].concentration, '');
});
