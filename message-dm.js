/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
let messageClient,
  messageRecipient = '',
  messageSession = '';
const messageDrafts = new Map();
function messageDraft(id = messageRecipient) {
  if (!messageDrafts.has(id))
    messageDrafts.set(id, {
      text: '',
      error: '',
      success: '',
      busy: false,
      request: null,
      confirm: null,
    });
  return messageDrafts.get(id);
}
function initMessages() {
  if (!api.messages) return;
  messageClient = new Messages.Client(api, (value) => {
    if (messageSession && messageSession !== value.sessionId) {
      messageDrafts.clear();
      messageRecipient = '';
      if (view === 'messages') render();
    }
    messageSession = value.sessionId;
    for (const [id, draft] of messageDrafts)
      if (draft.review?.messageId !== messageClient.message(id)?.messageId) draft.review = null;
    refreshMessages();
    paintMessagePreview();
  });
  messageClient
    .refresh()
    .catch(() => toast('Message controls could not load. Open Messages to retry.', true));
}
function messageRecipientOptions() {
  return (
    '<option value="">Choose a player…</option>' +
    (messageRecipient && !state.characters.some((c) => c.id === messageRecipient)
      ? `<option value="${esc(messageRecipient)}" selected>Recipient is no longer in the party</option>`
      : '') +
    state.characters
      .map(
        (c, i) =>
          `<option value="${esc(c.id)}" ${c.id === messageRecipient ? 'selected' : ''}>${esc(c.name)} · Player ${i + 1}${c.className ? ' · ' + esc(c.className) : ''}</option>`
      )
      .join('')
  );
}
function renderMessages() {
  if (!api.messages)
    return '<h1>Messages</h1><p>Open Tablelight.exe to send messages to player overlays.</p>';
  const draft = messageDraft();
  return `<div class="page-heading"><div class="eyebrow">A note from the DM</div><h1>Messages</h1><p>Choose one player. Sending shows an envelope; the text stays hidden until opened.</p></div><div class="message-compose-grid"><section class="card"><div class="card-body gap"><label class="form-field"><span>Player</span><select id="message-recipient" aria-label="Message recipient">${messageRecipientOptions()}</select></label><label class="form-field"><span>Message</span><textarea id="message-draft" maxlength="4000" aria-describedby="message-count message-lifetime" placeholder="Write a message for this player…">${esc(draft.text)}</textarea></label><div id="message-count" class="hint"></div><div id="message-recipient-summary" class="message-recipient"></div><div class="row"><button type="button" class="primary" data-message-dm="send">Send message</button><span id="message-send-result" role="status"></span></div><div id="message-replace"></div><div id="message-error" class="form-error" role="alert"></div><p class="hint" id="message-lifetime">One message per player. Closing keeps it available; dismissing removes it. Messages and drafts clear when Tablelight closes or a backup is restored. Removing a player clears their sent message.</p></div></section><section class="card"><div class="card-body gap"><h2>On this player’s TV overlay</h2><p class="note">Opened messages are visible on the shared TV.</p><div id="message-current"></div></div></section></div>`;
}
function captureMessageFocus() {
  const field = document.getElementById('message-draft');
  return (
    field && {
      focused: field === document.activeElement,
      start: field.selectionStart,
      end: field.selectionEnd,
      scroll: field.scrollTop,
    }
  );
}
function restoreMessageFocus(previous) {
  const field = document.getElementById('message-draft');
  if (!field || !previous) return;
  field.scrollTop = previous.scroll;
  if (previous.focused) {
    field.focus({ preventScroll: true });
    field.setSelectionRange(previous.start, previous.end);
  }
}
function refreshMessages() {
  const select = document.getElementById('message-recipient');
  if (!select) return;
  const c = state.characters.find((c) => c.id === messageRecipient),
    draft = messageDraft();
  const choices = messageRecipientOptions();
  if (select.dataset.choices !== choices) {
    select.innerHTML = choices;
    select.dataset.choices = choices;
  }
  const field = document.getElementById('message-draft');
  field.disabled = !c || draft.busy;
  const count = [...draft.text].length;
  document.getElementById('message-count').textContent =
    `${count.toLocaleString()} / 2,000 characters`;
  document.getElementById('message-recipient-summary').innerHTML = c
    ? `${portrait(c)}<div><small>Send to</small><br><b>${esc(c.name)}</b>${c.className ? `<br><small>${esc(c.className)}</small>` : ''}</div>`
    : '<p>Choose an active player before sending.</p>';
  const send = document.querySelector('[data-message-dm="send"]');
  send.disabled =
    !c || draft.busy || !draft.text.trim() || count > 2000 || !messageClient?.state.sessionId;
  send.textContent = draft.busy ? 'Sending…' : draft.request ? 'Retry send' : 'Send message';
  document.getElementById('message-send-result').textContent = draft.success;
  document.getElementById('message-error').textContent = draft.error;
  const replace = document.getElementById('message-replace');
  const confirmation = draft.confirm
    ? `<div class="message-replacement" role="group" aria-label="Replace message"><b>Replace the message for ${esc(draft.confirm.name)}?</b><p>The previous message will be discarded, and its replacement will start unread.</p><div class="row"><button type="button" data-message-dm="cancel-replace">Keep previous message</button><button type="button" class="primary" data-message-dm="confirm-replace" ${draft.busy || !c ? 'disabled' : ''}>Replace for ${esc(draft.confirm.name)}</button></div></div>`
    : '';
  if (replace.dataset.content !== confirmation) {
    replace.innerHTML = confirmation;
    replace.dataset.content = confirmation;
  }
  const current = document.getElementById('message-current'),
    m = messageClient?.message(messageRecipient);
  const focused = current.contains(document.activeElement)
    ? document.activeElement.dataset.messageDm
    : '';
  const status = !m
    ? 'No message for this player.'
    : [
        m.openedAt
          ? `Opened by ${m.openedBy === 'dm' ? 'DM' : 'player'}`
          : m.deliveredAt
            ? 'Delivered · Unread'
            : 'Sent · Waiting for delivery',
        !c?.hud.visible
          ? 'Player hidden'
          : !messageClient.state.overlay.visible
            ? 'TV overlay hidden'
            : !messageClient.state.overlay.connected
              ? 'TV overlay reconnecting'
              : m.open
                ? m.bodyVisible
                  ? 'Open on TV'
                  : 'Opening on TV…'
                : '',
      ]
        .filter(Boolean)
        .join(' · ');
  const control = (action, label, disabled = false) =>
    `<button type="button" data-message-dm="${action}" ${disabled || draft.busy ? 'disabled' : ''}>${label}</button>`;
  const controls = m
    ? `<p role="status" data-message-status>${esc(status)}</p><div class="row">${control('force-open', 'Force open', !m.available)}${control('close', 'Close on TV', !m.open)}${control('dismiss', 'Dismiss')}</div>${!m.available ? '<p class="hint">Show this player in TV & layout and show the TV overlay before opening their message.</p>' : ''}<div class="row space-top">${control('previous', '← Previous page', !m.bodyVisible || m.page === 0)}<span>Page ${m.page + 1} of ${m.pageCount}</span>${control('next', 'Next page →', !m.bodyVisible || m.page + 1 === m.pageCount)}</div><div class="row">${control('scroll-up', 'Scroll up', !m.bodyVisible)}${control('scroll-down', 'Scroll down', !m.bodyVisible)}</div><p class="hint">Reading controls work while the TV is click-through. “Opened” means displayed on the TV, not proof that the player read it.</p><div class="space-top">${control('review', 'View sent text on laptop')}</div><div class="message-sent-text" data-message-review></div>`
    : `<p role="status">${esc(status)}</p>`;
  if (current.dataset.content !== controls) {
    current.innerHTML = controls;
    current.dataset.content = controls;
    if (focused)
      current
        .querySelector(`[data-message-dm="${focused}"]:not(:disabled)`)
        ?.focus({ preventScroll: true });
  }
  const review = current.querySelector('[data-message-review]');
  if (review)
    review.textContent = draft.review?.messageId === m?.messageId ? draft.review.body : '';
}
async function submitMessage(confirmed = false) {
  const id = messageRecipient,
    c = state.characters.find((c) => c.id === id),
    draft = messageDraft(id);
  if (!c || draft.busy || !draft.text.trim() || [...draft.text].length > 2000) return;
  const current = messageClient.message(id);
  if (!draft.request && current && !confirmed) {
    draft.confirm = { messageId: current.messageId, name: c.name };
    refreshMessages();
    document.querySelector('[data-message-dm="cancel-replace"]')?.focus();
    return;
  }
  if (confirmed && (!draft.confirm || current?.messageId !== draft.confirm.messageId)) {
    draft.confirm = null;
    draft.error =
      'The previous message changed. Choose Send message to review its replacement again.';
    refreshMessages();
    return;
  }
  const text = draft.text;
  draft.request ||= messageClient.request('send', id, {
    body: text,
    replaceMessageId: confirmed ? draft.confirm.messageId : null,
  });
  draft.busy = true;
  draft.error = '';
  draft.success = '';
  refreshMessages();
  try {
    await messageClient.execute(draft.request);
    draft.request = null;
    draft.confirm = null;
    draft.review = null;
    if (draft.text === text) draft.text = '';
    draft.success = 'Message sent to ' + c.name + '.';
    if (messageRecipient === id) {
      const field = document.getElementById('message-draft');
      if (field) field.value = draft.text;
    }
  } catch (error) {
    draft.error =
      'Message not confirmed. Your draft is kept. ' +
      error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
    if (/session has ended|Choose Replace|no longer current|active party/.test(error.message))
      draft.request = null;
  } finally {
    draft.busy = false;
    refreshMessages();
  }
}
function paintMessagePreview() {
  const stage = document.getElementById('preview-stage');
  if (!stage) return;
  stage.querySelectorAll('[data-message-preview]').forEach((el) => el.remove());
  for (const root of stage.children) {
    const m = messageClient?.message(root.dataset.hudId);
    if (!m) continue;
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.disabled = true;
    badge.className = 'message-badge' + (m.unread ? ' is-unread' : '');
    badge.dataset.messagePreview = '';
    badge.setAttribute('aria-label', m.unread ? 'Unread message' : 'Message available');
    badge.title = 'Message notification only';
    badge.innerHTML =
      Messages.envelope + '<span class="message-unread-dot" aria-hidden="true"></span>';
    (root.querySelector('.hud-collapsed') || root).append(badge);
  }
}
document.addEventListener('input', (event) => {
  if (event.target.id !== 'message-draft') return;
  const draft = messageDraft();
  draft.text = event.target.value;
  draft.request = null;
  draft.confirm = null;
  draft.error = '';
  draft.success = '';
  refreshMessages();
});
document.addEventListener('change', (event) => {
  if (event.target.id !== 'message-recipient') return;
  messageRecipient = event.target.value;
  document.getElementById('message-draft').value = messageDraft().text;
  refreshMessages();
});
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-message-dm]');
  if (!button || button.disabled || updateBusy()) return;
  const action = button.dataset.messageDm,
    id = messageRecipient,
    draft = messageDraft(id);
  if (action === 'send' || action === 'confirm-replace') {
    await submitMessage(action === 'confirm-replace');
    return;
  }
  if (action === 'cancel-replace') {
    draft.confirm = null;
    refreshMessages();
    document.querySelector('[data-message-dm="send"]')?.focus();
    return;
  }
  const m = messageClient.message(id);
  if (!m) return;
  button.disabled = true;
  draft.error = '';
  try {
    if (action === 'review') {
      const response = await api.messageBody(messageClient.target(id));
      if (messageClient.current(response)) draft.review = response;
    } else if (['previous', 'next'].includes(action))
      await messageClient.command('page', id, { page: m.page + (action === 'previous' ? -1 : 1) });
    else if (action.startsWith('scroll-'))
      await messageClient.command('scroll', id, { direction: action === 'scroll-up' ? -1 : 1 });
    else await messageClient.command(action, id);
  } catch {
    draft.error = 'That message changed or is unavailable. Try its current controls.';
  } finally {
    if (button.isConnected) button.disabled = false;
    refreshMessages();
  }
});
