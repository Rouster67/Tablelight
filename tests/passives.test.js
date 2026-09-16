/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const TL = require('../core');
const { Service } = require('../approval-service');
const { Store } = require('../storage');
const { png, dataUrl } = require('./icon-fixtures');
const vm = require('node:vm');
const context = { window: {}, TL };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../hud.js'), 'utf8'), context);
const HUD = context.window.HUD;

function fixture() {
  const state = TL.empty();
  state.library = [
    TL.libraryEntry({
      id: 'passive',
      name: 'Lantern sense',
      kind: 'feature',
      behavior: 'passive',
      trackPassive: true,
      description: 'Read the marker while carrying a lantern.',
      passiveDescription: 'Retained second text',
      source: 'My notes',
      upgrades: 'My upgrade',
      requirements: 'A lantern',
      special: 'Original text',
      icon: dataUrl(png(2, 1)),
      level: 1,
      requiresConcentration: true,
    }),
    TL.libraryEntry({
      id: 'hybrid',
      name: 'Watchkeeper',
      behavior: 'hybrid',
      trackPassive: true,
      passiveDescription: 'Watch the gate.',
      description: 'Signal the party.',
      economy: 'reaction',
      level: 1,
      requiresConcentration: true,
    }),
    TL.libraryEntry({ id: 'unused', name: 'Unused passive', behavior: 'passive' }),
  ];
  state.characters = [TL.character(), TL.character(1)];
  state.roster = [TL.character(2)];
  for (const [i, c] of TL.allCharacters(state).entries()) {
    c.id = 'player-' + i;
    c.name = ['Mira', 'Rowan', 'Saved player'][i];
    c.theme = 'wizard';
    c.notes = 'Private DM note';
    c.hp = 7;
    c.tempHp = 2;
    c.resources = [{ id: 'pool', name: 'Signal charges', current: 3, max: 5, reset: 'long' }];
    c.slots[0] = { level: 1, current: 2, max: 3 };
    Object.assign(c.hud, {
      expanded: true,
      rotation: i * 90,
      scale: 0.8 + i / 10,
      conditionPage: 1,
      resourcePage: 2,
    });
    TL.attachItem(state, c.id, 'passive', {
      resourceId: 'pool',
      resourceCost: i + 1,
      disabled: i === 1,
    });
    TL.attachItem(state, c.id, 'hybrid', { resourceId: 'pool', resourceCost: 1 });
  }
  const local = TL.createLocalItem(state, 'player-0', {
    name: 'Local reminder',
    behavior: 'passive',
    trackPassive: true,
  });
  TL.setPassiveActive(state.characters[0], local.id, true);
  state.conditionLibrary = [TL.conditionEntry({ id: 'condition', name: 'User status' })];
  TL.assignCondition(state, 'player-0', 'condition');
  return TL.normalize(state);
}
const command = (service, type, fields = {}) => ({
  sessionId: service.snapshot().approvals.id,
  commandId: TL.uid(),
  characterId: 'player-0',
  type,
  ...fields,
});
const passiveId = (state) => state.characters[0].items[0].id;
const hybridId = (state) => state.characters[0].items[1].id;

test('passive-only entries never enter active HUD lists for any type or turn cost', () => {
  for (const kind of ['action', 'spell', 'feature']) {
    for (const economy of ['action', 'bonus', 'reaction', 'free']) {
      const c = TL.character();
      c.items = ['active', 'passive', 'hybrid'].map((behavior) =>
        TL.item({ kind, economy, behavior, name: behavior })
      );
      for (const panel of [economy, ...(['spell', 'feature'].includes(kind) ? [kind] : [])]) {
        c.hud.panel = panel;
        assert.deepEqual(
          TL.panelItems(c).map((it) => it.behavior),
          ['active', 'hybrid']
        );
      }
    }
  }
});

