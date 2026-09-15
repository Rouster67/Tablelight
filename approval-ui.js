/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
let approvalState = { id: '', revision: -1, pending: [] };
let approvalOpenId = '';
let approvalListOpen = false;
let approvalBusyId = '';
let pendingGuard = null;
const queueIcon =
  '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4H5a2 2 0 0 0-2 2v14h18V6a2 2 0 0 0-2-2h-3"/><rect x="8" y="2" width="8" height="5" rx="2"/><path d="m7 12 2 2 3-4m2 3h3M7 17h10"/></svg>';
function approvalCommand(type, values = {}) {
  return { sessionId: approvalState.id, commandId: TL.uid(), type, ...values };
}
function acceptApprovalState(value) {
  if (!value.approvals) return;
  if (value.approvals.id === approvalState.id && value.approvals.revision < approvalState.revision)
    return;
  const wasEmpty = !approvalState.pending.length;
  state = TL.normalize(value.state);
  approvalState = value.approvals;
  history = Array(value.undoCount || 0);
  render();
  if (
    value.change?.kind === 'request' &&
    wasEmpty &&
    !document.querySelector('[role="dialog"], [role="alertdialog"]')
  )
    showApprovalRequest(value.change.requestId);
}
function renderApprovalQueue() {
  const root = document.getElementById('dm-queue-root');
  if (!root) return;
  const count = approvalState.pending.length;
  const urgent = approvalState.pending.some((r) => r.urgent);
  root.innerHTML = `<button type="button" class="dm-queue-button ${count ? 'waiting' : ''} ${urgent ? 'urgent' : ''}" data-action="dm-queue" title="DM queue${count ? ': ' + count + ' waiting' : ''}" aria-label="DM queue, ${count} waiting">${queueIcon}${count ? '<span class="queue-alert" aria-hidden="true">!</span>' : ''}<span class="queue-count">${count}</span></button>`;
  if (approvalListOpen && document.querySelector('[data-dm-queue-list]')) refreshApprovalList();
  if (approvalOpenId && document.querySelector('[data-approval-detail]')) refreshApprovalRequest();
}
function refreshApprovalList() {
  const list = document.querySelector('[data-dm-queue-list]');
  if (!list) return;
  const focusId = document.activeElement?.closest('[data-action="review-request"]')?.dataset.id;
  const scroll = list.closest('.modal-body').scrollTop;
  list.innerHTML =
    approvalState.pending
      .map(
        (r) =>
          `<button type="button" class="dm-queue-entry ${r.urgent ? 'urgent' : ''}" data-action="review-request" data-id="${esc(r.id)}">${r.urgent ? '<span class="urgent-label">Urgent · Reaction</span>' : ''}<span><b>${esc(state.characters.find((c) => c.id === r.characterId)?.name || r.characterName)}</b> — using ${esc(r.ability.name)}</span><small>Awaiting approval</small></button>`
      )
      .join('') || '<p class="hint">Nothing is waiting for review.</p>';
  if (focusId)
    [...list.querySelectorAll('button')]
      .find((b) => b.dataset.id === focusId)
      ?.focus({ preventScroll: true });
  list.closest('.modal-body').scrollTop = scroll;
}
function showApprovalList() {
  approvalOpenId = '';
  modal(
    'DM queue',
    '<div data-dm-queue-list class="dm-queue-list"></div>',
    button('Close', 'close-modal', 'subtle'),
    true
  );
  approvalListOpen = true;
  refreshApprovalList();
}
function showApprovalRequest(id) {
  if (!approvalState.pending.some((r) => r.id === id)) return;
  modal(
    'Ability request',
    '<div data-approval-detail></div>',
    `<div class="row">${button('View character', 'request-character', 'subtle')}${button('Minimize', 'close-modal', 'subtle')}</div><div class="row">${button('Deny use', 'deny-request', 'danger subtle')}${button('Allow use', 'approve-request', 'primary')}</div>`
  );
  approvalListOpen = false;
  approvalOpenId = id;
  refreshApprovalRequest();
}
function refreshApprovalRequest() {
  const target = document.querySelector('[data-approval-detail]');
  if (!target) return;
  const r = approvalState.pending.find((r) => r.id === approvalOpenId);
  if (!r) {
    closeModal();
    return;
  }
  const c = state.characters.find((c) => c.id === r.characterId);
  const it = c?.items.find((it) => it.id === r.itemId);
  const reason = it
    ? TL.availability(c, it, r.slotLevel ?? undefined)
    : 'This ability is no longer available.';
  const warning = it && TL.concentrationUseWarning(c, it);
  const html = `<div class="approval-summary ${r.urgent ? 'urgent' : ''}">${r.urgent ? '<span class="urgent-label">Urgent · Reaction</span>' : ''}<p><b>${esc(c?.name || r.characterName)}</b> is requesting ${HUD.abilityName(it || r.ability)}.</p><div class="approval-costs"><b>Costs on approval</b><span>${r.costs.length ? r.costs.map((cost) => `${cost.amount} ${esc(cost.label)}`).join(' · ') : 'No tracked costs'}</span></div>${warning ? `<p class="note approval-concentration">${esc(warning.message)} Concentration switches only if you allow this use.</p>` : ''}${reason ? `<p class="form-error">${esc(reason)}</p>` : ''}</div>${HUD.renderAbilityDetails(it || r.ability, c || { resources: [] })}`;
  const heading = `<div class="eyebrow">${esc((it || r.ability).kind)} · ${esc(labels[(it || r.ability).economy])}${it?.local ? ' · Character only' : ''}</div>`;
  if (target.innerHTML !== heading + html) target.innerHTML = heading + html;
  document.querySelector('[data-action="approve-request"]').disabled =
    Boolean(reason) || approvalBusyId === r.id;
  document.querySelector('[data-action="deny-request"]').disabled = approvalBusyId === r.id;
  document.getElementById('modal-title').textContent = r.ability.name;
}
function guardChange(result) {
  return new Promise((resolve) => {
    const root = document.getElementById('queue-guard-root');
    const focus = document.activeElement;
    const expires = result.affected.every((r) => r.status === 'expired');
    root.innerHTML = `<div class="modal-backdrop queue-guard-backdrop"><section class="modal narrow" role="alertdialog" aria-modal="true" aria-labelledby="queue-guard-title"><header class="modal-header"><h2 id="queue-guard-title">${expires ? 'Start a new turn?' : 'Pending requests depend on this change'}</h2></header><div class="modal-body"><p>${expires ? 'Starting this turn will expire these pending requests and release their reserved costs.' : 'These queued requests rely on data being changed. Continuing will automatically deny them.'}</p><ul class="queue-affected">${result.affected.map((r) => `<li>${esc(r.characterName)} — ${esc(r.abilityName)}</li>`).join('')}</ul><p>Do you wish to continue?</p></div><footer class="modal-footer"><button type="button" data-guard-cancel>Cancel</button><button type="button" data-guard-continue class="primary">Continue</button></footer></section></div>`;
    for (const id of ['app', 'modal-root', 'dm-queue-root'])
      document.getElementById(id).inert = true;
    const finish = (answer) => {
      root.innerHTML = '';
      pendingGuard = null;
      for (const id of ['app', 'modal-root', 'dm-queue-root'])
        document.getElementById(id).inert = false;
      if (focus?.isConnected) focus.focus({ preventScroll: true });
      resolve(answer);
    };
    pendingGuard = finish;
    root.querySelector('[data-guard-cancel]').onclick = () => finish(false);
    root.querySelector('[data-guard-continue]').onclick = () => finish(true);
    root.querySelector('[data-guard-cancel]').focus();
  });
}
async function finishPartyChange(response) {
  response = await response;
  acceptApprovalState(response);
  if (response.result?.status !== 'confirmation-required') return true;
  const answer = await guardChange(response.result);
  const command = approvalCommand(answer ? 'confirm-change' : 'cancel-change', {
    confirmationId: response.result.confirmationId,
  });
  if (!answer) {
    try {
      acceptApprovalState(await api.approvalCommand(command));
    } catch {
      /* A stale canceled preview has no effect. */
    }
    return false;
  }
  acceptApprovalState(await api.approvalCommand(command));
  return true;
}
function handleApprovalAction(b) {
  const action = b.dataset.action;
  if (action === 'dm-queue') {
    if (document.querySelector('.modal') && !approvalOpenId && !approvalListOpen)
      toast('Close the current dialog to review queued requests.');
    else showApprovalList();
    return true;
  }
  if (action === 'review-request') {
    showApprovalRequest(b.dataset.id);
    return true;
  }
  if (action === 'request-character') {
    const request = approvalState.pending.find((r) => r.id === approvalOpenId);
    if (request) {
      selectedId = request.characterId;
      view = 'character';
      search = '';
      closeModal();
      render();
    }
    return true;
  }
  if (!['approve-request', 'deny-request'].includes(action)) return false;
  const request = approvalState.pending.find((r) => r.id === approvalOpenId);
  if (!request) return true;
  if (approvalBusyId === request.id) return true;
  const c = state.characters.find((c) => c.id === request.characterId),
    it = c?.items.find((it) => it.id === request.itemId);
  const command = approvalCommand(action === 'approve-request' ? 'approve' : 'deny', {
    requestId: request.id,
    confirmedConcentration: it ? TL.concentrationUseWarning(c, it)?.token || '' : '',
  });
  b.disabled = true;
  approvalBusyId = request.id;
  partyOperation(async () => {
    const success = await finishPartyChange(await api.approvalCommand(command));
    if (success && approvalOpenId === request.id) closeModal();
    return success;
  }).finally(() => {
    approvalBusyId = '';
    if (b.isConnected) refreshApprovalRequest();
  });
  return true;
}
