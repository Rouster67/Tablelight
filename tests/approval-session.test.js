/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  vm = require('node:vm');
const TL = require('../core'),
  { Store } = require('../storage');
const { Session, BUSY_MESSAGE, counterKey } = require('../approval-session');

function fixture(options = {}) {
  const state = TL.empty();
  state.library = [
    TL.libraryEntry({ name: 'Test attack', damage: 'Manual damage', source: 'My reference' }),
    TL.libraryEntry({ name: 'Test bonus', economy: 'bonus' }),
    TL.libraryEntry({ name: 'Test reaction', economy: 'reaction' }),
  ];
  for (let i = 0; i < 4; i++) {
    const c = TL.character(i);
    c.id = 'c' + i;
    c.resources = [{ id: 'pool-' + i, name: 'Charges ' + i, current: 5, max: 5, reset: 'long' }];
    c.slots[0] = { level: 1, current: 2, max: 2 };
    c.slots[2] = { level: 3, current: 2, max: 2 };
    Object.assign(c.hud, { rotation: i * 90, scale: 1.25, expanded: true });
    state.characters.push(c);
    for (const entry of state.library) TL.attachItem(state, c.id, entry.id);
    TL.createLocalItem(
      state,
      c.id,
      {
        name: 'Local special',
        economy: 'free',
        usesSlot: false,
        description: 'Manual rules',
        upgrades: 'Manual upgrades',
      },
      { resourceId: c.resources[0].id, resourceCost: 2 }
    );
    TL.createLocalItem(state, c.id, {
      name: 'Free spell',
      kind: 'spell',
      level: 1,
      economy: 'free',
    });
    TL.createLocalItem(
      state,
      c.id,
      {
        name: 'Focus spell',
        kind: 'spell',
        level: 1,
        economy: 'free',
        requiresConcentration: true,
      },
      { resourceId: c.resources[0].id }
    );
  }
  const normalized = TL.normalize(state);
  return { initial: normalized, session: new Session(normalized, options) };
}
let sequence = 0;
const command = (s, type, values = {}) => ({
  sessionId: s.id,
  commandId: 'test-' + ++sequence,
  type,
  ...values,
});
const itemId = (s, characterId, index) =>
  s.snapshot().state.characters.find((c) => c.id === characterId).items[index].id;
const request = (s, c = 'c0', index = 0, extra = {}) =>
  s.dispatch(
    command(s, 'request', {
      characterId: c,
      itemId: itemId(s, c, index),
      ...extra,
    })
  );
const resolve = (s, type, requestId, extra = {}) =>
  s.dispatch(command(s, type, { requestId, ...extra }));
const edit = (s, mutate, events = []) => s.change(command(s, 'change'), mutate, events);
const confirm = (s, preview) =>
  s.dispatch(command(s, 'confirm-change', { confirmationId: preview.confirmationId }));
const cancelEdit = (s, preview) =>
  s.dispatch(command(s, 'cancel-change', { confirmationId: preview.confirmationId }));

test('queued action and bonus reserve only projected costs; cancellation leaves actual state and saves intact', async () => {
  const writes = [],
    { initial, session: s } = fixture({ save: async (state) => writes.push(state) });
  const attack = await request(s),
    bonus = await request(s, 'c0', 1);
  assert.equal(s.projectCharacter('c0').turn.action, false);
  assert.equal(s.projectCharacter('c0').turn.bonus, false);
  assert.equal(s.projectCharacter('c0').turn.reaction, true);
  await assert.rejects(request(s), /Action already spent/);
  assert.deepEqual(s.snapshot().state, initial);
  assert.deepEqual(writes, []);
  await resolve(s, 'cancel', attack.requestId, { characterId: 'c0' });
  assert.equal(s.projectCharacter('c0').turn.action, true);
  assert.equal(s.projectCharacter('c0').turn.bonus, false);
  await resolve(s, 'deny', bonus.requestId);
  assert.deepEqual(s.projectCharacter('c0'), initial.characters[0]);
  assert.deepEqual(s.snapshot().state, initial);
  assert.deepEqual(writes, []);
});

