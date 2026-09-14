/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core'));
  else root.TLApproval = factory(root.TL);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (TL) {
  'use strict';
  const ABILITY_LIMIT = 3,
    HISTORY_LIMIT = 5;
  const BUSY_MESSAGE = 'Hold up—the DM is super busy!';
  const copy = TL.clone;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const counterKey = (characterId, kind, key = '') => JSON.stringify([characterId, kind, key]);
  const concentration = (c) => ({
    active: c.concentrating,
    itemId: c.concentrationItemId,
    name: c.concentration,
  });
  const definitionKey = (it) =>
    JSON.stringify([
      ...TL.definitionFields.map((key) => it[key]),
      it.resourceId,
      it.resourceCost,
      it.disabled,
      it.libraryId,
      it.local === true,
    ]);

  function character(state, id) {
    const c = state.characters.find((c) => c.id === id);
    if (!c) throw new Error('This character is no longer in the active party.');
    return c;
  }
  function ability(c, id) {
    const it = c.items.find((it) => it.id === id);
    if (!it) throw new Error('This character no longer has the ability.');
    return it;
  }
  function costsFor(c, it, level) {
    const costs = [];
    if (it.economy !== 'free')
      costs.push({
        kind: 'turn',
        key: it.economy,
        amount: 1,
        label: { action: 'Action', bonus: 'Bonus action', reaction: 'Reaction' }[it.economy],
      });
    if (it.resourceId)
      costs.push({
        kind: 'resource',
        key: it.resourceId,
        amount: it.resourceCost,
        label: c.resources.find((r) => r.id === it.resourceId)?.name || 'Resource charges',
      });
    if (it.usesSlot && it.level > 0) {
      if (!Number.isInteger(level) || level < it.level || level > 9)
        throw new Error('Choose a valid spell slot level.');
      costs.push({ kind: 'slot', key: level, amount: 1, label: 'Level ' + level + ' spell slot' });
    } else if (level != null) throw new Error('This ability does not spend a standard spell slot.');
    const reason = TL.availability(c, it, level == null ? undefined : level);
    if (reason) throw new Error(reason);
    return costs;
  }
  function valueOf(c, cost) {
    if (cost.kind === 'turn') return Number(c.turn[cost.key]);
    if (cost.kind === 'resource') return c.resources.find((r) => r.id === cost.key)?.current;
    return c.slots.find((s) => s.level === cost.key)?.current;
  }
  function reserve(c, cost) {
    if (cost.kind === 'turn') c.turn[cost.key] = false;
    else {
      const pool =
        cost.kind === 'resource'
          ? c.resources.find((r) => r.id === cost.key)
          : c.slots.find((s) => s.level === cost.key);
      if (pool) pool.current = Math.max(0, pool.current - cost.amount);
    }
  }
  function counters(state) {
    const values = new Map();
    for (const c of TL.allCharacters(state)) {
      for (const key of ['action', 'bonus', 'reaction'])
        values.set(counterKey(c.id, 'turn', key), c.turn[key]);
      for (const s of c.slots)
        values.set(counterKey(c.id, 'slot', s.level), { current: s.current, max: s.max });
      for (const r of c.resources)
        values.set(counterKey(c.id, 'resource', r.id), {
          current: r.current,
          max: r.max,
          reset: r.reset,
          name: r.name,
        });
      values.set(counterKey(c.id, 'concentration'), concentration(c));
    }
    return values;
  }
  function invalidations(state, events) {
    const keys = new Set(),
      newTurns = new Set();
    for (const event of events) {
      const c = TL.findCharacter(state, event.characterId);
      if (!c) throw new Error('Choose a character for this change.');
      const turn = () =>
        ['action', 'bonus', 'reaction'].forEach((key) => keys.add(counterKey(c.id, 'turn', key)));
      if (event.type === 'new-turn') {
        newTurns.add(c.id);
        turn();
        for (const r of c.resources.filter((r) => r.reset === 'turn'))
          keys.add(counterKey(c.id, 'resource', r.id));
      } else if (event.type === 'rest' && ['short', 'long'].includes(event.restType)) {
        for (const r of c.resources.filter(
          (r) => r.reset === 'short' || (event.restType === 'long' && r.reset === 'long')
        ))
          keys.add(counterKey(c.id, 'resource', r.id));
        if (event.restType === 'long') {
          turn();
          for (const s of c.slots) keys.add(counterKey(c.id, 'slot', s.level));
          keys.add(counterKey(c.id, 'concentration'));
        }
      } else if (event.type === 'adjust') {
        const key = counterKey(c.id, event.kind, event.key ?? '');
        if (!counters(state).has(key)) throw new Error('Choose an existing counter to adjust.');
        keys.add(key);
      } else throw new Error('Unknown counter change.');
    }
    return { keys, newTurns };
  }

  // Session-only domain model. The caller supplies a save adapter and authenticates UI commands.
  // It is deliberately not connected to the running app until the complete approval UI is ready.
  class Session {
    #state;
    #id;
    #now;
    #save;
    #revision = 0;
    #pending = [];
    #history = [];
    #revisions = {};
    #tail = Promise.resolve();
    #completed = new Map();
    #prepared = null;
    constructor(state, { save = async () => {}, now = Date.now } = {}) {
      if (typeof save !== 'function' || typeof now !== 'function')
        throw new Error('Invalid session adapter.');
      this.#state = TL.normalize(state);
      this.#id = TL.uid();
      this.#save = save;
      this.#now = now;
    }
    get id() {
      return this.#id;
    }
    snapshot() {
      return copy({
        state: this.#state,
        session: {
          id: this.#id,
          revision: this.#revision,
          pending: this.#pending,
          history: this.#history,
          revisions: this.#revisions,
        },
      });
    }
    projectCharacter(characterId) {
      const projected = copy(character(this.#state, characterId));
      for (const request of this.#pending.filter(
        (r) => r.kind === 'ability' && r.characterId === characterId
      ))
        for (const cost of request.costs) reserve(projected, cost);
      return projected;
    }
    playerView(characterId) {
      return {
        character: TL.overlayState({
          ...this.#state,
          characters: [this.projectCharacter(characterId)],
        }).characters[0],
        pending: copy(
          this.#pending
            .filter((r) => r.kind === 'ability' && r.characterId === characterId)
            .map((r) => ({
              id: r.id,
              itemId: r.itemId,
              name: r.ability.name,
              slotLevel: r.slotLevel,
              costs: r.costs,
              urgent: r.urgent,
              status: 'pending',
            }))
        ),
      };
    }
    review(requestId) {
      const request = this.#pending.find((r) => r.id === requestId);
      if (!request) throw new Error('This request is no longer pending.');
      let reason = '',
        warning = null;
      try {
        const c = character(this.#state, request.characterId),
          it = ability(c, request.itemId);
        if (definitionKey(it) !== request.definitionKey)
          throw new Error('This ability has changed. Request it again.');
        costsFor(c, it, request.slotLevel);
        warning = TL.concentrationUseWarning(c, it);
      } catch (error) {
        reason = error.message;
      }
      return copy({ request, reason, concentrationWarning: warning });
    }
    #serial(work) {
      const job = this.#tail.then(work);
      this.#tail = job.catch(() => {});
      return job;
    }
    #validateCommand(command) {
      if (!command || command.sessionId !== this.#id)
        throw new Error('This request belongs to an earlier session.');
      if (
        typeof command.commandId !== 'string' ||
        !command.commandId ||
        command.commandId.length > 100
      )
        throw new Error('A unique command ID is required.');
    }
    #replay(command, signature) {
      this.#validateCommand(command);
      const result = this.#completed.get(command.commandId);
      if (!result) return null;
      if (result.signature !== signature)
        throw new Error('This command ID was already used for a different action.');
      return { ...copy(result.value), replayed: true, revision: this.#revision };
    }
    #remember(command, signature, value) {
      this.#completed.set(command.commandId, { signature, value: copy(value) });
      return { ...copy(value), revision: this.#revision };
    }
    async #commit(state, pending, history, revisions) {
      // A failed write publishes neither costs nor resolution. Retrying starts from the same state.
      if (!same(state, this.#state)) await this.#save(copy(state));
      this.#state = state;
      this.#pending = pending;
      this.#history = history.slice(0, HISTORY_LIMIT);
      this.#revisions = revisions;
      this.#revision++;
      this.#prepared = null;
    }
    #resolve(request, status, extra = {}) {
      return { ...copy(request), status, resolvedAt: this.#now(), ...extra };
    }
    #mark(revisions, key, owner, invalidate = false) {
      const previous = revisions[key] || { epoch: 0 };
      revisions[key] = {
        epoch: previous.epoch + Number(invalidate),
        revision: this.#revision + 1,
        owner,
      };
      return copy(revisions[key]);
    }
    #applyUse(next, request, confirmedConcentration, revisions) {
      const c = character(next, request.characterId),
        it = ability(c, request.itemId);
      const before = request.costs.map((cost) => valueOf(c, cost)),
        priorConcentration = concentration(c);
      TL.spend(
        c,
        it,
        request.slotLevel == null ? undefined : request.slotLevel,
        confirmedConcentration || ''
      );
      const costs = request.costs.map((cost, index) => ({
        ...cost,
        amount: before[index] - valueOf(c, cost),
        before: before[index],
        after: valueOf(c, cost),
        marker: this.#mark(revisions, counterKey(c.id, cost.kind, cost.key), request.id),
      }));
      return {
        costs,
        concentration: it.requiresConcentration
          ? {
              before: priorConcentration,
              after: concentration(c),
              marker: this.#mark(revisions, counterKey(c.id, 'concentration'), request.id, true),
            }
          : null,
      };
    }
    dispatch(raw) {
      const command = copy(raw);
      return this.#serial(async () => {
        const {
          type,
          characterId,
          itemId,
          requestId,
          slotLevel = null,
          confirmedConcentration = '',
          confirmationId,
        } = command;
        const signature = JSON.stringify({
          type,
          characterId,
          itemId,
          requestId,
          slotLevel,
          confirmedConcentration,
          confirmationId,
        });
        const replay = this.#replay(command, signature);
        if (replay) return replay;
        let result;
        if (type === 'request') {
          const c = character(this.#state, characterId),
            it = ability(c, itemId),
            urgent = it.economy === 'reaction';
          if (
            !urgent &&
            this.#pending.filter((r) => r.kind === 'ability' && !r.urgent).length >= ABILITY_LIMIT
          )
            throw new Error(BUSY_MESSAGE);
          const costs = costsFor(this.projectCharacter(characterId), it, slotLevel);
          const warning = TL.concentrationUseWarning(c, it);
          if (warning && confirmedConcentration !== warning.token)
            throw new Error('Review the concentration warning before requesting this ability.');
          const request = {
            id: TL.uid(),
            kind: 'ability',
            source: 'overlay',
            status: 'pending',
            characterId,
            characterName: c.name,
            itemId,
            libraryId: it.libraryId,
            local: it.local === true,
            ability: TL.libraryEntry(it),
            definitionKey: definitionKey(it),
            slotLevel,
            costs,
            urgent,
            createdAt: this.#now(),
            sequence: this.#revision + 1,
          };
          const pending = [...this.#pending, request].sort(
            (a, b) => Number(b.urgent) - Number(a.urgent) || a.sequence - b.sequence
          );
          await this.#commit(this.#state, pending, this.#history, this.#revisions);
          result = { accepted: true, requestId: request.id };
        } else if (['approve', 'deny', 'cancel'].includes(type)) {
          const request = this.#pending.find((r) => r.id === requestId);
          if (!request) throw new Error('This request is no longer pending.');
          if (type === 'cancel' && characterId !== request.characterId)
            throw new Error('Only the requesting character can cancel this request.');
          const next = copy(this.#state),
            revisions = copy(this.#revisions);
          let receipt;
          if (type === 'approve') {
            const review = this.review(requestId);
            if (review.reason) throw new Error(review.reason);
            receipt = this.#applyUse(next, request, confirmedConcentration, revisions);
          }
          const status = { approve: 'approved', deny: 'denied', cancel: 'canceled' }[type];
          const resolved = this.#resolve(request, status, receipt ? { receipt } : {});
          await this.#commit(
            next,
            this.#pending.filter((r) => r.id !== requestId),
            [resolved, ...this.#history],
            revisions
          );
          result = { requestId, status };
        } else if (type === 'confirm-change' || type === 'cancel-change') {
          const plan = this.#prepared;
          if (!plan || plan.id !== confirmationId || plan.revision !== this.#revision)
            throw new Error('The session changed. Review this edit again before applying it.');
          if (type === 'confirm-change') await this.#applyChange(plan);
          else this.#prepared = null;
          result = { status: type === 'confirm-change' ? 'changed' : 'canceled-change' };
        } else if (type === 'direct-use') {
          const c = character(this.#state, characterId),
            it = ability(c, itemId);
          const request = {
            id: TL.uid(),
            characterId,
            itemId,
            slotLevel,
            costs: costsFor(c, it, slotLevel),
          };
          const next = copy(this.#state),
            revisions = copy(this.#revisions);
          this.#applyUse(next, request, confirmedConcentration, revisions);
          result = await this.#prepareChange(next, [], revisions);
        } else throw new Error('Unknown approval command.');
        return this.#remember(command, signature, result);
      });
    }
    change(raw, mutate, events = []) {
      const command = copy(raw),
        declaredEvents = copy(events);
      return this.#serial(async () => {
        const signature = JSON.stringify({ type: 'change', events: declaredEvents });
        const replay = this.#replay(command, signature);
        if (replay) return replay;
        if (typeof mutate !== 'function') throw new Error('A change function is required.');
        const draft = copy(this.#state);
        const returned = mutate(draft);
        if (returned && typeof returned.then === 'function')
          throw new Error('Changes must be synchronous.');
        const result = await this.#prepareChange(TL.normalize(draft), declaredEvents);
        return this.#remember(command, signature, result);
      });
    }
    async #prepareChange(next, events, spendRevisions) {
      const { keys, newTurns } = invalidations(this.#state, events);
      const beforeCounters = counters(this.#state),
        afterCounters = counters(next);
      for (const key of new Set([...beforeCounters.keys(), ...afterCounters.keys()]))
        if (!same(beforeCounters.get(key), afterCounters.get(key))) keys.add(key);
      const affected = this.#pending
        .filter((request) => {
          const c = next.characters.find((c) => c.id === request.characterId),
            it = c?.items.find((it) => it.id === request.itemId);
          return (
            newTurns.has(request.characterId) ||
            !it ||
            definitionKey(it) !== request.definitionKey ||
            request.costs.some((cost) =>
              keys.has(counterKey(request.characterId, cost.kind, cost.key))
            ) ||
            (it.requiresConcentration && keys.has(counterKey(c.id, 'concentration')))
          );
        })
        .map((request) => ({
          requestId: request.id,
          characterId: request.characterId,
          characterName: request.characterName,
          abilityName: request.ability.name,
          status: newTurns.has(request.characterId) ? 'expired' : 'denied',
          reason: newTurns.has(request.characterId)
            ? 'Expired — new turn'
            : 'Dependent data changed',
        }));
      const revisions = spendRevisions || copy(this.#revisions);
      if (!spendRevisions) for (const key of keys) this.#mark(revisions, key, null, true);
      const plan = { id: TL.uid(), revision: this.#revision, next, affected, revisions };
      if (affected.length) {
        this.#prepared = plan;
        return {
          status: 'confirmation-required',
          confirmationId: plan.id,
          affected: copy(affected),
        };
      }
      await this.#applyChange(plan);
      return { status: 'changed' };
    }
    async #applyChange(plan) {
      const affected = new Map(plan.affected.map((value) => [value.requestId, value]));
      const resolved = this.#pending
        .filter((r) => affected.has(r.id))
        .map((r) => {
          const { status, reason } = affected.get(r.id);
          return this.#resolve(r, status, { reason });
        });
      await this.#commit(
        plan.next,
        this.#pending.filter((r) => !affected.has(r.id)),
        [...resolved.reverse(), ...this.#history],
        plan.revisions
      );
    }
  }
  return { Session, ABILITY_LIMIT, HISTORY_LIMIT, BUSY_MESSAGE, counterKey };
});