test('passive details omit dormant costs and keep hybrid effects separate and escaped', () => {
  const state = fixture(),
    c = state.characters[0],
    passive = c.items[0],
    hybrid = c.items[1];
  const html = HUD.renderAbilityDetails(passive, c);
  assert.match(html, /Read the marker/);
  assert.match(html, /A lantern/);
  assert.doesNotMatch(
    html,
    /Charges spent|Linked resource|Concentration|Spell Level|Retained second text/
  );
  hybrid.passiveDescription = '<script>passive text</script>';
  const passiveHtml = HUD.renderAbilityDetails(hybrid, c, 'passive');
  assert.match(passiveHtml, /&lt;script&gt;passive text&lt;\/script&gt;/);
  assert.doesNotMatch(passiveHtml, /Signal the party|Signal charges|Charges spent|Concentration/);
  const activeHtml = HUD.renderAbilityDetails(hybrid, c);
  assert.match(activeHtml, /Active effect/);
  assert.match(activeHtml, /Signal the party/);
  assert.doesNotMatch(activeHtml, /passive text/);
  hybrid.passiveDescription = '';
  assert.match(HUD.renderAbilityDetails(hybrid, c, 'passive'), /No passive description entered/);
  hybrid.description = '';
  hybrid.passiveDescription = 'Passive text with an empty active effect';
  assert.match(
    HUD.renderAbilityDetails(hybrid, c, 'passive'),
    /Passive text with an empty active effect/
  );
  assert.equal(HUD.passiveStatus({ trackPassive: false, passiveActive: true }), 'Always applies');
  assert.equal(HUD.passiveStatus({ trackPassive: true, passiveActive: false }), 'Inactive');
});

test('passive conversion clears only its active HUD detail and rejects stale detail commands', () => {
  const state = fixture(),
    c = state.characters[0];
  c.hud.detailId = hybridId(state);
  c.hud.panel = 'reaction';
  const before = TL.clone(c.hud),
    other = TL.clone(state.characters[1]);
  state.library[1].behavior = 'passive';
  const normalized = TL.normalize(state);
  assert.deepEqual(normalized.characters[0].hud, { ...before, detailId: '', page: 0 });
  assert.deepEqual(normalized.characters[1].hud, other.hud);
  const saved = TL.clone(normalized);
  assert.throws(
    () => TL.hudCommand(normalized, { type: 'detail', characterId: c.id, itemId: c.items[1].id }),
    /DM Passives/
  );
  assert.deepEqual(normalized, saved);
  assert.deepEqual(TL.normalize(TL.toBackup(normalized)), normalized);
});

test('formats 1–10 default to active without reinterpreting text or losing existing state', () => {
  const expected = TL.toBackup(fixture());
  for (const definition of [
    ...expected.library,
    ...TL.allCharacters(expected).flatMap((c) => c.items.filter((it) => it.local)),
  ]) {
    Object.assign(definition, { behavior: 'active', trackPassive: false, passiveDescription: '' });
  }
  for (const c of TL.allCharacters(expected)) for (const it of c.items) it.passiveActive = false;
  for (let version = 1; version <= 10; version++) {
    const old = TL.clone(expected);
    old.version = version;
    for (const definition of [...old.library, ...TL.allCharacters(old).flatMap((c) => c.items)]) {
      for (const key of ['behavior', 'trackPassive', 'passiveDescription', 'passiveActive'])
        delete definition[key];
    }
    const original = TL.clone(old);
    assert.deepEqual(TL.toBackup(TL.normalize(old)), expected, 'format ' + version);
    assert.deepEqual(old, original);
  }
});

test('passive definitions and independent assignment states round trip through backups', () => {
  const state = fixture();
  TL.setPassiveActive(state.characters[0], passiveId(state), true);
  TL.setPassiveActive(state.roster[0], state.roster[0].items[0].id, true);
  const backup = TL.toBackup(state);
  assert.equal(backup.version, 11);
  assert.deepEqual(TL.normalize(JSON.parse(JSON.stringify(backup))), state);
  for (const c of TL.allCharacters(backup)) {
    assert.equal(c.items[0].description, undefined);
    assert.equal(c.items[0].behavior, undefined);
    assert.equal(c.items[0].trackPassive, undefined);
  }
  assert.equal(backup.library[0].passiveActive, undefined);
  assert.equal(backup.characters[0].items[2].behavior, 'passive');
  const overlay = TL.overlayState(state);
  assert.equal(overlay.library, undefined);
  assert.equal(overlay.roster, undefined);
  assert.equal(overlay.characters[0].notes, undefined);
  assert.equal(overlay.characters[0].items[0].passiveActive, true);
});

