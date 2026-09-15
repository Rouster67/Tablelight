/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test'),
  assert = require('node:assert/strict');
const TL = require('../core');
const { Service } = require('../approval-service');
function setup(options) {
  const state = TL.empty(),
    c = TL.character();
  c.id = 'player';
  c.notes = 'DM SECRET';
  c.resources = [{ id: 'charges', current: 5, max: 5, name: 'Charges', reset: 'long' }];
  state.characters = [c];
  state.settings.overlayInteractive = true;
  const it = TL.createLocalItem(
    state,
    c.id,
    { name: 'Manual ability', economy: 'free' },
    { resourceId: 'charges', resourceCost: 2 }
  );
  return { service: new Service(state, options), itemId: it.id };
}
const cmd = (s, type, values = {}) => ({
  sessionId: s.snapshot().approvals.id,
  commandId: TL.uid(),
  type,
  ...values,
});
const use = (s, itemId) => s.hud(cmd(s, 'use', { characterId: 'player', itemId }));
test('the main-process owner projects only player data and survives renderer reload reads', async () => {
  const { service: s, itemId } = setup();
  await use(s, itemId);
  const projected = s.overlayState();
  assert.equal(projected.characters[0].resources[0].current, 3);
  assert.equal(projected.characters[0].notes, undefined);
  assert.equal(projected.approvals, undefined);
  assert.equal(projected.library, undefined);
  assert.equal(projected.characters[0].pendingRequests.length, 1);
  const reload = s.snapshot();
  assert.equal(reload.state.characters[0].resources[0].current, 5);
  assert.equal(reload.approvals.pending.length, 1);
  assert.equal(reload.undoCount, 0);
});
test('overlay commands cannot approve, edit party state, use DM controls or confirm a DM edit', async () => {
  const { service: s, itemId } = setup();
  const r = await use(s, itemId);
  await assert.rejects(
    s.command(cmd(s, 'approve', { requestId: r.result.requestId }), 'overlay'),
    /Only the DM/
  );
  await assert.rejects(s.hud(cmd(s, 'interactive')), /DM window/);
  await assert.rejects(s.change({ edited: s.snapshot().state }, 'overlay'), /Only the DM/);
  const base = s.snapshot().state,
    edited = TL.clone(base);
  edited.characters[0].resources[0].current = 1;
  const preview = await s.change({ base, edited });
  await assert.rejects(
    s.hud(cmd(s, 'confirm-change', { confirmationId: preview.result.confirmationId })),
    /Review it again/
  );
  assert.equal(s.snapshot().state.characters[0].resources[0].current, 5);
});
test('conflicting overlay corrections wait for their own confirmation; cancel keeps costs and requests', async () => {
  const { service: s, itemId } = setup();
  await use(s, itemId);
  const preview = await s.hud(
    cmd(s, 'resource', { characterId: 'player', resourceId: 'charges', amount: -1 })
  );
  assert.equal(preview.result.status, 'confirmation-required');
  await s.hud(cmd(s, 'cancel-change', { confirmationId: preview.result.confirmationId }));
  assert.equal(s.snapshot().approvals.pending.length, 1);
  assert.equal(s.snapshot().state.characters[0].resources[0].current, 5);
  const again = await s.hud(
    cmd(s, 'resource', { characterId: 'player', resourceId: 'charges', amount: -1 })
  );
  await s.hud(cmd(s, 'confirm-change', { confirmationId: again.result.confirmationId }));
  assert.equal(s.snapshot().approvals.pending.length, 0);
  assert.equal(s.snapshot().state.characters[0].resources[0].current, 4);
});
test('editor deltas preserve later overlay HP spending and unrelated requests', async () => {
  const { service: s, itemId } = setup();
  const base = s.snapshot().state,
    edited = TL.clone(base);
  edited.characters[0].name = 'Edited name';
  await use(s, itemId);
  await s.hud(cmd(s, 'hp', { characterId: 'player', amount: -3 }));
  await s.change({ base, edited });
  assert.equal(s.snapshot().state.characters[0].name, 'Edited name');
  assert.equal(s.snapshot().state.characters[0].hp, base.characters[0].hp - 3);
  assert.equal(s.snapshot().approvals.pending.length, 1);
});
test('save failures and duplicate approval delivery do not duplicate spending or ordinary Undo entries', async () => {
  let fail = true,
    saves = 0;
  const { service: s, itemId } = setup({
    save: async () => {
      if (fail) throw Error('disk full');
      saves++;
    },
  });
  const r = await use(s, itemId),
    approve = cmd(s, 'approve', { requestId: r.result.requestId });
  await assert.rejects(s.command(approve), /disk full/);
  assert.equal(s.snapshot().undoCount, 0);
  assert.equal(s.snapshot().approvals.pending.length, 1);
  fail = false;
  await s.command(approve);
  await s.command(approve);
  assert.equal(saves, 1);
  assert.equal(s.snapshot().undoCount, 1);
  await s.undo();
  assert.equal(s.snapshot().state.characters[0].resources[0].current, 5);
  assert.equal(s.snapshot().undoCount, 0);
});
test('restoring a backup confirms even costless requests, clears session data, and remains undoable', async () => {
  const { service: s } = setup();
  const edited = s.snapshot().state;
  const free = TL.createLocalItem(edited, 'player', { name: 'Costless', economy: 'free' });
  await s.change({ edited });
  await use(s, free.id);
  const oldId = s.snapshot().approvals.id;
  const blank = TL.empty();
  const preview = await s.change({ edited: blank, restore: true });
  assert.equal(preview.result.affected[0].status, 'denied');
  await s.command(cmd(s, 'confirm-change', { confirmationId: preview.result.confirmationId }));
  assert.notEqual(s.snapshot().approvals.id, oldId);
  assert.equal(s.snapshot().approvals.pending.length, 0);
  assert.equal(s.snapshot().approvals.history.length, 0);
  await s.undo();
  assert.equal(s.snapshot().state.characters.length, 1);
});

