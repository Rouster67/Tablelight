/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const TL = require('../core'),
  { png, dataUrl } = require('./icon-fixtures');
module.exports = () => {
  const state = TL.empty();
  state.library = Array.from({ length: 5000 }, (_, i) =>
    TL.libraryEntry({
      id: 'entry-' + i,
      name: 'Ability ' + i,
      icon: i < 31 ? dataUrl(png(256, 256, { pixel: [i, 90, 150, 255], level: 0 })) : '',
    })
  );
  state.characters = Array.from({ length: 8 }, (_, i) => TL.character(i));
  state.roster = Array.from({ length: 100 }, (_, i) => TL.character(i + 8));
  state.settings.soloExpand = false;
  for (const [i, c] of state.characters.entries()) {
    for (const entry of state.library.slice(0, 31)) TL.attachItem(state, c.id, entry.id);
    c.resources = [{ id: 'pool', name: 'Pool', current: 50, max: 50, reset: 'manual' }];
    Object.assign(c.hud, {
      expanded: true,
      visible: true,
      panel: 'action',
      rotation: (i % 4) * 90,
      scale: 0.4,
      x: 15 + (i % 4) * 23,
      y: 25 + Math.floor(i / 4) * 50,
    });
  }
  for (const c of state.roster) TL.attachItem(state, c.id, 'entry-4999');
  return state;
};
