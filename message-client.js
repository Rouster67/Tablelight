/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Messages = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Lossless, bounded pages. The reading panel grows for narrow displays,
  // long words and explicit newlines; the DM has matching page controls.
  function pages(text) {
    const chars = [...text],
      result = [];
    while (chars.length) {
      let end = Math.min(320, chars.length),
        lines = 0;
      for (let i = 0; i < end; i++)
        if (chars[i] === '\n' && ++lines === 8) {
          end = i + 1;
          break;
        }
      if (end < chars.length && lines < 8) {
        for (let i = end - 1; i >= end / 2; i--)
          if (/\s/u.test(chars[i])) {
            end = i + 1;
            break;
          }
      }
      result.push(chars.splice(0, end).join(''));
    }
    return result.length ? result : [''];
  }
  const key = (session, m) =>
    JSON.stringify([session, m.characterId, m.messageId, m.revision, m.presentationId]);
  const envelope =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>';
  class Client {
    state = {
      sessionId: '',
      revision: -1,
      overlay: { connected: false, visible: false },
      messages: [],
    };
    retired = new Set();
    events = 0;
    constructor(api, onChange = () => {}) {
      this.api = api;
      this.onChange = onChange;
      this.unsubscribe = api.onMessages((value) => {
        this.events++;
        this.accept(value);
      });
    }
    accept(value) {
      if (
        this.retired.has(value.sessionId) ||
        (value.sessionId === this.state.sessionId && value.revision <= this.state.revision)
      )
        return;
      if (this.state.sessionId && this.state.sessionId !== value.sessionId)
        this.retired.add(this.state.sessionId);
      this.state = value;
      this.onChange(value);
    }
    async refresh() {
      const events = this.events;
      const value = await this.api.messages();
      if (events === this.events || value.sessionId === this.state.sessionId) this.accept(value);
      return this.state;
    }
    message(id) {
      return this.state.messages.find((m) => m.characterId === id);
    }
    target(id) {
      const m = this.message(id);
      return {
        sessionId: this.state.sessionId,
        characterId: id,
        ...(m
          ? { messageId: m.messageId, revision: m.revision, presentationId: m.presentationId }
          : {}),
      };
    }
    current(request) {
      const m = this.message(request.characterId);
      return Boolean(m && key(this.state.sessionId, m) === key(request.sessionId, request));
    }
    request(type, id, values = {}) {
      return { ...this.target(id), requestId: globalThis.crypto.randomUUID(), type, ...values };
    }
    async execute(request) {
      try {
        const response = await this.api.messageCommand(request);
        this.accept(response);
        return response;
      } catch (error) {
        await this.refresh().catch(() => {});
        throw error;
      }
    }
    command(type, id, values = {}) {
      return this.execute(this.request(type, id, values));
    }
    destroy() {
      this.unsubscribe?.();
      this.onChange = () => {};
    }
  }
  return { pages, key, envelope, Client };
});
