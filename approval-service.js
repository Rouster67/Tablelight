/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('./core'), require('./approval-session'));
  else root.TLApprovalService = factory(root.TL, root.TLApproval);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (TL, Approval) {
  'use strict';
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function eventsFor(command) {
    const characterId = command.characterId;
    if (command.type === 'turn') return [{ type: 'new-turn', characterId }];
    const keys = {
      economy: ['turn', command.key],
      slot: ['slot', command.level],
      resource: ['resource', command.resourceId],
      'resource-reset': ['resource', command.resourceId],
      concentration: ['concentration', ''],
    };
    const key = keys[command.type];
    return key ? [{ type: 'adjust', characterId, kind: key[0], key: key[1] }] : [];
  }
  // One owner for saved state, session requests, and ordinary Undo across window reloads.
  class Service {
    #session;
    #save;
    #tail = Promise.resolve();
    #undo = [];
    #preview = null;
    constructor(state, { save = async () => {}, onChange = () => {} } = {}) {
      this.#save = save;
      this.onChange = onChange;
      this.#session = new Approval.Session(state, { save });
    }
    snapshot() {
      const value = this.#session.snapshot();
      value.session.history = value.session.history.map((entry) => {
        const { undoReason, reconsiderReason } = this.#session.reviewHistory(entry.id);
        return { ...entry, undoReason, reconsiderReason };
      });
      return { state: value.state, approvals: value.session, undoCount: this.#undo.length };
    }
    overlayState() {
      const { state } = this.#session.snapshot();
      const result = TL.overlayState(state);
      result.characters = state.characters.map((c) => {
        const view = this.#session.playerView(c.id);
        return { ...view.character, pendingRequests: view.pending };
      });
      result.approvalSessionId = this.#session.id;
      return result;
    }
    #command(values = {}) {
      return { sessionId: this.#session.id, commandId: TL.uid(), ...values };
    }
    #serial(work) {
      const job = this.#tail.then(work);
      this.#tail = job.catch(() => {});
      return job;
    }
    async #run(work, meta) {
      const before = this.#session.snapshot();
      if (meta.actor === 'overlay' && !before.state.settings.overlayInteractive)
        throw new Error('The overlay is in click-through mode.');
      const result = await work();
      if (result.status === 'confirmation-required') {
        this.#preview = { ...meta, confirmationId: result.confirmationId };
        return { ...this.snapshot(), result };
      }
      const after = this.#session.snapshot();
      if (meta.undo && result.status === 'changed' && !result.replayed) this.#undo.pop();
      else if (
        !same(before.state, after.state) ||
        (['approve', 'undo-use'].includes(meta.kind) &&
          !same(before.session.history, after.session.history))
      ) {
        if (!result.replayed) {
          const requestId = meta.requestId || result.requestId;
          this.#undo.push({
            state: before.state,
            kind: meta.kind,
            requestId,
            historyEntry: before.session.history.find((entry) => entry.id === requestId),
          });
          if (this.#undo.length > 40) this.#undo.shift();
        }
      }
      if (meta.restore && !result.replayed) {
        this.#session = new Approval.Session(after.state, { save: this.#save });
      }
      if (after.session.revision !== before.session.revision || meta.restore) {
        this.#preview = null;
        this.onChange(this.snapshot(), { kind: meta.kind, requestId: result.requestId });
      }
      return { ...this.snapshot(), result };
    }
    change(raw, actor = 'dm') {
      const input = TL.clone(raw);
      return this.#serial(() => {
        if (actor !== 'dm') throw new Error('Only the DM can edit party data.');
        const { base, edited, events = [], restore = false } = input;
        // Normal editor saves merge only changed fields against the latest authoritative state.
        // Backup restore is an explicit replacement and invalidates every pending request.
        return this.#run(
          () =>
            this.#session.change(
              this.#command(input),
              (draft) => {
                const merged =
                  restore || !base || same(base, draft)
                    ? TL.clone(edited)
                    : TL.mergeChanges(base, edited, draft);
                if (base && !restore) {
                  for (const c of TL.allCharacters(edited)) {
                    const old = TL.findCharacter(base, c.id),
                      current = TL.findCharacter(merged, c.id);
                    for (const item of c.items) {
                      const original = old?.items.find((it) => it.id === item.id);
                      const target = current?.items.find((it) => it.id === item.id);
                      if (original && target && original.local !== item.local)
                        target.local = item.local === true;
                    }
                  }
                }
                const next = TL.normalize(merged);
                if (
                  base &&
                  !restore &&
                  !same(
                    base.characters.map((c) => c.id),
                    edited.characters.map((c) => c.id)
                  )
                ) {
                  const ids = edited.characters.map((c) => c.id);
                  next.characters.sort(
                    (a, b) =>
                      (ids.includes(a.id) ? ids.indexOf(a.id) : ids.length) -
                      (ids.includes(b.id) ? ids.indexOf(b.id) : ids.length)
                  );
                }
                Object.assign(draft, next);
              },
              restore ? [{ type: 'restore' }] : events
            ),
          { actor, kind: 'edit', restore }
        );
      });
    }
    command(raw, actor = 'dm') {
      const input = TL.clone(raw);
      return this.#serial(() => {
        if (['confirm-change', 'cancel-change'].includes(input.type)) {
          const preview = this.#preview;
          if (
            !preview ||
            preview.actor !== actor ||
            preview.confirmationId !== input.confirmationId
          )
            throw new Error('The pending change changed. Review it again.');
          return this.#run(() => this.#session.dispatch(input), {
            ...preview,
            restore: input.type === 'confirm-change' && preview.restore,
          });
        }
        if (actor === 'overlay') {
          if (!['request', 'cancel'].includes(input.type))
            throw new Error('Only the DM can resolve requests.');
        } else if (
          actor !== 'dm' ||
          !['approve', 'deny', 'direct-use', 'reconsider', 'undo-use'].includes(input.type)
        )
          throw new Error('Unknown DM approval control.');
        return this.#run(() => this.#session.dispatch(input), {
          actor,
          kind: input.type,
          requestId: input.requestId,
        });
      });
    }
    hud(raw) {
      const input = TL.clone(raw);
      if (input.type === 'use' || input.type === 'cancel-request')
        return this.command(
          {
            ...input,
            type: input.type === 'use' ? 'request' : 'cancel',
            slotLevel: input.level ?? null,
          },
          'overlay'
        );
      if (['confirm-change', 'cancel-change'].includes(input.type))
        return this.command(input, 'overlay');
      return this.#serial(() => {
        if (['interactive', 'prepare-update'].includes(input.type))
          throw new Error('This control is only available in the DM window.');
        return this.#run(
          () =>
            this.#session.change(
              this.#command(input),
              (draft) => {
                if (input.type === 'economy' && input.ready === undefined)
                  input.ready = !this.#session.projectCharacter(input.characterId).turn[input.key];
                TL.hudCommand(draft, input);
              },
              eventsFor(input)
            ),
          { actor: 'overlay', kind: 'hud' }
        );
      });
    }
    undo() {
      return this.#serial(() => {
        const entry = this.#undo.at(-1);
        if (!entry) return { ...this.snapshot(), result: { status: 'unchanged' } };
        return this.#run(() => this.#session.undoChange(this.#command(), entry), {
          actor: 'dm',
          kind: 'undo',
          undo: true,
        });
      });
    }
    flush() {
      return this.#serial(() => this.#save(this.#session.snapshot().state));
    }
  }
  return { Service, eventsFor };
});
