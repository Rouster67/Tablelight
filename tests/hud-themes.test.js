/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const Themes = require('../hud-themes');
const luminance = (hex) =>
  [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
test('all 13 class palettes have stable identifiers; missing or unknown choices resolve to Default', () => {
  assert.deepEqual(
    Themes.choices.map((p) => p.name),
    [
      'Default',
      'Artificer',
      'Barbarian',
      'Bard',
      'Cleric',
      'Druid',
      'Fighter',
      'Monk',
      'Paladin',
      'Ranger',
      'Rogue',
      'Sorcerer',
      'Warlock',
      'Wizard',
    ]
  );
  for (const id of [
    undefined,
    null,
    '',
    'default',
    'Wizard',
    '__proto__',
    'constructor',
    'future-theme',
    'wizard; color:red',
  ])
    assert.equal(Themes.get(id), null);
  assert.equal(Themes.get('wizard').name, 'Wizard');
  assert.throws(() => {
    Themes.palettes.wizard.colors.text = '#000000';
  }, TypeError);
});
test('class text, semantic labels, selected states and control boundaries meet the planned contrast thresholds', () => {
  for (const { name, colors: c } of Object.values(Themes.palettes)) {
    for (const background of ['surface', 'panel', 'control', 'hover']) {
      for (const text of ['text', 'muted', 'highlight', 'hp', 'temp', 'damage', 'warning'])
        assert.ok(
          contrast(c[text], c[background]) >= 4.5,
          `${name} ${text}/${background}: ${contrast(c[text], c[background])}`
        );
      assert.ok(
        contrast(c.border, c[background]) >= 3,
        `${name} border/${background}: ${contrast(c.border, c[background])}`
      );
    }
    assert.ok(contrast(c.ink, c.highlight) >= 4.5, name + ' selected text');
    assert.ok(contrast(c.warning, c['warning-surface']) >= 4.5, name + ' concentration');
  }
});
test('arbitrary resource colors get a contrasting backing without altering their stored color', () => {
  for (let r = 0; r <= 255; r += 17)
    for (let g = 0; g <= 255; g += 17)
      for (let b = 0; b <= 255; b += 17) {
        const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
        assert.ok(contrast(hex, Themes.resourceBacking(hex)) >= 4.5, hex);
        assert.equal(Themes.resourceBacking(`rgb(${r}, ${g}, ${b})`), Themes.resourceBacking(hex));
      }
});