test('three ordinary requests are a global cap; reactions remain independent, urgent and naturally limited', async () => {
  const { session: s } = fixture();
  for (let i = 0; i < 3; i++) await request(s, 'c' + i);
  const before = s.snapshot();
  await assert.rejects(request(s, 'c3'), (error) => error.message === BUSY_MESSAGE);
  assert.deepEqual(s.snapshot(), before);
  for (let i = 0; i < 4; i++) await request(s, 'c' + i, 2);
  const pending = s.snapshot().session.pending;
  assert.equal(pending.length, 7);
  assert.ok(pending.slice(0, 4).every((r) => r.urgent));
  assert.ok(pending.slice(4).every((r) => !r.urgent));
  await assert.rejects(request(s, 'c0', 2), /Reaction already spent/);
});

test('repeated free uses reserve their individual pools and slots and can be approved out of order', async () => {
  const { session: s } = fixture();
  const a = await request(s, 'c0', 3),
    b = await request(s, 'c0', 3);
  assert.notEqual(a.requestId, b.requestId);
  assert.equal(s.projectCharacter('c0').resources[0].current, 1);
  await assert.rejects(request(s, 'c0', 3), /Not enough/);
  await resolve(s, 'approve', b.requestId);
  assert.equal(s.snapshot().state.characters[0].resources[0].current, 3);
  assert.equal(s.projectCharacter('c0').resources[0].current, 1);
  await resolve(s, 'cancel', a.requestId, { characterId: 'c0' });
  assert.equal(s.projectCharacter('c0').resources[0].current, 3);
  const low = await request(s, 'c0', 4, { slotLevel: 1 });
  const high = await request(s, 'c0', 4, { slotLevel: 3 });
  assert.equal(s.projectCharacter('c0').slots[0].current, 1);
  assert.equal(s.projectCharacter('c0').slots[2].current, 1);
  await resolve(s, 'approve', high.requestId);
  await resolve(s, 'deny', low.requestId);
  assert.equal(s.snapshot().state.characters[0].slots[0].current, 2);
  assert.equal(s.snapshot().state.characters[0].slots[2].current, 1);
  assert.equal(s.snapshot().session.history[1].receipt.costs[0].label, 'Level 3 spell slot');
});

test('invalid slots, disabled abilities, inactive characters and wrong-character cancellations do not mutate anything', async () => {
  const { session: s } = fixture();
  const before = s.snapshot();
  for (const slotLevel of [undefined, 0, '1', 10, 1.5])
    await assert.rejects(request(s, 'c0', 4, { slotLevel }), /valid spell slot/);
  await assert.rejects(request(s, 'c0', 0, { slotLevel: 1 }), /does not spend/);
  await assert.rejects(
    s.dispatch(command(s, 'request', { characterId: 'missing', itemId: 'missing' })),
    /active party/
  );
  assert.deepEqual(s.snapshot(), before);
  const queued = await request(s);
  await assert.rejects(
    resolve(s, 'cancel', queued.requestId, { characterId: 'c1' }),
    /requesting character/
  );
  const warning = await edit(s, (state) => {
    state.characters[0].items[0].disabled = true;
  });
  await confirm(s, warning);
  await assert.rejects(request(s), /unavailable/);
  await edit(s, (state) => TL.removeFromParty(state, 'c3'));
  await assert.rejects(
    s.dispatch(
      command(s, 'request', { characterId: 'c3', itemId: before.state.characters[3].items[0].id })
    ),
    /active party/
  );
});

test('approvals record exact cost deltas and independent character definitions without changing placement', async () => {
  const { session: s } = fixture();
  await edit(s, (state) => {
    const c = state.characters[0];
    c.items[5].economy = 'bonus';
    c.items[5].resourceCost = 2;
    c.items[5].attack = 'My fixed attack';
  });
  const before = s.snapshot().state;
  const r = await request(s, 'c0', 5, { slotLevel: 3 });
  assert.equal(s.projectCharacter('c0').concentrating, false);
  await resolve(s, 'approve', r.requestId);
  const { state, session } = s.snapshot(),
    receipt = session.history[0].receipt;
  assert.deepEqual(
    receipt.costs.map((c) => [c.kind, c.before, c.after, c.amount]),
    [
      ['turn', 1, 0, 1],
      ['resource', 5, 3, 2],
      ['slot', 2, 1, 1],
    ]
  );
  assert.equal(session.history[0].ability.attack, 'My fixed attack');
  assert.equal(session.history[0].local, true);
  assert.deepEqual(state.characters[0].hud, before.characters[0].hud);
  assert.deepEqual(state.characters.slice(1), before.characters.slice(1));
  assert.deepEqual(state.library, before.library);
  assert.equal(state.characters[0].hp, before.characters[0].hp);
  assert.equal(receipt.concentration.before.active, false);
  assert.equal(receipt.concentration.after.itemId, itemId(s, 'c0', 5));
});

