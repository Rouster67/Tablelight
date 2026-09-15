/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const TL = require('../core');
const Themes = require('../hud-themes');
const { Store } = require('../storage');
const { Service } = require('../approval-service');
const { png, dataUrl } = require('./icon-fixtures');

test('old and malformed theme fields use Default independently of the entered class', () => {
  assert.equal(TL.character().theme, 'default');
  for (let version = 1; version <= 10; version++) {
    const raw = TL.toBackup(TL.empty());
    raw.version = version;
    raw.characters = [TL.character()];
    raw.roster = [TL.character()];
    for (const c of TL.allCharacters(raw)) {
      delete c.theme;
      c.className = 'Wizard / Artificer';
    }
    const restored = TL.normalize(raw);
    assert.ok(TL.allCharacters(restored).every((c) => c.theme === 'default'));
    assert.ok(TL.allCharacters(restored).every((c) => c.className === 'Wizard / Artificer'));
  }
  for (const value of [undefined, null, '', '   ', 3, false, {}, ['wizard']]) {
    const state = TL.empty();
    state.characters = [{ ...TL.character(), theme: value }];
    assert.equal(TL.normalize(state).characters[0].theme, 'default');
  }
});

test('all class themes and unknown identifiers survive saves, backups and party membership with shared artwork intact', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tablelight-character-themes-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const state = TL.empty();
  const ids = [...Themes.choices.map((c) => c.id), 'future-palette', '__proto__', 'Wizard'];
  const players = ids.map((theme, i) => ({ ...TL.character(i), theme, className: 'Same class' }));
  state.characters = players.slice(0, 8);
  state.roster = players.slice(8);
  const icon = dataUrl(png(2, 1));
  state.library = [TL.libraryEntry({ name: 'Shared illustrated ability', icon })];
  for (const c of players) TL.attachItem(state, c.id, state.library[0].id);
  const store = new Store(directory);
  const saved = store.save(state);
  const restored = new Store(directory).load().state;
  assert.deepEqual(restored, saved);
  assert.deepEqual(
    TL.allCharacters(restored).map((c) => c.theme),
    ids
  );
  assert.ok(TL.allCharacters(restored).every((c) => c.items[0].icon === icon));
  const backup = TL.toBackup(restored);
  assert.equal(JSON.stringify(backup).split(icon).length - 1, 1);
  assert.deepEqual(TL.normalize(JSON.parse(JSON.stringify(backup))), restored);
  const before = TL.clone(restored.characters[0]);
  TL.removeFromParty(restored, before.id);
  assert.deepEqual(TL.findCharacter(restored, before.id), before);
  TL.addToParty(restored, before.id);
  assert.deepEqual(TL.findCharacter(restored, before.id), before);
});

test('a stale theme edit preserves concurrent spending, other themes, pending requests and Undo', async () => {
  const state = TL.empty();
  state.characters = Array.from({ length: 8 }, (_, i) => ({
    ...TL.character(i),
    className: 'Wizard',
  }));
  const c = state.characters[0];
  c.resources = [
    { id: 'charges', name: 'Charges', max: 6, current: 6, color: '#112233', icon: 'star' },
  ];
  c.slots[0] = { level: 1, max: 4, current: 4 };
  const item = TL.createLocalItem(
    state,
    c.id,
    { name: 'Synthetic spell', economy: 'free', level: 1, usesSlot: true },
    { resourceId: 'charges', resourceCost: 1 }
  );
  const service = new Service(state);
  const command = (type, values = {}) => ({
    sessionId: service.snapshot().approvals.id,
    commandId: TL.uid(),
    type,
    characterId: c.id,
    ...values,
  });
  const base = service.snapshot().state;
  const edited = TL.clone(base);
  edited.characters[0].theme = 'artificer';
  await service.hud(command('hp', { amount: -2 }));
  await service.command(command('direct-use', { itemId: item.id, slotLevel: 1 }));
  await service.hud(command('use', { itemId: item.id, level: 1 }));
  const other = service.snapshot().state;
  const changed = TL.clone(other);
  changed.characters[1].theme = 'warlock';
  await service.change({ base: other, edited: changed });
  const beforeTheme = service.snapshot();
  const result = await service.change({ base, edited });
  const expected = TL.clone(beforeTheme.state);
  expected.characters[0].theme = 'artificer';
  assert.deepEqual(result.state, expected);
  assert.equal(result.state.characters[0].hp, 8);
  assert.equal(result.state.characters[0].slots[0].current, 3);
  assert.equal(result.state.characters[0].resources[0].current, 5);
  assert.deepEqual(result.approvals.pending, beforeTheme.approvals.pending);
  assert.equal(service.overlayState().characters[0].theme, 'artificer');
  await service.undo();
  assert.deepEqual(service.snapshot().state, beforeTheme.state);
  assert.deepEqual(service.snapshot().approvals.pending, beforeTheme.approvals.pending);
});

test('failed theme saves retain the saved choice and can be retried', async () => {
  const state = TL.empty();
  state.characters = [{ ...TL.character(), theme: 'wizard' }];
  let fail = true;
  const service = new Service(state, {
    save: () => {
      if (fail) throw Error('Synthetic save failure');
    },
  });
  const base = service.snapshot().state;
  const edited = TL.clone(base);
  edited.characters[0].theme = 'default';
  await assert.rejects(service.change({ base, edited }), /Synthetic save failure/);
  assert.equal(service.snapshot().state.characters[0].theme, 'wizard');
  assert.equal(service.snapshot().undoCount, 0);
  fail = false;
  await service.change({ base, edited });
  assert.equal(service.snapshot().state.characters[0].theme, 'default');
});
