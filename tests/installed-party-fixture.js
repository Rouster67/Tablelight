/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function createInstalledParty() {
  const TL = require('../core');
  const { png, dataUrl } = require('../tests/icon-fixtures');
  const sharedIcon = dataUrl(png(32, 16, { pixel: [60, 170, 245, 180] }));
  const localIcon = dataUrl(png(16, 32, { pixel: [235, 95, 70, 255] }));
  const state = TL.empty();
  const c = TL.character(0);
  c.name = 'Synthetic update player';
  c.theme = 'artificer';
  c.maxHp = 42;
  c.hp = 23;
  c.notes = 'Private synthetic note survives the update.';
  c.avatar =
    'data:image/png;base64,' + fs.readFileSync(path.join(root, 'icon.png')).toString('base64');
  c.abilities.int = 17;
  c.slots[0] = { level: 1, max: 3, current: 1 };
  c.resources = [
    {
      id: 'test-pool',
      name: 'Synthetic pool',
      max: 5,
      current: 2,
      reset: 'long',
      icon: 'diamond',
      color: '#123456',
    },
  ];
  state.characters = [c];
  state.activeId = c.id;
  state.roster = [
    { ...TL.character(1), name: 'Synthetic saved player', avatar: c.avatar, theme: 'wizard' },
  ];
  state.library = [
    TL.libraryEntry({
      name: 'Synthetic spell',
      kind: 'spell',
      level: 1,
      requiresConcentration: true,
      description: 'Synthetic spell text.',
      icon: sharedIcon,
    }),
    TL.libraryEntry({
      name: 'Synthetic action',
      kind: 'action',
      description: 'Synthetic action text.',
    }),
    TL.libraryEntry({
      name: 'Synthetic feature',
      kind: 'feature',
      description: 'Synthetic feature text.',
      icon: sharedIcon,
    }),
    TL.libraryEntry({
      name: 'Unassigned ability',
      description: 'Retain unused library entries too.',
      icon: localIcon,
    }),
  ];
  const concentration = TL.attachItem(state, c.id, state.library[0].id, {
    resourceId: 'test-pool',
    resourceCost: 2,
  });
  TL.attachItem(state, c.id, state.library[1].id);
  TL.attachItem(state, state.roster[0].id, state.library[2].id, { disabled: true });
  TL.createLocalItem(state, c.id, {
    name: 'Synthetic local ability',
    icon: localIcon,
    economy: 'free',
  });
  TL.setConcentration(c, true, concentration.id);
  state.conditionLibrary = [
    TL.conditionEntry({
      name: 'Active condition',
      description: 'Synthetic active condition text.',
    }),
    TL.conditionEntry({
      name: 'Saved-player condition',
      description: 'Synthetic saved-player condition text.',
    }),
    TL.conditionEntry({
      name: 'Unassigned condition',
      description: 'Retain unused conditions too.',
    }),
  ];
  TL.assignCondition(state, c.id, state.conditionLibrary[0].id);
  TL.assignCondition(state, state.roster[0].id, state.conditionLibrary[1].id);
  // Exercise shared definitions, independent reminder states, local-only text and
  // dormant costs through the actual installer, not just a save round trip.
  state.library.push(
    TL.libraryEntry({
      id: 'update-passive',
      name: 'Synthetic lantern sense',
      behavior: 'passive',
      trackPassive: true,
      description: 'Read this reminder while carrying the synthetic lantern.',
      economy: 'bonus',
      level: 1,
      icon: sharedIcon,
    }),
    TL.libraryEntry({
      id: 'update-hybrid',
      name: 'Synthetic watchkeeper',
      behavior: 'hybrid',
      trackPassive: true,
      description: 'Signal the party.',
      passiveDescription: 'Watch the synthetic gate.',
      economy: 'reaction',
      level: 1,
      icon: localIcon,
    }),
    TL.libraryEntry({
      id: 'update-unused-passive',
      name: 'Unassigned passive',
      behavior: 'passive',
      description: 'Keep an unused passive definition through the update.',
    })
  );
  const savedPlayer = state.roster[0];
  savedPlayer.resources = [
    { id: 'saved-pool', name: 'Saved player pool', max: 7, current: 4, reset: 'short' },
  ];
  for (const [player, resourceId, cost, active] of [
    [c, 'test-pool', 2, true],
    [savedPlayer, 'saved-pool', 3, false],
  ]) {
    const passive = TL.attachItem(state, player.id, 'update-passive', {
      resourceId,
      resourceCost: cost,
      disabled: !active,
    });
    const hybrid = TL.attachItem(state, player.id, 'update-hybrid', {
      resourceId,
      resourceCost: cost,
    });
    TL.setPassiveActive(player, passive.id, active);
    TL.setPassiveActive(player, hybrid.id, !active);
    Object.assign(player.hud, {
      expanded: true,
      panel: 'passive',
      detailId: hybrid.id,
      rotation: active ? 90 : 270,
      scale: active ? 0.85 : 1.15,
    });
  }
  const localPassive = TL.createLocalItem(state, c.id, {
    name: 'Synthetic private reminder',
    behavior: 'passive',
    trackPassive: true,
    description: 'Only this character owns this reminder.',
    icon: localIcon,
  });
  TL.setPassiveActive(c, localPassive.id, true);
  state.settings.opacity = 0.81;
  state.settings.soloExpand = true;
  state.settings.hudControlsVersion = 1;
  return TL.normalize(state);
}
function assertInstalledParty(saved) {
  assert.equal(saved.characters[0].hp, 22);
  assert.equal(saved.characters[0].notes, 'Private synthetic note survives the update.');
  assert.equal(saved.roster[0].name, 'Synthetic saved player');
  assert.equal(saved.library.length, 7);
  assert.equal(saved.conditionLibrary.length, 3);
  assert.equal(saved.characters[0].items.length, 6);
  assert.equal(saved.roster[0].items.length, 3);
  assert.equal(saved.characters[0].conditionIds.length, 1);
  assert.equal(saved.roster[0].conditionIds.length, 1);
  assert.ok(saved.characters[0].avatar.startsWith('data:image/png;base64,'));
  assert.equal(saved.version, 11);
  assert.equal(saved.characters[0].theme, 'artificer');
  assert.equal(saved.roster[0].theme, 'wizard');
  assert.ok(saved.library[0].icon.startsWith('data:image/png;base64,'));
  assert.ok(saved.library[2].icon.startsWith('data:image/png;base64,'));
  assert.ok(saved.library[3].icon.startsWith('data:image/png;base64,'));
  assert.ok(saved.characters[0].items[2].icon.startsWith('data:image/png;base64,'));
  assert.equal(saved.characters[0].items[0].icon, undefined);
  for (const [player, active, resourceId, cost, rotation, scale] of [
    [saved.characters[0], true, 'test-pool', 2, 90, 0.85],
    [saved.roster[0], false, 'saved-pool', 3, 270, 1.15],
  ]) {
    const passive = player.items.find((item) => item.libraryId === 'update-passive');
    const hybrid = player.items.find((item) => item.libraryId === 'update-hybrid');
    assert.equal(passive.passiveActive, active);
    assert.equal(passive.disabled, !active);
    assert.equal(hybrid.passiveActive, !active);
    for (const item of [passive, hybrid]) {
      assert.equal(item.resourceId, resourceId);
      assert.equal(item.resourceCost, cost);
    }
    assert.equal(player.hud.panel, 'passive');
    assert.equal(player.hud.detailId, hybrid.id);
    assert.equal(player.hud.rotation, rotation);
    assert.equal(player.hud.scale, scale);
  }
  const localPassive = saved.characters[0].items.find(
    (item) => item.name === 'Synthetic private reminder'
  );
  assert.equal(localPassive.behavior, 'passive');
  assert.equal(localPassive.passiveActive, true);
  assert.ok(!localPassive.libraryId);
  const hybridDefinition = saved.library.find((item) => item.id === 'update-hybrid');
  assert.equal(hybridDefinition.behavior, 'hybrid');
  assert.equal(hybridDefinition.economy, 'reaction');
  assert.equal(hybridDefinition.description, 'Signal the party.');
  assert.equal(hybridDefinition.passiveDescription, 'Watch the synthetic gate.');
}
module.exports = { createInstalledParty, assertInstalledParty };
