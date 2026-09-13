/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
let updateState = {
  supported: false,
  enabled: true,
  phase: 'idle',
  availableVersion: '',
  message: '',
};
let updatePromptSeen = '',
  updatePromptScheduled = false,
  updateDialogSignature = '';
const updateBusy = () => ['downloading', 'saving', 'installing'].includes(updateState.phase);
function updateStatusText() {
  if (!updateState.supported)
    return 'Install Tablelight with the Windows installer to enable in-app updates.';
  if (updateState.message) return updateState.message;
  switch (updateState.phase) {
    case 'checking':
      return 'Checking for a newer stable release…';
    case 'current':
      return 'You have the latest stable version available to this app.';
    case 'available':
      return `Tablelight ${updateState.availableVersion} is available.`;
    case 'downloading':
      return 'Downloading the update. Tablelight will save and restart when it is ready.';
    case 'saving':
      return 'Saving your party before the update…';
    case 'installing':
      return 'Installing the update and restarting Tablelight…';
    case 'ready':
      return `Tablelight ${updateState.availableVersion} is downloaded and ready to retry.`;
    default:
      return updateState.enabled
        ? 'Automatic checks run when you open Tablelight.'
        : 'Automatic checks are off. You can still use Check now.';
  }
}
function renderUpdateIndicator() {
  if (!updateState.availableVersion) return '';
  const label = `Update available: v${updateState.availableVersion}`;
  return button(
    '↓',
    'update-offer',
    'update-indicator',
    `title="${esc(label)}" aria-label="${esc(label)}"`
  );
}
function renderUpdatePanel() {
  return `<label class="update-setting"><input type="checkbox" id="update-checks" ${updateState.enabled ? 'checked' : ''} ${!updateState.supported || updateBusy() ? 'disabled' : ''}>Check for updates at launch</label>
    <p class="hint">Checks GitHub for stable releases. No character, party, or library content is sent. Play works offline.</p>
    ${updateState.preferenceError ? `<p class="form-error">${esc(updateState.preferenceError)}</p>` : ''}
    <p class="hint update-status" role="status">${esc(updateStatusText())}</p>
    ${updateProgressMarkup()}
    <div class="row wrap">${button('Check now', 'update-check', 'small', !updateState.supported || updateState.phase === 'checking' || updateBusy() ? 'disabled' : '')}
    ${updateState.availableVersion ? button('Review update', 'update-offer', 'small primary') : ''}
    ${button('Release page', 'update-release-page', 'small subtle', window.tablelight ? '' : 'disabled')}</div>`;
}
function renderUpdates() {
  return `<section class="card"><div class="card-heading"><h3>Updates</h3></div><div id="updates-panel" class="card-body gap">${renderUpdatePanel()}</div></section>`;
}
function updateProgressMarkup() {
  return updateState.phase === 'downloading'
    ? `<div class="update-progress"><progress max="100" value="${Number(updateState.progress) || 0}" aria-label="Update download progress"></progress><span>${Math.floor(updateState.progress || 0)}%</span></div>`
    : '';
}
function updateDialogBody() {
  return `<p>Current version: <b>${esc(appVersion)}</b><br>New version: <b>${esc(updateState.availableVersion)}</b></p><p class="space-top update-status" role="status">${esc(updateStatusText())}</p>${updateProgressMarkup()}<p class="hint space-top">Your saved characters and libraries stay on this computer. Updating will close the DM screen and TV overlay, then reopen Tablelight with the overlay hidden.</p>`;
}
function updateDialogFooter() {
  if (updateState.phase === 'downloading')
    return button('Cancel download', 'update-cancel', 'subtle');
  if (updateBusy()) return '<span class="hint">Please wait…</span>';
  return `${button('Release notes', 'update-release-page', 'subtle')}<div class="row">${button('Later', 'close-modal', 'subtle')}${button('Update and restart', 'update-download', 'primary')}</div>`;
}
function openUpdateOffer() {
  if (!updateState.availableVersion || document.querySelector('.modal')) return;
  updatePromptSeen = updateState.availableVersion;
  api.dismissUpdate?.().catch(() => {});
  modal(
    'A Tablelight update is available',
    `<div id="update-dialog">${updateDialogBody()}</div>`,
    updateDialogFooter(),
    true
  );
  updateDialogSignature = '';
  refreshUpdates();
}
function maybeShowUpdateOffer() {
  if (
    updatePromptScheduled ||
    !updateState.promptVersion ||
    updatePromptSeen === updateState.promptVersion
  )
    return;
  updatePromptScheduled = true;
  requestAnimationFrame(() => {
    updatePromptScheduled = false;
    if (
      state &&
      updateState.promptVersion &&
      updatePromptSeen !== updateState.promptVersion &&
      !document.querySelector('.modal') &&
      !document.activeElement?.matches('input,textarea,select,[contenteditable]')
    )
      openUpdateOffer();
  });
}
function refreshUpdates() {
  const indicator = document.getElementById('update-indicator');
  if (indicator) indicator.innerHTML = renderUpdateIndicator();
  const panel = document.getElementById('updates-panel');
  const signature = JSON.stringify([
    updateState.phase,
    updateState.message,
    updateState.availableVersion,
    updateState.enabled,
    updateState.preferenceError,
  ]);
  // Progress changes only touch the meter, preserving keyboard focus on Cancel download.
  if (panel && panel.dataset.signature !== signature) {
    const focused = panel.contains(document.activeElement) ? document.activeElement.id : '';
    panel.innerHTML = renderUpdatePanel();
    panel.dataset.signature = signature;
    if (focused) document.getElementById(focused)?.focus({ preventScroll: true });
  }
  const dialog = document.getElementById('update-dialog');
  if (dialog && signature !== updateDialogSignature) {
    const hadFocus = Boolean(document.activeElement?.closest('.modal'));
    dialog.innerHTML = updateDialogBody();
    document.querySelector('.modal-footer').innerHTML = updateDialogFooter();
    document.querySelector('.modal-header [data-action="close-modal"]').disabled = updateBusy();
    updateDialogSignature = signature;
    if (hadFocus && !document.activeElement?.closest('.modal'))
      document.querySelector('.modal-footer button')?.focus();
  }
  for (const meter of document.querySelectorAll('.update-progress')) {
    meter.querySelector('progress').value = updateState.progress || 0;
    meter.querySelector('span').textContent = `${Math.floor(updateState.progress || 0)}%`;
  }
  maybeShowUpdateOffer();
}
function acceptUpdateState(value) {
  updateState = value;
  refreshUpdates();
}
async function handleUpdateAction(action) {
  switch (action) {
    case 'update-check':
      acceptUpdateState(await api.checkUpdates());
      break;
    case 'update-offer':
      openUpdateOffer();
      break;
    case 'update-download':
      acceptUpdateState(await api.downloadUpdate());
      break;
    case 'update-cancel':
      acceptUpdateState(await api.cancelUpdate());
      break;
    case 'update-release-page':
      await api.releasePage();
      break;
  }
}
document.addEventListener('change', async (event) => {
  if (event.target.id !== 'update-checks') return;
  const enabled = event.target.checked;
  event.target.disabled = true;
  try {
    acceptUpdateState(await api.setUpdateChecks(enabled));
  } catch (error) {
    event.target.checked = updateState.enabled;
    event.target.disabled = false;
    toast(error.message, true);
  }
});
document.addEventListener('focusout', () => maybeShowUpdateOffer());
