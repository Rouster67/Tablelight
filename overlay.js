/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
let state,
  gesture,
  lastHit = false,
  pointer = { x: -1, y: -1 },
  pendingPaint = false;
const stage = document.getElementById('overlay-stage');
let publishedRegions = '';
let concentrationPicker = null;
let conditionPicker = null;
let useWarning = null;
const pendingUses = new Set();
const requestPrompts = new Map();
// Picker results can change the summary height after the initial paint.
const hudSizeObserver = new ResizeObserver(() => {
  if (!state || gesture?.isDragging) return;
  HUD.fit(stage, state, innerWidth, innerHeight);
  updateHit();
  publishRegions();
});
function requestPrompt(characterId, title, message, confirmation = null) {
  if (requestPrompts.has(characterId)) return Promise.resolve(false);
  return new Promise((resolve) => {
    requestPrompts.set(characterId, { title, message, confirmation, resolve });
    paint();
    const root = [...stage.children].find((el) => el.dataset.hudId === characterId);
    root?.querySelector('[data-request-prompt-close]')?.focus({ preventScroll: true });
  });
}
function closeRequestPrompt(id, answer) {
  const prompt = requestPrompts.get(id);
  if (!prompt) return;
  requestPrompts.delete(id);
  prompt.resolve(answer);
  paint();
}
function paintRequestPrompts() {
  for (const [id, prompt] of requestPrompts) {
    const c = state.characters.find((c) => c.id === id);
    const root = [...stage.children].find((el) => el.dataset.hudId === id);
    if (!root || !c.hud.expanded || !state.settings.overlayInteractive) {
      requestPrompts.delete(id);
      prompt.resolve(false);
      continue;
    }
    root.querySelector('.hud-card').inert = true;
    const toolbar = root.querySelector('.hud-toolstrip');
    if (toolbar) toolbar.inert = true;
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="hud-use-warning-backdrop"><section class="hud-use-warning hud-request-prompt" role="alertdialog" aria-modal="true" aria-label="${HUD.esc(prompt.title)}" data-request-prompt="${HUD.esc(id)}"><h3>${HUD.esc(prompt.title)}</h3><p>${HUD.esc(prompt.message)}</p>${prompt.confirmation ? `<ul>${prompt.confirmation.affected.map((r) => `<li>${HUD.esc(r.abilityName)}</li>`).join('')}</ul>` : ''}<div class="row"><button type="button" data-request-prompt-close>${prompt.confirmation ? 'Cancel' : 'Got it'}</button>${prompt.confirmation ? '<button type="button" data-request-prompt-continue class="primary">Continue</button>' : ''}</div></section></div>`
    );
  }
}
function focusUseControl(value) {
  const button = [...stage.querySelectorAll('[data-hud-command]')].find((el) => {
    const command = JSON.parse(el.dataset.hudCommand);
    return (
      command.type === 'use' &&
      command.characterId === value.characterId &&
      command.itemId === value.itemId &&
      command.level === value.level
    );
  });
  button?.focus({ preventScroll: true });
}
function cancelUseWarning() {
  const value = useWarning?.value;
  useWarning = null;
  paint();
  if (value) focusUseControl(value);
}
function paintUseWarning(focus) {
  if (!useWarning) return;
  const c = state.characters.find((c) => c.id === useWarning.value.characterId),
    it = c?.items.find((it) => it.id === useWarning.value.itemId),
    root = [...stage.children].find((el) => el.dataset.hudId === c?.id);
  if (
    !it ||
    !root ||
    !c.hud.expanded ||
    !state.settings.overlayInteractive ||
    c.hud.detailId !== it.id
  ) {
    useWarning = null;
    return;
  }
  const warning = TL.concentrationUseWarning(c, it);
  if (!warning) {
    useWarning = null;
    return;
  }
  useWarning.token = warning.token;
  const reason = TL.availability(c, it, useWarning.value.level);
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="hud-use-warning-backdrop"><section class="hud-use-warning" role="alertdialog" aria-label="End current concentration?" aria-describedby="use-warning-${HUD.esc(c.id)}"><h3>End current concentration?</h3><p id="use-warning-${HUD.esc(c.id)}">${HUD.esc(warning.message)} Continue?</p>${reason ? `<p class="form-error">${HUD.esc(reason)}</p>` : ''}<div class="row"><button type="button" data-hud-use-cancel>Cancel</button><button type="button" data-hud-use-confirm class="primary" ${reason ? 'disabled' : ''}>Use ability</button></div></section></div>`
  );
  if (focus) root.querySelector(`[data-hud-use-${focus}]`)?.focus({ preventScroll: true });
}
async function useAbility(value, confirmedConcentration = '') {
  if (pendingUses.has(value.characterId)) return;
  const c = state.characters.find((c) => c.id === value.characterId),
    it = c?.items.find((it) => it.id === value.itemId);
  if (!it) return;
  const reason = TL.availability(c, it, value.level);
  if (reason) {
    notice(reason);
    return;
  }
  const warning = TL.concentrationUseWarning(c, it);
  if (warning && warning.token !== confirmedConcentration) {
    useWarning = { value, token: warning.token };
    paint();
    stage.querySelector('[data-hud-use-cancel]')?.focus({ preventScroll: true });
    return;
  }
  useWarning = null;
  pendingUses.add(value.characterId);
  paint();
  try {
    await command({ ...value, confirmedConcentration });
  } finally {
    pendingUses.delete(value.characterId);
    focusUseControl(value);
  }
}
function renderConcentrationResults() {
  const list = stage.querySelector('[data-concentration-results]');
  const c = state.characters.find((c) => c.id === concentrationPicker?.id);
  if (!list || !c) return;
  const scroll = list.scrollTop;
  list.innerHTML = HUD.concentrationOptions(c, concentrationPicker.query, 'overlay');
  list.scrollTop = scroll;
}
function renderConditionResults() {
  if (!conditionPicker) return;
  const list = stage.querySelector('[data-hud-condition-results]');
  const c = state.characters.find((c) => c.id === conditionPicker.id);
  if (!list || !c) return;
  const scroll = list.scrollTop;
  list.innerHTML = conditionPicker.error
    ? `<p>${HUD.esc(conditionPicker.error)}</p>`
    : !conditionPicker.entries
      ? '<p>Searching…</p>'
      : conditionPicker.entries
          .map(
            (e) =>
              `<div class="condition-choice"><span><b title="${HUD.esc(e.description || 'No description entered.')}">${HUD.esc(e.name)}</b><small>${HUD.esc(e.description || 'No description entered.')}</small></span><button type="button" data-hud-condition-pick="${HUD.esc(e.id)}" ${c.conditionIds.includes(e.id) ? 'disabled' : ''}>${c.conditionIds.includes(e.id) ? 'Added' : 'Add'}</button></div>`
          )
          .join('') || '<p>No matching conditions. Create conditions on the DM screen.</p>';
  list.scrollTop = scroll;
  if (conditionPicker.reveal && conditionPicker.entries) {
    conditionPicker.reveal = false;
  }
  stage.querySelector('[data-hud-condition-count]').textContent =
    conditionPicker.total > 100
      ? 'Showing 100 of ' + conditionPicker.total + ' matches. Narrow your search for more.'
      : '';
}
async function searchHudConditions() {
  const picker = conditionPicker;
  if (!picker) return;
  const request = ++picker.request;
  try {
    const result = await window.tablelight.searchConditions(picker.query);
    if (conditionPicker !== picker || request !== picker.request) return;
    Object.assign(picker, result, { error: '' });
  } catch (error) {
    if (conditionPicker !== picker || request !== picker.request) return;
    picker.error = error.message;
  }
  renderConditionResults();
}
function paintConditionPicker(previous) {
  if (!conditionPicker) return;
  const c = state.characters.find((c) => c.id === conditionPicker.id);
  const root = [...stage.children].find((el) => el.dataset.hudId === conditionPicker.id);
  const target = root?.querySelector('.hud-condition-picker');
  if (!c || !target || !state.settings.overlayInteractive) {
    conditionPicker = null;
    return;
  }
  target.innerHTML = `<div class="hud-condition-menu" role="group" aria-label="Add condition to ${HUD.esc(c.name)}"><div class="spread"><b>Add condition</b><button type="button" data-hud-condition-close>Done</button></div><input type="search" data-hud-condition-search maxlength="300" aria-label="Search saved conditions" placeholder="Find a condition…" value="${HUD.esc(conditionPicker.query)}"><small data-hud-condition-count></small><div data-hud-condition-results></div></div>`;
  renderConditionResults();
  target.querySelector('[data-hud-condition-results]').scrollTop = previous?.scroll || 0;
  if (previous?.focused) {
    const input = target.querySelector('input');
    input.focus({ preventScroll: true });
    input.setSelectionRange(previous.start, previous.end);
  }
}
function hit(value) {
  value = Boolean(value) && state?.settings.overlayInteractive;
  if (value === lastHit) return;
  lastHit = value;
  // Cursor state is local; Windows uses the published HUD shapes for routing.
}
function updateHit() {
  const target = document.elementFromPoint(pointer.x, pointer.y);
  hit(gesture?.isDragging || target?.closest('.hud-position'));
}
function publishRegions() {
  const frames = [...stage.children].map((el) => {
    const c = state.characters.find((c) => c.id === el.dataset.hudId),
      r = el.getBoundingClientRect();
    return {
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      width: el.offsetWidth * c.hud.scale,
      height: el.offsetHeight * c.hud.scale,
      rotation: c.hud.rotation,
    };
  });
  const notice = document.querySelector('#overlay-notice.visible');
  if (notice) {
    const r = notice.getBoundingClientRect();
    frames.push({
      cx: r.x + r.width / 2,
      cy: r.y + r.height / 2,
      width: r.width,
      height: r.height,
      rotation: 0,
    });
  }
  // Rebuild native hit regions only when the measured frame changes.
  const regionKey = JSON.stringify([innerWidth, innerHeight, frames]);
  if (regionKey !== publishedRegions) {
    window.tablelight.hudRegions(frames);
    publishedRegions = regionKey;
  }
}
function paint() {
  if (!state) return;
  document.body.classList.toggle('overlay-interactive', state.settings.overlayInteractive);
  if (gesture?.isDragging) {
    pendingPaint = true;
    return;
  }
  const currentField = stage.querySelector('[data-concentration-search]');
  const promptFocus =
    document.activeElement?.closest('[data-request-prompt]')?.dataset.requestPrompt;
  const promptContinue = document.activeElement?.hasAttribute('data-request-prompt-continue');
  const restoreFocus = currentField && document.activeElement === currentField;
  const selection = currentField
    ? [currentField.selectionStart, currentField.selectionEnd]
    : [0, 0];
  const concentrationScroll = stage.querySelector('[data-concentration-results]')?.scrollTop || 0;
  const conditionField = stage.querySelector('[data-hud-condition-search]');
  const useFocus = document.activeElement?.hasAttribute('data-hud-use-confirm')
    ? 'confirm'
    : document.activeElement?.hasAttribute('data-hud-use-cancel')
      ? 'cancel'
      : '';
  const conditionFocus = conditionField && {
    focused: document.activeElement === conditionField,
    start: conditionField.selectionStart,
    end: conditionField.selectionEnd,
    scroll: stage.querySelector('[data-hud-condition-results]').scrollTop,
  };
  hudSizeObserver.disconnect();
  HUD.mount(
    stage,
    state,
    innerWidth,
    innerHeight,
    1,
    '',
    state.settings.overlayInteractive ? 'overlay' : ''
  );
  if (concentrationPicker) {
    const c = state.characters.find((c) => c.id === concentrationPicker.id);
    const root = [...stage.children].find((el) => el.dataset.hudId === concentrationPicker.id);
    const target = root?.querySelector('.hud-concentration-editor');
    if (!c || !target || !state.settings.overlayInteractive) concentrationPicker = null;
    else {
      target.innerHTML = `<div class="hud-condition-menu hud-concentration-menu" role="group" aria-label="Choose concentration for ${HUD.esc(c.name)}"><div class="spread"><b>Choose concentration</b><button type="button" data-concentration-cancel>Cancel</button></div><input data-concentration-search type="search" maxlength="300" value="${HUD.esc(concentrationPicker.query)}" placeholder="Find an ability…" aria-label="Search this character’s concentration abilities"><div data-concentration-results></div></div>`;
      renderConcentrationResults();
      target.querySelector('[data-concentration-results]').scrollTop = concentrationScroll;
      if (restoreFocus) {
        const input = target.querySelector('input');
        input.focus({ preventScroll: true });
        input.setSelectionRange(...selection);
      }
    }
  }
  paintConditionPicker(conditionFocus);
  paintUseWarning(useFocus);
  paintRequestPrompts();
  if (promptFocus) {
    const root = [...stage.children].find((el) => el.dataset.hudId === promptFocus);
    root
      ?.querySelector(
        promptContinue ? '[data-request-prompt-continue]' : '[data-request-prompt-close]'
      )
      ?.focus({ preventScroll: true });
  }
  HUD.fit(stage, state, innerWidth, innerHeight);
  for (const el of stage.children) hudSizeObserver.observe(el);
  updateHit();
  publishRegions();
}
function notice(message) {
  const el = document.getElementById('overlay-notice');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(notice.timer);
  publishRegions();
  notice.timer = setTimeout(() => {
    el.classList.remove('visible');
    publishRegions();
  }, 4500);
}
async function command(value) {
  const submitted = { sessionId: state.approvalSessionId, commandId: TL.uid(), ...value };
  try {
    const response = await window.tablelight.hudCommand(submitted);
    if (response.result?.status === 'confirmation-required') {
      const expires = response.result.affected.every((r) => r.status === 'expired');
      const answer = await requestPrompt(
        value.characterId,
        expires ? 'Start a new turn?' : 'Pending requests depend on this change',
        expires
          ? 'Continuing will expire these requests and release their reserved costs.'
          : 'Continuing will automatically deny these requests. Do you wish to continue?',
        response.result
      );
      try {
        await window.tablelight.hudCommand({
          type: answer ? 'confirm-change' : 'cancel-change',
          sessionId: submitted.sessionId,
          commandId: TL.uid(),
          confirmationId: response.result.confirmationId,
        });
      } catch (error) {
        if (answer) throw error;
      }
      return answer;
    }
    return true;
  } catch (error) {
    const latest = await window.tablelight.load();
    state = latest.state;
    paint();
    if (error.message.includes('DM is super busy'))
      await requestPrompt(
        value.characterId,
        'Hold up—the DM is super busy!',
        'Three ability requests are already waiting. Try again after the DM handles one.'
      );
    else notice(error.message);
    return false;
  }
}
gesture = HUDControls.gestures(stage, {
  getState: () => state,
  enabled: () => state?.settings.overlayInteractive,
  viewport: () => ({ width: innerWidth, height: innerHeight }),
  onActive: (active) => {
    window.tablelight.hudDragging(active);
    if (active) hit(true);
    else {
      if (pendingPaint) {
        pendingPaint = false;
        paint();
      }
      updateHit();
    }
  },
  onCommit: (id, placement) => {
    command({ type: 'placement', characterId: id, ...placement });
    paint();
  },
  onTap: (id) => command({ type: 'expand', characterId: id }),
  onCancel: () => {
    window.tablelight.hudDragging(false);
    paint();
    updateHit();
  },
});
stage.addEventListener('click', async (event) => {
  if (!state?.settings.overlayInteractive) return;
  const promptControl = event.target.closest(
    '[data-request-prompt-close],[data-request-prompt-continue]'
  );
  if (promptControl) {
    closeRequestPrompt(
      promptControl.closest('[data-request-prompt]').dataset.requestPrompt,
      promptControl.hasAttribute('data-request-prompt-continue')
    );
    return;
  }
  const cancelRequest = event.target.closest('[data-cancel-request]');
  if (cancelRequest && !cancelRequest.disabled) {
    cancelRequest.disabled = true;
    await command({
      type: 'cancel-request',
      characterId: cancelRequest.dataset.character,
      requestId: cancelRequest.dataset.cancelRequest,
    });
    if (cancelRequest.isConnected) cancelRequest.disabled = false;
    return;
  }
  if (event.target.closest('[data-hud-use-cancel]')) {
    cancelUseWarning();
    return;
  }
  if (event.target.closest('[data-hud-use-confirm]')) {
    if (useWarning && !event.target.closest('button').disabled)
      await useAbility(useWarning.value, useWarning.token);
    return;
  }
  const addConditions = event.target.closest('[data-hud-conditions]');
  if (addConditions) {
    conditionPicker = {
      id: addConditions.dataset.hudConditions,
      query: '',
      entries: null,
      total: 0,
      request: 0,
      reveal: true,
    };
    paint();
    stage.querySelector('[data-hud-condition-search]')?.focus();
    searchHudConditions();
    return;
  }
  if (event.target.closest('[data-hud-condition-close]')) {
    conditionPicker = null;
    paint();
    return;
  }
  const pickCondition = event.target.closest('[data-hud-condition-pick]');
  if (pickCondition && conditionPicker && !pickCondition.disabled) {
    pickCondition.disabled = true;
    await command({
      type: 'condition-add',
      characterId: conditionPicker.id,
      conditionId: pickCondition.dataset.hudConditionPick,
    });
    if (conditionPicker) conditionPicker.reveal = true;
    searchHudConditions();
    return;
  }
  if (event.target.closest('[data-concentration-cancel]')) {
    concentrationPicker = null;
    paint();
    return;
  }
  const concentration = event.target.closest('[data-hud-concentration-pick]');
  if (concentration && concentrationPicker && !concentration.disabled) {
    concentration.disabled = true;
    const selected = concentrationPicker;
    if (
      await command({
        type: 'concentration',
        characterId: selected.id,
        active: true,
        itemId: concentration.dataset.hudConcentrationPick,
      })
    ) {
      if (concentrationPicker === selected) concentrationPicker = null;
      paint();
    }
    return;
  }
  const button = event.target.closest('[data-hud-command]');
  if (!button || button.disabled) return;
  const value = JSON.parse(button.dataset.hudCommand);
  if (value.type === 'concentration' && value.active) {
    concentrationPicker = { id: value.characterId, query: '' };
    paint();
    stage.querySelector('[data-concentration-search]')?.focus();
    stage.querySelector('.hud-concentration-menu')?.scrollIntoView({ block: 'nearest' });
  } else if (value.type === 'use') await useAbility(value);
  else command(value);
});
stage.addEventListener('input', (event) => {
  if (event.target.matches('[data-concentration-search]') && concentrationPicker) {
    concentrationPicker.query = event.target.value;
    renderConcentrationResults();
    return;
  }
  if (!event.target.matches('[data-hud-condition-search]') || !conditionPicker) return;
  conditionPicker.query = event.target.value;
  conditionPicker.entries = null;
  conditionPicker.error = '';
  renderConditionResults();
  searchHudConditions();
});
stage.addEventListener('keydown', (event) => {
  const prompt = event.target.closest('[data-request-prompt]');
  if (prompt && event.key === 'Escape') {
    event.preventDefault();
    closeRequestPrompt(prompt.dataset.requestPrompt, false);
    return;
  }
  if (useWarning && event.key === 'Escape') {
    event.preventDefault();
    cancelUseWarning();
    return;
  }
  if (event.key === 'Tab' && event.target.closest('.hud-use-warning')) {
    const buttons = [
      ...event.target.closest('.hud-use-warning').querySelectorAll('button:not(:disabled)'),
    ];
    if (event.shiftKey && document.activeElement === buttons[0]) {
      event.preventDefault();
      buttons.at(-1)?.focus();
    } else if (!event.shiftKey && document.activeElement === buttons.at(-1)) {
      event.preventDefault();
      buttons[0]?.focus();
    }
  }
  if (event.key === 'Escape' && (concentrationPicker || conditionPicker)) {
    concentrationPicker = null;
    conditionPicker = null;
    paint();
  }
});
window.addEventListener('mousemove', (event) => {
  pointer = { x: event.clientX, y: event.clientY };
  updateHit();
});
window.addEventListener('mouseout', (event) => {
  if (!event.relatedTarget && !gesture.isDragging) hit(false);
});
window.tablelight.onHudScroll((value) => HUD.scroll(stage, value));
window.tablelight.onState((value) => {
  const id = gesture.activeId,
    local = state?.characters.find((c) => c.id === id)?.hud;
  state = value;
  if (id) {
    const c = state.characters.find((c) => c.id === id);
    if (!state.settings.overlayInteractive || !c || !c.hud.visible) gesture.cancel();
    else if (local) Object.assign(c.hud, { x: local.x, y: local.y, rotation: local.rotation });
  }
  if (!state.settings.overlayInteractive) hit(false);
  paint();
  if (conditionPicker) searchHudConditions();
});
window.tablelight.onOverlay((value) => {
  if (!value.visible) {
    concentrationPicker = null;
    conditionPicker = null;
    useWarning = null;
    gesture.cancel();
    hit(false);
    paint();
  }
});
window.tablelight.load().then((value) => {
  state = value.state;
  paint();
});
window.addEventListener('resize', () => {
  gesture.cancel();
  paint();
});