test('shared edits preserve dormant costs, text and personal states across behavior changes', () => {
  let state = fixture();
  TL.setPassiveActive(state.characters[0], passiveId(state), true);
  const baseline = TL.clone(state);
  for (const behavior of ['active', 'hybrid', 'passive']) {
    state.library[0].behavior = behavior;
    state.library[0].trackPassive = false;
    state.library[0].description = 'Changed shared text';
    state = TL.normalize(state);
    const expected = TL.clone(baseline);
    for (const entry of [expected.library[0], ...TL.allCharacters(expected).map((c) => c.items[0])])
      Object.assign(entry, { behavior, trackPassive: false, description: 'Changed shared text' });
    assert.deepEqual(state, expected);
  }
  state.library[0].trackPassive = true;
  state = TL.normalize(state);
  assert.equal(state.characters[0].items[0].passiveActive, true);
  assert.equal(state.characters[1].items[0].passiveActive, false);
});

test('passive switches affect only the chosen assignment, even when active costs are unavailable', () => {
  const state = fixture(),
    c = state.characters[1],
    id = c.items[0].id;
  c.turn.action = false;
  c.resources[0].current = 0;
  c.slots[0].current = 0;
  const expected = TL.clone(state);
  expected.characters[1].items[0].passiveActive = true;
  TL.setPassiveActive(c, id, true);
  assert.deepEqual(state, expected);
  TL.setPassiveActive(c, id, true);
  assert.deepEqual(state, expected);
  for (const invalid of [undefined, null, 'true', 1])
    assert.throws(() => TL.setPassiveActive(c, id, invalid), /valid passive/);
  assert.throws(() => TL.setPassiveActive(c, 'missing', true), /assigned passive/);
  c.items[0].trackPassive = false;
  assert.throws(() => TL.setPassiveActive(c, id, false), /manual tracking/);
  c.items[0].behavior = 'active';
  c.items[0].trackPassive = true;
  assert.throws(() => TL.setPassiveActive(c, id, false), /assigned passive/);
});

test('invalid new fields and future formats are rejected without mutating input', () => {
  for (const [key, value] of [
    ['behavior', 'sometimes'],
    ['behavior', null],
    ['trackPassive', 'false'],
    ['passiveDescription', {}],
  ]) {
    const raw = TL.toBackup(fixture());
    raw.library[0][key] = value;
    const before = TL.clone(raw);
    assert.throws(() => TL.normalize(raw), /behavior|tracking|description/);
    assert.deepEqual(raw, before);
    assert.throws(() => TL.libraryEntry({ [key]: value }));
  }
  const raw = TL.toBackup(fixture());
  raw.characters[0].items[0].passiveActive = 'false';
  assert.throws(() => TL.normalize(raw), /passive state/);
  raw.characters[0].items[0].passiveActive = false;
  raw.characters[0].items[2].trackPassive = 1;
  assert.throws(() => TL.normalize(raw), /tracking/);
  raw.version = 12;
  assert.throws(() => TL.normalize(raw), /not a supported/);
  const text = '<script>example</script>\n' + 'x'.repeat(40000);
  assert.equal(
    TL.libraryEntry({ passiveDescription: text }).passiveDescription,
    text.slice(0, 40000)
  );
});

