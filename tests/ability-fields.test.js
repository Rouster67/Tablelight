/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const TL = require('../core');
const context = { window: {}, TL };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../hud.js'), 'utf8'), context);
const HUD = context.window.HUD;
const additions = ['trigger', 'area', 'castingTime', 'school', 'onSave', 'requirements', 'special'];

test('manual fields round trip for every type and older saves retain their text and character state', () => {
  for (const kind of ['action', 'spell', 'feature']) {
    const state = TL.empty();
    state.library = [
      TL.libraryEntry({
        kind,
        level: 3,
        ...Object.fromEntries(additions.map((key) => [key, ' User text <' + key + '> '])),
      }),
    ];
    state.characters = [TL.character()];
    TL.attachItem(state, state.characters[0].id, state.library[0].id);
    const restored = TL.normalize(TL.toBackup(state));
    for (const key of additions)
      assert.equal(restored.characters[0].items[0][key], state.library[0][key]);
    assert.equal(restored.library[0].level, 3);
    for (const key of additions) {
      assert.equal(TL.libraryEntry({ [key]: null })[key], '');
      assert.equal(
        TL.libraryEntry({ [key]: 'x'.repeat(40001) })[key].length,
        TL.abilityTextLimit(key)
      );
    }
  }
  for (const version of [1, 2, 3, 4, 5, 6, 7]) {
    const c = TL.character();
    c.items = [
      TL.item({
        attack: ' +7 or special\nPreserve this ',
        save: 'DEX 15 — half',
        description: 'Existing text',
        source: 'Old reference',
        upgrades: 'Old upgrades',
      }),
    ];
    c.hud.rotation = 270;
    c.hud.detailId = c.items[0].id;
    for (const key of additions) delete c.items[0][key];
    const raw = { version, characters: [c], roster: [], conditionLibrary: [] };
    const copy = TL.clone(raw);
    const restored = TL.normalize(raw);
    const expected = TL.clone(c);
    expected.items[0] = {
      ...expected.items[0],
      libraryId: restored.library[0].id,
      ...Object.fromEntries(additions.map((key) => [key, ''])),
    };
    assert.deepEqual(restored.characters[0], expected);
    assert.deepEqual(TL.normalize(TL.toBackup(restored)), restored);
    assert.deepEqual(raw, copy);
  }
});

test('shared manual edits preserve later spending, independent bindings, and inactive characters', () => {
  let state = TL.empty();
  state.library = [TL.libraryEntry({ name: 'Shared', attack: 'Attack text', save: 'Save text' })];
  state.characters = [TL.character()];
  state.roster = [TL.character()];
  for (const [i, c] of TL.allCharacters(state).entries()) {
    c.resources = [{ id: 'pool-' + i, name: 'Pool ' + i, current: 4, max: 5, reset: 'long' }];
    TL.attachItem(state, c.id, state.library[0].id, {
      resourceId: c.resources[0].id,
      resourceCost: i ? 1 : 2,
      disabled: !!i,
    });
    c.hud.rotation = i ? 270 : 90;
  }
  state = TL.normalize(state);
  const original = TL.clone(state.library[0]);
  TL.spend(state.characters[0], state.characters[0].items[0]);
  const afterSpend = TL.clone(TL.allCharacters(state));
  const changes = Object.fromEntries(additions.map((key) => [key, 'Manual ' + key]));
  state.library[0] = TL.mergeChanges(original, { ...original, ...changes }, state.library[0]);
  state = TL.normalize(TL.toBackup(state));
  for (const [i, c] of TL.allCharacters(state).entries()) {
    const expected = afterSpend[i];
    Object.assign(expected.items[0], changes);
    assert.deepEqual(c, expected);
  }
  assert.equal(state.characters[0].resources[0].current, 2);
  assert.equal(state.roster[0].resources[0].current, 4);
  const backup = TL.toBackup(state);
  assert.ok(TL.allCharacters(backup).every((c) => !Object.hasOwn(c.items[0], 'trigger')));
});

test('attack and save text never change with character statistics or spellcasting overrides', () => {
  const it = TL.item({
    attack: 'Roll as written +X',
    save: 'DEX 15',
    onSave: 'Half damage',
    damage: '2d6 + user bonus',
  });
  const c = TL.character();
  const before = HUD.renderAbilityDetails(it, c);
  Object.assign(c, {
    level: 20,
    proficiency: 6,
    spellAbility: 'cha',
    spellAttack: 99,
    spellDC: 99,
  });
  c.abilities.cha = 30;
  assert.equal(HUD.renderAbilityDetails(it, c), before);
  assert.equal(TL.resolveAbilityValues, undefined);
  assert.equal(it.damage, '2d6 + user bonus');
});

