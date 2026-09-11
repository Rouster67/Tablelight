/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
let rosterSearch = '',
  rosterFilter = 'all',
  rosterPage = 0;
const ROSTER_PAGE_SIZE = 12;

function renderRoster() {
  return `<div class="page-heading spread wrap"><div><div class="eyebrow">Saved players · active party</div><h1 class="space-top">Players & party</h1><p>Keep as many players as you need. Choose up to eight for this session.</p></div>${button('+ Create player', 'add-character', 'primary')}</div><div class="note roster-note"><b>${state.characters.length} / ${TL.PARTY_LIMIT} in the active party · ${TL.allCharacters(state).length} saved players</b><p class="hint">Only active party members appear in the DM console, turn order, and TV overlay. Remove from party keeps their character and HUD setup saved. Delete character removes their saved character.</p></div><section class="card"><div class="card-body roster-toolbar"><label class="form-field"><span>Search saved players</span><input id="roster-search" type="search" placeholder="Name, class, or species…" value="${esc(rosterSearch)}"></label><label class="form-field"><span>Show players</span><select id="roster-filter">${options(
    [
      ['all', 'All saved players'],
      ['party', 'In active party'],
      ['saved', 'Outside the party'],
    ],
    rosterFilter
  )}</select></label></div><div id="roster-results">${renderRosterResults()}</div></section>`;
}
function renderRosterResults() {
  const activeIds = new Set(state.characters.map((c) => c.id));
  const query = rosterSearch.trim().toLocaleLowerCase();
  const players = TL.allCharacters(state)
    .filter(
      (c) =>
        (rosterFilter === 'all' || activeIds.has(c.id) === (rosterFilter === 'party')) &&
        `${c.name} ${c.className} ${c.species}`.toLocaleLowerCase().includes(query)
    )
    .sort((a, b) =>
      rosterFilter === 'party'
        ? 0
        : a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
    );
  const pages = Math.max(1, Math.ceil(players.length / ROSTER_PAGE_SIZE));
  rosterPage = Math.min(Math.max(0, rosterPage), pages - 1);
  const start = rosterPage * ROSTER_PAGE_SIZE;
  return `<div class="roster-list">${
    players
      .slice(start, start + ROSTER_PAGE_SIZE)
      .map((c) => {
        const active = activeIds.has(c.id);
        const full = state.characters.length >= TL.PARTY_LIMIT;
        return `<article class="roster-row" data-player-id="${esc(c.id)}" style="--accent:${c.accent}">${portrait(c)}<div class="roster-player"><b>${esc(c.name)}</b><p class="hint">Level ${c.level} ${esc(c.className || 'adventurer')}${c.species ? ' · ' + esc(c.species) : ''}</p><small class="${active ? 'roster-active' : 'muted'}">${active ? 'In active party' : 'Saved for later'}</small></div><div class="row wrap roster-actions">${active ? button('Remove from party', 'roster-remove', 'small', `data-id="${esc(c.id)}"`) : button(full ? 'Party full · 8 / 8' : 'Add to party', 'roster-add', 'small primary', `data-id="${esc(c.id)}" ${full ? 'disabled title="Remove a party member to make room. They remain saved."' : ''}`)}${button('Edit', 'roster-edit', 'small subtle', `data-id="${esc(c.id)}" aria-label="Edit ${esc(c.name)}"`)}${button('Delete character', 'roster-delete', 'small danger subtle', `data-id="${esc(c.id)}" aria-label="Delete ${esc(c.name)}"`)}</div></article>`;
      })
      .join('') ||
    `<div class="card-body empty-roster"><h3>${query ? 'No matching players' : 'No players here yet'}</h3><p class="hint">${query ? 'Try another name, class, or species.' : rosterFilter === 'party' ? 'Choose saved players from the roster to build your active party.' : 'Create a player to get started.'}</p></div>`
  }</div><div class="card-body spread wrap roster-pagination"><span class="hint">${players.length ? `${start + 1}–${Math.min(start + ROSTER_PAGE_SIZE, players.length)} of ${players.length} players` : '0 players'}</span><div class="row">${button('← Previous', 'roster-page', 'small subtle', `data-amount="-1" ${rosterPage === 0 ? 'disabled' : ''}`)}<span class="hint">Page ${rosterPage + 1} of ${pages}</span>${button('Next →', 'roster-page', 'small subtle', `data-amount="1" ${rosterPage >= pages - 1 ? 'disabled' : ''}`)}</div></div>`;
}
function refreshRosterResults() {
  const target = document.getElementById('roster-results');
  if (target) target.innerHTML = renderRosterResults();
}
function deleteSavedPlayer(id) {
  const c = TL.findCharacter(state, id);
  if (!c) return;
  confirmAction(
    'Delete ' + esc(c.name) + '?',
    'This deletes their saved character, portrait, stats, and ability links, and removes them from the party and TV. Shared library entries stay available. You can Undo during this session.',
    () =>
      commit(() => {
        TL.deletePlayer(state, id);
        if (selectedId === id) selectedId = state.activeId || state.characters[0]?.id || '';
      }, 'Character deleted'),
    'Delete character'
  );
}
function handleRosterAction(b) {
  const id = b.dataset.id;
  switch (b.dataset.action) {
    case 'roster-add':
      commit(() => {
        TL.addToParty(state, id);
        if (!selectedId) selectedId = id;
      }, 'Added to active party');
      return true;
    case 'roster-remove':
      commit(() => {
        TL.removeFromParty(state, id);
        if (selectedId === id) selectedId = state.activeId || state.characters[0]?.id || '';
      }, 'Removed from party · player remains saved');
      return true;
    case 'roster-delete':
      deleteSavedPlayer(id);
      return true;
    case 'roster-edit':
      editCharacter(false, id);
      return true;
    case 'roster-page':
      rosterPage += Number(b.dataset.amount);
      refreshRosterResults();
      return true;
    default:
      return false;
  }
}
document.addEventListener('input', (event) => {
  if (event.target.id !== 'roster-search') return;
  rosterSearch = event.target.value;
  rosterPage = 0;
  refreshRosterResults();
});
document.addEventListener('change', (event) => {
  if (event.target.id !== 'roster-filter') return;
  rosterFilter = event.target.value;
  rosterPage = 0;
  refreshRosterResults();
});
