/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test'),
  assert = require('node:assert/strict'),
  TL = require('../core');
const pools = () =>
  ['short', 'long', 'turn', 'manual'].map((reset) => ({
    id: reset,
    name: reset,
    reset,
    max: 3,
    current: 0,
    icon: 'diamond',
    color: '#123456',
  }));

test('resource reset rules distinguish rests, turns, and explicit manual reset', () => {
  const c = TL.character();
  c.resources = pools();
  TL.rest(c, 'short');
  assert.deepEqual(
    c.resources.map((r) => r.current),
    [3, 0, 0, 0]
  );
  c.resources = pools();
  TL.rest(c, 'long');
  assert.deepEqual(
    c.resources.map((r) => r.current),
    [3, 3, 0, 0]
  );
  c.resources = pools();
  c.turn.action = false;
  TL.startTurn(c);
  assert.deepEqual(
    c.resources.map((r) => r.current),
    [0, 0, 3, 0]
  );
  assert.equal(c.turn.action, true);
  TL.resetResource(c, 'manual');
  assert.equal(c.resources[3].current, 3);
  assert.throws(() => TL.resetResource(c, 'short'));
  assert.throws(() => TL.resetResource(c, 'missing'));
});

test('next turn and overlay start turn refill only the targeted player’s per-turn resources', () => {
  const s = TL.empty(),
    a = TL.character(),
    b = TL.character();
  a.resources = pools();
  b.resources = pools();
  s.characters = [a, b];
  s.activeId = a.id;
  TL.nextTurn(s);
  assert.equal(b.resources[2].current, 3);
  assert.equal(a.resources[2].current, 0);
  TL.hudCommand(s, { type: 'turn', characterId: a.id });
  assert.equal(a.resources[2].current, 3);
  TL.hudCommand(s, { type: 'resource-reset', characterId: a.id, resourceId: 'manual' });
  assert.equal(a.resources[3].current, 3);
  assert.equal(b.resources[3].current, 0);
  assert.throws(() =>
    TL.hudCommand(s, { type: 'resource-reset', characterId: 'inactive', resourceId: 'manual' })
  );
});

test('legacy custom resources retain counts and links; shapes, colors and turn resets round-trip safely', () => {
  const s = TL.empty(),
    c = TL.character();
  s.characters = [c];
  c.resources = pools();
  delete c.resources[0].icon;
  delete c.resources[0].color;
  c.resources[1].color = 'red;background:url(x)';
  c.resources[1].icon = '<script>';
  c.items = [TL.item({ name: 'User ability', resourceId: 'turn', resourceCost: 2 })];
  const restored = TL.normalize(TL.toBackup(TL.normalize(s))).characters[0];
  assert.equal(restored.resources[0].icon, 'circle');
  assert.equal(restored.resources[0].color, c.accent);
  assert.equal(restored.resources[1].icon, 'circle');
  assert.equal(restored.resources[1].color, c.accent);
  assert.equal(restored.resources[2].reset, 'turn');
  assert.equal(restored.resources[2].icon, 'diamond');
  assert.equal(restored.resources[2].color, '#123456');
  assert.equal(restored.items[0].resourceId, 'turn');
  TL.startTurn(restored);
  TL.spend(restored, restored.items[0]);
  assert.equal(restored.resources[2].current, 1);
});

test('editing resource appearance and adding or deleting pools preserves concurrent spending', () => {
  const before = TL.character();
  before.resources = pools();
  before.resources[0].current = 3;
  const edited = TL.clone(before),
    current = TL.clone(before);
  edited.resources[0].name = 'Renamed';
  edited.resources[0].color = '#abcdef';
  edited.resources.splice(1, 1);
  edited.resources.push({ id: 'new', name: 'New', max: 1, current: 1, reset: 'manual' });
  current.resources[0].current = 1;
  const merged = TL.mergeChanges(before, edited, current);
  assert.equal(merged.resources[0].current, 1);
  assert.equal(merged.resources[0].name, 'Renamed');
  assert.equal(merged.resources[0].color, '#abcdef');
  assert.ok(!merged.resources.some((r) => r.id === 'long'));
  assert.ok(merged.resources.some((r) => r.id === 'new'));
});
