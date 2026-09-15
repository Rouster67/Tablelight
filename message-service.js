/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const { randomUUID, createHash } = require('node:crypto');
const { pages } = require('./message-client');
const MAX_LENGTH = 2000;
const operations = {
  dm: ['send', 'force-open', 'close', 'dismiss', 'page', 'scroll'],
  player: ['open', 'close', 'page', 'scroll', 'ack-indicator', 'ack-opened'],
};
function identifier(value, maximum = 100) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum)
    throw Error('Invalid message identifier. Refresh the message controls.');
  return value;
}
function players(state) {
  return new Map(
    state.characters.map((c) => [
      c.id,
      {
        visible: c.hud.visible,
        expanded: c.hud.expanded,
      },
    ])
  );
}

// Messages and replay receipts exist only in this main-process owner. There is no
// save callback; neither the party model nor gameplay Undo can capture message text.
class MessageService {
  #id = randomUUID();
  #revision = 0;
  #front = 0;
  #players;
  #interactive;
  #displayId;
  #transport = { connected: false, visible: false };
  #messages = new Map();
  #completed = new Map();
  #onChange;
  #now;
  constructor(state, { onChange = () => {}, now = Date.now } = {}) {
    this.#players = players(state);
    this.#interactive = state.settings.overlayInteractive;
    this.#displayId = state.settings.displayId;
    this.#onChange = onChange;
    this.#now = now;
  }
  #available(message) {
    return (
      this.#transport.connected &&
      this.#transport.visible &&
      this.#players.get(message.characterId)?.visible === true
    );
  }
  #metadata(message) {
    return {
      characterId: message.characterId,
      messageId: message.id,
      revision: message.revision,
      presentationId: message.presentationId,
      sentAt: message.sentAt,
      deliveredAt: message.deliveredAt,
      openedAt: message.openedAt,
      openedBy: message.openedBy,
      unread: message.openedAt === null,
      open: message.open,
      requestedBy: message.requestedBy,
      available: this.#available(message),
      indicatorVisible: message.indicatorVisible,
      bodyVisible: message.bodyVisible,
      page: message.page,
      pageCount: message.pageCount,
      scrollSequence: message.scrollSequence,
      scrollDirection: message.scrollDirection,
      order: message.order || 0,
    };
  }
  snapshot() {
    return {
      sessionId: this.#id,
      revision: this.#revision,
      overlay: { ...this.#transport },
      messages: [...this.#messages.values()].map((m) => this.#metadata(m)),
    };
  }
  #notify() {
    this.#revision++;
    this.#onChange(this.snapshot());
  }
  #present(message, close = false) {
    message.presentationId = randomUUID();
    message.indicatorVisible = false;
    message.bodyVisible = false;
    message.bodyToken = null;
    message.scrollSequence = 0;
    message.scrollDirection = 0;
    if (close && message.open) {
      message.open = false;
      message.requestedBy = null;
      message.revision++;
    }
  }
  setOverlay({ connected, visible }, { invalidate = false } = {}) {
    const next = { connected: connected === true, visible: visible === true };
    if (
      !invalidate &&
      next.connected === this.#transport.connected &&
      next.visible === this.#transport.visible
    )
      return;
    this.#transport = next;
    for (const message of this.#messages.values()) this.#present(message, true);
    this.#notify();
  }
  reconcile(state, { reset = false } = {}) {
    const next = players(state);
    const displayChanged = this.#displayId !== state.settings.displayId;
    let changed = false;
    if (reset) {
      this.#id = randomUUID();
      this.#revision = 0;
      this.#front = 0;
      this.#messages.clear();
      this.#completed.clear();
      changed = true;
    } else {
      for (const [id, message] of this.#messages) {
        const before = this.#players.get(id),
          after = next.get(id);
        if (!after) {
          this.#messages.delete(id);
          changed = true;
        } else if (
          displayChanged ||
          before?.visible !== after.visible ||
          before?.expanded !== after.expanded
        ) {
          this.#present(message, true);
          changed = true;
        }
      }
    }
    this.#players = next;
    this.#interactive = state.settings.overlayInteractive;
    this.#displayId = state.settings.displayId;
    if (changed) this.#notify();
  }
  #session(request) {
    if (
      !request ||
      typeof request !== 'object' ||
      Array.isArray(request) ||
      request.sessionId !== this.#id
    )
      throw Error('This message session has ended. Refresh the message controls.');
  }
  #target(request, { presentation = false } = {}) {
    const characterId = identifier(request.characterId, 300);
    const messageId = identifier(request.messageId);
    if (!this.#players.has(characterId))
      throw Error('This player is no longer in the active party.');
    const message = this.#messages.get(characterId);
    if (
      !message ||
      message.id !== messageId ||
      !Number.isSafeInteger(request.revision) ||
      message.revision !== request.revision
    )
      throw Error('This message has changed or was dismissed. Refresh the message controls.');
    if (presentation && message.presentationId !== request.presentationId)
      throw Error('This message view has changed. Refresh the message controls.');
    return message;
  }
  body(request, actor) {
    this.#session(request);
    if (!Object.hasOwn(operations, actor)) throw Error('Unknown message reader.');
    const message = this.#target(request, { presentation: actor === 'player' });
    if (actor === 'player' && (!message.open || !this.#available(message)))
      throw Error('Open this message on a visible player overlay first.');
    if (actor === 'player') message.bodyToken ??= randomUUID();
    return {
      sessionId: this.#id,
      ...this.#metadata(message),
      body: message.body,
      ...(actor === 'player' ? { bodyToken: message.bodyToken } : {}),
    };
  }
  command(request, actor) {
    this.#session(request);
    if (!Object.hasOwn(operations, actor) || !operations[actor].includes(request.type))
      throw Error('This message control is not available in this window.');
    const input = {
      sessionId: this.#id,
      requestId: identifier(request.requestId),
      type: request.type,
      characterId: identifier(request.characterId, 300),
    };
    if (request.type === 'send') {
      if (
        typeof request.body !== 'string' ||
        request.body.length > MAX_LENGTH * 2 ||
        !request.body.trim() ||
        [...request.body].length > MAX_LENGTH
      )
        throw Error('Enter a message between 1 and 2,000 characters.');
      input.body = request.body;
      input.replaceMessageId =
        request.replaceMessageId == null ? null : identifier(request.replaceMessageId);
    } else {
      input.messageId = identifier(request.messageId);
      if (!Number.isSafeInteger(request.revision) || request.revision < 1)
        throw Error('Invalid message revision. Refresh the message controls.');
      input.revision = request.revision;
      input.presentationId = identifier(request.presentationId);
      if (input.type === 'ack-opened') input.bodyToken = identifier(request.bodyToken);
      if (input.type === 'page') {
        if (!Number.isSafeInteger(request.page) || request.page < 0)
          throw Error('Choose a valid message page.');
        input.page = request.page;
      }
      if (input.type === 'scroll') {
        if (![1, -1].includes(request.direction)) throw Error('Choose a valid scroll direction.');
        input.direction = request.direction;
      }
    }
    // Keep only a digest of command text. Receipts survive dismissal and removal
    // for this session so a late retry never resurrects an old message.
    const key = JSON.stringify([actor, input.requestId]);
    const digest = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const completed = this.#completed.get(key);
    if (completed) {
      if (completed.digest !== digest)
        throw Error('This message request was already used for another action.');
      return { ...this.snapshot(), result: { ...completed.result, replayed: true } };
    }
    if (!this.#players.has(input.characterId)) throw Error('Choose a player in the active party.');
    let message,
      changed = false,
      status;
    if (input.type === 'send') {
      const previous = this.#messages.get(input.characterId);
      if ((previous?.id || null) !== input.replaceMessageId)
        throw Error(
          previous
            ? 'This player already has a message. Choose Replace to replace it.'
            : 'The message to replace is no longer current.'
        );
      message = {
        id: randomUUID(),
        characterId: input.characterId,
        body: input.body,
        revision: 1,
        sentAt: this.#now(),
        deliveredAt: null,
        openedAt: null,
        openedBy: null,
        open: false,
        requestedBy: null,
        page: 0,
        pageCount: pages(input.body).length,
      };
      this.#present(message);
      this.#messages.set(input.characterId, message);
      changed = true;
      status = 'sent';
    } else {
      message = this.#target(input, { presentation: true });
      if (
        actor === 'player' &&
        ['open', 'close', 'page', 'scroll'].includes(input.type) &&
        !this.#interactive
      )
        throw Error('The overlay is in click-through mode. Use the DM message controls.');
      if (
        ['open', 'force-open', 'page', 'scroll', 'ack-indicator', 'ack-opened'].includes(
          input.type
        ) &&
        !this.#available(message)
      )
        throw Error(
          'Show this player and the TV overlay before opening or acknowledging the message.'
        );
      switch (input.type) {
        case 'page':
        case 'scroll':
          if (!message.open) throw Error('Open this message before using its reading controls.');
          if (input.type === 'page') {
            if (input.page >= message.pageCount) throw Error('This message has no such page.');
            if (message.page !== input.page) {
              message.page = input.page;
              message.revision++;
              this.#present(message);
              changed = true;
            }
          } else {
            message.scrollSequence++;
            message.scrollDirection = input.direction;
            changed = true;
          }
          message.order = ++this.#front;
          changed = true;
          status = input.type === 'page' ? 'paged' : 'scrolled';
          break;
        case 'open':
        case 'force-open':
          message.order = ++this.#front;
          changed = true;
          if (!message.open) {
            message.open = true;
            message.requestedBy = actor;
            message.revision++;
            this.#present(message);
            changed = true;
          }
          status = 'opening';
          break;
        case 'close':
          if (message.open) {
            this.#present(message, true);
            changed = true;
          }
          status = 'closed';
          break;
        case 'dismiss':
          this.#messages.delete(input.characterId);
          changed = true;
          status = 'dismissed';
          break;
        case 'ack-indicator':
        case 'ack-opened':
          if (
            input.type === 'ack-opened' &&
            (!message.open || !message.bodyToken || message.bodyToken !== input.bodyToken)
          )
            throw Error('Fetch and display the current open message before acknowledging it.');
          if (!message.indicatorVisible) {
            message.indicatorVisible = true;
            message.deliveredAt ??= this.#now();
            changed = true;
          }
          if (input.type === 'ack-opened' && !message.bodyVisible) {
            message.bodyVisible = true;
            message.openedAt = this.#now();
            message.openedBy = message.requestedBy;
            changed = true;
          }
          status = input.type === 'ack-opened' ? 'opened' : 'delivered';
          break;
      }
    }
    const result = { status, messageId: message.id, characterId: message.characterId };
    this.#completed.set(key, { digest, result });
    if (changed) this.#notify();
    return { ...this.snapshot(), result: { ...result, replayed: false } };
  }
}
module.exports = { MessageService, MAX_LENGTH };
