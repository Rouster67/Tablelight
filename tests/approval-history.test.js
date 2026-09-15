/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test'),
  assert = require('node:assert/strict');
const TL = require('../core'),
  { Service } = require('../approval-service');
function setup(options = {}) {
  const state = TL.empty(),
    ids = {};
  state.settings.overlayInteractive = true;
  for (const id of ['a', 'b']) {
    const c = TL.character();
    c.id = id;
    c.resources = [{ id: 'pool', name: 'Special charges', current: 5, max: 5, reset: 'long' }];
    c.slots[0] = { level: 1, current: 5, max: 5 };
    state.characters.push(c);
    ids[id] = {};
    for (const [name, fields, binding] of [
      ['two', {}, { resourceId: 'pool', resourceCost: 2 }],
      ['one', {}, { resourceId: 'pool', resourceCost: 1 }],
      ['slot', { kind: 'spell', level: 1 }, {}],
      [
        'combined',
        { kind: 'spell', level: 1, economy: 'action', requiresConcentration: true },
        { resourceId: 'pool', resourceCost: 2 },
      ],
      ['focus', { requiresConcentration: true }, {}],
      ['free', {}, {}],
      ['reaction', { economy: 'reaction' }, {}],
    ])
      ids[id][name] = TL.createLocalItem(
        state,
        id,
        {
          name,
          economy: 'free',
          description: 'Original description',
          source: 'Original reference',
          ...fields,
        },
        binding
      ).id;
  }
  return { service: new Service(state, options), ids };
}
const cmd = (s, type, args = {}) => ({
  sessionId: s.snapshot().approvals.id,
  commandId: TL.uid(),
  type,
  ...args,
});
const current = (s, id = 'a') => TL.findCharacter(s.snapshot().state, id);
const entry = (s, id) => s.snapshot().approvals.history.find((r) => r.id === id);
const charges = (s, id = 'a') => current(s, id).resources[0].current;
const change = (s, mutate, events = []) => {
  const base = s.snapshot().state,
    edited = TL.clone(base);
  mutate(edited);
  return s.change({ base, edited, events });
};
async function request(s, itemId, characterId = 'a', level) {
  const c = current(s, characterId),
    it = c.items.find((it) => it.id === itemId);
  const response = await s.hud(
    cmd(s, 'use', {
      characterId,
      itemId,
      level,
      confirmedConcentration: TL.concentrationUseWarning(c, it)?.token || '',
    })
  );
  return response.result.requestId;
}
async function approve(s, itemId, characterId = 'a', level) {
  const id = await request(s, itemId, characterId, level);
  const c = current(s, characterId),
    it = c.items.find((it) => it.id === itemId);
  await s.command(
    cmd(s, 'approve', {
      requestId: id,
      confirmedConcentration: TL.concentrationUseWarning(c, it)?.token || '',
    })
  );
  return id;
}
const undoUse = (s, id) => s.command(cmd(s, 'undo-use', { requestId: id }));

test('targeted refunds preserve later spending, HP, movement, notes, placements, and another character', async () => {
  const { service: s, ids } = setup();
  const a = await approve(s, ids.a.two),
    b = await approve(s, ids.a.one);
  await approve(s, ids.b.two, 'b');
  await change(s, (state) => {
    const c = state.characters[0];
    c.hp = 4;
    c.turn.movement = 15;
    c.notes = 'Later note';
    c.hud.rotation = 35;
    c.items.find((it) => it.id === ids.a.two).resourceCost = 4;
    c.items.find((it) => it.id === ids.a.two).description = 'Changed later';
  });
  const before = s.snapshot().state;
  await undoUse(s, a);
  assert.equal(charges(s), 4);
  assert.equal(entry(s, a).status, 'undone');
  assert.equal(entry(s, b).status, 'approved');
  const expected = TL.clone(before);
  expected.characters[0].resources[0].current = 4;
  assert.deepEqual(s.snapshot().state, expected);
  await undoUse(s, b);
  assert.equal(charges(s), 5);
  await assert.rejects(undoUse(s, a), /already been undone/);
});

