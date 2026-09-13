/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test'),
  assert = require('node:assert/strict'),
  TL = require('../core');
function fixture() {
  const c = TL.character();
  c.items = [
    TL.item({ name: 'Old ward', requiresConcentration: true, economy: 'free' }),
    TL.item({
      name: 'New ward',
      kind: 'spell',
      level: 1,
      requiresConcentration: true,
      resourceId: 'focus',
      resourceCost: 1,
    }),
    TL.item({ name: 'Other ward', requiresConcentration: true }),
  ];
  c.slots[0] = { level: 1, current: 2, max: 2 };
  c.resources = [{ id: 'focus', name: 'Focus', current: 2, max: 2, reset: 'manual' }];
  TL.setConcentration(c, true, c.items[0].id);
  return c;
}
test('a confirmed concentration use switches the tracked ability and spends its costs together', () => {
  const c = fixture(),
    before = TL.clone(c),
    it = c.items[1];
  const warning = TL.concentrationUseWarning(c, it);
  assert.match(warning.message, /Using New ward will end concentration on Old ward/);
  assert.throws(() => TL.spend(c, it, 1), /concentration warning/);
  assert.deepEqual(c, before);
  TL.spend(c, it, 1, warning.token);
  assert.equal(c.turn.action, false);
  assert.equal(c.slots[0].current, 1);
  assert.equal(c.resources[0].current, 1);
  assert.equal(c.concentrating, true);
  assert.equal(c.concentrationItemId, it.id);
  assert.equal(c.concentration, 'New ward');
});
test('HUD uses reject missing and stale confirmations without changing state', () => {
  const c = fixture(),
    s = TL.empty();
  s.characters = [c];
  const command = { type: 'use', characterId: c.id, itemId: c.items[1].id, level: 1 };
  let before = TL.clone(s);
  assert.throws(() => TL.hudCommand(s, command), /concentration warning/);
  assert.deepEqual(s, before);
  const oldToken = TL.concentrationUseWarning(c, c.items[1]).token;
  c.items[2].name = c.items[0].name;
  TL.setConcentration(c, true, c.items[2].id);
  before = TL.clone(s);
  assert.throws(
    () => TL.hudCommand(s, { ...command, confirmedConcentration: oldToken }),
    /concentration warning/
  );
  assert.deepEqual(s, before);
  TL.hudCommand(s, {
    ...command,
    confirmedConcentration: TL.concentrationUseWarning(c, c.items[1]).token,
  });
  assert.equal(c.slots[0].current, 1);
  assert.equal(c.concentrationItemId, c.items[1].id);
  assert.equal(c.concentration, 'New ward');
});
test('ordinary uses preserve concentration and first concentration casts start it without a warning', () => {
  const c = fixture(),
    it = c.items[1];
  it.requiresConcentration = false;
  assert.equal(TL.concentrationUseWarning(c, it), null);
  TL.spend(c, it, 1);
  assert.equal(c.concentration, 'Old ward');
  TL.startTurn(c);
  TL.setConcentration(c, false);
  it.requiresConcentration = true;
  assert.equal(TL.concentrationUseWarning(c, it), null);
  TL.spend(c, it, 1);
  assert.equal(c.concentrating, true);
  assert.equal(c.concentrationItemId, it.id);
  assert.equal(c.concentration, it.name);
});
test('reusing the same concentration ability and legacy unnamed concentration still warn', () => {
  const c = fixture();
  assert.ok(TL.concentrationUseWarning(c, c.items[0]));
  assert.throws(() => TL.spend(c, c.items[0]), /concentration warning/);
  TL.spend(c, c.items[0], undefined, TL.concentrationUseWarning(c, c.items[0]).token);
  assert.equal(c.concentrationItemId, c.items[0].id);
  c.concentrationItemId = '';
  c.concentration = '';
  assert.match(TL.concentrationUseWarning(c, c.items[1]).message, /your current ability/);
  assert.throws(() => TL.spend(c, c.items[1], 1), /concentration warning/);
  TL.spend(c, c.items[1], 1, TL.concentrationUseWarning(c, c.items[1]).token);
  assert.equal(c.concentrationItemId, c.items[1].id);
  assert.equal(c.concentration, c.items[1].name);
});
test('confirmation does not bypass availability or apply to another character or ability', () => {
  const c = fixture(),
    other = fixture(),
    it = c.items[1];
  const token = TL.concentrationUseWarning(c, it).token;
  assert.throws(() => TL.spend(other, other.items[1], 1, token), /concentration warning/);
  assert.throws(() => TL.spend(c, c.items[2], undefined, token), /concentration warning/);
  c.slots[0].current = 0;
  const before = TL.clone(c);
  assert.throws(() => TL.spend(c, it, 1, token), /spell slot/);
  assert.deepEqual(c, before);
});

test('failed concentration uses preserve both the old concentration and every cost', () => {
  for (const failure of [
    'missing slot',
    'empty slot',
    'disabled',
    'empty resource',
    'spent action',
    'unassigned',
  ]) {
    const c = fixture(),
      it = c.items[1];
    if (failure === 'empty slot') c.slots[0].current = 0;
    if (failure === 'disabled') it.disabled = true;
    if (failure === 'empty resource') c.resources[0].current = 0;
    if (failure === 'spent action') c.turn.action = false;
    if (failure === 'unassigned') c.items.splice(1, 1);
    const before = TL.clone(c),
      token = TL.concentrationUseWarning(c, it).token;
    assert.throws(
      () => TL.spend(c, it, failure === 'missing slot' ? undefined : 1, token),
      failure
    );
    assert.deepEqual(c, before, failure);
  }
});

test('automatic concentration applies to every flagged ability type and persists only for its user', () => {
  for (const definition of [
    { kind: 'action', economy: 'action' },
    { kind: 'feature', economy: 'bonus' },
    { kind: 'spell', level: 0, economy: 'free' },
    { kind: 'spell', level: 2, usesSlot: false, economy: 'reaction', resourceId: 'focus' },
  ]) {
    const a = TL.character(),
      b = TL.character();
    for (const c of [a, b]) {
      c.resources = [{ id: 'focus', name: 'Focus', current: 2, max: 2, reset: 'manual' }];
      c.items = [TL.item({ ...definition, name: 'Shared focus', requiresConcentration: true })];
    }
    const s = TL.normalize({ version: 1, characters: [a, b], settings: {} });
    const c = s.characters[0],
      otherBefore = TL.clone(s.characters[1]);
    assert.equal(c.items[0].libraryId, s.characters[1].items[0].libraryId);
    TL.hudCommand(s, { type: 'use', characterId: c.id, itemId: c.items[0].id });
    assert.equal(c.concentrating, true);
    assert.equal(c.concentrationItemId, c.items[0].id);
    assert.equal(c.concentration, 'Shared focus');
    assert.deepEqual(s.characters[1], otherBefore);
    const loaded = TL.normalize(TL.toBackup(s));
    assert.equal(loaded.characters[0].concentrationItemId, c.items[0].id);
    assert.equal(loaded.characters[0].concentration, 'Shared focus');
    assert.equal(loaded.characters[1].concentrating, false);
  }
});
