/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
let guideOpening = false;
let guideFeedback = '';
function renderGuideLink() {
  return `<div id="guide-link">${button('Open illustrated user guide (PDF, offline)', 'open-guide', 'primary', `aria-describedby="guide-feedback" ${guideOpening ? 'disabled' : ''}`)}<p id="guide-feedback" class="hint space-top" role="status" aria-live="polite">${esc(guideFeedback)}</p></div>`;
}
function refreshGuideLink() {
  const el = document.getElementById('guide-link');
  if (el) el.outerHTML = renderGuideLink();
}
async function openUserGuide() {
  if (guideOpening) return;
  const focused = document.activeElement?.dataset.action === 'open-guide';
  guideOpening = true;
  guideFeedback = 'Opening the offline guide…';
  refreshGuideLink();
  try {
    guideFeedback = api.openGuide
      ? (await api.openGuide()).message
      : 'Open Tablelight.exe to read the installed offline guide. This browser page is a development preview.';
  } catch {
    guideFeedback =
      'The guide could not be opened. Try again, or restart Tablelight. If it still fails, reinstall this version; saved parties are stored separately.';
  } finally {
    guideOpening = false;
    refreshGuideLink();
    if (focused) document.querySelector('[data-action="open-guide"]')?.focus();
  }
}