test('concentration is warned at admission and checked again on approval after another approved use', async () => {
  const { session: s } = fixture();
  await edit(s, (state) => {
    TL.createLocalItem(state, 'c0', {
      name: 'Other focus',
      economy: 'free',
      requiresConcentration: true,
    });
    TL.setConcentration(state.characters[0], true, state.characters[0].items[5].id);
  });
  const c = s.snapshot().state.characters[0],
    warning = TL.concentrationUseWarning(c, c.items[6]);
  await assert.rejects(request(s, 'c0', 6), /concentration warning/);
  const a = await request(s, 'c0', 6, { confirmedConcentration: warning.token });
  const b = await request(s, 'c0', 5, {
    slotLevel: 1,
    confirmedConcentration: TL.concentrationUseWarning(c, c.items[5]).token,
  });
  assert.deepEqual(s.snapshot().state.characters[0], c);
  await resolve(s, 'approve', a.requestId, { confirmedConcentration: warning.token });
  const oldToken = TL.concentrationUseWarning(c, c.items[5]).token;
  await assert.rejects(
    resolve(s, 'approve', b.requestId, { confirmedConcentration: oldToken }),
    /concentration warning/
  );
  assert.equal(s.review(b.requestId).reason, '');
  await resolve(s, 'approve', b.requestId, {
    confirmedConcentration: s.review(b.requestId).concentrationWarning.token,
  });
  assert.equal(s.snapshot().state.characters[0].concentrationItemId, c.items[5].id);
  const [last, first] = s.snapshot().session.history;
  assert.ok(last.receipt.concentration.marker.epoch > first.receipt.concentration.marker.epoch);
});

test('repeated delivery and approval/cancellation races settle one request exactly once', async () => {
  let writes = 0;
  const { session: s } = fixture({
    save: async () => {
      writes++;
    },
  });
  const cmd = command(s, 'request', { characterId: 'c0', itemId: itemId(s, 'c0', 3) });
  const [first, again] = await Promise.all([s.dispatch(cmd), s.dispatch(cmd)]);
  assert.equal(first.requestId, again.requestId);
  assert.equal(again.replayed, true);
  assert.equal(s.snapshot().session.pending.length, 1);
  await assert.rejects(s.dispatch({ ...cmd, characterId: 'c1' }), /different action/);
  const approve = command(s, 'approve', { requestId: first.requestId });
  const [a, b] = await Promise.all([s.dispatch(approve), s.dispatch(approve)]);
  assert.equal(a.status, 'approved');
  assert.equal(b.replayed, true);
  assert.equal(writes, 1);
  const second = await request(s, 'c0', 3);
  const race = await Promise.allSettled([
    resolve(s, 'cancel', second.requestId, { characterId: 'c0' }),
    resolve(s, 'approve', second.requestId),
  ]);
  assert.deepEqual(
    race.map((r) => r.status),
    ['fulfilled', 'rejected']
  );
  assert.equal(s.snapshot().state.characters[0].resources[0].current, 3);
  assert.equal(writes, 1);
});

test('parallel arrivals enforce capacity and a failed save leaves a retriable pending approval', async () => {
  let fail = true,
    writes = 0;
  const { session: s } = fixture({
    save: async () => {
      writes++;
      if (fail) throw new Error('disk full');
    },
  });
  const arrivals = await Promise.allSettled(
    Array.from({ length: 4 }, (_, i) => request(s, 'c' + i))
  );
  assert.equal(arrivals.filter((r) => r.status === 'fulfilled').length, 3);
  const req = arrivals[0].value.requestId,
    before = s.snapshot();
  const approve = command(s, 'approve', { requestId: req });
  await assert.rejects(s.dispatch(approve), /disk full/);
  assert.deepEqual(s.snapshot(), before);
  fail = false;
  await s.dispatch(approve);
  await s.dispatch(approve);
  assert.equal(writes, 2);
  assert.equal(s.snapshot().state.characters[0].turn.action, false);
  assert.equal(s.snapshot().session.pending.length, 2);
  assert.equal(s.snapshot().session.history.length, 1);
});

