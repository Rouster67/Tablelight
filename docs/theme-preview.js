/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
function sample(theme) {
  const c = TL.character();
  Object.assign(c, {
    name: theme.name + ' adventurer',
    className: 'Independent player color',
    hp: 24,
    maxHp: 38,
    tempHp: 5,
    concentrating: true,
    concentration: 'Prismatic beacon',
    theme: theme.id,
  });
  c.turn.bonus = false;
  c.slots[0] = { level: 1, max: 4, current: 2 };
  c.resources = [
    {
      id: 'focus',
      name: 'Focus',
      color: '#080808',
      icon: 'star',
      current: 2,
      max: 4,
      reset: 'long',
    },
    {
      id: 'spirit',
      name: 'Spirit',
      color: '#FAFAFA',
      icon: 'diamond',
      current: 1,
      max: 3,
      reset: 'short',
    },
  ];
  c.items = [
    TL.item({
      name: 'Prismatic beacon',
      description:
        'A bright marker guides the party. The image, player color, and resource settings are independent of the class theme.',
      economy: 'action',
    }),
    TL.item({ name: 'Spent technique', economy: 'action', disabled: true }),
  ];
  c.hud = { ...c.hud, expanded: true, panel: 'action', visible: true, x: 50, y: 58, scale: 0.48 };
  const bubble = TL.clone(c);
  bubble.id = TL.uid();
  bubble.hud = { ...c.hud, expanded: false, y: 12, scale: 0.65 };
  return {
    version: 10,
    characters: [c, bubble],
    settings: { opacity: 0.94, overlayInteractive: true },
  };
}
const gallerySamples = HUDThemes.choices.map((theme) => {
  const section = document.createElement('section');
  section.className = 'theme-sample';
  section.innerHTML = `<h2>${HUD.esc(theme.name)}</h2><div class="theme-stage"></div><p>${theme.id === 'default' ? 'Current appearance; unchanged opacity behavior.' : 'Solid reading surfaces · independent player ring and resource colors.'}</p>`;
  document.getElementById('theme-gallery').append(section);
  return { state: sample(theme), stage: section.querySelector('.theme-stage') };
});
function renderGallery() {
  const opacity = Number(document.getElementById('opacity').value) / 100,
    panel = document.getElementById('panel').value;
  document.body.dataset.map = document.getElementById('map').value;
  document.getElementById('opacity-value').value = Math.round(opacity * 100) + '%';
  for (const { state, stage } of gallerySamples) {
    state.settings.opacity = opacity;
    const c = state.characters[0];
    c.hud.panel = panel === 'detail' ? 'action' : panel;
    c.hud.detailId = panel === 'detail' ? c.items[0].id : '';
    c.hud.scale = Math.min(0.48, (stage.clientWidth - 22) / 880);
    HUD.mount(stage, state, stage.clientWidth, stage.clientHeight, 1, '', 'preview');
  }
}
for (const id of ['map', 'opacity', 'panel'])
  document.getElementById(id).addEventListener('input', renderGallery);
window.addEventListener('resize', renderGallery);
renderGallery();