test('restoring a reserved action uses the displayed intent instead of toggling the actual counter', async () => {
  const { service: s } = setup();
  const edited = s.snapshot().state;
  const action = TL.createLocalItem(edited, 'player', { name: 'Action', economy: 'action' });
  await s.change({ edited });
  await use(s, action.id);
  const warning = await s.hud(
    cmd(s, 'economy', { characterId: 'player', key: 'action', ready: true })
  );
  assert.equal(warning.result.status, 'confirmation-required');
  await s.hud(cmd(s, 'confirm-change', { confirmationId: warning.result.confirmationId }));
  assert.equal(s.snapshot().state.characters[0].turn.action, true);
  assert.equal(s.snapshot().approvals.pending.length, 0);
});

test('reordering the party preserves later HP edits when the controller snapshot is older', async () => {
  const { service: s } = setup();
  const setupState = s.snapshot().state;
  setupState.characters.push({ ...TL.character(), id: 'second' });
  await s.change({ edited: setupState });
  const base = s.snapshot().state,
    edited = TL.clone(base);
  edited.characters.reverse();
  await s.hud(cmd(s, 'hp', { characterId: 'player', amount: -2 }));
  await s.change({ base, edited });
  assert.deepEqual(
    s.snapshot().state.characters.map((c) => c.id),
    ['second', 'player']
  );
  assert.equal(s.snapshot().state.characters[1].hp, base.characters[0].hp - 2);
});

test('returning an assignment from local to shared preserves concurrent HP changes', async () => {
  const { service: s } = setup();
  const initial = s.snapshot().state;
  const definition = TL.libraryEntry({ name: 'Shared' });
  initial.library.push(definition);
  const assigned = TL.attachItem(initial, 'player', definition.id);
  await s.change({ edited: initial });
  const shared = s.snapshot().state,
    local = TL.clone(shared);
  TL.deleteLibraryEntry(local, definition.id, ['player']);
  await s.change({ edited: local });
  const base = s.snapshot().state;
  await s.hud(cmd(s, 'hp', { characterId: 'player', amount: -2 }));
  await s.change({ base, edited: shared });
  const c = s.snapshot().state.characters[0],
    it = c.items.find((it) => it.id === assigned.id);
  assert.equal(it.local, undefined);
  assert.equal(it.libraryId, definition.id);
  assert.equal(c.hp, shared.characters[0].hp - 2);
});

test('a flush before installing an update verifies a write even if no counters have changed', async () => {
  let fail = true;
  const { service: s } = setup({
    save: async () => {
      if (fail) throw Error('disk full');
    },
  });
  const before = s.snapshot();
  await assert.rejects(s.flush(), /disk full/);
  assert.deepEqual(s.snapshot(), before);
  fail = false;
  await s.flush();
  assert.deepEqual(s.snapshot(), before);
});