test('format 7 preserves explicit manual numbers as text and keeps personal exceptions separate', () => {
  const state = TL.empty();
  state.library = [
    TL.libraryEntry({ name: 'Legacy shared', attack: 'Original attack', save: 'Original save' }),
  ];
  state.characters = [TL.character(), TL.character()];
  state.roster = [TL.character()];
  for (const c of TL.allCharacters(state)) TL.attachItem(state, c.id, state.library[0].id);
  const raw = TL.toBackup(state);
  raw.version = 7;
  Object.assign(raw.library[0], {
    attackValue: { mode: 'auto', value: null },
    saveDCValue: { mode: 'fixed', value: 14 },
    targetSaveAbility: 'dex',
  });
  for (const c of [raw.characters[1], raw.roster[0]])
    Object.assign(c.items[0], {
      attackOverride: { mode: 'fixed', value: 8 },
      saveDCOverride: { mode: 'fixed', value: 17 },
      targetSaveOverride: 'wis',
    });
  const input = TL.clone(raw),
    restored = TL.normalize(raw);
  assert.equal(restored.library.length, 2);
  assert.equal(restored.characters[0].items[0].attack, 'Original attack');
  assert.equal(restored.characters[0].items[0].save, 'Original save\nDexterity DC 14');
  assert.equal(restored.characters[1].items[0].attack, 'Original attack\n+8');
  assert.equal(restored.characters[1].items[0].save, 'Original save\nWisdom DC 17');
  assert.equal(restored.characters[1].items[0].libraryId, restored.roster[0].items[0].libraryId);
  assert.notEqual(restored.characters[0].items[0].libraryId, restored.roster[0].items[0].libraryId);
  assert.deepEqual(
    TL.allCharacters(restored).map((c) => c.items[0].id),
    TL.allCharacters(raw).map((c) => c.items[0].id)
  );
  const backup = TL.toBackup(restored);
  assert.equal(backup.version, 9);
  assert.ok(
    !/attackValue|saveDCValue|targetSaveAbility|attackOverride|saveDCOverride|targetSaveOverride/.test(
      JSON.stringify(backup)
    )
  );
  assert.deepEqual(TL.normalize(backup), restored);
  assert.deepEqual(raw, input);
});

test('all detail sections are escaped, paged without text loss, and followed by Reference', () => {
  const c = TL.character();
  const it = TL.item({
    trigger: '<img src=x>',
    area: '20 ft',
    castingTime: '1 minute',
    school: 'Example',
    onSave: 'Half',
    requirements: 'r'.repeat(40000),
    special: 's'.repeat(40000),
    upgrades: 'User upgrades',
    description: 'Base rules',
    source: 'Final reference',
  });
  c.items = [it];
  c.hud.expanded = true;
  c.hud.detailId = it.id;
  const pages = TL.abilityTextPages(it);
  for (const section of TL.abilityTextSections(it)) {
    assert.equal(
      pages
        .flat()
        .filter((part) => part.label === section.label)
        .map((part) => part.text)
        .join('')
        .replace(/\s/g, ''),
      section.text.replace(/\s/g, '')
    );
  }
  for (const [page, parts] of pages.entries()) {
    c.hud.page = page;
    const html = HUD.render(c);
    for (const part of parts) assert.ok(html.includes(HUD.esc(part.text)));
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('&lt;img src=x&gt;'));
    assert.ok(html.indexOf('ability-source') > html.lastIndexOf('hud-description'));
  }
  assert.equal(HUD.countPages(c), pages.length);
  const html = HUD.renderAbilityDetails(it, c);
  assert.ok(html.indexOf('<h4>Requirements</h4>') < html.indexOf('<h4>Special</h4>'));
  assert.ok(html.indexOf('Final reference') > html.indexOf('<h4>Special</h4>'));
  let state = TL.normalize({ version: 1, characters: [c] });
  const before = TL.clone(state.characters[0].hud);
  Object.assign(state.library[0], { requirements: '', special: '' });
  state = TL.normalize(state);
  assert.deepEqual(state.characters[0].hud, { ...before, page: 0 });
});

test('the selected level and slot checkbox control spending for every ability type', () => {
  for (const kind of ['action', 'spell', 'feature'])
    for (const usesSlot of [true, false]) {
      const c = TL.character();
      c.slots[0] = { level: 1, current: 3, max: 3 };
      const it = TL.item({
        kind,
        level: 1,
        usesSlot,
        damage: 'Unchanged damage',
        upgrades: 'Manual improvement',
      });
      TL.spend(c, it, 1);
      assert.equal(c.slots[0].current, usesSlot ? 2 : 3);
      assert.equal(it.damage, 'Unchanged damage');
      assert.equal(it.upgrades, 'Manual improvement');
    }
});