test('selected spell slots and later direct DM uses retain independent recorded deductions', async () => {
  const { service: s, ids } = setup();
  const a = await approve(s, ids.a.slot, 'a', 1);
  await s.command(cmd(s, 'direct-use', { characterId: 'a', itemId: ids.a.slot, slotLevel: 1 }));
  const b = await approve(s, ids.a.slot, 'a', 1);
  await undoUse(s, a);
  assert.equal(current(s).slots[0].current, 3);
  await undoUse(s, b);
  assert.equal(current(s).slots[0].current, 4);
  assert.equal(s.snapshot().approvals.history.length, 2);
});

for (const [name, mutate, events] of [
  [
    'manual correction',
    (c) => {
      c.resources[0].current++;
    },
    [],
  ],
  [
    'capacity change',
    (c) => {
      c.resources[0].max++;
    },
    [],
  ],
  [
    'same-value reset',
    () => {},
    [{ type: 'adjust', characterId: 'a', kind: 'resource', key: 'pool' }],
  ],
  ['long rest', (c) => TL.rest(c, 'long'), [{ type: 'rest', characterId: 'a', restType: 'long' }]],
  ['new turn', (c) => TL.startTurn(c), [{ type: 'new-turn', characterId: 'a' }]],
  [
    'later concentration',
    (c) => {
      c.concentrating = false;
      c.concentrationItemId = '';
      c.concentration = '';
    },
    [],
  ],
])
  test(`${name} blocks the entire combined refund, without partially returning other costs`, async () => {
    const { service: s, ids } = setup();
    const id = await approve(s, ids.a.combined, 'a', 1);
    await change(s, (state) => mutate(state.characters[0]), events);
    const before = s.snapshot();
    assert.ok(entry(s, id).undoReason);
    await assert.rejects(undoUse(s, id));
    assert.deepEqual(s.snapshot(), before);
  });

test('restoring matching values does not erase a correction or concentration replacement', async () => {
  const { service: s, ids } = setup();
  const id = await approve(s, ids.a.two);
  await change(s, (state) => {
    state.characters[0].resources[0].current = 4;
  });
  await change(s, (state) => {
    state.characters[0].resources[0].current = 3;
  });
  await assert.rejects(undoUse(s, id), /reset, correction, or edit/);
  const focus = await approve(s, ids.a.focus);
  const next = await approve(s, ids.a.combined, 'a', 1);
  await undoUse(s, next);
  assert.equal(current(s).concentrationItemId, ids.a.focus);
  await assert.rejects(undoUse(s, focus), /Concentration changed/);
});

test('concentration undo restores the prior focus, but refuses a deleted prior ability', async () => {
  const { service: s, ids } = setup();
  await approve(s, ids.a.focus);
  const id = await approve(s, ids.a.combined, 'a', 1);
  await change(s, (state) => {
    state.characters[0].items.find((it) => it.id === ids.a.focus).name = 'Renamed prior focus';
  });
  await undoUse(s, id);
  assert.equal(current(s).concentrationItemId, ids.a.focus);
  assert.equal(current(s).concentration, 'Renamed prior focus');
  await s.undo();
  await change(s, (state) => {
    state.characters[0].items = state.characters[0].items.filter((it) => it.id !== ids.a.focus);
  });
  const before = s.snapshot();
  await assert.rejects(undoUse(s, id), /previous concentration ability/);
  assert.deepEqual(s.snapshot(), before);
});

