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

function libraryRows(query, filter, characterId = '', localCopy = false) {
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
        return `<div class="ability-row library-row">${HUD.abilityThumbnail(entry)}<div class="ability-main"><b>${esc(entry.name)}</b><small>${esc(entry.kind)} · ${esc(labels[entry.economy])}${entry.kind === 'spell' ? ' · ' + TL.levelLabel(entry) : ''}</small><p class="library-excerpt">${esc(entry.description || 'No description yet.')}</p><small>${users.length ? 'Used by ' + users.map((c) => esc(c.name)).join(', ') : 'Ready to add to a character'}</small></div><div class="ability-controls">${c && localCopy ? button('Copy locally', 'copy-library-locally', 'small primary', `data-id="${esc(entry.id)}" data-character="${esc(c.id)}"`) : c ? button(attached ? 'Already added' : 'Choose', 'attach-library-entry', 'small primary', `data-id="${esc(entry.id)}" data-character="${esc(c.id)}" ${attached ? 'disabled' : ''}`) : button('Add to character', 'assign-library-entry', 'small', `data-id="${esc(entry.id)}" ${TL.allCharacters(state).length ? '' : 'disabled'}`)}${!c ? button('Duplicate', 'duplicate-library-entry', 'small subtle', `data-id="${esc(entry.id)}" aria-label="Duplicate ${esc(entry.name)} in library"`) : ''}<span class="library-edit-controls">${!localCopy ? button('Edit', 'edit-library-entry', 'small subtle', `data-id="${esc(entry.id)}"`) : ''}${!c ? button('Delete', 'delete-library-entry', 'small subtle danger', `data-id="${esc(entry.id)}" aria-label="Delete ${esc(entry.name)} from library"`) : ''}</span></div></div>`;
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
    `<p class="hint">Create or choose an ability. Use the smaller buttons to keep it only on this character.</p><div class="library-choices space-top"><div class="library-choice-group">${button('<b>Create new</b><span>Write a spell, action, or feature. Save it to the library and add it to this character.</span>', 'new-library-entry', 'library-choice', `data-character="${esc(c.id)}"`)}${button('Create new local ability', 'new-local-item', 'small subtle library-local-choice', `data-character="${esc(c.id)}" title="Create a new ability for this character only, without saving it in the ability library."`)}</div><div class="library-choice-group">${button('<b>Choose existing</b><span>Search your shared library and add an entry to this character.</span>', 'choose-library-entry', 'library-choice', `data-character="${esc(c.id)}"`)}${button('Create local-only copy', 'choose-local-library-entry', 'small subtle library-local-choice', `data-character="${esc(c.id)}" title="Choose an ability from the library and make an independent copy for this character only. The copy will not be saved in or linked to the library."`)}</div></div>`,

    `<span></span>${button('Cancel', 'close-modal', 'subtle')}`
  );
}

