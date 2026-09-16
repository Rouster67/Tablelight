/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test'),
  assert = require('node:assert/strict'),
  TL = require('../core');
function party() {
  const s = TL.empty();
  s.characters = [TL.character(0), TL.character(1), TL.character(2)];
  s.settings.soloExpand = false;
  return s;
}
test('each bubble can move and rotate without changing another character', () => {
  const s = party(),
    before = TL.clone(s.characters[1]);
  TL.hudCommand(s, {
    type: 'placement',
    characterId: s.characters[0].id,
    x: 70,
    y: 12,
    rotation: 270,
  });
  assert.equal(s.characters[0].hud.rotation, 270);
  assert.deepEqual(s.characters[1], before);
  TL.hudCommand(s, { type: 'rotate', characterId: s.characters[1].id, amount: 90 });
  assert.equal(s.characters[1].hud.rotation, 90);
  assert.equal(s.characters[0].hud.rotation, 270);
});
test('multiple HUDs expand independently and preserve distinct rotations', () => {
  const s = party();
  s.characters[0].hud.rotation = 90;
  s.characters[1].hud.rotation = 270;
  for (const c of s.characters) TL.hudCommand(s, { type: 'expand', characterId: c.id });
  assert.ok(s.characters.every((c) => c.hud.expanded));
  assert.deepEqual(
    s.characters.map((c) => c.hud.rotation),
    [90, 270, 0]
  );
  TL.hudCommand(s, { type: 'expand', characterId: s.characters[0].id });
  assert.equal(s.characters[0].hud.expanded, false);
  assert.equal(s.characters[1].hud.expanded, true);
});
test('hiding a character leaves all other bubbles visible', () => {
  const s = party();
  TL.hudCommand(s, { type: 'hide', characterId: s.characters[1].id });
  assert.deepEqual(
    s.characters.map((c) => c.hud.visible),
    [true, false, true]
  );
});

test('ability paging handles fifteen-item boundaries and stale saved pages independently', () => {
  const s = party(),
    c = s.characters[0];
  c.hud.panel = 'action';
  const other = TL.clone(s.characters[1]);
  for (const [count, pages] of [
    [0, 1],
    [15, 1],
    [16, 2],
    [30, 2],
    [31, 3],
  ]) {
    c.items = Array.from({ length: count }, (_, i) =>
      TL.item({ name: 'Action ' + i, economy: 'action' })
    );
    c.items.push(TL.item({ economy: 'bonus' }));
    assert.equal(TL.hudPageCount(c), pages);
    c.hud.page = 999;
    TL.hudCommand(s, { type: 'page', characterId: c.id, amount: -1 });
    assert.equal(c.hud.page, Math.max(0, pages - 2));
    TL.hudCommand(s, { type: 'page', characterId: c.id, amount: 100 });
    assert.equal(c.hud.page, pages - 1);
    TL.hudCommand(s, { type: 'page', characterId: c.id, amount: -100 });
    assert.equal(c.hud.page, 0);
  }
  assert.deepEqual(s.characters[1], other);
});

test('resources use three-item pages without changing ability-detail pages', () => {
  const s = party(),
    c = s.characters[0];
  c.hud.panel = 'resources';
  c.resources = Array.from({ length: 13 }, (_, i) => ({ id: 'pool-' + i }));
  assert.equal(TL.hudPageCount(c), 5);
  c.items = [TL.item({ description: 'A long ability description. '.repeat(100) })];
  c.hud.detailId = c.items[0].id;
  const pages = TL.abilityTextPages(c.items[0]).length;
  assert.ok(pages > 1);
  assert.equal(TL.hudPageCount(c), pages);
  c.hud.page = 999;
  TL.hudCommand(s, { type: 'page', characterId: c.id, amount: -1 });
  assert.equal(c.hud.page, pages - 2);
});