test('History keeps only five outcomes without refunding evicted uses; restart keeps saved spending only', async () => {
  const saved = [],
    { service: s, ids } = setup({ save: async (state) => saved.push(state) });
  const first = await approve(s, ids.a.one),
    outcomes = [];
  for (const type of ['deny', 'cancel', 'expire', 'deny', 'cancel']) {
    const id = await request(s, ids.a.free);
    if (type === 'expire') {
      const preview = await change(s, (state) => TL.startTurn(state.characters[0]), [
        { type: 'new-turn', characterId: 'a' },
      ]);
      await s.command(cmd(s, 'confirm-change', { confirmationId: preview.result.confirmationId }));
    } else if (type === 'cancel')
      await s.hud(cmd(s, 'cancel-request', { characterId: 'a', requestId: id }));
    else await s.command(cmd(s, 'deny', { requestId: id }));
    outcomes.unshift(type === 'expire' ? 'expired' : type === 'cancel' ? 'canceled' : 'denied');
  }
  assert.deepEqual(
    s.snapshot().approvals.history.map((r) => r.status),
    outcomes
  );
  assert.equal(charges(s), 4);
  await assert.rejects(undoUse(s, first), /no longer in History/);
  assert.ok(saved.every((state) => !state.approvals && !state.history && !state.pending));
  const restarted = new Service(s.snapshot().state);
  assert.equal(charges(restarted), 4);
  assert.equal(restarted.snapshot().approvals.history.length, 0);
});

test('Reconsider uses current definitions and binding costs, opens only one fresh attempt, and preserves urgent ordering', async () => {
  const { service: s, ids } = setup();
  const old = await request(s, ids.a.two);
  await s.command(cmd(s, 'deny', { requestId: old }));
  await change(s, (state) => {
    const it = state.characters[0].items.find((it) => it.id === ids.a.two);
    it.name = 'Latest name';
    it.resourceCost = 1;
  });
  const other = await request(s, ids.b.free, 'b'),
    urgent = await request(s, ids.b.reaction, 'b');
  const attempts = await Promise.allSettled([
    s.command(cmd(s, 'reconsider', { requestId: old })),
    s.command(cmd(s, 'reconsider', { requestId: old })),
  ]);
  assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
  const id = attempts[0].value.result.requestId;
  assert.notEqual(id, old);
  assert.equal(entry(s, old).reconsideredAs, id);
  const latest = s.snapshot().approvals.pending.find((r) => r.id === id);
  assert.equal(latest.ability.name, 'Latest name');
  assert.equal(latest.costs[0].amount, 1);
  await request(s, ids.a.free);
  assert.deepEqual(
    s
      .snapshot()
      .approvals.pending.map((r) => r.id)
      .slice(0, 3),
    [urgent, id, other]
  );
  assert.equal(s.overlayState().characters[0].resources[0].current, 4);
  assert.equal(charges(s), 5);
});

test('Reconsider respects capacity and current slot requirements, and never guesses a missing assignment', async () => {
  const { service: s, ids } = setup();
  const id = await request(s, ids.a.slot, 'a', 1);
  await s.command(cmd(s, 'deny', { requestId: id }));
  const pending = [];
  for (let i = 0; i < 3; i++) pending.push(await request(s, ids.b.free, 'b'));
  await assert.rejects(s.command(cmd(s, 'reconsider', { requestId: id })), /super busy/);
  await s.command(cmd(s, 'deny', { requestId: pending[0] }));
  await change(s, (state) => {
    state.characters[0].items.find((it) => it.id === ids.a.slot).level = 2;
  });
  await assert.rejects(s.command(cmd(s, 'reconsider', { requestId: id })), /valid spell slot/);
  await change(s, (state) => {
    state.characters[0].items = state.characters[0].items.filter((it) => it.id !== ids.a.slot);
  });
  await assert.rejects(
    s.command(cmd(s, 'reconsider', { requestId: id })),
    /no longer has the ability/
  );
  assert.equal(entry(s, id).reconsideredAs, undefined);
});

