/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';

function renderPartyList() {
  return renderSidebarParty();
}

const rankAfterToggle = (rank, which) => (which === 'p' ? (rank ? 0 : 1) : rank === 2 ? 1 : 2);
function rankButtons(rank, kind, name, inputName = '') {
  return `<span class="rank-bubbles" role="group" aria-label="${esc(name)} training">${[
    ['p', 'P', 'Proficiency', rank >= 1],
    ['e', 'E', 'Expertise', rank === 2],
  ]
    .map(([which, label, title, active]) =>
      button(
        label,
        'rank-toggle',
        'rank-bubble ' + (active ? 'filled' : ''),
        `data-kind="${kind}" data-name="${esc(name)}" data-which="${which}" ${inputName ? `data-input="${esc(inputName)}"` : ''} aria-label="${title}: ${esc(name)}" aria-pressed="${active}" title="${title}: ${esc(name)}"`
      )
    )
    .join('')}</span>`;
}
function editorRank(rank, kind, name, inputName) {
  return `<input type="hidden" name="${esc(inputName)}" value="${rank}">${rankButtons(rank, kind, name, inputName)}`;
}
function renderEditorSaves(c) {
  return `<h3 class="space-top">Saving throws</h3><p>P = proficiency · E = expertise. Expertise includes proficiency.</p><div class="training-saves">${TL.abilities.map((a) => `<div class="training-row"><span>${a.toUpperCase()}</span>${editorRank(TL.saveRank(c, a), 'save', a, 'save-rank-' + a)}</div>`).join('')}</div>`;
}
function renderEditorSkills(c) {
  return `<p>P = proficiency · E = expertise. Click a filled bubble to change it. Leave bonus overrides blank for automatic calculation.</p><div class="training-skills">${Object.keys(
    TL.skills
  )
    .map(
      (s, i) =>
        `<div class="training-row"><span>${esc(s)}</span>${editorRank(c.skills[s].rank, 'skill', s, 'skill-rank-' + i)}<input name="skill-override-${i}" aria-label="${esc(s)} bonus override" type="number" min="-99" max="99" placeholder="auto" value="${c.skills[s].override ?? ''}"></div>`
    )
    .join('')}</div>`;
}
function renderCharacterSheet(c) {
  return `<div class="card-body"><div class="spread"><h3>Skills & saves</h3>${button('Edit', 'edit-character', 'small')}</div><p class="hint space-top">P = proficiency · E = expertise. Click either bubble to change training.</p><div class="training-skills">${Object.keys(
    TL.skills
  )
    .map(
      (s) =>
        `<div class="training-row"><span>${esc(s)}</span>${rankButtons(c.skills[s].rank, 'skill', s)}<b>${TL.signed(TL.skillBonus(c, s))}</b></div>`
    )
    .join(
      ''
    )}</div><div class="separator"></div><h3>Saving throws</h3><div class="training-saves">${TL.abilities.map((a) => `<div class="training-row"><span>${a.toUpperCase()}</span>${rankButtons(TL.saveRank(c, a), 'save', a)}<b>${TL.signed(TL.saveBonus(c, a))}</b></div>`).join('')}</div>${c.notes ? `<div class="separator"></div><div class="eyebrow">DM notes · laptop only</div><p class="description-text space-top">${esc(c.notes)}</p>` : ''}</div>`;
}