test('reads during a slow save see the old state; later commands use the saved result', async () => {
  let release, started;
  const writing = new Promise((r) => {
    started = r;
  });
  const { session: s } = fixture({
    save: () => {
      started();
      return new Promise((r) => {
        release = r;
      });
    },
  });
  const queued = await request(s, 'c0', 3),
    before = s.snapshot();
  const approved = resolve(s, 'approve', queued.requestId);
  await writing;
  const later = request(s, 'c0', 3);
  assert.deepEqual(s.snapshot(), before);
  release();
  await approved;
  await later;
  assert.equal(s.snapshot().state.characters[0].resources[0].current, 3);
  assert.equal(s.projectCharacter('c0').resources[0].current, 1);
});

test('dependency edits require confirmation, cancel cleanly, and preserve unrelated requests and latest fields', async () => {
  const { session: s } = fixture();
  await request(s);
  const unrelated = await request(s, 'c1', 3);
  const before = s.snapshot();
  const mutate = (state) => {
    state.library[0].description = 'Revised manual rules';
  };
  const preview = await edit(s, mutate);
  assert.equal(preview.status, 'confirmation-required');
  assert.equal(preview.affected.length, 1);
  assert.deepEqual(s.snapshot(), before);
  await cancelEdit(s, preview);
  assert.deepEqual(s.snapshot(), before);
  const confirmed = await edit(s, mutate);
  await confirm(s, confirmed);
  assert.equal(s.snapshot().session.history[0].status, 'denied');
  assert.equal(s.snapshot().session.pending[0].id, unrelated.requestId);
  assert.equal(s.snapshot().state.characters[0].items[0].description, 'Revised manual rules');
  const fresh = await request(s);
  assert.equal(s.review(fresh.requestId).request.ability.description, 'Revised manual rules');
});

test('new turns and even equal-value resource resets invalidate dependencies only after confirmation', async () => {
  const { session: s } = fixture();
  const special = await request(s, 'c0', 3),
    other = await request(s, 'c1');
  const before = s.snapshot();
  const rest = await edit(s, (state) => TL.rest(state.characters[0], 'long'), [
    { type: 'rest', characterId: 'c0', restType: 'long' },
  ]);
  assert.equal(rest.status, 'confirmation-required');
  assert.equal(rest.affected[0].requestId, special.requestId);
  await cancelEdit(s, rest);
  assert.deepEqual(s.snapshot(), before);
  const turn = await edit(s, (state) => TL.startTurn(state.characters[0]), [
    { type: 'new-turn', characterId: 'c0' },
  ]);
  await confirm(s, turn);
  assert.equal(s.snapshot().session.history[0].status, 'expired');
  assert.equal(s.snapshot().session.history[0].reason, 'Expired — new turn');
  assert.equal(s.snapshot().session.pending[0].id, other.requestId);
  assert.equal(s.projectCharacter('c0').resources[0].current, 5);
  assert.ok(s.snapshot().session.revisions[counterKey('c0', 'turn', 'action')].epoch > 0);
});

test('failed dependency-change saves preserve both the edit confirmation and the pending reservations', async () => {
  let fail = true;
  const { session: s } = fixture({
    save: async () => {
      if (fail) throw new Error('write failed');
    },
  });
  await request(s, 'c0', 3);
  const before = s.snapshot();
  const preview = await edit(s, (state) => {
    state.characters[0].resources[0].current = 1;
  });
  const apply = command(s, 'confirm-change', { confirmationId: preview.confirmationId });
  await assert.rejects(s.dispatch(apply), /write failed/);
  assert.deepEqual(s.snapshot(), before);
  assert.equal(s.projectCharacter('c0').resources[0].current, 3);
  fail = false;
  await s.dispatch(apply);
  await s.dispatch(apply);
  assert.equal(s.projectCharacter('c0').resources[0].current, 1);
  assert.equal(s.snapshot().session.pending.length, 0);
  assert.equal(s.snapshot().session.history.length, 1);
  assert.equal(s.snapshot().session.history[0].status, 'denied');
});