function chooseLibraryEntry(characterId, localCopy = false) {
  const c = TL.allCharacters(state).find((c) => c.id === characterId);
  if (!c) return;
  modal(
    (localCopy ? 'Copy an ability for ' : 'Choose an ability for ') + esc(c.name),
    `<div class="list-toolbar library-toolbar"><input id="library-picker-search" aria-label="Search existing abilities" placeholder="Search your library…"><select id="library-picker-filter" aria-label="Filter existing abilities">${options(libraryTypes, 'all')}</select></div><div id="library-picker-list" class="ability-list" data-character="${esc(c.id)}" data-local-copy="${localCopy}">${libraryRows('', 'all', c.id, localCopy)}</div>`,
    `<span class="hint">${localCopy ? 'Copies belong only to this character.' : 'Each character keeps their own resource charges.'}</span><div class="row">${button(localCopy ? 'Create new local ability' : 'Create new', localCopy ? 'new-local-item' : 'new-library-entry', 'subtle', `data-character="${esc(c.id)}"`)}${button('Cancel', 'close-modal', 'subtle')}</div>`
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
  submitForm('attach-form', async (data) => {
    if (
      await commit(
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

function abilityIconEditor(local) {
  return `<div class="ability-icon-editor"><div data-icon-preview></div><div><b>Ability image</b><div class="row wrap space-top"><button type="button" data-icon-upload>Upload image</button><button type="button" class="subtle" data-icon-remove>Remove image</button></div><p class="hint">PNG, JPEG, or static WebP · up to 5 MiB and 4096 × 4096 pixels. Fits the whole image within 256 × 256, without cropping. Party image limit: 8 MiB after resizing.</p><p class="hint">${local ? 'This image belongs only to this character’s ability.' : 'This image is shared by every character linked to this library entry.'} Changes apply when you save.</p><p class="hint" data-icon-status role="status"></p><p class="hint ability-icon-error" data-icon-error role="alert"></p></div></div>`;
}

function bindAbilityIconEditor(form, draft) {
  const upload = form.querySelector('[data-icon-upload]'),
    remove = form.querySelector('[data-icon-remove]'),
    save = document.querySelector('[form="item-form"]'),
    preview = form.querySelector('[data-icon-preview]'),
    status = form.querySelector('[data-icon-status]'),
    error = form.querySelector('[data-icon-error]');
  let busy = false;
  function refresh() {
    preview.innerHTML = HUD.abilityThumbnail({ ...draft, kind: form.elements.kind.value }, 'large');
    upload.textContent = draft.icon ? 'Replace image' : 'Upload image';
    upload.disabled = busy;
    remove.disabled = busy || !draft.icon;
    status.textContent = busy
      ? 'Preparing image…'
      : draft.icon
        ? 'Image ready. Save to apply.'
        : 'No image. The ability’s usual symbol will appear.';
  }
  // Enter must not save a half-finished upload; Cancel remains available throughout.
  form.addEventListener(
    'submit',
    (event) => {
      if (busy) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
  upload.onclick = async () => {
    if (busy || save.disabled) return;
    busy = true;
    save.disabled = true;
    error.textContent = '';
    refresh();
    try {
      const icon = await api.abilityIcon();
      if (!form.isConnected) return;
      if (icon !== null) draft.icon = TL.abilityIcon(icon);
    } catch (err) {
      if (form.isConnected) error.textContent = err.message;
    } finally {
      busy = false;
      if (form.isConnected) {
        save.disabled = false;
        refresh();
      }
    }
  };
  remove.onclick = () => {
    if (busy || save.disabled) return;
    draft.icon = '';
    error.textContent = '';
    refresh();
  };
  form.elements.kind.addEventListener('change', refresh);
  refresh();
}

function bindAbilityBehaviorEditor(form) {
  const behavior = form.elements.namedItem('behavior'),
    turnCost = form.elements.namedItem('economy').closest('label'),
    hint = form.querySelector('[data-behavior-hint]');
  const refresh = () => {
    turnCost.hidden = behavior.value === 'passive';
    hint.textContent =
      behavior.value === 'passive'
        ? 'Passive: no action, slot, or resource is spent. Saved cost settings are kept if you change back to an active effect.'
        : behavior.value === 'hybrid'
          ? 'Passive + active: turn cost, spell slots, resources, and concentration apply only to the active effect.'
          : 'Active: choose Action, Bonus action, Reaction, or Free / other under Turn cost. Casting Time is descriptive text.';
  };
  behavior.addEventListener('change', refresh);
  refresh();
}

function editLibraryEntry(id, characterId = '', itemId = '', localDraft = false) {
  const entry = state.library.find((e) => e.id === id),
    c = TL.findCharacter(state, characterId);
  const binding = c?.items.find((it) => it.id === itemId),
    originalBinding = binding && TL.clone(binding);
  const local = binding?.local === true || localDraft;
  if (local && !c) return toast('This character no longer exists.', true);
  const draft = TL.clone(
    (binding?.local ? TL.libraryEntry(binding) : entry) ||
      TL.libraryEntry({
        name: '',
        kind: c && ['spell', 'feature'].includes(tab) ? tab : 'action',
        economy: c && ['bonus', 'reaction', 'free'].includes(tab) ? tab : 'action',
      })
  );
  if (!entry && !binding) draft.name = '';
  const original = TL.clone(draft),
    users = entry ? libraryUsers(id) : [];
  const textField = (label, key, full = false) =>
    `<label class="form-field ${full ? 'full' : ''}"><span>${label}</span><input name="${key}" maxlength="${TL.abilityTextLimit(key)}" value="${esc(draft[key])}"></label>`;
  const textArea = (label, key, rows, full = true) =>
    `<label class="form-field ${full ? 'full' : ''}"><span>${label}</span><textarea name="${key}" rows="${rows}" maxlength="${TL.abilityTextLimit(key)}">${esc(draft[key])}</textarea></label>`;
  modal(
    local
      ? binding
        ? 'Edit character-only ability'
        : 'Create a character-only ability'
      : entry
        ? 'Edit library entry'
        : 'Create a library entry',
    `<form id="item-form"><p class="note">${local ? 'Only for ' + esc(c.name) + '. This ability has its own details and costs and is not in the ability library.' : entry ? 'Shared entry' + (users.length ? ' · used by ' + users.map((c) => esc(c.name)).join(', ') : '') + '. Changes below update every character using it.' : 'Save this once to reuse it across characters. No rules are preloaded.'}</p><div class="form-grid two space-top">
    ${textField('Name', 'name')}<label class="form-field"><span>Type</span><select name="kind">${options(
      [
        ['action', 'Action / ability'],
        ['spell', 'Spell'],
        ['feature', 'Class / species / other feature'],
      ],
      draft.kind
    )}</select></label>
    <label class="form-field"><span>Behavior</span><select name="behavior" aria-describedby="ability-behavior-hint">${options(
      [
        ['active', 'Active'],
        ['passive', 'Passive'],
        ['hybrid', 'Passive + active'],
      ],
      draft.behavior
    )}</select></label>
    <label class="form-field ability-turn-cost"><span>Turn cost</span><select name="economy" aria-describedby="ability-behavior-hint">${options(
      [
        ['action', 'Action'],
        ['bonus', 'Bonus action'],
        ['reaction', 'Reaction'],
        ['free', 'Free / other'],
      ],
      draft.economy
    )}</select></label>
    <p class="hint full">Type chooses where this ability is listed; every type can use any cost or detail. <span id="ability-behavior-hint" data-behavior-hint aria-live="polite"></span></p>
    <div class="full">${abilityIconEditor(local)}</div>
    ${textField('Trigger', 'trigger')}${textField('Duration', 'duration')}${textField('Range', 'range')}${textField('Area', 'area')}
    ${textField('Casting Time', 'castingTime')}<label class="form-field"><span>Spell Level</span><select name="level">${options([['', 'None'], ...Array.from({ length: 10 }, (_, i) => [i, i ? 'Level ' + i : 'Cantrip'])], draft.level ?? '')}</select></label>
    ${textField('Components', 'components')}${textField('School', 'school')}${textField('Attack', 'attack')}${textField('Save', 'save')}${textField('On Save', 'onSave')}
    <label class="row hint"><input type="checkbox" name="usesSlot" ${draft.usesSlot ? 'checked' : ''}>Spend a standard spell slot</label><label class="row hint"><input type="checkbox" name="requiresConcentration" ${draft.requiresConcentration ? 'checked' : ''}>Concentration</label>
    ${textField('Damage / Healing', 'damage', true)}${textArea('Upcast / Upgrades', 'upgrades', 4)}
    ${textArea('Requirements', 'requirements', 3, false)}${textArea('Special', 'special', 3, false)}
    ${characterBindingFields(c, binding)}${textArea('Description', 'description', 9)}
    <label class="form-field full ability-source-field"><span>Reference</span><input name="source" maxlength="300" value="${esc(draft.source)}"></label>
    </div></form>`,
    `<div>${binding ? button('Remove from character', 'delete-item', 'danger subtle', `data-id="${esc(binding.id)}"`) : entry ? button('Delete from library', 'delete-library-entry', 'danger subtle', `data-id="${esc(id)}"`) : '<span class="hint">Your text. Your rules.</span>'}</div><div class="row">${button('Cancel', 'close-modal', 'subtle')}<button form="item-form" type="submit" class="primary">${local ? (binding ? 'Save character ability' : 'Save to character') : entry ? 'Save shared entry' : c ? 'Save & add to character' : 'Save to library'}</button></div>`
  );
  const form = document.getElementById('item-form');
  bindAbilityIconEditor(form, draft);
  bindAbilityBehaviorEditor(form);
  const initialFields = new FormData(form);
  submitForm('item-form', async (data) => {
    for (const key of TL.definitionFields) {
      if (['level', 'usesSlot', 'requiresConcentration', 'icon'].includes(key)) continue;
      draft[key] = data.get(key) === initialFields.get(key) ? original[key] : data.get(key);
    }
    draft.level = data.get('level') === '' ? null : Number(data.get('level'));
    draft.usesSlot = data.has('usesSlot');
    draft.requiresConcentration = data.has('requiresConcentration');
    const success = await commit(
      () => {
        if (local) {
          if (!binding) {
            TL.createLocalItem(state, c.id, draft, readCharacterBinding(data));
            return;
          }
          const target = TL.findCharacter(state, c.id)?.items.find((it) => it.id === itemId);
          if (!target?.local) throw new Error('This character-only ability no longer exists.');
          Object.assign(target, TL.libraryEntry(TL.mergeChanges(original, draft, target)));
        } else if (entry) {
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
      local
        ? binding
          ? 'Character ability updated'
          : 'Ability added to ' + c.name
        : entry
          ? 'Shared entry updated'
          : c
            ? 'Saved to library and added to ' + c.name
            : 'Saved to library'
    );
    if (success) closeModal();
  });
}

function libraryDeletionCharacters(users, selection) {
  return `<div class="library-delete-characters">${users
    .map((c) => {
      const name = `<span>${esc(c.name)}${state.roster.some((r) => r.id === c.id) ? '<small class="hint">Not in active party</small>' : ''}</span>`;
      return selection
        ? `<label class="library-delete-character"><input type="checkbox" name="localCharacter" value="${esc(c.id)}" ${selection[c.id] !== false ? 'checked' : ''}>${name}</label>`
        : `<div class="library-delete-character">${name}</div>`;
    })
    .join('')}</div>`;
}

async function finishLibraryDeletion(id, keepIds, assignments, reopen) {
  if (JSON.stringify(TL.libraryAssignments(state, id)) !== JSON.stringify(assignments)) {
    reopen(
      'The assigned characters changed while this dialog was open. Review the updated list before deleting.'
    );
    return;
  }
  if (
    await commit(
      () => TL.deleteLibraryEntry(state, id, keepIds, assignments),
      'Library ability deleted'
    )
  )
    closeModal();
}

function showLibraryDeletion(id, selection = {}, notice = '') {
  const entry = state.library.find((e) => e.id === id);
  if (!entry) return toast('This library entry no longer exists.', true);
  const users = libraryUsers(id),
    assignments = TL.libraryAssignments(state, id);
  modal(
    'Delete ' + esc(entry.name) + '?',
    `${notice ? `<p class="note" role="alert">${esc(notice)}</p>` : ''}${users.length ? `<p>This ability is currently assigned to:</p>${libraryDeletionCharacters(users)}<div class="hint space-top"><p><b class="library-delete-remove">Remove and Delete:</b> Remove this ability from every listed character and delete it from the ability library.</p><p><b class="library-local-delete">Make Local Copies and Delete:</b> Choose who keeps a local copy, remove it from the other characters, and delete it from the library.</p><p><b class="library-delete-edit">Edit instead:</b> Open the ability editor without deleting anything.</p></div>` : '<p>This ability is not assigned to any character. Delete it from the ability library?</p>'}`,
    `${button('Cancel', 'close-modal', 'subtle')}<div class="row wrap">${button('Edit instead', 'edit-library-entry', 'subtle library-delete-edit', `data-id="${esc(id)}"`)}${users.length ? '<button type="button" id="delete-with-local-copies" class="library-local-delete">Make local copies and delete…</button>' : ''}<button type="button" id="confirm-library-delete" class="danger">${users.length ? 'Remove and delete' : 'Delete ability'}</button></div>`
  );
  document.getElementById('confirm-library-delete').onclick = () =>
    finishLibraryDeletion(id, [], assignments, (message) =>
      showLibraryDeletion(id, selection, message)
    );
  const localButton = document.getElementById('delete-with-local-copies');
  if (localButton) localButton.onclick = () => chooseLocalCopiesBeforeDelete(id, selection);
}

function chooseLocalCopiesBeforeDelete(id, selection = {}, notice = '') {
  const entry = state.library.find((e) => e.id === id);
  if (!entry) return toast('This library entry no longer exists.', true);
  const users = libraryUsers(id),
    assignments = TL.libraryAssignments(state, id);
  modal(
    'Keep local copies of ' + esc(entry.name) + '?',
    `<form id="delete-library-form">${notice ? `<p class="note" role="alert">${esc(notice)}</p>` : ''}<p>Checked characters keep an independent local copy with their current resource settings. Unchecked characters lose this ability.</p><p class="hint space-top">The ability will be deleted from the shared library. Existing local copies are unaffected.</p>${users.length ? libraryDeletionCharacters(users, selection) : '<p class="note space-top">No characters currently have this ability.</p>'}</form>`,
    '<button type="button" id="back-library-delete" class="subtle">Go back</button><button form="delete-library-form" type="submit" class="library-local-delete">Make local copies and delete</button>'
  );
  const readSelection = () =>
    Object.fromEntries(
      [...document.querySelectorAll('#delete-library-form [name="localCharacter"]')].map((el) => [
        el.value,
        el.checked,
      ])
    );
  document.getElementById('back-library-delete').onclick = () =>
    showLibraryDeletion(id, readSelection());
  submitForm('delete-library-form', async (data) => {
    const currentSelection = readSelection();
    await finishLibraryDeletion(id, data.getAll('localCharacter'), assignments, (message) =>
      chooseLocalCopiesBeforeDelete(id, currentSelection, message)
    );
  });
}

function handleLibraryAction(buttonElement) {
  const { action, id, character } = buttonElement.dataset;
  switch (action) {
    case 'new-local-item':
      editLibraryEntry(undefined, character, '', true);
      return true;
    case 'choose-local-library-entry':
      chooseLibraryEntry(character, true);
      return true;
    case 'copy-library-locally': {
      let copy;
      commit(
        () => (copy = TL.copyLibraryItemLocally(state, character, id)),
        'Character-only copy created'
      ).then((success) => {
        if (success) editLibraryEntry('', character, copy.id);
      });
      return true;
    }
    case 'duplicate-library-entry': {
      let copy;
      commit(() => (copy = TL.duplicateLibraryEntry(state, id)), 'Library entry duplicated').then(
        (success) => {
          if (success) editLibraryEntry(copy.id);
        }
      );
      return true;
    }
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
      showLibraryDeletion(id);
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
      list.dataset.character,
      list.dataset.localCopy === 'true'
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