function renderCurrentDisplay(c) {
  const detail = c.items.find((i) => i.id === c.hud.detailId),
    total = HUD.countPages(c),
    page = TL.hudPage(c);
  let content = '';
  if (detail)
    content = `<b>${HUD.abilityName(detail)}</b><p class="current-description">${esc(HUD.pages(detail.description)[page])}</p>${button('← Back to list', 'panel', 'small subtle', `data-panel="${esc(c.hud.panel)}"`)}`;
  else if (['action', 'bonus', 'reaction', 'free', 'spell', 'feature'].includes(c.hud.panel))
    content = `<div class="current-options">${
      TL.panelItems(c)
        .slice(page * HUD.abilityPageSize, (page + 1) * HUD.abilityPageSize)
        .map((it) =>
          button(HUD.abilityName(it), 'hud-detail', 'small subtle', `data-id="${esc(it.id)}"`)
        )
        .join('') || '<p class="hint">No abilities in this list yet.</p>'
    }</div>`;
  else if (c.hud.panel === 'resources')
    content = `<div class="current-options">${
      c.resources
        .slice(page * TL.statusPageSize, (page + 1) * TL.statusPageSize)
        .map((r) => `<span class="hint">${esc(r.name)} · ${r.current}/${r.max}</span>`)
        .join('') || '<p class="hint">No resource pools yet.</p>'
    }</div>`;
  else
    content = `<p class="hint">${c.hud.panel === 'sheet' ? 'Skills, saving throws, and training bubbles.' : `${c.hp}/${c.maxHp} HP · ${c.tempHp} temporary HP · AC ${c.ac}`}</p>`;
  const status = !overlayStatus.visible
    ? 'TV overlay hidden'
    : !c.hud.visible
      ? 'This player is hidden'
      : !c.hud.expanded
        ? 'Portrait only'
        : 'Live on TV';
  return `<section class="card current-display" data-current-character="${esc(c.id)}"><div class="card-heading"><h3>Currently displayed</h3><p class="hint">${esc(c.name)} · ${status}</p></div><div class="card-body gap">${renderCurrentSize(c)}<div class="current-navigation">${HUD.panelChoices.map(([key, label]) => button(label, 'panel', 'small ' + (c.hud.panel === key ? 'active' : ''), `data-panel="${key}" aria-pressed="${c.hud.panel === key}"`)).join('')}</div><div class="current-preview"><div class="eyebrow">${esc(labels[c.hud.panel] || 'Overview')}</div>${content}</div><div class="spread current-pages">${button('← Previous', 'hud-page', 'small', `data-amount="-1" ${page > 0 ? '' : 'disabled'}`)}<span class="hint">${page + 1} / ${total}</span>${button('Next →', 'hud-page', 'small', `data-amount="1" ${page < total - 1 ? '' : 'disabled'}`)}</div><div class="row wrap">${button(c.hud.expanded ? 'Collapse' : 'Expand HUD', 'toggle-expand', 'small subtle')}${button(c.hud.visible ? 'Hide player' : 'Show player', 'toggle-character-visible', 'small subtle')}</div></div></section>`;
}

function renderCurrentSize(c) {
  const percent = Math.round(c.hud.scale * 100);
  return `<div class="current-size"><label>HUD size <output>${percent}%</output><input type="range" min="40" max="250" step="1" value="${percent}" data-current-size="${esc(c.id)}" aria-label="HUD size for ${esc(c.name)}"></label><div class="current-size-buttons">${[
    [-10, 'Smaller'],
    [0, '100%'],
    [10, 'Larger'],
  ]
    .map(([amount, label]) =>
      button(label, 'current-size', 'small', `data-id="${esc(c.id)}" data-amount="${amount}"`)
    )
    .join(
      ''
    )}</div><p class="hint">The frame grows taller to keep character details visible.</p></div>`;
}
document.addEventListener('input', (event) => {
  const el = event.target.closest('[data-current-size]');
  if (el) el.closest('label').querySelector('output').textContent = el.value + '%';
});
document.addEventListener('change', (event) => {
  const el = event.target.closest('[data-current-size]');
  if (el)
    commit(() =>
      TL.hudCommand(state, {
        type: 'placement',
        characterId: el.dataset.currentSize,
        scale: Number(el.value) / 100,
      })
    );
});
async function scrollCurrentHud(command) {
  try {
    await saveQueue;
    await api.scrollHud?.(command);
    HUD.scroll(document.getElementById('preview-stage'), command);
  } catch (error) {
    toast(error.message);
  }
}
function showInitiativeOrder() {
  let order = state.characters.map((c) => ({ id: c.id, name: c.name, initiative: c.initiative }));
  const before = TL.clone(order);
  const rows = () =>
    order
      .map(
        (c, index) =>
          `<div class="initiative-row" data-order-id="${esc(c.id)}"><span>${index + 1}. ${esc(c.name)}</span><input name="initiative-${esc(c.id)}" aria-label="Initiative for ${esc(c.name)}" type="number" min="-99" max="999" required value="${c.initiative}"><button type="button" data-order-step="-1" aria-label="Move ${esc(c.name)} earlier" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-order-step="1" aria-label="Move ${esc(c.name)} later" ${index === order.length - 1 ? 'disabled' : ''}>↓</button></div>`
      )
      .join('');
  modal(
    'Party initiative order',
    `<form id="initiative-form"><p class="hint">Next turn follows this order. Enter rolls and sort, or use the arrows to set any order. You can also drag players or use the arrows in the sidebar.</p><div id="initiative-rows" class="space-top">${rows()}</div><p class="hint space-top">Changing order keeps the current player’s turn and the TV seating positions.</p></form>`,
    `<button id="sort-initiative" type="button">Sort highest first</button><div class="row">${button('Cancel', 'close-modal', 'subtle')}<button type="submit" form="initiative-form" class="primary">Save order</button></div>`
  );
  const read = () => {
    const form = document.getElementById('initiative-form');
    if (!form.reportValidity()) return false;
    for (const c of order)
      c.initiative = Number(form.elements.namedItem('initiative-' + c.id).value);
    return true;
  };
  document.getElementById('sort-initiative').onclick = () => {
    if (read()) {
      order.sort((a, b) => b.initiative - a.initiative);
      document.getElementById('initiative-rows').innerHTML = rows();
    }
  };
  document.getElementById('initiative-rows').onclick = (event) => {
    const b = event.target.closest('[data-order-step]');
    if (!b || !read()) return;
    const from = order.findIndex((c) => c.id === b.closest('[data-order-id]').dataset.orderId),
      to = from + Number(b.dataset.orderStep);
    if (to < 0 || to >= order.length) return;
    const [c] = order.splice(from, 1);
    order.splice(to, 0, c);
    document.getElementById('initiative-rows').innerHTML = rows();
  };
  submitForm('initiative-form', async () => {
    if (!read()) return;
    if (
      await commit(() => {
        TL.reorderParty(
          state,
          order.map((c) => c.id)
        );
        for (const c of order)
          if (c.initiative !== before.find((x) => x.id === c.id).initiative)
            state.characters.find((x) => x.id === c.id).initiative = c.initiative;
      }, 'Initiative order saved')
    )
      closeModal();
  });
}

