/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';

function renderCharacterResources(c) {
  return `<section class="card"><div class="card-heading spread"><h3>Custom resources</h3>${button('Edit', 'edit-character', 'small subtle')}</div><div class="card-body">${c.resources.map((r) => `<div class="resource-row custom-resource-row" data-dm-resource="${esc(r.id)}"><div class="resource-title">${HUD.resourceIcon(r)}<b>${esc(r.name)}</b></div><small>${esc(TL.resourceResetLabels[r.reset])}</small><div class="resource-adjust">${button('−', 'resource', 'icon small', `data-id="${esc(r.id)}" data-amount="-1" aria-label="Spend ${esc(r.name)}" ${r.current ? '' : 'disabled'}`)}<b>${r.current}/${r.max}</b>${button('+', 'resource', 'icon small', `data-id="${esc(r.id)}" data-amount="1" aria-label="Restore ${esc(r.name)}" ${r.current < r.max ? '' : 'disabled'}`)}${r.reset === 'manual' ? button('Reset', 'resource-reset', 'small', `data-id="${esc(r.id)}" aria-label="Reset ${esc(r.name)}" ${r.current < r.max ? '' : 'disabled'}`) : ''}</div></div>`).join('') || '<p class="hint">Add named counters in Edit character, below spell slots.</p>'}${c.resources.length ? button('Show resources on TV', 'panel', 'small subtle space-top', 'data-panel="resources"') : ''}</div></section>`;
}

function renderResourceEditorRow(r, draft) {
  const linked = draft.items.some((it) => it.resourceId === r.id);
  return `<fieldset class="resource-editor-row" data-edit-resource="${esc(r.id)}"><legend>Custom resource</legend><div class="form-grid two"><label class="form-field full"><span>Name</span><input name="resource-name" value="${esc(r.name)}" required maxlength="120" placeholder="Name this counter"></label>${field('Maximum amount', 'resource-max', r.max, 'number', 'min="1" max="999" required')}${field('Available now', 'resource-current', r.current, 'number', 'min="0" max="999" required')}<label class="form-field full"><span>Reset to maximum on</span><select name="resource-reset">${options(
    [
      ['short', 'Short rest (also long rest)'],
      ['long', 'Long rest'],
      ['turn', 'Per turn · Start turn'],
      ['manual', 'Manual · Reset button'],
    ],
    r.reset
  )}</select></label></div><p class="hint space-top">Shape icon</p><div class="resource-shape-picker" role="group" aria-label="Resource icon">${TL.resourceIcons.map((icon) => `<button type="button" data-resource-icon="${icon}" aria-pressed="${r.icon === icon}" aria-label="${icon}" title="${icon}">${HUD.resourceIcon({ ...r, icon })}</button>`).join('')}</div><input type="hidden" name="resource-icon" value="${esc(r.icon)}"><label class="resource-color-label">Icon color<input name="resource-color" type="color" value="${esc(r.color)}"></label><button type="button" class="small subtle danger resource-remove" data-resource-remove ${linked ? 'disabled' : ''}>Remove resource</button>${linked ? '<p class="hint">Linked to an ability. Remove that ability’s resource link before deleting this counter.</p>' : ''}</fieldset>`;
}

function renderResourceEditor(draft) {
  return `<div class="form-section" id="character-resources"><div class="spread wrap"><h3>Custom resources</h3><button type="button" id="resource-editor-add" class="small subtle" ${draft.resources.length >= 60 ? 'disabled' : ''}>+ Add resource</button></div><p class="hint space-top">Name each counter and choose when it refills. Counters stack below spell slots on the TV. Raising a maximum adds available charges. Changes take effect when you save the character.</p><div class="resource-editor-list">${draft.resources.map((r) => renderResourceEditorRow(r, draft)).join('')}</div></div>`;
}

function bindResourceEditor(draft) {
  const section = document.getElementById('character-resources');
  const add = section.querySelector('#resource-editor-add');
  const list = section.querySelector('.resource-editor-list');
  const rememberMax = (row) => {
    row.dataset.previousMax = row.querySelector('[name="resource-max"]').value;
  };
  list.querySelectorAll('.resource-editor-row').forEach(rememberMax);
  add.onclick = () => {
    if (draft.resources.length >= 60) return;
    const r = {
      id: TL.uid(),
      name: '',
      max: 1,
      current: 1,
      reset: 'long',
      icon: 'circle',
      color: draft.accent,
    };
    draft.resources.push(r);
    list.insertAdjacentHTML('beforeend', renderResourceEditorRow(r, draft));
    rememberMax(list.lastElementChild);
    list.lastElementChild.querySelector('[name="resource-name"]').focus();
    add.disabled = draft.resources.length >= 60;
  };
  section.addEventListener('click', (event) => {
    const row = event.target.closest('.resource-editor-row');
    if (!row) return;
    const shape = event.target.closest('[data-resource-icon]');
    if (shape) {
      row.querySelector('[name="resource-icon"]').value = shape.dataset.resourceIcon;
      row
        .querySelectorAll('[data-resource-icon]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === shape)));
    }
    const remove = event.target.closest('[data-resource-remove]');
    if (remove && !remove.disabled) {
      draft.resources = draft.resources.filter((r) => r.id !== row.dataset.editResource);
      row.remove();
      add.disabled = false;
    }
  });
  section.addEventListener('input', (event) => {
    const row = event.target.closest('.resource-editor-row');
    if (!row) return;
    if (event.target.name === 'resource-color')
      row
        .querySelectorAll('.resource-icon')
        .forEach((icon) => (icon.style.color = event.target.value));
    if (event.target.name === 'resource-max' && event.target.validity.valid) {
      const current = row.querySelector('[name="resource-current"]');
      const max = Number(event.target.value);
      current.value = Math.min(
        max,
        Number(current.value) + Math.max(0, max - Number(row.dataset.previousMax))
      );
      row.dataset.previousMax = String(max);
    }
  });
}

function readResourceEditor(draft) {
  const rows = document.querySelectorAll('#character-resources .resource-editor-row');
  draft.resources = [...rows].map((row) => {
    const value = (key) => row.querySelector(`[name="resource-${key}"]`).value;
    const r = {
      id: row.dataset.editResource,
      name: value('name').trim(),
      max: Number(value('max')),
      current: Number(value('current')),
      reset: value('reset'),
      icon: value('icon'),
      color: value('color'),
    };
    if (!r.name) throw new Error('Enter a name for each custom resource.');
    if (r.current > r.max)
      throw new Error(r.name + ': available charges cannot exceed the maximum.');
    return r;
  });
}