test('ordinary Undo reverses targeted undo and approvals without duplicate refunds or stale labels', async () => {
  const { service: s, ids } = setup();
  const a = await approve(s, ids.a.two),
    b = await approve(s, ids.a.one);
  await undoUse(s, a);
  assert.equal(charges(s), 4);
  await s.undo();
  assert.equal(charges(s), 2);
  assert.equal(entry(s, a).status, 'approved');
  assert.equal(entry(s, a).undoReason, '');
  await s.undo();
  assert.equal(charges(s), 3);
  assert.equal(entry(s, b).status, 'undone');
  assert.equal(entry(s, a).undoReason, '');
  await s.undo();
  assert.equal(charges(s), 5);
  assert.equal(entry(s, a).status, 'undone');
  assert.equal(s.snapshot().undoCount, 0);
  await assert.rejects(undoUse(s, a), /already been undone/);
});

test('costless uses and reversals still participate in ordinary Undo; repeated commands apply once', async () => {
  const { service: s, ids } = setup();
  const id = await approve(s, ids.a.free);
  assert.equal(s.snapshot().undoCount, 1);
  const undo = cmd(s, 'undo-use', { requestId: id });
  await s.command(undo);
  await s.command(undo);
  assert.equal(s.snapshot().undoCount, 2);
  await s.undo();
  assert.equal(entry(s, id).status, 'approved');
  await s.undo();
  assert.equal(entry(s, id).status, 'undone');
  assert.equal(s.snapshot().undoCount, 0);
});

test('targeted undo warns before changing dependent pending requests; cancel and stale confirmation are safe', async () => {
  const { service: s, ids } = setup();
  const id = await approve(s, ids.a.two),
    pending = await request(s, ids.a.one);
  const preview = await undoUse(s, id);
  assert.equal(preview.result.status, 'confirmation-required');
  assert.equal(charges(s), 3);
  await s.command(cmd(s, 'cancel-change', { confirmationId: preview.result.confirmationId }));
  assert.equal(entry(s, id).status, 'approved');
  const stale = await undoUse(s, id);
  await change(s, (state) => {
    state.characters[1].hp--;
  });
  await assert.rejects(
    s.command(cmd(s, 'confirm-change', { confirmationId: stale.result.confirmationId })),
    /changed/
  );
  const ready = await undoUse(s, id);
  await s.command(cmd(s, 'confirm-change', { confirmationId: ready.result.confirmationId }));
  assert.equal(charges(s), 5);
  assert.equal(entry(s, pending).status, 'denied');
  assert.equal(entry(s, id).status, 'undone');
  await s.undo();
  assert.equal(charges(s), 3);
  assert.equal(entry(s, id).status, 'approved');
  assert.equal(entry(s, pending).status, 'denied');
});

test('failed refunds preserve state, History, and ordinary Undo; retry is atomic', async () => {
  let fail = false;
  const { service: s, ids } = setup({
    save: async () => {
      if (fail) throw Error('disk full');
    },
  });
  const id = await approve(s, ids.a.combined, 'a', 1),
    before = s.snapshot();
  fail = true;
  const undo = cmd(s, 'undo-use', { requestId: id });
  await assert.rejects(s.command(undo), /disk full/);
  assert.deepEqual(s.snapshot(), before);
  fail = false;
  await s.command(undo);
  await s.command(undo);
  assert.equal(charges(s), 5);
  assert.equal(current(s).slots[0].current, 5);
  assert.equal(current(s).turn.action, true);
  assert.equal(current(s).concentrating, false);
  assert.equal(s.snapshot().undoCount, before.undoCount + 1);
});

test('only the DM can reconsider or refund, and inactive characters retain independent refunds', async () => {
  const { service: s, ids } = setup();
  const id = await approve(s, ids.a.two);
  for (const type of ['reconsider', 'undo-use'])
    await assert.rejects(s.command(cmd(s, type, { requestId: id }), 'overlay'), /Only the DM/);
  await change(s, (state) => TL.removeFromParty(state, 'a'));
  await undoUse(s, id);
  assert.equal(charges(s), 5);
  assert.equal(charges(s, 'b'), 5);
});