function handleSessionAction(b) {
  const { action, kind, name, which, input, id } = b.dataset;
  switch (action) {
    case 'current-size': {
      const c = state.characters.find((c) => c.id === id);
      if (c)
        commit(() =>
          TL.hudCommand(state, {
            type: 'placement',
            characterId: id,
            scale: Number(b.dataset.amount)
              ? (Math.round(c.hud.scale * 100) + Number(b.dataset.amount)) / 100
              : 1,
          })
        );
      return true;
    }
    case 'current-scroll':
      scrollCurrentHud({
        characterId: id,
        area: b.dataset.area,
        direction: Number(b.dataset.direction),
      });
      return true;
    case 'rank-toggle': {
      if (input) {
        const field = b.closest('form').elements.namedItem(input),
          rank = rankAfterToggle(Number(field.value), which);
        field.value = rank;
        const group = b.closest('.rank-bubbles');
        for (const button of group.querySelectorAll('button')) {
          const active = button.dataset.which === 'p' ? rank >= 1 : rank === 2;
          button.classList.toggle('filled', active);
          button.setAttribute('aria-pressed', String(active));
        }
      } else {
        const c = selected(),
          rank = kind === 'skill' ? c.skills[name].rank : TL.saveRank(c, name);
        commit(() => TL.setRank(selected(), kind, name, rankAfterToggle(rank, which)));
      }
      return true;
    }
    case 'temp-hp': {
      const c = selected();
      amountModal('Set temporary HP · ' + esc(c.name), c.tempHp, (amount) =>
        commit(() => {
          const target = state.characters.find((x) => x.id === c.id);
          if (target) target.tempHp = amount;
        }, 'Temporary HP updated')
      );
      return true;
    }
    case 'party-move':
      commit(() => TL.moveParty(state, id, Number(b.dataset.amount)));
      return true;
    case 'initiative-order':
      showInitiativeOrder();
      return true;
    case 'hud-detail':
      commit(() => TL.hudCommand(state, { type: 'detail', characterId: selectedId, itemId: id }));
      return true;
    default:
      return false;
  }
}

let draggedPartyId = '';
document.addEventListener('dragstart', (event) => {
  const row = event.target.closest('[data-party-id]');
  if (!row) return;
  draggedPartyId = row.dataset.partyId;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', draggedPartyId);
  row.classList.add('party-dragging');
});
document.addEventListener('dragover', (event) => {
  const row = event.target.closest('[data-party-id]');
  if (row && draggedPartyId) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }
});
document.addEventListener('drop', (event) => {
  const row = event.target.closest('[data-party-id]');
  if (!row || !draggedPartyId) return;
  event.preventDefault();
  const id = draggedPartyId;
  draggedPartyId = '';
  if (id === row.dataset.partyId) return;
  const ids = state.characters.map((c) => c.id);
  if (!ids.includes(id)) return;
  ids.splice(ids.indexOf(id), 1);
  const rect = row.getBoundingClientRect(),
    index = ids.indexOf(row.dataset.partyId) + (event.clientY > rect.top + rect.height / 2 ? 1 : 0);
  ids.splice(index, 0, id);
  commit(() => TL.reorderParty(state, ids));
});
document.addEventListener('dragend', () => {
  draggedPartyId = '';
  document
    .querySelectorAll('.party-dragging')
    .forEach((el) => el.classList.remove('party-dragging'));
});
