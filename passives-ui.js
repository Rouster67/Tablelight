/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';

function passiveReminderControl(c, it) {
  if (!it.trackPassive) return '<span class="badge">Always applies</span>';
  return button(
    HUD.passiveStatus(it),
    'set-passive',
    'small passive-switch' + (it.passiveActive ? ' active' : ''),
    `data-id="${esc(it.id)}" data-character="${esc(c.id)}" data-active="${!it.passiveActive}" role="switch" aria-checked="${it.passiveActive}" aria-label="Applies now: ${esc(it.name)}"`
  );
}
function passiveEffectLink(c, it) {
  return it.behavior === 'hybrid'
    ? button(
        'View passive effect',
        'view-passive',
        'subtle',
        `data-id="${esc(it.id)}" data-character="${esc(c.id)}"`
      )
    : '';
}
function renderPassiveList(c, items) {
  const rows = items
    .map(
      (it) => `<div class="ability-row passive-row" data-passive-id="${esc(it.id)}">
    ${HUD.abilityThumbnail(it, '', 'passive')}<div class="ability-main"><b>${HUD.abilityName(it)}</b><small>${it.behavior === 'hybrid' ? 'Passive + active' : 'Passive'}</small><p class="passive-excerpt">${esc(TL.passiveText(it))}</p></div>
    <div class="passive-controls"><div class="row wrap">${passiveReminderControl(c, it)}${button('View', 'view-passive', 'small', `data-id="${esc(it.id)}" data-character="${esc(c.id)}"`)}${button('Edit', 'edit-item', 'small subtle', `data-id="${esc(it.id)}"`)}</div>${button('Remove from character', 'delete-item', 'small subtle danger', `data-id="${esc(it.id)}" aria-label="Remove ${esc(it.name)} from ${esc(c.name)}"`)}</div></div>`
    )
    .join('');
  return (
    '<p class="hint passive-list-note">Passives are reminders, separate from conditions. Active / Inactive records whether a conditional passive applies to this character; it does not change statistics or spend anything.</p>' +
    (rows ||
      `<div class="empty-inline">${search ? 'No matching passives.' : 'No passives yet. Use + Add to create one or choose from your ability library.'}</div>`)
  );
}
function passiveDetailContent(c, it) {
  return `<div class="spread wrap"><span class="eyebrow">${it.behavior === 'hybrid' ? 'Passive part of a mixed ability' : 'Passive'}${it.local ? ' · Character only' : ' · Shared definition'}</span>${passiveReminderControl(c, it)}</div>${HUD.renderAbilityDetails(it, c, 'passive')}<p class="hint space-top">${it.trackPassive ? 'This switch records a reminder for ' + esc(c.name) + ' only.' : 'This passive is shown as always applying.'} Adjust any character statistics yourself. Conditions are managed separately.</p>`;
}
function passiveActiveLink(c, it) {
  return it.behavior === 'hybrid'
    ? button(
        'View active effect',
        'view-active-effect',
        'subtle',
        `data-id="${esc(it.id)}" data-character="${esc(c.id)}"`
      )
    : '';
}
function showPassiveItem(id, characterId = selected()?.id) {
  const c = TL.findCharacter(state, characterId),
    it = c?.items.find((it) => it.id === id);
  if (!it) return;
  if (!TL.hasPassiveEffect(it)) return showItem(id, false, characterId);
  modal(
    HUD.abilityName(it),
    `<div id="passive-details" data-character="${esc(c.id)}" data-item="${esc(it.id)}">${passiveDetailContent(c, it)}</div>`,
    `<div class="row wrap">${button('Edit', 'edit-item', 'subtle', `data-id="${esc(it.id)}"`)}${button('Show passive effect on TV', 'hud-detail', 'subtle', `data-id="${esc(it.id)}" data-character="${esc(c.id)}" data-effect="passive"`)}<span id="passive-active-link">${passiveActiveLink(c, it)}</span></div>${button('Close', 'close-modal', 'subtle')}`
  );
  document.querySelector('.modal').classList.add('ability-modal');
}
function refreshPassiveDetails() {
  const details = document.getElementById('passive-details');
  if (!details) return;
  const c = TL.findCharacter(state, details.dataset.character),
    it = c?.items.find((it) => it.id === details.dataset.item);
  if (!it) return closeModal();
  if (!TL.hasPassiveEffect(it)) return showItem(it.id, false, c.id);
  const html = passiveDetailContent(c, it);
  if (details.innerHTML !== html) details.innerHTML = html;
  document.getElementById('modal-title').innerHTML = HUD.abilityName(it);
  document.getElementById('passive-active-link').innerHTML = passiveActiveLink(c, it);
}
function handlePassiveAction(b) {
  const { action, id, character } = b.dataset;
  if (action === 'view-passive') showPassiveItem(id, character);
  else if (action === 'view-active-effect') showItem(id, false, character);
  else if (action === 'set-passive') {
    const fromDetails = !!b.closest('#passive-details'),
      fromCurrent = !!b.closest('.current-display'),
      focused = document.activeElement === b;
    commit(
      () =>
        TL.setPassiveActive(TL.findCharacter(state, character), id, b.dataset.active === 'true'),
      'Passive reminder updated'
    ).then(() => {
      if (!focused) return;
      const scope = fromCurrent
        ? document.querySelector('.current-display')
        : document.getElementById(fromDetails ? 'passive-details' : 'ability-list');
      [...(scope?.querySelectorAll('[data-action="set-passive"]') || [])]
        .find((el) => el.dataset.id === id && el.dataset.character === character)
        ?.focus();
    });
  } else return false;
  return true;
}