test('character cost edits and conversion to local copies invalidate only the dependent assignments', async () => {
  const { session: s } = fixture();
  const a = await request(s),
    b = await request(s, 'c1'),
    local = await request(s, 'c2', 3);
  const costEdit = await edit(s, (state) => {
    state.characters[0].items[0].resourceId = 'pool-0';
    state.characters[0].items[0].resourceCost = 3;
  });
  assert.deepEqual(
    costEdit.affected.map((r) => r.requestId),
    [a.requestId]
  );
  await confirm(s, costEdit);
  const converted = await edit(s, (state) => {
    TL.deleteLibraryEntry(state, state.library[0].id, ['c0', 'c1', 'c2', 'c3']);
  });
  assert.deepEqual(
    converted.affected.map((r) => r.requestId),
    [b.requestId]
  );
  await confirm(s, converted);
  assert.equal(s.snapshot().session.pending[0].id, local.requestId);
  const fresh = await request(s);
  assert.equal(s.review(fresh.requestId).request.local, true);
  assert.equal(s.review(fresh.requestId).request.libraryId, '');
  assert.equal(s.projectCharacter('c0').resources[0].current, 2);
  assert.equal(s.snapshot().state.characters[1].items[0].resourceId, '');
  assert.equal(s.snapshot().state.library.length, 2);
});

test('approval wins a later cancel or a second distinct approval without spending twice', async () => {
  const { session: s } = fixture();
  const r = await request(s, 'c0', 3);
  const outcomes = await Promise.allSettled([
    resolve(s, 'approve', r.requestId),
    resolve(s, 'cancel', r.requestId, { characterId: 'c0' }),
    resolve(s, 'approve', r.requestId),
  ]);
  assert.deepEqual(
    outcomes.map((r) => r.status),
    ['fulfilled', 'rejected', 'rejected']
  );
  assert.equal(s.snapshot().session.history.length, 1);
  assert.equal(s.snapshot().session.history[0].status, 'approved');
  assert.equal(s.projectCharacter('c0').resources[0].current, 3);
});

test('unrelated changes do not deny requests; stale confirmation cannot overwrite later edits', async () => {
  const { session: s } = fixture();
  const queued = await request(s, 'c0', 3);
  assert.equal(
    (
      await edit(s, (state) => {
        state.characters[0].hp = 4;
        state.characters[0].hud.rotation = 180;
      })
    ).status,
    'changed'
  );
  assert.equal(s.snapshot().session.pending[0].id, queued.requestId);
  const preview = await edit(s, (state) => {
    state.characters[0].resources[0].current = 1;
  });
  await request(s, 'c1');
  await assert.rejects(confirm(s, preview), /Review this edit again/);
  assert.equal(s.snapshot().state.characters[0].resources[0].current, 5);
  const fresh = await edit(s, (state) => {
    state.characters[0].resources[0].current = 1;
  });
  await confirm(s, fresh);
  assert.equal(s.snapshot().state.characters[0].hp, 4);
  assert.equal(s.snapshot().state.characters[0].hud.rotation, 180);
  assert.equal(s.snapshot().session.pending[0].characterId, 'c1');
});

test('receipt epochs distinguish later tracked spending from resource corrections and resets', async () => {
  const { session: s } = fixture();
  const a = await request(s, 'c0', 3);
  await resolve(s, 'approve', a.requestId);
  const original = s.snapshot().session.history[0].receipt.costs[0].marker;
  await s.dispatch(command(s, 'direct-use', { characterId: 'c0', itemId: itemId(s, 'c0', 3) }));
  const key = counterKey('c0', 'resource', 'pool-0');
  assert.equal(s.snapshot().session.revisions[key].epoch, original.epoch);
  assert.ok(s.snapshot().session.revisions[key].revision > original.revision);
  assert.equal(s.snapshot().session.history.length, 1);
  await edit(s, (state) => {
    state.characters[0].resources[0].current = 3;
  });
  assert.ok(s.snapshot().session.revisions[key].epoch > original.epoch);
  const revised = s.snapshot().session.revisions[key].epoch;
  await edit(s, () => {}, [{ type: 'adjust', characterId: 'c0', kind: 'resource', key: 'pool-0' }]);
  assert.equal(s.snapshot().session.revisions[key].epoch, revised + 1);
});