test('exact-content matching distinguishes passive definitions and preserves local-copy behavior', () => {
  const c = TL.character();
  c.items = [
    TL.item({ name: 'Same', behavior: 'active' }),
    TL.item({ name: 'Same', behavior: 'passive' }),
    TL.item({ name: 'Same', behavior: 'passive', trackPassive: true }),
    TL.item({ name: 'Same', behavior: 'hybrid', passiveDescription: 'First' }),
    TL.item({ name: 'Same', behavior: 'hybrid', passiveDescription: 'Second' }),
  ];
  const state = TL.normalize({ version: 1, characters: [c] });
  assert.equal(state.library.length, 5);
  const original = state.characters[0].items[2];
  TL.setPassiveActive(state.characters[0], original.id, true);
  const copy = TL.duplicateLocalItem(state, c.id, original.id);
  assert.equal(copy.behavior, 'passive');
  assert.equal(copy.trackPassive, true);
  assert.equal(copy.passiveActive, false, 'a new assignment starts Inactive');
  TL.deleteLibraryEntry(state, original.libraryId, [c.id]);
  const preserved = TL.normalize(state).characters[0].items.find((it) => it.id === original.id);
  assert.equal(preserved.local, true);
  assert.equal(preserved.passiveActive, true, 'converting the same assignment retains its state');
});

test('passive core spending, concentration and real approval routes fail without side effects', async () => {
  const state = fixture(),
    c = state.characters[0],
    it = c.items[0];
  const before = TL.clone(state);
  assert.match(TL.availability(c, it, 1), /Passive abilities/);
  assert.throws(() => TL.spend(c, it, 1), /Passive abilities/);
  assert.throws(
    () => TL.hudCommand(state, { type: 'use', characterId: c.id, itemId: it.id, level: 1 }),
    /Passive abilities/
  );
  assert.equal(
    TL.concentrationChoices(c).some((entry) => entry.id === it.id),
    false
  );
  assert.throws(() => TL.setConcentration(c, true, it.id), /Concentration/);
  assert.deepEqual(state, before);
  let saves = 0;
  const service = new Service(state, { save: async () => saves++ });
  const snapshot = service.snapshot();
  await assert.rejects(
    service.hud(command(service, 'use', { itemId: it.id, level: 1 })),
    /Passive abilities/
  );
  await assert.rejects(
    service.command(command(service, 'direct-use', { itemId: it.id, slotLevel: 1 })),
    /Passive abilities/
  );
  assert.deepEqual(service.snapshot(), snapshot);
  assert.equal(saves, 0);
});

test('hybrid reminder changes do not invalidate requests, spending, or targeted refunds', async () => {
  const state = fixture(),
    id = hybridId(state),
    service = new Service(state);
  const requested = await service.hud(command(service, 'use', { itemId: id, level: 1 }));
  await service.hud(command(service, 'passive', { itemId: id, active: true }));
  assert.equal(service.snapshot().approvals.pending.length, 1);
  const requestId = requested.result.requestId;
  await service.command(command(service, 'approve', { requestId }));
  const c = service.snapshot().state.characters[0];
  assert.equal(c.items[1].passiveActive, true);
  assert.equal(c.turn.reaction, false);
  assert.equal(c.resources[0].current, 2);
  assert.equal(c.slots[0].current, 1);
  assert.equal(c.concentrationItemId, id);
  await service.hud(command(service, 'passive', { itemId: id, active: false }));
  await service.command(command(service, 'undo-use', { requestId }));
  assert.deepEqual(service.snapshot().state, state);
});

test('switch save failures roll back; retries and repeated requests create only one undo step', async () => {
  const state = fixture();
  let fail = true,
    saves = 0;
  const service = new Service(state, {
    save: async () => {
      if (fail) throw Error('disk full');
      saves++;
    },
  });
  const toggle = command(service, 'passive', { itemId: passiveId(state), active: true });
  const before = service.snapshot();
  await assert.rejects(service.hud(toggle), /disk full/);
  assert.deepEqual(service.snapshot(), before);
  fail = false;
  await service.hud(toggle);
  await service.hud(toggle);
  assert.equal(saves, 1);
  assert.equal(service.snapshot().undoCount, 1);
  await service.undo();
  assert.deepEqual(service.snapshot().state, state);
});

