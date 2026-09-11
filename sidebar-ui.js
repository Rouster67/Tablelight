/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
let sidebarSearch = '',
  sidebarPage = 0;
const SIDEBAR_PAGE_SIZE = 12;

function renderSidebar() {
  return `<aside class="sidebar"><div class="brand"><div class="brand-mark">T</div><div><div class="brand-name">Tablelight</div><small>THE TABLE, ALIVE.</small></div></div><nav class="sidebar-navigation" aria-label="App sections">${[
    ['character', '⚔', 'DM console'],
    ['display', '▱', 'TV & layout'],
    ['library', '▤', 'Ability library'],
    ['condition-library', '◇', 'Condition library'],
    ['roster', '♙', 'Players & party'],
  ]
    .map(([key, icon, label]) =>
      button(
        `<span>${icon}</span>${label}`,
        'view-' + key,
        'nav-button ' + (view === key ? 'active' : '')
      )
    )
    .join(
      ''
    )}</nav><div class="sidebar-player-sections"><section class="sidebar-section sidebar-party ${state.characters.length ? '' : 'is-empty'}" aria-labelledby="sidebar-party-heading"><div class="spread sidebar-section-heading"><h2 id="sidebar-party-heading" class="eyebrow">Party</h2><span class="hint">${state.characters.length} / ${TL.PARTY_LIMIT}</span></div>${renderPartyList()}</section><section class="sidebar-section sidebar-saved ${state.roster.length ? '' : 'is-empty'}" aria-labelledby="sidebar-saved-heading"><div class="spread sidebar-section-heading"><h2 id="sidebar-saved-heading" class="eyebrow">All characters</h2><span class="hint">${state.roster.length}</span></div><p class="sidebar-caption">Not in the party · A–Z</p>${state.roster.length ? `<input id="sidebar-search" type="search" aria-label="Search characters outside the party" placeholder="Find a character…" value="${esc(sidebarSearch)}">` : ''}<div id="sidebar-saved-results">${renderSidebarSaved()}</div></section></div><div class="sidebar-footer">${button('+ Add character', 'add-character', 'subtle sidebar-create')}${button('Setup & help', 'view-help', 'nav-button ' + (view === 'help' ? 'active' : ''))}<p class="hint">Tablelight 1.9.2</p><p class="hint" id="save-status">${saveError ? 'Save failed' : 'Saved on this laptop'}</p></div></aside>`;
}
function renderSidebarParty() {
  return `${button('Initiative order', 'initiative-order', 'subtle small', state.characters.length ? '' : 'disabled')}<div id="sidebar-party-list" class="party-list" tabindex="0" aria-label="Party in initiative order">${state.characters.map((c, index) => `<div class="party-entry" draggable="true" data-party-id="${esc(c.id)}"><button type="button" class="party-button ${c.id === selectedId ? 'active' : ''}" data-action="select" data-id="${esc(c.id)}" style="--accent:${c.accent}" title="Select ${esc(c.name)} · drag to reorder">${portrait(c)}<div><div class="party-name">${esc(c.name)}</div><small>${index + 1}. Init ${c.initiative} · ${c.hp}/${c.maxHp} HP</small></div>${c.id === state.activeId ? '<i class="party-dot" title="Current turn"></i>' : ''}</button><div class="party-order-buttons">${button('↑', 'party-move', '', `data-id="${esc(c.id)}" data-amount="-1" aria-label="Move ${esc(c.name)} earlier" ${index === 0 ? 'disabled' : ''}`)}${button('↓', 'party-move', '', `data-id="${esc(c.id)}" data-amount="1" aria-label="Move ${esc(c.name)} later" ${index === state.characters.length - 1 ? 'disabled' : ''}`)}</div><div class="sidebar-character-actions">${button('Remove from party', 'roster-remove', 'subtle', `data-id="${esc(c.id)}" aria-label="Remove ${esc(c.name)} from party"`)}${button('Delete character', 'roster-delete', 'danger subtle', `data-id="${esc(c.id)}" aria-label="Delete ${esc(c.name)}"`)}</div></div>`).join('') || '<p class="hint sidebar-empty">Add a saved character below or create a new one.</p>'}</div>`;
}
function renderSidebarSaved() {
  const query = sidebarSearch.trim().toLocaleLowerCase();
  const characters = state.roster
    .filter((c) => `${c.name} ${c.className} ${c.species}`.toLocaleLowerCase().includes(query))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
    );
  const pages = Math.max(1, Math.ceil(characters.length / SIDEBAR_PAGE_SIZE));
  sidebarPage = Math.min(Math.max(sidebarPage, 0), pages - 1);
  const start = sidebarPage * SIDEBAR_PAGE_SIZE;
  const full = state.characters.length >= TL.PARTY_LIMIT;
  return `<div id="sidebar-saved-list" class="saved-character-list" tabindex="0" aria-label="Characters outside the party, alphabetical order">${
    characters
      .slice(start, start + SIDEBAR_PAGE_SIZE)
      .map(
        (c) =>
          `<div class="saved-character-entry" data-saved-id="${esc(c.id)}"><button type="button" class="party-button" data-action="roster-edit" data-id="${esc(c.id)}" style="--accent:${c.accent}" title="Edit ${esc(c.name)}">${portrait(c)}<div><div class="party-name">${esc(c.name)}</div><small>Level ${c.level} ${esc(c.className || 'adventurer')}</small></div></button><div class="sidebar-character-actions">${button('Add to party', 'roster-add', 'subtle', `data-id="${esc(c.id)}" aria-label="Add ${esc(c.name)} to party" ${full ? 'disabled title="Party full (8/8). Remove someone to make room."' : ''}`)}${button('Delete character', 'roster-delete', 'danger subtle', `data-id="${esc(c.id)}" aria-label="Delete ${esc(c.name)}"`)}</div></div>`
      )
      .join('') ||
    `<p class="hint sidebar-empty">${state.roster.length ? 'No matching characters.' : 'Every saved character is in the party.'}</p>`
  }</div>${pages > 1 ? `<div class="sidebar-pages">${button('←', 'sidebar-page', 'small subtle', `data-amount="-1" aria-label="Previous saved characters" ${sidebarPage === 0 ? 'disabled' : ''}`)}<span class="hint">${start + 1}–${Math.min(start + SIDEBAR_PAGE_SIZE, characters.length)} of ${characters.length}</span>${button('→', 'sidebar-page', 'small subtle', `data-amount="1" aria-label="Next saved characters" ${sidebarPage >= pages - 1 ? 'disabled' : ''}`)}</div>` : ''}`;
}
function refreshSidebarSaved() {
  const target = document.getElementById('sidebar-saved-results');
  if (target) target.innerHTML = renderSidebarSaved();
}
function captureSidebarState() {
  const search = document.getElementById('sidebar-search');
  return {
    partyScroll: document.getElementById('sidebar-party-list')?.scrollTop || 0,
    savedScroll: document.getElementById('sidebar-saved-list')?.scrollTop || 0,
    focused: !!search && document.activeElement === search,
    selectionStart: search?.selectionStart,
    selectionEnd: search?.selectionEnd,
  };
}
function restoreSidebarState(previous) {
  const party = document.getElementById('sidebar-party-list'),
    saved = document.getElementById('sidebar-saved-list');
  if (party) party.scrollTop = previous.partyScroll;
  if (saved) saved.scrollTop = previous.savedScroll;
  const search = document.getElementById('sidebar-search');
  if (previous.focused && search) {
    search.focus({ preventScroll: true });
    if (previous.selectionStart !== null)
      search.setSelectionRange(previous.selectionStart, previous.selectionEnd);
  }
}
document.addEventListener('input', (event) => {
  if (event.target.id !== 'sidebar-search') return;
  sidebarSearch = event.target.value;
  sidebarPage = 0;
  refreshSidebarSaved();
});
document.addEventListener('click', (event) => {
  const b = event.target.closest('[data-action="sidebar-page"]');
  if (!b || b.disabled) return;
  sidebarPage += Number(b.dataset.amount);
  refreshSidebarSaved();
});