test('six-condition and three-resource pages clamp stale pages and preserve other players and backups', () => {
  const s = party(),
    c = s.characters[0],
    before = TL.clone(s.characters[1]);
  c.resources = Array.from({ length: 13 }, (_, i) => ({
    id: 'r' + i,
    name: 'Pool ' + i,
    current: 2,
    max: 3,
    reset: 'manual',
  }));
  s.conditionLibrary = Array.from({ length: 13 }, (_, i) =>
    TL.conditionEntry({ id: 'c' + i, name: 'Condition ' + i })
  );
  c.conditionIds = s.conditionLibrary.map((e) => e.id);
  c.appliedConditions = s.conditionLibrary;
  for (const kind of ['conditions', 'resources']) {
    const size = kind === 'conditions' ? 6 : 3;
    assert.equal(TL.hudListPage(c, kind).items.length, size);
    TL.hudCommand(s, { type: 'list-page', kind, characterId: c.id, amount: 1 });
    assert.equal(TL.hudListPage(c, kind).items[0].id, kind === 'conditions' ? 'c6' : 'r3');
    TL.hudCommand(s, { type: 'list-page', kind, characterId: c.id, amount: 100 });
    assert.equal(TL.hudListPage(c, kind).items.length, 1);
    c.hud[TL.hudListPage(c, kind).key] = 999;
    TL.hudCommand(s, { type: 'list-page', kind, characterId: c.id, amount: -1 });
    assert.equal(TL.hudListPage(c, kind).page, kind === 'conditions' ? 1 : 3);
  }
  c.hud.panel = 'resources';
  TL.hudCommand(s, { type: 'page', characterId: c.id, amount: 1 });
  assert.equal(TL.hudPage(c), 4);
  assert.equal(c.hud.conditionPage, 1);
  assert.deepEqual(s.characters[1], before);
  const restored = TL.normalize(TL.toBackup(s)).characters[0];
  assert.equal(restored.hud.conditionPage, 1);
  assert.equal(restored.hud.resourcePage, 4);
  assert.equal(restored.resources.length, 13);
  assert.equal(restored.conditionIds.length, 13);
  assert.throws(() =>
    TL.hudCommand(s, { type: 'list-page', kind: 'invalid', characterId: c.id, amount: 1 })
  );
});
test('TV resource and action commands affect only their named character', () => {
  const s = party(),
    c = s.characters[0];
  c.resources = [{ id: 'energy', name: 'Test pool', current: 2, max: 2, reset: 'manual' }];
  c.items = [TL.item({ economy: 'bonus', resourceId: 'energy' })];
  TL.hudCommand(s, { type: 'use', characterId: c.id, itemId: c.items[0].id });
  assert.equal(c.turn.bonus, false);
  assert.equal(c.resources[0].current, 1);
  assert.equal(s.characters[1].turn.bonus, true);
  assert.throws(
    () => TL.hudCommand(s, { type: 'use', characterId: c.id, itemId: c.items[0].id }),
    /already spent/
  );
  assert.equal(c.resources[0].current, 1);
});
test('save normalizes independent placement and interactive preference without losing them', () => {
  const s = party();
  s.settings.overlayInteractive = false;
  s.characters.forEach((c, i) => {
    c.hud.rotation = i * 90;
    c.hud.x = 10 + i * 30;
  });
  const loaded = TL.normalize(s);
  assert.equal(loaded.settings.overlayInteractive, false);
  assert.deepEqual(
    loaded.characters.map((c) => c.hud.rotation),
    [0, 90, 180]
  );
  assert.deepEqual(
    loaded.characters.map((c) => c.hud.x),
    [10, 40, 70]
  );
});
test('stale character editor merges its actual edits without reverting live HP or placement', () => {
  const original = TL.character(),
    edited = TL.clone(original),
    live = TL.clone(original);
  edited.name = 'Edited name';
  edited.abilities.wis = 18;
  live.hp = 3;
  live.hud.rotation = 180;
  live.hud.x = 70;
  live.slots[0].max = 4;
  live.slots[0].current = 2;
  live.items.push(TL.item({ name: 'New custom option' }));
  const merged = TL.mergeChanges(original, edited, live);
  assert.equal(merged.name, 'Edited name');
  assert.equal(merged.hp, 3);
  assert.equal(merged.hud.rotation, 180);
  assert.equal(merged.slots[0].current, 2);
  assert.equal(merged.items.length, 1);
});
test('invalid commands are rejected and cannot edit private notes or create arbitrary fields', () => {
  const s = party();
  assert.throws(() => TL.hudCommand(s, { type: 'notes', characterId: s.characters[0].id }));
  assert.throws(() =>
    TL.hudCommand(s, { type: 'placement', characterId: s.characters[0].id, rotation: NaN })
  );
  assert.throws(() => TL.hudCommand(s, { type: 'expand', characterId: 'missing' }));
});
