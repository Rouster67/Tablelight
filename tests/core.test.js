/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const TL = require('../core');
const { Store } = require('../storage');
test('new parties contain no preloaded characters or rules', () => {
  assert.equal(TL.empty().characters.length, 0);
  assert.equal(TL.character().items.length, 0);
  assert.equal(TL.character().resources.length, 0);
});
test('damage absorbs temporary HP first and cannot go negative', () => {
  const c = TL.character();
  c.tempHp = 7;
  TL.damage(c, 12);
  assert.equal(c.hp, 5);
  assert.equal(c.tempHp, 0);
  TL.damage(c, 100);
  assert.equal(c.hp, 0);
  TL.heal(c, 100);
  assert.equal(c.hp, 10);
});
test('spending a linked ability atomically charges action, resource and selected upcast slot', () => {
  const c = TL.character();
  c.resources = [{ id: 'pool', name: 'Test pool', max: 2, current: 2, reset: 'long' }];
  c.slots[2] = { level: 3, max: 2, current: 2 };
  const it = TL.item({ kind: 'spell', level: 1, economy: 'bonus', resourceId: 'pool' });
  TL.spend(c, it, 3);
  assert.equal(c.turn.bonus, false);
  assert.equal(c.turn.action, true);
  assert.equal(c.resources[0].current, 1);
  assert.equal(c.slots[2].current, 1);
  const before = TL.clone(c);
  assert.throws(() => TL.spend(c, it, 3), /already spent/);
  assert.deepEqual(c, before);
});
test('missing, under-level or empty slots cannot consume other resources', () => {
  const c = TL.character(),
    it = TL.item({ kind: 'spell', level: 2 });
  c.slots[0].max = 2;
  c.slots[0].current = 2;
  const before = TL.clone(c);
  assert.throws(() => TL.spend(c, it, 1));
  assert.deepEqual(c, before);
  c.slots[2].current = 1;
  c.slots[2].max = 1;
  assert.throws(() => TL.spend(c, it), /Choose a spell slot/);
  assert.equal(c.turn.action, true);
});
test('cantrips and nonstandard spell pools support custom rules', () => {
  const c = TL.character();
  TL.spend(c, TL.item({ kind: 'spell', level: 0 }));
  assert.equal(c.turn.action, false);
  c.turn = TL.freshTurn(c);
  c.resources = [{ id: 'special', name: 'Pool', current: 1, max: 1, reset: 'manual' }];
  TL.spend(c, TL.item({ kind: 'spell', level: 4, usesSlot: false, resourceId: 'special' }));
  assert.equal(c.resources[0].current, 0);
});
test('disabled abilities and exhausted resources block spending without partial changes', () => {
  const c = TL.character();
  c.resources = [{ id: 'pool', current: 0, max: 2, name: 'Energy' }];
  let it = TL.item({ resourceId: 'pool' });
  const before = TL.clone(c);
  assert.throws(() => TL.spend(c, it), /Not enough/);
  assert.deepEqual(c, before);
  it = TL.item({ disabled: true });
  assert.throws(() => TL.spend(c, it), /unavailable/);
  assert.equal(c.turn.action, true);
});
test('rest recovery honors short, long and manual pools', () => {
  const c = TL.character();
  c.resources = ['short', 'long', 'manual'].map((reset) => ({
    id: reset,
    reset,
    max: 3,
    current: 0,
  }));
  c.hp = 2;
  c.tempHp = 4;
  c.turn.action = false;
  c.slots[0] = { level: 1, current: 0, max: 4 };
  c.conditions = 'Test';
  c.concentration = 'Test focus';
  TL.rest(c, 'short');
  assert.deepEqual(
    c.resources.map((r) => r.current),
    [3, 0, 0]
  );
  assert.equal(c.hp, 2);
  assert.equal(c.slots[0].current, 0);
  TL.rest(c, 'long');
  assert.deepEqual(
    c.resources.map((r) => r.current),
    [3, 3, 0]
  );
  assert.equal(c.hp, 10);
  assert.equal(c.tempHp, 0);
  assert.equal(c.turn.action, true);
  assert.equal(c.slots[0].current, 4);
  assert.equal(c.conditions, 'Test');
  assert.equal(c.concentration, '');
});
test('skill calculation supports proficiency, expertise and manual overrides', () => {
  const c = TL.character();
  c.abilities.dex = 16;
  c.proficiency = 3;
  c.skills.Stealth.rank = 2;
  assert.equal(TL.skillBonus(c, 'Stealth'), 9);
  c.skills.Stealth.override = 0;
  assert.equal(TL.skillBonus(c, 'Stealth'), 0);
});
test('normalization validates backups, IDs, resource links, images and numeric bounds', () => {
  assert.throws(() => TL.normalize({ characters: [] }));
  const c = TL.character();
  const s = { version: 1, characters: [c] };
  c.hp = 100;
  c.maxHp = 20;
  c.hud.rotation = -90;
  c.avatar = 'https://example.com/tracker.png';
  const normalized = TL.normalize(s).characters[0];
  assert.equal(normalized.hp, 20);
  assert.equal(normalized.avatar, '');
  assert.equal(normalized.hud.rotation, 270);
  assert.throws(() => TL.normalize({ version: 1, characters: [c, c] }), /unique/);
  assert.throws(
    () => TL.normalize({ version: 1, characters: Array.from({ length: 9 }, () => TL.character()) }),
    /eight/
  );
  c.items = [TL.item({ resourceId: 'missing' })];
  assert.throws(() => TL.normalize(s), /missing resource/);
});
test('rotated HUD geometry stays within the visible display', () => {
  for (const rotation of [0, 45, 90, 180, 270, 359]) {
    const hud = { x: 0, y: 100, rotation, scale: 1 },
      w = 380,
      h = 600,
      result = TL.fitHud(hud, w, h, 1920, 1080),
      rad = (rotation * Math.PI) / 180;
    const bw = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad)),
      bh = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
    assert.ok(result.x - bw / 2 >= 0);
    assert.ok(result.y + bh / 2 <= 1080);
  }
});
test('party storage round-trips portraits and custom text and recovers a corrupt last save', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tablelight-test-'));
  try {
    const store = new Store(dir);
    assert.equal(store.load().state.characters.length, 0);
    const state = TL.empty(),
      c = TL.character();
    c.avatar = 'data:image/png;base64,aGVsbG8=';
    c.items = [TL.item({ description: 'Custom text <script>not code</script>\nSecond line' })];
    state.characters.push(c);
    store.save(state);
    state.characters[0].hp = 4;
    store.save(state);
    assert.equal(store.load().state.characters[0].hp, 4);
    fs.writeFileSync(store.file, '{broken');
    const recovered = store.load();
    assert.ok(recovered.warning);
    assert.equal(recovered.state.characters[0].hp, 10);
    assert.equal(recovered.state.characters[0].items[0].description, c.items[0].description);
    store.save(recovered.state);
    assert.ok(JSON.parse(fs.readFileSync(store.file, 'utf8')));
    fs.writeFileSync(store.file, '{broken');
    fs.writeFileSync(store.backup, '{broken');
    assert.throws(() => store.load(), /kept intact/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
