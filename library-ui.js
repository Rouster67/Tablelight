/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';

let librarySearch = '',
  libraryFilter = 'all';
const libraryTypes = [
  ['all', 'All types'],
  ['action', 'Actions'],
  ['spell', 'Spells'],
  ['feature', 'Features'],
  ['bonus', 'Bonus actions'],
  ['reaction', 'Reactions'],
  ['free', 'Free / other'],
];
const libraryUsers = (id) =>
  TL.allCharacters(state).filter((c) => c.items.some((it) => it.libraryId === id));

function matchingLibrary(query, filter) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return state.library
    .filter((entry) => {
      const text = [
        entry.name,
        entry.description,
        entry.upgrades,
        entry.trigger,
        entry.duration,
        entry.area,
        entry.castingTime,
        entry.school,
        entry.attack,
        entry.save,
        entry.onSave,
        entry.damage,
        entry.requirements,
        entry.special,
        entry.source,
        entry.kind,
        labels[entry.economy],
        entry.range,
        entry.components,
      ]
        .join(' ')
        .toLowerCase();
      return (
        (filter === 'all' ||
          (['action', 'spell', 'feature'].includes(filter)
            ? entry.kind === filter
            : entry.economy === filter)) &&
        words.every((word) => text.includes(word))
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function libraryRows(query, filter, characterId = '') {
  const entries = matchingLibrary(query, filter),
    c = TL.allCharacters(state).find((c) => c.id === characterId);
  if (!entries.length)
    return `<div class="empty-inline">${state.library.length ? 'No entries match your search.' : 'Your library is empty. Create your own spells, actions, and features here.'}</div>`;
  return (
    entries
      .slice(0, 100)
      .map((entry) => {
        const users = libraryUsers(entry.id),
          attached = c?.items.some((it) => it.libraryId === entry.id);
        return `<div class="ability-row library-row"><span class="ability-symbol">${symbols[entry.kind]}</span><div class="ability-main"><b>${esc(entry.name)}</b><small>${esc(entry.kind)} · ${esc(labels[entry.economy])}${entry.kind === 'spell' ? ' · ' + TL.levelLabel(entry) : ''}</small><p class="library-excerpt">${esc(entry.description || 'No description yet.')}</p><small>${users.length ? 'Used by ' + users.map((c) => esc(c.name)).join(', ') : 'Ready to add to a character'}</small></div><div class="ability-controls">${c ? button(attached ? 'Already added' : 'Choose', 'attach-library-entry', 'small primary', `data-id="${esc(entry.id)}" data-character="${esc(c.id)}" ${attached ? 'disabled' : ''}`) : button('Add to character', 'assign-library-entry', 'small', `data-id="${esc(entry.id)}" ${TL.allCharacters(state).length ? '' : 'disabled'}`)}<span class="library-edit-controls">${button('Edit', 'edit-library-entry', 'small subtle', `data-id="${esc(entry.id)}"`)}${!c ? button('Delete', 'delete-library-entry', 'small subtle danger', `data-id="${esc(entry.id)}" aria-label="Delete ${esc(entry.name)} from library"`) : ''}</span></div></div>`;
      })
      .join('') +
    (entries.length > 100
      ? `<p class="hint card-body">Showing the first 100 of ${entries.length} matches. Narrow your search to see more.</p>`
      : '')
  );
}

function renderLibrary() {
  return `<div class="page-heading spread wrap"><div><div class="eyebrow">Create once. Use across your party.</div><h1 class="space-top">Ability library</h1><p>Shared spells, actions, and features. Your text and your rules.</p></div>${button('+ Create new', 'new-library-entry', 'primary')}</div><section class="card"><div class="list-toolbar library-toolbar"><input id="library-search" aria-label="Search library" placeholder="Search names, descriptions, or rules…" value="${esc(librarySearch)}"><select id="library-filter" aria-label="Filter library">${options(libraryTypes, libraryFilter)}</select><span class="badge">${state.library.length} entries</span></div><p class="hint library-note">Library edits update every character using that entry. Charges, resource links, and unavailable flags belong to each character.</p><div id="library-list" class="ability-list">${libraryRows(librarySearch, libraryFilter)}</div></section>`;
}

function addItemChoice() {
  const c = selected();
  if (!c) return;
  modal(
    'Add an ability to ' + esc(c.name),
    `<p class="hint">Build a new library entry, or reuse one you have already saved.</p><div class="library-choices space-top">${button('<b>Create new</b><span>Write a spell, action, or feature. Save it to the library and add it to this character.</span>', 'new-library-entry', 'library-choice', `data-character="${esc(c.id)}"`)}${button('<b>Choose existing</b><span>Search your shared library and add an entry to this character.</span>', 'choose-library-entry', 'library-choice', `data-character="${esc(c.id)}"`)}</div>`,
    `<span></span>${button('Cancel', 'close-modal', 'subtle')}`
  );
}

function chooseLibraryEntry(characterId) {
  const c = TL.allCharacters(state).find((c) => c.id === characterId);
  if (!c) return;
  modal(
    'Choose an ability for ' + esc(c.name),
    `<div class="list-toolbar library-toolbar"><input id="library-picker-search" aria-label="Search existing abilities" placeholder="Search your library…"><select id="library-picker-filter" aria-label="Filter existing abilities">${options(libraryTypes, 'all')}</select></div><div id="library-picker-list" class="ability-list" data-character="${esc(c.id)}">${libraryRows('', 'all', c.id)}</div>`,
    `<span class="hint">Each character keeps their own resource charges.</span><div class="row">${button('Create new', 'new-library-entry', 'subtle', `data-character="${esc(c.id)}"`)}${button('Cancel', 'close-modal', 'subtle')}</div>`
  );
}

function readCharacterBinding(data) {
  return {
    resourceId: data.get('resourceId'),
    resourceCost: data.get('resourceCost') === '' ? 1 : Number(data.get('resourceCost')),
    disabled: data.has('disabled'),
  };
}
function characterBindingFields(c, binding = {}) {
  if (!c)
    return `<div class="form-section full"><h3>Resources</h3><div class="form-grid two"><label class="form-field"><span>Linked resource pool</span><select disabled><option>Choose a character first</option></select></label><label class="form-field"><span>Charges spent per use</span><input type="number" value="1" disabled></label></div><p class="hint space-top">Link a resource pool when adding this ability to a character.</p></div>`;
  return `<div class="form-section full"><h3>For ${esc(c.name)} only</h3><div class="form-grid two"><label class="form-field"><span>Linked resource pool</span><select name="resourceId">${options([['', 'No resource cost'], ...c.resources.map((r) => [r.id, r.name])], binding.resourceId || '')}</select></label>${field('Charges spent per use', 'resourceCost', binding.resourceCost ?? 1, 'number', 'min="1" max="999"')}<label class="row hint full"><input name="disabled" type="checkbox" ${binding.disabled ? 'checked' : ''}>Mark unavailable for this character</label></div><p class="hint space-top">Each character keeps their own resource pool and charges.</p></div>`;
}
function attachLibraryEntry(libraryId, characterId) {
  const entry = state.library.find((e) => e.id === libraryId),
    c = TL.findCharacter(state, characterId);
  if (!entry || !c) return;
  modal(
    'Add ' + esc(entry.name),
    `<form id="attach-form"><div class="eyebrow">${esc(entry.kind)} · ${esc(labels[entry.economy])}</div>${HUD.renderAbilityDetails(entry, c)}${characterBindingFields(c)}</form>`,
    `<span class="hint">Linked to the shared library.</span><div class="row">${button('Cancel', 'close-modal', 'subtle')}<button form="attach-form" type="submit" class="primary">Add to ${esc(c.name)}</button></div>`
  );
  submitForm('attach-form', (data) => {
    if (
      commit(
        () => TL.attachItem(state, c.id, entry.id, readCharacterBinding(data)),
        'Ability added to ' + c.name
      )
    )
      closeModal();
  });
}

function assignLibraryEntry(libraryId) {
  const entry = state.library.find((e) => e.id === libraryId);
  if (!entry) return;
  const available = TL.allCharacters(state).filter(
    (c) => !c.items.some((it) => it.libraryId === libraryId)
  );
  if (!available.length) {
    toast('Every character already has this entry');
    return;
  }
  modal(
    'Add ' + esc(entry.name) + ' to a character',
    `<form id="assign-form"><label class="form-field"><span>Character</span><select name="characterId">${options(
      available.map((c) => [c.id, c.name]),
      selectedId
    )}</select></label></form>`,
    `<span></span><div class="row">${button('Cancel', 'close-modal', 'subtle')}<button form="assign-form" type="submit" class="primary">Continue</button></div>`,
    true
  );
  submitForm('assign-form', (data) => attachLibraryEntry(libraryId, data.get('characterId')));
}

function editLibraryEntry(id, characterId = '', itemId = '') {
  const entry = state.library.find((e) => e.id === id),
    c = TL.findCharacter(state, characterId);
  const binding = c?.items.find((it) => it.id === itemId),
    originalBinding = binding && TL.clone(binding);
  const draft = TL.clone(
    entry ||
      TL.libraryEntry({
        name: '',
        kind: c && ['spell', 'feature'].includes(tab) ? tab : 'action',
        economy: c && ['bonus', 'reaction', 'free'].includes(tab) ? tab : 'action',
      })
  );
  if (!entry) draft.name = '';
  const original = TL.clone(draft),
    users = entry ? libraryUsers(id) : [];
  const textField = (label, key, full = false) =>
    `<label class="form-field ${full ? 'full' : ''}"><span>${label}</span><input name="${key}" maxlength="${TL.abilityTextLimit(key)}" value="${esc(draft[key])}"></label>`;
  const textArea = (label, key, rows, full = true) =>
    `<label class="form-field ${full ? 'full' : ''}"><span>${label}</span><textarea name="${key}" rows="${rows}" maxlength="${TL.abilityTextLimit(key)}">${esc(draft[key])}</textarea></label>`;
  modal(
    entry ? 'Edit library entry' : 'Create a library entry',
    `<form id="item-form"><p class="note">${entry ? 'Shared entry' + (users.length ? ' · used by ' + users.map((c) => esc(c.name)).join(', ') : '') + '. Changes below update every character using it.' : 'Save this once to reuse it across characters. No rules are preloaded.'}</p><div class="form-grid two space-top">
    ${textField('Name', 'name')}<label class="form-field"><span>Type</span><select name="kind">${options(
      [
        ['action', 'Action / ability'],
        ['spell', 'Spell'],
        ['feature', 'Class / species / other feature'],
      ],
      draft.kind
    )}</select></label>
    ${textField('Trigger', 'trigger')}${textField('Duration', 'duration')}${textField('Range', 'range')}${textField('Area', 'area')}
    ${textField('Casting Time', 'castingTime')}<label class="form-field"><span>Spell Level</span><select name="level">${options([['', 'None'], ...Array.from({ length: 10 }, (_, i) => [i, i ? 'Level ' + i : 'Cantrip'])], draft.level ?? '')}</select></label>
    ${textField('Components', 'components')}${textField('School', 'school')}${textField('Attack', 'attack')}${textField('Save', 'save')}${textField('On Save', 'onSave')}
    <label class="form-field"><span>Turn cost</span><select name="economy">${options(
      [
        ['action', 'Action'],
        ['bonus', 'Bonus action'],
        ['reaction', 'Reaction'],
        ['free', 'Free / other'],
      ],
      draft.economy
    )}</select></label>
    <label class="row hint"><input type="checkbox" name="usesSlot" ${draft.usesSlot ? 'checked' : ''}>Spend a standard spell slot</label><label class="row hint"><input type="checkbox" name="requiresConcentration" ${draft.requiresConcentration ? 'checked' : ''}>Concentration</label>
    ${textField('Damage / Healing', 'damage', true)}${textArea('Upcast / Upgrades', 'upgrades', 4)}
    ${textArea('Requirements', 'requirements', 3, false)}${textArea('Special', 'special', 3, false)}
    ${characterBindingFields(c, binding)}${textArea('Description', 'description', 9)}
    <label class="form-field full ability-source-field"><span>Reference</span><input name="source" maxlength="300" value="${esc(draft.source)}"></label>
    </div></form>`,
    `<div>${binding ? button('Remove from character', 'delete-item', 'danger subtle', `data-id="${esc(binding.id)}"`) : entry ? button('Delete from library', 'delete-library-entry', 'danger subtle', `data-id="${esc(id)}"`) : '<span class="hint">Your text. Your rules.</span>'}</div><div class="row">${button('Cancel', 'close-modal', 'subtle')}<button form="item-form" type="submit" class="primary">${entry ? 'Save shared entry' : c ? 'Save & add to character' : 'Save to library'}</button></div>`
  );
  const initialFields = new FormData(document.getElementById('item-form'));
  submitForm('item-form', (data) => {
    for (const key of TL.definitionFields) {
      if (['level', 'usesSlot', 'requiresConcentration'].includes(key)) continue;
      draft[key] = data.get(key) === initialFields.get(key) ? original[key] : data.get(key);
    }
    draft.level = data.get('level') === '' ? null : Number(data.get('level'));
    draft.usesSlot = data.has('usesSlot');
    draft.requiresConcentration = data.has('requiresConcentration');
    const success = commit(
      () => {
        if (entry) {
          const index = state.library.findIndex((e) => e.id === id);
          if (index < 0) throw new Error('This library entry no longer exists.');
          state.library[index] = TL.libraryEntry(
            TL.mergeChanges(original, draft, state.library[index])
          );
        } else {
          if (state.library.length >= 5000)
            throw new Error('The library can contain up to 5,000 entries.');
          state.library.push(TL.libraryEntry(draft));
        }
        if (c) {
          const settings = readCharacterBinding(data);
          if (binding) {
            const target = TL.findCharacter(state, c.id)?.items.find((it) => it.id === itemId);
            if (!target) throw new Error('This character ability no longer exists.');
            const merged = TL.mergeChanges(
              originalBinding,
              { ...originalBinding, ...settings },
              target
            );
            Object.assign(target, {
              resourceId: merged.resourceId,
              resourceCost: merged.resourceCost,
              disabled: merged.disabled,
            });
          } else TL.attachItem(state, c.id, draft.id, settings);
        }
      },
      entry
        ? 'Shared entry updated'
        : c
          ? 'Saved to library and added to ' + c.name
          : 'Saved to library'
    );
    if (success) closeModal();
  });
}

function handleLibraryAction(buttonElement) {
  const { action, id, character } = buttonElement.dataset;
  switch (action) {
    case 'new-library-entry':
      editLibraryEntry(undefined, character);
      return true;
    case 'edit-library-entry':
      editLibraryEntry(id);
      return true;
    case 'choose-library-entry':
      chooseLibraryEntry(character);
      return true;
    case 'attach-library-entry':
      attachLibraryEntry(id, character);
      return true;
    case 'assign-library-entry':
      assignLibraryEntry(id);
      return true;
    case 'delete-library-entry': {
      const users = libraryUsers(id);
      if (users.length) {
        formError(
          'This entry is used by ' +
            users.map((c) => c.name).join(', ') +
            '. Remove it from those characters before deleting it from the library.'
        );
        return true;
      }
      confirmAction(
        'Delete this library entry?',
        'It is not assigned to a character. This removes it from the shared library. You can use Undo during this session.',
        () => commit(() => TL.removeLibraryEntry(state, id), 'Library entry deleted'),
        'Delete entry'
      );
      return true;
    }
    default:
      return false;
  }
}

function refreshLibraryPicker() {
  const list = document.getElementById('library-picker-list');
  if (list)
    list.innerHTML = libraryRows(
      document.getElementById('library-picker-search').value,
      document.getElementById('library-picker-filter').value,
      list.dataset.character
    );
}
document.addEventListener('input', (event) => {
  if (event.target.id === 'library-search') {
    librarySearch = event.target.value;
    document.getElementById('library-list').innerHTML = libraryRows(librarySearch, libraryFilter);
  }
  if (event.target.id === 'library-picker-search') refreshLibraryPicker();
});
document.addEventListener('change', (event) => {
  if (event.target.id === 'library-filter') {
    libraryFilter = event.target.value;
    document.getElementById('library-list').innerHTML = libraryRows(librarySearch, libraryFilter);
  }
  if (event.target.id === 'library-picker-filter') refreshLibraryPicker();
});