test('stale character and library saves preserve later switches and unrelated spending', async () => {
  const state = fixture(),
    service = new Service(state),
    base = service.snapshot().state;
  const edited = TL.clone(base);
  edited.characters[0].name = 'Edited name';
  edited.library[0].description = 'Edited library description';
  await service.hud(command(service, 'passive', { itemId: passiveId(state), active: true }));
  await service.command(command(service, 'direct-use', { itemId: hybridId(state), slotLevel: 1 }));
  const expected = service.snapshot().state;
  expected.characters[0].name = 'Edited name';
  expected.library[0].description = 'Edited library description';
  const result = await service.change({ base, edited });
  assert.deepEqual(result.state, TL.normalize(expected));
});

test('passive HUD commands reject hidden, collapsed, click-through and inactive characters', async () => {
  for (const change of [
    (s) => (s.characters[0].hud.visible = false),
    (s) => (s.characters[0].hud.expanded = false),
    (s) => (s.settings.overlayInteractive = false),
    (s) => TL.removeFromParty(s, 'player-0'),
  ]) {
    const state = fixture(),
      id = passiveId(state);
    change(state);
    const service = new Service(state),
      before = service.snapshot();
    await assert.rejects(
      service.hud(command(service, 'passive', { itemId: id, active: true })),
      /HUD|click-through|party/
    );
    assert.deepEqual(service.snapshot(), before);
  }
});

test('rests, turns, party moves and reattachment follow manual-state lifetime rules', () => {
  const state = fixture(),
    c = state.characters[0],
    id = passiveId(state);
  TL.setPassiveActive(c, id, true);
  for (const action of [
    (c) => TL.startTurn(c),
    (c) => TL.rest(c, 'short'),
    (c) => TL.rest(c, 'long'),
  ]) {
    action(c);
    assert.equal(c.items[0].passiveActive, true);
  }
  TL.removeFromParty(state, c.id);
  TL.addToParty(state, c.id);
  assert.equal(TL.findCharacter(state, c.id).items[0].passiveActive, true);
  c.items = c.items.filter((it) => it.id !== id);
  const fresh = TL.attachItem(state, c.id, 'passive');
  assert.equal(fresh.passiveActive, false);
  assert.notEqual(fresh.id, id);
});

test('conversion cannot silently end concentration on active or inactive characters', async () => {
  for (const inactive of [false, true]) {
    const state = fixture(),
      c = inactive ? state.roster[0] : state.characters[0];
    TL.setConcentration(c, true, c.items[1].id);
    const service = new Service(state),
      before = service.snapshot();
    const edited = TL.clone(before.state);
    edited.library[1].behavior = 'passive';
    await assert.rejects(
      service.change({ base: before.state, edited }),
      /End or change concentration/
    );
    assert.deepEqual(service.snapshot(), before);
    TL.setConcentration(TL.findCharacter(edited, c.id), false);
    await service.change({ base: before.state, edited });
    assert.equal(TL.findCharacter(service.snapshot().state, c.id).items[1].behavior, 'passive');
  }
});

test('format 11 persists on disk, rejects invalid replacements and recovers the previous save', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tablelight-passives-'));
  try {
    const store = new Store(directory),
      state = fixture();
    TL.setPassiveActive(state.characters[0], passiveId(state), true);
    store.save(state);
    assert.deepEqual(store.load().state, state);
    const bytes = fs.readFileSync(store.file);
    const invalid = TL.toBackup(state);
    invalid.version = 12;
    assert.throws(() => store.save(invalid), /not a supported/);
    assert.deepEqual(fs.readFileSync(store.file), bytes);
    TL.setPassiveActive(state.characters[0], passiveId(state), false);
    store.save(state);
    fs.writeFileSync(store.file, '{invalid');
    const recovered = store.load();
    assert.match(recovered.warning, /previous backup/);
    state.characters[0].items[0].passiveActive = true;
    assert.deepEqual(recovered.state, state);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
