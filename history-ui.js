/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
let historyOpenId = '';
let historyListOpen = false;
let historyBusyId = '';
const historyIcon =
  '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 1 7M3 4v6h6m3-4v6l4 2"/></svg>';
const historyOutcome = (r) =>
  ({
    approved: 'Allowed',
    denied: 'Denied',
    canceled: 'Canceled by player',
    expired: 'Expired — new turn',
    undone: 'Undone',
  })[r.status] || r.status;
function renderApprovalHistory() {
  const root = document.getElementById('dm-history-root');
  if (!root) return;
  const count = approvalState.history?.length || 0;
  root.innerHTML = `<button type="button" class="dm-queue-button dm-history-button" data-action="dm-history" title="History · ${count} recent requests" aria-label="History, ${count} recent requests">${historyIcon}<span class="queue-count">${count}</span></button>`;
  if (historyListOpen) refreshHistoryList();
  if (historyOpenId) refreshHistoryDetail();
}
function showHistoryList() {
  modal(
    'History',
    '<p class="hint">The five most recent resolved requests. History clears when Tablelight closes.</p><div class="dm-queue-list history-list" data-dm-history-list></div>',
    button('Close', 'close-modal', 'subtle'),
    true
  );
  historyListOpen = true;
  refreshHistoryList();
}
function refreshHistoryList() {
  const list = document.querySelector('[data-dm-history-list]');
  if (!list) return;
  const focusId = document.activeElement?.closest('[data-action="review-history"]')?.dataset.id;
  const scroll = list.closest('.modal-body').scrollTop;
  list.innerHTML =
    approvalState.history
      .map(
        (r) =>
          `<button type="button" class="dm-queue-entry history-entry ${r.status}" data-action="review-history" data-id="${esc(r.id)}"><span><b>${esc(TL.findCharacter(state, r.characterId)?.name || r.characterName)}</b> — ${HUD.abilityName({ ...r.ability, local: r.local })}</span><small class="history-outcome">${esc(historyOutcome(r))}${r.reconsideredAs ? ' · Reconsidered' : ''}</small></button>`
      )
      .join('') || '<p class="hint">No resolved requests yet.</p>';
  if (focusId)
    (
      [...list.querySelectorAll('button')].find((b) => b.dataset.id === focusId) ||
      list.querySelector('button') ||
      document.querySelector('.modal [data-action="close-modal"]')
    )?.focus({ preventScroll: true });
  list.closest('.modal-body').scrollTop = scroll;
}
function showHistoryDetail(id) {
  if (!approvalState.history?.some((r) => r.id === id)) return;
  modal(
    'Request history',
    '<div data-history-detail></div>',
    '<div class="history-actions" data-history-actions></div>'
  );
  historyOpenId = id;
  refreshHistoryDetail();
}
function refreshHistoryDetail() {
  const target = document.querySelector('[data-history-detail]');
  if (!target) return;
  const r = approvalState.history.find((entry) => entry.id === historyOpenId);
  if (!r) {
    closeModal();
    toast('This request is no longer in the five-entry History.');
    return;
  }
  const costs = r.receipt?.costs || r.costs;
  const resource = r.costs.find((cost) => cost.kind === 'resource');
  const it = {
    ...r.ability,
    local: r.local,
    resourceId: resource?.key || '',
    resourceCost: resource?.amount || 0,
  };
  const originalCharacter = {
    resources: resource ? [{ id: resource.key, name: resource.label }] : [],
  };
  const focus = r.receipt?.concentration;
  const focusName = (value) => (value.active ? value.name || 'Concentrating' : 'None');
  const html = `<div class="eyebrow">${esc(it.kind)} · ${esc(labels[it.economy])}${it.local ? ' · Character only' : ''}</div><div class="approval-summary history-summary ${r.status}"><p><b>${esc(TL.findCharacter(state, r.characterId)?.name || r.characterName)}</b> — ${HUD.abilityName(it)}</p><strong class="history-outcome">${esc(historyOutcome(r))}</strong>${r.reason ? `<p>${esc(r.reason)}</p>` : ''}<div class="approval-costs"><b>${r.status === 'undone' ? 'Costs refunded' : r.status === 'approved' ? 'Costs spent' : 'Requested costs — not spent'}</b><span>${costs.length ? costs.map((cost) => `${cost.amount} ${esc(cost.label)}`).join(' · ') : 'No tracked costs'}</span></div>${focus ? `<p>${r.status === 'undone' ? `Concentration restored: ${esc(focusName(focus.before))}` : `Concentration: ${esc(focusName(focus.before))} → ${esc(focusName(focus.after))}`}</p>` : ''}<p class="hint">Ability details recorded with this request.${r.reconsideredAs ? ' This request has already been reconsidered.' : ''}</p></div>${HUD.renderAbilityDetails(it, originalCharacter)}`;
  if (target.innerHTML !== html) target.innerHTML = html;
  const action =
    r.status === 'approved'
      ? 'history-undo'
      : ['denied', 'canceled', 'expired'].includes(r.status)
        ? 'history-reconsider'
        : '';
  const reason = action === 'history-undo' ? r.undoReason : r.reconsiderReason;
  const footer = `<div class="row wrap">${button('← History', 'dm-history', 'subtle')}${button('View character', 'history-character', 'subtle', TL.findCharacter(state, r.characterId) ? '' : 'disabled')}${action ? button(action === 'history-undo' ? 'Undo this use' : 'Reconsider', action, action === 'history-undo' ? 'subtle' : 'primary', `${reason || historyBusyId === r.id ? 'disabled' : ''} aria-describedby="history-action-reason"`) : ''}</div><p class="hint" id="history-action-reason">${action ? esc(reason || (action === 'history-undo' ? 'Refund only this use’s recorded costs and concentration change.' : 'Return this request to the front of the queue using its current ability details and costs.')) : 'This use has been undone and cannot be reconsidered or refunded again.'}</p>`;
  const actions = document.querySelector('[data-history-actions]');
  if (actions.innerHTML !== footer) {
    const focusedAction = actions.contains(document.activeElement)
      ? document.activeElement.dataset.action
      : '';
    actions.innerHTML = footer;
    if (focusedAction)
      (
        [...actions.querySelectorAll('button:not(:disabled)')].find(
          (button) => button.dataset.action === focusedAction
        ) || actions.querySelector('[data-action="dm-history"]')
      )?.focus({ preventScroll: true });
  }
  document.getElementById('modal-title').textContent = r.ability.name;
}
function handleHistoryAction(b) {
  const action = b.dataset.action;
  if (action === 'dm-history') {
    if (
      document.querySelector('.modal') &&
      !approvalOpenId &&
      !approvalListOpen &&
      !historyOpenId &&
      !historyListOpen
    )
      toast('Close the current dialog to review History.');
    else showHistoryList();
    return true;
  }
  if (action === 'review-history') {
    showHistoryDetail(b.dataset.id);
    return true;
  }
  if (action === 'history-character') {
    const entry = approvalState.history.find((r) => r.id === historyOpenId);
    if (entry && TL.findCharacter(state, entry.characterId)) {
      selectedId = entry.characterId;
      view = 'character';
      search = '';
      closeModal();
      render();
    }
    return true;
  }
  if (!['history-undo', 'history-reconsider'].includes(action)) return false;
  const entry = approvalState.history.find((r) => r.id === historyOpenId);
  if (!entry || historyBusyId) return true;
  const command = approvalCommand(action === 'history-undo' ? 'undo-use' : 'reconsider', {
    requestId: entry.id,
  });
  historyBusyId = entry.id;
  const error = document.getElementById('form-error');
  if (error) error.textContent = '';
  refreshHistoryDetail();
  partyOperation(async () => {
    const response = await api.approvalCommand(command);
    const success = await finishPartyChange(response);
    if (success && action === 'history-reconsider' && historyOpenId === entry.id)
      showApprovalRequest(response.result.requestId);
    if (success && action === 'history-undo') toast('Use undone.');
    return success;
  }).finally(() => {
    historyBusyId = '';
    if (historyOpenId) refreshHistoryDetail();
  });
  return true;
}
