/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test'),
  assert = require('node:assert/strict');
const TL = require('../core');

test('new abilities default to no spell level; existing cantrips and leveled spells retain levels', () => {
  assert.equal(TL.item().level, null);
  assert.equal(TL.libraryEntry().level, null);
  assert.equal(TL.libraryEntry({ kind: 'spell' }).level, null);
  assert.equal(TL.libraryEntry({ kind: 'spell', level: '' }).level, null);
  assert.equal(TL.libraryEntry({ kind: 'action', level: 0 }).level, null);
  assert.equal(TL.libraryEntry({ kind: 'spell', level: 0 }).level, 0);
  assert.equal(TL.libraryEntry({ kind: 'spell', level: 4 }).level, 4);
  const c = TL.character();
  c.slots[0] = { level: 1, max: 2, current: 2 };
  TL.spend(c, TL.item({ kind: 'spell', level: null }));
  assert.equal(c.slots[0].current, 2);
  assert.equal(TL.levelLabel({ level: null }), 'No spell level');
  assert.equal(TL.levelLabel({ level: 0 }), 'Cantrip');
});
test('skill and save proficiency bubbles apply one or two proficiency bonuses and preserve overrides', () => {
  const c = TL.character();
  c.proficiency = 3;
  c.abilities.dex = 16;
  TL.setRank(c, 'skill', 'Stealth', 1);
  assert.equal(TL.skillBonus(c, 'Stealth'), 6);
  TL.setRank(c, 'skill', 'Stealth', 2);
  assert.equal(TL.skillBonus(c, 'Stealth'), 9);
  c.skills.Stealth.override = 12;
  TL.setRank(c, 'skill', 'Stealth', 0);
  assert.equal(TL.skillBonus(c, 'Stealth'), 12);
  TL.setRank(c, 'save', 'dex', 2);
  assert.equal(TL.saveRank(c, 'dex'), 2);
  assert.equal(TL.saveBonus(c, 'dex'), 9);
  assert.ok(c.saves.includes('dex'));
  TL.setRank(c, 'save', 'dex', 1);
  assert.equal(TL.saveBonus(c, 'dex'), 6);
  assert.ok(!c.saveExpertise.includes('dex'));
  TL.setRank(c, 'save', 'dex', 0);
  assert.equal(TL.saveBonus(c, 'dex'), 3);
  assert.ok(!c.saves.includes('dex'));
  assert.throws(() => TL.setRank(c, 'save', 'invalid', 2));
  assert.throws(() => TL.setRank(c, 'skill', 'Stealth', 3));
});
test('old save proficiency migrates and expertise survives backup round trip', () => {
  const raw = { version: 1, characters: [{ ...TL.character(), saves: ['str', 'wis'] }] };
  delete raw.characters[0].saveExpertise;
  const state = TL.normalize(raw),
    c = state.characters[0];
  assert.equal(TL.saveRank(c, 'str'), 1);
  TL.setRank(c, 'save', 'wis', 2);
  const loaded = TL.normalize(TL.toBackup(state));
  assert.equal(TL.saveRank(loaded.characters[0], 'wis'), 2);
  assert.equal(TL.saveRank(loaded.characters[0], 'str'), 1);
});
test('temporary HP controls and damage affect only the named character', () => {
  const state = TL.empty();
  state.characters = [TL.character(), TL.character(1)];
  const [a, b] = state.characters;
  TL.hudCommand(state, { type: 'temp-hp', characterId: a.id, amount: 8 });
  TL.hudCommand(state, { type: 'hp', characterId: a.id, amount: -5 });
  assert.equal(a.tempHp, 3);
  assert.equal(a.hp, 10);
  TL.hudCommand(state, { type: 'hp', characterId: a.id, amount: -6 });
  assert.equal(a.tempHp, 0);
  assert.equal(a.hp, 7);
  assert.equal(b.hp, 10);
  TL.hudCommand(state, { type: 'temp-hp', characterId: a.id, amount: -100 });
  assert.equal(a.tempHp, 0);
  TL.hudCommand(state, {
    type: 'proficiency',
    characterId: a.id,
    kind: 'save',
    name: 'dex',
    rank: 2,
  });
  assert.equal(TL.saveRank(a, 'dex'), 2);
  assert.equal(TL.saveRank(b, 'dex'), 0);
});
test('manual party order drives turns without changing seating or the current turn', () => {
  const state = TL.empty();
  state.characters = Array.from({ length: 3 }, (_, i) => {
    const c = TL.character(i);
    c.initiative = 20 - i * 5;
    return c;
  });
  const [a, b, c] = state.characters;
  state.activeId = a.id;
  const placements = Object.fromEntries(state.characters.map((c) => [c.id, TL.clone(c.hud)]));
  TL.reorderParty(state, [a.id, c.id, b.id]);
  assert.equal(state.activeId, a.id);
  assert.equal(TL.nextTurn(state).id, c.id);
  assert.equal(TL.nextTurn(state).id, b.id);
  assert.equal(state.round, undefined);
  assert.equal(TL.nextTurn(state).id, a.id);
  assert.equal(state.round, undefined);
  TL.moveParty(state, a.id, 1);
  assert.deepEqual(
    state.characters.map((c) => c.id),
    [c.id, a.id, b.id]
  );
  const loaded = TL.normalize(TL.toBackup(state));
  assert.deepEqual(
    loaded.characters.map((c) => c.id),
    [c.id, a.id, b.id]
  );
  for (const character of loaded.characters)
    assert.deepEqual(character.hud, placements[character.id]);
  assert.throws(() => TL.reorderParty(state, [a.id, a.id, b.id]));
});
test('old parties migrate to their existing initiative sequence once', () => {
  const a = TL.character(),
    b = TL.character(1);
  a.initiative = 5;
  b.initiative = 20;
  const state = TL.normalize({ version: 2, characters: [a, b] });
  assert.deepEqual(
    state.characters.map((c) => c.id),
    [b.id, a.id]
  );
  TL.reorderParty(state, [a.id, b.id]);
  assert.deepEqual(
    TL.normalize(state).characters.map((c) => c.id),
    [a.id, b.id]
  );
});
test('action-cost panels include actions, spells and features across every economy', () => {
  const c = TL.character();
  for (const economy of ['action', 'bonus', 'reaction', 'free'])
    for (const kind of ['action', 'spell', 'feature'])
      c.items.push(TL.item({ kind, economy, name: kind + ' ' + economy }));
  for (const economy of ['action', 'bonus', 'reaction', 'free']) {
    c.hud.panel = economy;
    assert.equal(TL.panelItems(c).length, 3);
    assert.deepEqual(
      TL.panelItems(c).map((i) => i.kind),
      ['action', 'spell', 'feature']
    );
  }
  c.hud.panel = 'spell';
  assert.equal(TL.panelItems(c).length, 4);
});