test('direct DM spending creates no request or history and respects pending dependencies on confirmation', async () => {
  const { session: s } = fixture();
  const pending = await request(s, 'c0', 3);
  const cmd = command(s, 'direct-use', { characterId: 'c0', itemId: itemId(s, 'c0', 3) });
  const preview = await s.dispatch(cmd);
  assert.equal(preview.status, 'confirmation-required');
  assert.equal(s.snapshot().state.characters[0].resources[0].current, 5);
  await confirm(s, preview);
  assert.equal(s.snapshot().state.characters[0].resources[0].current, 3);
  assert.equal(s.snapshot().session.history.length, 1);
  assert.equal(s.snapshot().session.history[0].id, pending.requestId);
  assert.equal(s.snapshot().session.history[0].status, 'denied');
  assert.equal(s.snapshot().session.pending.length, 0);
});

test('pending and recent history remain separate from backups; restart releases reservations but retains approved costs', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tablelight-approvals-'));
  try {
    const store = new Store(dir),
      { session: s } = fixture({ save: (state) => store.save(state) });
    const approved = await request(s, 'c0', 3);
    await resolve(s, 'approve', approved.requestId);
    await request(s, 'c0', 3);
    const saved = store.load().state,
      raw = JSON.parse(fs.readFileSync(store.file, 'utf8'));
    assert.equal(saved.characters[0].resources[0].current, 3);
    assert.equal(s.projectCharacter('c0').resources[0].current, 1);
    assert.deepEqual(raw, TL.toBackup(saved));
    assert.equal(raw.version, 11);
    assert.equal(raw.session, undefined);
    const restarted = new Session(saved);
    assert.deepEqual(restarted.snapshot().session.pending, []);
    assert.deepEqual(restarted.snapshot().session.history, []);
    assert.equal(restarted.projectCharacter('c0').resources[0].current, 3);
    await assert.rejects(
      restarted.dispatch(command(s, 'request', { characterId: 'c0', itemId: itemId(s, 'c0', 3) })),
      /earlier session/
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('five-entry history eviction cannot make a delayed request or resolution spend again', async () => {
  const { session: s } = fixture();
  const first = command(s, 'request', { characterId: 'c0', itemId: itemId(s, 'c0', 3) });
  const response = await s.dispatch(first);
  const approved = command(s, 'approve', { requestId: response.requestId });
  await s.dispatch(approved);
  for (let i = 0; i < 6; i++) {
    const r = await request(s);
    await resolve(s, 'deny', r.requestId);
  }
  assert.equal(s.snapshot().session.history.length, 5);
  assert.ok(s.snapshot().session.history.every((r) => r.id !== response.requestId));
  const before = s.snapshot();
  assert.equal((await s.dispatch(first)).replayed, true);
  assert.equal((await s.dispatch(approved)).replayed, true);
  assert.deepEqual(s.snapshot(), before);
  await assert.rejects(resolve(s, 'approve', response.requestId), /no longer pending/);
});

test('character projections and snapshots cannot mutate the session or expose other characters requests', async () => {
  const { session: s } = fixture();
  await edit(s, (state) => {
    state.characters[0].notes = 'Private DM notes';
  });
  await request(s);
  await request(s, 'c1');
  const view = s.playerView('c0');
  assert.equal(view.pending.length, 1);
  assert.equal(view.character.id, 'c0');
  assert.equal(view.character.notes, undefined);
  assert.equal(s.snapshot().state.characters[0].notes, 'Private DM notes');
  view.character.items[0].name = 'Tampered';
  view.pending[0].costs.length = 0;
  const snapshot = s.snapshot();
  snapshot.state.characters.length = 0;
  snapshot.session.pending.length = 0;
  assert.equal(s.snapshot().state.characters.length, 4);
  assert.equal(s.playerView('c0').pending[0].costs.length, 1);
  assert.equal(s.projectCharacter('c0').items[0].name, 'Test attack');
});

test('browser module loads with the shared rules engine without enabling or changing the existing app', async () => {
  const context = vm.createContext({ structuredClone, crypto: require('node:crypto').webcrypto });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../ability-icon.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../core.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../approval-session.js'), 'utf8'), context);
  assert.equal(context.TLApproval.ABILITY_LIMIT, 3);
  assert.equal(context.TLApproval.HISTORY_LIMIT, 5);
  assert.equal(new context.TLApproval.Session(context.TL.empty()).snapshot().state.version, 11);
});
