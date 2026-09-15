/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
class MessageOverlay {
  constructor({ api, stage, getState, changed, report }) {
    Object.assign(this, { api, stage, getState, changed, report });
    this.entries = new Map();
    this.pulses = new Map();
    this.inFlight = new Set();
    this.layer = document.getElementById('message-stage');
    this.client = new Messages.Client(api, () => this.render());
    this.click = (event) => this.handleClick(event);
    this.keydown = (event) => {
      if (
        event.key !== 'Escape' ||
        !event.target.closest('.message-panel') ||
        !this.getState()?.settings.overlayInteractive
      )
        return;
      event.preventDefault();
      this.act('close', event.target.closest('[data-message-character]').dataset.messageCharacter);
    };
    this.pointer = (event) => {
      const panel = event.target.closest('.message-panel');
      if (panel && this.getState()?.settings.overlayInteractive && !event.target.closest('button'))
        this.act('open', panel.dataset.messageCharacter);
    };
    stage.addEventListener('click', this.click);
    this.layer.addEventListener('click', this.click);
    this.layer.addEventListener('keydown', this.keydown);
    this.layer.addEventListener('pointerdown', this.pointer);
    this.client
      .refresh()
      .catch(() => report('Message notifications could not load. Reopen the TV overlay to retry.'));
  }
  remove(entry) {
    entry.badge?.remove();
    entry.frame?.remove();
  }
  destroy() {
    this.stopped = true;
    this.client.destroy();
    cancelAnimationFrame(this.paintFrame);
    for (const entry of this.entries.values()) this.remove(entry);
    this.entries.clear();
    this.stage.removeEventListener('click', this.click);
    this.layer.removeEventListener('click', this.click);
    this.layer.removeEventListener('keydown', this.keydown);
    this.layer.removeEventListener('pointerdown', this.pointer);
    this.changed();
  }
  dimensions(c) {
    const angle = (c.hud.rotation * Math.PI) / 180,
      cos = Math.abs(Math.cos(angle)),
      sin = Math.abs(Math.sin(angle));
    const fit = Math.min(
      1,
      (innerWidth - 32) / ((480 * cos + 320 * sin) * c.hud.scale),
      (innerHeight - 32) / ((480 * sin + 320 * cos) * c.hud.scale)
    );
    return {
      width: 480 * fit,
      height: 320 * fit,
      font: Math.max(12, 20 * fit),
      padding: Math.max(5, 14 * fit),
    };
  }
  render() {
    if (this.stopped) return;
    const state = this.getState();
    if (!state) return;
    const active = new Set();
    for (const m of this.client.state.messages) {
      const c = state.characters.find((c) => c.id === m.characterId);
      const root = [...this.stage.children].find((el) => el.dataset.hudId === m.characterId);
      if (!c?.hud.visible || !root) continue;
      active.add(c.id);
      let entry = this.entries.get(c.id);
      if (!entry) {
        entry = { id: c.id, scroll: 0 };
        this.entries.set(c.id, entry);
      }
      const key = Messages.key(this.client.state.sessionId, m);
      if (entry.order !== m.order) {
        entry.order = m.order;
        entry.error = '';
        entry.ackError = '';
      }
      if (entry.key !== key) {
        if (entry.frame?.contains(document.activeElement))
          entry.focus = document.activeElement.dataset.messageAction || 'text';
        entry.key = key;
        entry.body = null;
        entry.error = '';
        entry.fetching = false;
        entry.ackError = '';
        entry.scroll = 0;
        entry.scrollSequence = 0;
        entry.frame?.remove();
        entry.frame = null;
      }
      if (!entry.badge?.isConnected || entry.root !== root) {
        entry.badge?.remove();
        entry.root = root;
        entry.badge = document.createElement('button');
        entry.badge.type = 'button';
        entry.badge.className = 'message-badge';
        entry.badge.dataset.messageBadge = c.id;
        entry.badge.dataset.messageAction = 'open';
        entry.badge.dataset.messageCharacter = c.id;
        entry.badge.innerHTML =
          Messages.envelope + '<span class="message-unread-dot" aria-hidden="true"></span>';
        (c.hud.expanded ? root : root.querySelector('.hud-collapsed')).append(entry.badge);
      }
      const label = (m.unread ? 'Unread message' : 'Message') + ' for ' + c.name + '. Open message';
      entry.badge.setAttribute('aria-label', label);
      entry.badge.title = m.unread ? 'Unread message from DM' : 'Message from DM';
      entry.badge.classList.toggle('is-unread', m.unread);
      entry.badge.disabled = !state.settings.overlayInteractive;
      if (m.available && !this.pulses.has(m.messageId)) this.pulses.set(m.messageId, Date.now());
      const elapsed = Date.now() - (this.pulses.get(m.messageId) || 0);
      entry.badge.classList.toggle('message-pulse', m.unread && elapsed < 5000);
      if (m.available && entry.badge.dataset.pulseId !== m.messageId) {
        entry.badge.dataset.pulseId = m.messageId;
        entry.badge.style.animationDelay = -elapsed + 'ms';
      }
      if (!m.open || !m.available || entry.suspended) {
        const focused = entry.frame?.contains(document.activeElement);
        entry.frame?.remove();
        entry.frame = null;
        if ((focused || entry.focus) && state.settings.overlayInteractive)
          entry.badge.focus({ preventScroll: true });
        entry.focus = '';
        continue;
      }
      if (!entry.frame) {
        entry.frame = document.createElement('div');
        entry.frame.className = 'message-position';
        entry.frame.dataset.messageCharacter = c.id;
        entry.frame.innerHTML = `<section class="message-panel" role="region" data-message-character="${HUD.esc(c.id)}"><header><h2></h2><button type="button" data-message-action="close">Close</button></header><div class="message-text" tabindex="0" aria-label="Message text"></div><footer><button type="button" data-message-action="previous" aria-label="Previous message page">←</button><span data-message-page></span><button type="button" data-message-action="next" aria-label="Next message page">→</button></footer></section>`;
        entry.frame.addEventListener(
          'scroll',
          () => {
            entry.scroll = entry.frame?.querySelector('.message-text')?.scrollTop || 0;
          },
          true
        );
        this.layer.append(entry.frame);
      }
      const frame = entry.frame,
        size = this.dimensions(c);
      HUDThemes.apply(frame, c.theme);
      frame.style.width = size.width + 'px';
      frame.style.height = size.height + 'px';
      frame.style.setProperty('--message-font', size.font + 'px');
      frame.style.setProperty('--message-padding', size.padding + 'px');
      frame.style.zIndex = m.order;
      frame.dataset.expanded = String(c.hud.expanded);
      let position;
      if (c.hud.expanded) {
        const r = root.getBoundingClientRect(),
          angle = (c.hud.rotation * Math.PI) / 180;
        position = {
          x: r.left + r.width / 2 - Math.sin(angle) * 25 * c.hud.scale,
          y: r.top + r.height / 2 + Math.cos(angle) * 25 * c.hud.scale,
        };
      } else position = TL.fitHud(c.hud, size.width, size.height, innerWidth, innerHeight);
      frame.style.left = position.x + 'px';
      frame.style.top = position.y + 'px';
      frame.style.transform = `translate(-50%, -50%) rotate(${c.hud.rotation}deg) scale(${c.hud.scale})`;
      frame.querySelector('h2').textContent = 'Message for ' + c.name;
      frame.querySelector('section').setAttribute('aria-label', 'Message for ' + c.name);
      const area = frame.querySelector('.message-text');
      if (entry.body) {
        const text = Messages.pages(entry.body.body)[m.page];
        if (area.textContent !== text || area.querySelector('button')) area.textContent = text;
      } else if (entry.error) {
        area.innerHTML =
          '<p>Unable to load this message.</p><button type="button" data-message-action="retry">Retry</button>';
      } else area.textContent = 'Opening message…';
      area.scrollTop = entry.scroll;
      if (entry.body && m.scrollSequence > entry.scrollSequence) {
        area.scrollTop += m.scrollDirection * Math.max(30, area.clientHeight * 0.75);
        entry.scroll = area.scrollTop;
        entry.scrollSequence = m.scrollSequence;
      }
      frame.querySelector('[data-message-page]').textContent =
        `Page ${m.page + 1} of ${m.pageCount}`;
      for (const button of frame.querySelectorAll('button'))
        button.disabled = !state.settings.overlayInteractive;
      frame.querySelector('[data-message-action="previous"]').disabled ||= m.page === 0;
      frame.querySelector('[data-message-action="next"]').disabled ||= m.page === m.pageCount - 1;
      area.tabIndex = state.settings.overlayInteractive ? 0 : -1;
      if (entry.focus && state.settings.overlayInteractive) {
        const control = frame.querySelector(
          `[data-message-action="${entry.focus}"]:not(:disabled)`
        );
        (control || area).focus({ preventScroll: true });
        entry.focus = '';
      }
      if (!entry.body && !entry.error && !entry.fetching) this.fetch(entry);
    }
    for (const [id, entry] of this.entries)
      if (!active.has(id)) {
        this.remove(entry);
        this.entries.delete(id);
      }
    for (const id of this.pulses.keys())
      if (!this.client.state.messages.some((m) => m.messageId === id)) this.pulses.delete(id);
    this.changed();
    cancelAnimationFrame(this.paintFrame);
    this.paintFrame = requestAnimationFrame(() => {
      this.paintFrame = requestAnimationFrame(() => this.acknowledge());
    });
  }
  async fetch(entry) {
    const target = this.client.target(entry.id),
      key = entry.key;
    entry.fetching = true;
    try {
      const body = await this.api.messageBody(target);
      if (
        this.stopped ||
        !this.client.current(body) ||
        entry.key !== key ||
        !this.client.message(entry.id)?.open
      )
        return;
      entry.body = body;
    } catch {
      if (entry.key === key) entry.error = 'Unable to load';
      await this.client.refresh().catch(() => {});
    } finally {
      if (entry.key === key) entry.fetching = false;
      this.render();
    }
  }
  visible(element) {
    if (!element?.isConnected || document.visibilityState !== 'visible') return false;
    const r = element.getBoundingClientRect();
    return (
      r.width > 0 &&
      r.height > 0 &&
      r.right > 0 &&
      r.bottom > 0 &&
      r.left < innerWidth &&
      r.top < innerHeight
    );
  }
  acknowledge() {
    if (this.stopped) return;
    for (const entry of this.entries.values()) {
      const m = this.client.message(entry.id);
      if (!m?.available || entry.ackError || entry.suspended) continue;
      const opened =
        m.open &&
        entry.body &&
        this.client.current(entry.body) &&
        this.visible(entry.frame?.querySelector('.message-text'));
      const type =
        opened && !m.bodyVisible
          ? 'ack-opened'
          : !m.indicatorVisible && this.visible(entry.badge)
            ? 'ack-indicator'
            : '';
      const key = entry.key + type;
      if (!type || this.inFlight.has(key)) continue;
      this.inFlight.add(key);
      this.client
        .command(type, entry.id, opened ? { bodyToken: entry.body.bodyToken } : {})
        .catch(() => {
          if (key === entry.key + type) entry.ackError = key;
        })
        .finally(() => this.inFlight.delete(key));
    }
  }
  frames() {
    return [...this.entries.values()]
      .filter((e) => e.frame?.isConnected && e.frame.dataset.expanded === 'false')
      .map((e) => {
        const r = e.frame.getBoundingClientRect(),
          c = this.getState().characters.find((c) => c.id === e.id);
        return {
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
          width: e.frame.offsetWidth * c.hud.scale,
          height: e.frame.offsetHeight * c.hud.scale,
          rotation: c.hud.rotation,
        };
      });
  }
  async act(type, id, values = {}) {
    try {
      await this.client.command(type, id, values);
    } catch {
      this.report('That message changed or is unavailable. Try its current controls.');
    }
  }
  async handleClick(event) {
    const button = event.target.closest('[data-message-action]');
    if (!button || button.disabled || !this.getState()?.settings.overlayInteractive) return;
    event.stopPropagation();
    const id = button.closest('[data-message-character]').dataset.messageCharacter;
    const action = button.dataset.messageAction,
      m = this.client.message(id);
    if (!m) return;
    if (action === 'retry') {
      const entry = this.entries.get(id);
      entry.error = '';
      entry.ackError = '';
      this.render();
      return;
    }
    const target = this.client.target(id);
    await this.act(
      ['previous', 'next'].includes(action) ? 'page' : action,
      id,
      action === 'previous' ? { page: m.page - 1 } : action === 'next' ? { page: m.page + 1 } : {}
    );
    if (action === 'open' && this.client.message(id)?.messageId === target.messageId)
      this.entries
        .get(id)
        ?.frame?.querySelector('[data-message-action="close"]')
        ?.focus({ preventScroll: true });
  }
  drag(id) {
    const entry = this.entries.get(id);
    if (!entry || !this.client.message(id)?.open) return;
    entry.suspended = true;
    entry.frame?.remove();
    entry.frame = null;
    this.act('close', id).finally(() => {
      entry.suspended = false;
      this.render();
    });
  }
}
