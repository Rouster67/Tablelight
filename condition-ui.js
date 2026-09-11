/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
let conditionSearch = '';
const conditionUsers = (id) => TL.allCharacters(state).filter((c) => c.conditionIds.includes(id));
function matchingConditions(query) {
  return TL.searchConditions(state, query).entries;
}
function conditionRows(query, characterId = '') {
  const entries = matchingConditions(query),
    c = TL.findCharacter(state, characterId);
  return (
    entries
      .slice(0, 100)
      .map((e) =>
        c
          ? `<div class="condition-choice"><span><b title="${esc(e.description || 'No description entered.')}">${esc(e.name)}</b><small>${esc(e.description || 'No description entered.')}</small></span>${button(c.conditionIds.includes(e.id) ? 'Added' : 'Add', 'condition-pick', 'small', `data-id="${esc(e.id)}" data-character="${esc(c.id)}" ${c.conditionIds.includes(e.id) ? 'disabled' : ''}`)}</div>`
          : `<div class="ability-row condition-library-row"><div class="ability-main"><b>${esc(e.name)}</b><p class="library-excerpt">${esc(e.description || 'No description entered.')}</p><small>${
              conditionUsers(e.id).length
                ? 'Used by ' +
                  conditionUsers(e.id)
                    .map((c) => esc(c.name))
                    .join(', ')
                : 'Not assigned'
            }</small></div><div class="ability-controls">${button('Assign', 'condition-assign', 'small', `data-id="${esc(e.id)}" ${TL.allCharacters(state).length ? '' : 'disabled'}`)}<span class="library-edit-controls">${button('Edit', 'condition-edit', 'small subtle', `data-id="${esc(e.id)}"`)}${button('Delete', 'condition-delete', 'small subtle danger', `data-id="${esc(e.id)}"`)}</span></div></div>`
      )
      .join('') ||
    '<p class="hint card-body">No matching conditions. Try another search or create a condition on the DM screen.</p>'
  );
}
function renderConditionLibrary() {
  return `<div class="page-heading spread wrap"><div><div class="eyebrow">Your rules, saved once</div><h1 class="space-top">Condition library</h1><p>Names and descriptions you can reuse across characters.</p></div>${button('+ Create condition', 'condition-new', 'primary')}</div><section class="card"><div class="list-toolbar"><input id="condition-search" type="search" maxlength="300" value="${esc(conditionSearch)}" placeholder="Find a condition…" aria-label="Search condition library"><span class="badge">${state.conditionLibrary.length} entries</span></div><p class="hint library-note">Edits update every assigned character. Remove a condition from its characters before deleting it. Showing up to 100 matches; narrow your search to find more.</p><div id="condition-library-list" class="ability-list">${conditionRows(conditionSearch)}</div></section>`;
}
function editCondition(id, characterId = '', name = '') {
  const entry = state.conditionLibrary.find((e) => e.id === id),
    original = entry && TL.clone(entry),
    draft = TL.conditionEntry(entry || { name });
  modal(
    entry ? 'Edit condition' : 'Create condition',
    `<form id="condition-form"><div class="gap">${characterId ? `<p class="hint">Save to the library and add to ${esc(TL.findCharacter(state, characterId)?.name || 'this character')}.</p>` : ''}${field('Condition name', 'name', entry?.name || name, 'text', 'required maxlength="300"')}<label class="form-field"><span>Description · shown on hover</span><textarea name="description" maxlength="40000" rows="8">${esc(draft.description)}</textarea></label></div></form>`,
    `<span></span><div class="row">${button('Cancel', 'close-modal', 'subtle')}<button type="submit" form="condition-form" class="primary">${characterId ? 'Save & add' : 'Save condition'}</button></div>`
  );
  submitForm('condition-form', (data) => {
    draft.name = data.get('name').trim();
    draft.description = data.get('description');
    if (!draft.name) throw Error('Enter a condition name.');
    if (
      commit(() => {
        if (entry) {
          const index = state.conditionLibrary.findIndex((e) => e.id === id);
          if (index < 0) throw Error('This condition no longer exists.');
          state.conditionLibrary[index] = TL.mergeChanges(
            original,
            draft,
            state.conditionLibrary[index]
          );
        } else state.conditionLibrary.push(draft);
        if (characterId) TL.assignCondition(state, characterId, draft.id);
      }, 'Condition saved')
    )
      closeModal();
  });
}
function addConditions(characterId, existingOnly = false) {
  const c = TL.findCharacter(state, characterId);
  if (!c) return;
  modal(
    'Add condition · ' + esc(c.name),
    `<div class="spread wrap"><p class="hint">Choose a saved condition. Showing up to 100 matches.</p>${existingOnly ? '' : button('Create new', 'condition-create-for', 'small primary', `data-character="${esc(c.id)}"`)}</div><input id="condition-picker-search" type="search" maxlength="300" placeholder="Find a saved condition…" aria-label="Search conditions to add" class="space-top"><div id="condition-picker-list" data-character="${esc(c.id)}">${conditionRows('', c.id)}</div>`,
    `<span class="hint">Added conditions save immediately.</span>${button('Done', 'close-modal', 'primary')}`
  );
}
function refreshConditionPicker() {
  const list = document.getElementById('condition-picker-list');
  if (!list) return;
  const scroll = list.scrollTop;
  if (!TL.findCharacter(state, list.dataset.character)) {
    closeModal();
    return;
  }
  list.innerHTML = conditionRows(
    document.getElementById('condition-picker-search').value,
    list.dataset.character
  );
  list.scrollTop = scroll;
}
function editConcentration(characterId) {
  const c = TL.findCharacter(state, characterId);
  if (!c) return;
  modal(
    'Concentration · ' + esc(c.name),
    `<p class="hint">Choose from this character’s abilities marked Requires concentration.</p><input id="concentration-search" type="search" maxlength="300" placeholder="Find an ability…" aria-label="Search this character’s concentration abilities" class="space-top"><div id="concentration-picker-list" data-character="${esc(c.id)}">${HUD.concentrationOptions(c)}</div>`,
    `<span class="hint">Choose an ability to start concentration.</span>${button('Cancel', 'close-modal', 'subtle')}`,
    true
  );
}
function refreshConcentrationPicker() {
  const list = document.getElementById('concentration-picker-list');
  if (!list) return;
  const c = TL.findCharacter(state, list.dataset.character);
  if (!c) {
    closeModal();
    return;
  }
  const scroll = list.scrollTop;
  list.innerHTML = HUD.concentrationOptions(
    c,
    document.getElementById('concentration-search').value
  );
  list.scrollTop = scroll;
}
function renderCharacterStatus(c) {
  return `<section class="card"><div class="card-heading"><h3>Concentration & conditions</h3></div><div class="card-body gap"><div class="spread wrap">${button(`<span aria-hidden="true">◉</span> Concentrating${c.concentrating ? ' · On' : ' · Off'}`, 'concentration-toggle', `small concentration-toggle ${c.concentrating ? 'is-on' : ''}`, `data-character="${esc(c.id)}" aria-pressed="${c.concentrating}" title="${esc(HUD.concentrationTitle(c))}"`)}${button(c.concentrating ? 'Change ability' : 'Choose ability', 'concentration-edit', 'small subtle', `data-character="${esc(c.id)}"`)}</div><div class="spread"><b>Conditions</b>${button('Add', 'conditions', 'small', `data-character="${esc(c.id)}"`)}</div><table class="condition-table"><tbody>${c.appliedConditions.map((e) => `<tr><td title="${esc(e.description || 'No description entered.')}">${esc(e.name)}</td><td>${button('Remove', 'condition-remove', 'small subtle', `data-character="${esc(c.id)}" data-id="${esc(e.id)}" aria-label="Remove ${esc(e.name)} from ${esc(c.name)}"`)}</td></tr>`).join('') || '<tr><td class="hint">None</td></tr>'}</tbody></table></div></section>`;
}
function handleConditionAction(b) {
  const { action, id, character } = b.dataset;
  switch (action) {
    case 'condition-new':
      editCondition();
      return true;
    case 'condition-edit':
      editCondition(id);
      return true;
    case 'conditions':
      addConditions(character || selectedId);
      return true;
    case 'condition-create-for':
      editCondition(
        undefined,
        character,
        document.getElementById('condition-picker-search')?.value || ''
      );
      return true;
    case 'condition-pick':
      commit(() => TL.assignCondition(state, character, id), 'Condition added');
      return true;
    case 'condition-remove':
      commit(() => TL.unassignCondition(state, character, id));
      return true;
    case 'concentration-toggle': {
      const c = TL.findCharacter(state, character);
      if (c?.concentrating)
        commit(() => TL.setConcentration(TL.findCharacter(state, character), false));
      else editConcentration(character);
      return true;
    }
    case 'concentration-edit':
      editConcentration(character);
      return true;
    case 'concentration-pick':
      if (
        commit(
          () => TL.setConcentration(TL.findCharacter(state, character), true, id),
          'Concentration updated'
        )
      )
        closeModal();
      return true;
    case 'condition-assign': {
      const entry = state.conditionLibrary.find((e) => e.id === id);
      if (!entry) return true;
      modal(
        'Assign ' + esc(entry.name),
        `<form id="assign-condition-form"><label class="form-field"><span>Character</span><select name="characterId">${options(
          TL.allCharacters(state).map((c) => [
            c.id,
            c.name + (state.roster.some((r) => r.id === c.id) ? ' (saved)' : ''),
          ]),
          selectedId
        )}</select></label></form>`,
        `<span></span><div class="row">${button('Cancel', 'close-modal', 'subtle')}<button type="submit" form="assign-condition-form" class="primary">Assign condition</button></div>`,
        true
      );
      submitForm('assign-condition-form', (data) => {
        if (
          commit(() => TL.assignCondition(state, data.get('characterId'), id), 'Condition assigned')
        )
          closeModal();
      });
      return true;
    }
    case 'condition-delete': {
      const users = conditionUsers(id),
        entry = state.conditionLibrary.find((e) => e.id === id);
      if (!entry) return true;
      if (users.length) {
        formError(
          'Used by ' +
            users.map((c) => c.name).join(', ') +
            '. Remove this condition from those characters first.'
        );
        return true;
      }
      confirmAction(
        'Delete ' + esc(entry.name) + '?',
        'This removes the condition from the library. You can use Undo during this session.',
        () => commit(() => TL.removeConditionEntry(state, id), 'Condition deleted'),
        'Delete condition'
      );
      return true;
    }
    default:
      return false;
  }
}
document.addEventListener('input', (event) => {
  if (event.target.id === 'concentration-search') refreshConcentrationPicker();
  if (event.target.id === 'condition-search') {
    conditionSearch = event.target.value;
    document.getElementById('condition-library-list').innerHTML = conditionRows(conditionSearch);
  }
  if (event.target.id === 'condition-picker-search') {
    const list = document.getElementById('condition-picker-list');
    list.innerHTML = conditionRows(event.target.value, list.dataset.character);
  }
});
