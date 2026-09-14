/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test'),
  assert = require('node:assert/strict'),
  TL = require('../core');
const { hudRegions } = require('../window-shape');
test('legacy condition notes and concentration survive migration without seeded rules', () => {
  const c = TL.character();
  delete c.conditionIds;
  delete c.concentrating;
  c.conditions = 'My condition, with a qualifier';
  c.concentration = 'User-entered focus';
  const s = TL.normalize({ version: 3, characters: [c], roster: [] });
  assert.equal(s.version, 8);
  assert.equal(s.conditionLibrary.length, 1);
  assert.equal(s.characters[0].appliedConditions[0].name, c.conditions);
  assert.equal(s.characters[0].concentrating, true);
  assert.equal(s.characters[0].concentration, c.concentration);
  assert.deepEqual(TL.empty().conditionLibrary, []);
  assert.equal(TL.normalize(TL.toBackup(s)).conditionLibrary.length, 1);
});
test('shared conditions update active and saved players, with independent assignments and protected deletion', () => {
  let s = TL.empty();
  const a = TL.character(),
    b = TL.character();
  s.characters = [a];
  s.roster = [b];
  const e = TL.conditionEntry({ name: 'User condition', description: 'First description' });
  s.conditionLibrary.push(e);
  TL.assignCondition(s, a.id, e.id);
  TL.assignCondition(s, b.id, e.id);
  TL.assignCondition(s, a.id, e.id);
  assert.equal(a.conditionIds.length, 1);
  e.description = 'Edited once';
  s = TL.normalize(s);
  assert.equal(s.characters[0].appliedConditions[0].description, 'Edited once');
  assert.equal(s.roster[0].appliedConditions[0].description, 'Edited once');
  assert.throws(() => TL.removeConditionEntry(s, e.id));
  TL.unassignCondition(s, a.id, e.id);
  assert.throws(() => TL.removeConditionEntry(s, e.id));
  TL.unassignCondition(s, b.id, e.id);
  TL.removeConditionEntry(s, e.id);
  assert.equal(s.conditionLibrary.length, 0);
});
test('concentration selects an assigned flagged ability, stays scoped, and clears on long rest', () => {
  const s = TL.empty(),
    a = TL.character(),
    b = TL.character();
  s.characters = [a, b];
  const focus = TL.item({ name: 'My focus', requiresConcentration: true });
  a.items.push(focus);
  TL.hudCommand(s, { type: 'concentration', characterId: a.id, active: true, itemId: focus.id });
  assert.equal(a.concentrating, true);
  assert.equal(a.concentration, 'My focus');
  assert.equal(b.concentrating, false);
  let c = TL.normalize(TL.toBackup(s)).characters[0];
  assert.equal(c.concentrating, true);
  assert.equal(c.concentrationItemId, focus.id);
  TL.rest(c, 'short');
  assert.equal(c.concentration, 'My focus');
  TL.rest(c, 'long');
  assert.equal(c.concentrating, false);
  assert.equal(c.concentration, '');
  assert.equal(c.concentrationItemId, '');
  assert.throws(() => TL.setConcentration(c, 'true'));
  assert.throws(() =>
    TL.hudCommand(s, { type: 'concentration', characterId: 'missing', active: true })
  );
});
test('condition saves store shared descriptions once and only assigned conditions reach the TV', () => {
  const s = TL.empty(),
    c = TL.character();
  s.characters = [c];
  s.conditionLibrary = [
    TL.conditionEntry({ name: 'Assigned', description: 'Shared description' }),
    TL.conditionEntry({ name: 'Unused', description: 'Unused text' }),
  ];
  TL.assignCondition(s, c.id, s.conditionLibrary[0].id);
  const normalized = TL.normalize(s),
    backup = TL.toBackup(normalized),
    tv = TL.overlayState(normalized);
  assert.equal(backup.characters[0].appliedConditions, undefined);
  assert.equal(backup.characters[0].conditions, undefined);
  assert.equal(tv.conditionLibrary, undefined);
  assert.equal(tv.characters[0].appliedConditions.length, 1);
  assert.ok(!JSON.stringify(tv).includes('Unused text'));
  assert.throws(() => TL.normalize({ ...backup, conditionLibrary: undefined }));
  assert.throws(() => TL.normalize({ ...backup, conditionLibrary: [] }));
  assert.throws(() =>
    TL.normalize({
      ...backup,
      conditionLibrary: [backup.conditionLibrary[0], backup.conditionLibrary[0]],
    })
  );
});
test('Windows HUD regions include rotated controls and leave empty map corners outside the window', () => {
  const rects = hudRegions(
    [{ cx: 500, cy: 400, width: 400, height: 200, rotation: 45 }],
    1000,
    800
  );
  const hit = (x, y) =>
    rects.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
  assert.ok(hit(500, 400));
  assert.ok(hit(625, 525));
  assert.equal(hit(295, 605), false);
  assert.equal(hit(5, 5), false);
  assert.ok(
    rects.every((r) => r.x >= 0 && r.y >= 0 && r.x + r.width <= 1000 && r.y + r.height <= 800)
  );
  assert.deepEqual(hudRegions([], 1000, 800), []);
  assert.throws(() => hudRegions([{ width: NaN }], 1000, 800));
});

test('condition search is bounded, alphabetical, and exposes only saved definitions', () => {
  const s = TL.empty();
  s.conditionLibrary = Array.from({ length: 120 }, (_, i) =>
    TL.conditionEntry({
      name: 'Condition ' + String(i).padStart(3, '0'),
      description: i === 119 ? 'A rare description' : 'Common',
    })
  ).reverse();
  const result = TL.searchConditions(s);
  assert.equal(result.total, 120);
  assert.equal(result.entries.length, 100);
  assert.equal(result.entries[0].name, 'Condition 000');
  assert.deepEqual(Object.keys(result.entries[0]).sort(), ['description', 'id', 'name']);
  assert.equal(TL.searchConditions(s, 'RARE 119').entries[0].name, 'Condition 119');
  assert.equal(TL.searchConditions(s, 'missing').total, 0);
  assert.throws(() => TL.searchConditions(s, 'a'.repeat(301)));
  assert.throws(() => TL.searchConditions(s, {}));
});

test('overlay condition addition accepts existing definitions once and cannot create conditions or target inactive players', () => {
  const s = TL.empty(),
    a = TL.character(),
    b = TL.character(),
    saved = TL.character();
  s.characters = [a, b];
  s.roster = [saved];
  const e = TL.conditionEntry({ name: 'User condition' });
  s.conditionLibrary.push(e);
  const command = { type: 'condition-add', characterId: a.id, conditionId: e.id };
  TL.hudCommand(s, command);
  TL.hudCommand(s, command);
  assert.deepEqual(a.conditionIds, [e.id]);
  assert.deepEqual(b.conditionIds, []);
  assert.throws(() => TL.hudCommand(s, { ...command, conditionId: 'missing' }));
  assert.throws(() => TL.hudCommand(s, { ...command, characterId: saved.id }));
  assert.throws(() =>
    TL.hudCommand(s, { ...command, type: 'condition-create', name: 'New condition' })
  );
  assert.equal(s.conditionLibrary.length, 1);
});
