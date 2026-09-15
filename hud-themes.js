/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HUDThemes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const directions = [
    ['artificer', 'Artificer', '#18272B', '#E8B777'],
    ['barbarian', 'Barbarian', '#2B191D', '#F29A83'],
    ['bard', 'Bard', '#281E35', '#DDB0EF'],
    ['cleric', 'Cleric', '#242A32', '#E9D9A2'],
    ['druid', 'Druid', '#192B23', '#ADD095'],
    ['fighter', 'Fighter', '#202833', '#B7CADA'],
    ['monk', 'Monk', '#29251C', '#E4C57F'],
    ['paladin', 'Paladin', '#1C2540', '#E6CC84'],
    ['ranger', 'Ranger', '#242B1D', '#C0CD88'],
    ['rogue', 'Rogue', '#22232C', '#BCBAD3'],
    ['sorcerer', 'Sorcerer', '#301D29', '#F0A3CF'],
    ['warlock', 'Warlock', '#241E35', '#BDB0F3'],
    ['wizard', 'Wizard', '#192B3C', '#94CDF0'],
  ];
  const rgb = (hex) =>
    hex
      .slice(1)
      .match(/../g)
      .map((v) => parseInt(v, 16));
  const mix = (a, b, weight) =>
    '#' +
    rgb(a)
      .map((v, i) =>
        Math.round(v * (1 - weight) + rgb(b)[i] * weight)
          .toString(16)
          .padStart(2, '0')
      )
      .join('');
  const palettes = Object.freeze(
    Object.fromEntries(
      directions.map(([id, name, surface, highlight]) => [
        id,
        Object.freeze({
          id,
          name,
          colors: Object.freeze({
            surface,
            highlight,
            panel: mix(surface, highlight, 0.06),
            control: mix(surface, highlight, 0.1),
            hover: mix(surface, highlight, 0.18),
            border: mix(surface, highlight, 0.7),
            text: '#F3F5F7',
            muted: '#C6CFD8',
            ink: '#10151B',
            hp: '#A7E6BB',
            temp: '#B7E8FA',
            damage: '#FFB7B2',
            warning: '#FFE6A8',
            'warning-surface': '#493C22',
          }),
        }),
      ])
    )
  );
  const choices = Object.freeze([
    Object.freeze({ id: 'default', name: 'Default' }),
    ...Object.values(palettes).map(({ id, name }) => Object.freeze({ id, name })),
  ]);
  const get = (id) => (typeof id === 'string' && Object.hasOwn(palettes, id) ? palettes[id] : null);
  const luminance = (channels) =>
    channels
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  function resourceBacking(color) {
    const channels = /^#[0-9a-f]{6}$/i.test(color)
      ? rgb(color)
      : color
          .match(/[\d.]+/g)
          ?.slice(0, 3)
          .map(Number);
    const light = channels?.length === 3 ? luminance(channels) : 0;
    return (light + 0.05) / 0.05 >= 1.05 / (light + 0.05) ? '#000000' : '#FFFFFF';
  }
  function apply(element, id) {
    const palette = get(id);
    // Returning to Default removes only the theme's own decoration, never player settings.
    for (const name of [...element.style])
      if (name.startsWith('--hud-theme-')) element.style.removeProperty(name);
    if (!palette) {
      delete element.dataset.hudTheme;
      for (const frame of element.querySelectorAll('.hud-resource-icon-frame'))
        frame.replaceWith(frame.firstElementChild);
      return;
    }
    element.dataset.hudTheme = palette.id;
    for (const [name, value] of Object.entries(palette.colors))
      element.style.setProperty('--hud-theme-' + name, value);
    element.style.setProperty('--hud-theme-rgb', rgb(palette.colors.surface).join(', '));
    for (const icon of element.querySelectorAll('.resource-icon')) {
      let frame = icon.parentElement;
      if (!frame.classList.contains('hud-resource-icon-frame')) {
        frame = element.ownerDocument.createElement('span');
        frame.className = 'hud-resource-icon-frame';
        frame.setAttribute('aria-hidden', 'true');
        icon.replaceWith(frame);
        frame.append(icon);
      }
      frame.style.setProperty('--resource-backing', resourceBacking(icon.style.color));
    }
  }
  return Object.freeze({ choices, palettes, get, apply, resourceBacking });
});
