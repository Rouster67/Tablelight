/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const TL = require('../core');
const { MessageService } = require('../message-service');
const { Service } = require('../approval-service');
const { Store } = require('../storage');
function setup() {
  const state = TL.empty();
  state.characters = Array.from({ length: 8 }, (_, i) => ({
    ...TL.character(i),
    id: 'p' + i,
    name: 'Same name',
  }));
  state.roster = [{ ...TL.character(), id: 'inactive' }];
  state.settings.overlayInteractive = true;
  const events = [];
  let time = 100;
  const service = new MessageService(state, {
    onChange: (snapshot) => events.push(snapshot),
    now: () => ++time,
  });
  service.setOverlay({ connected: true, visible: true });
  return { state, service, events };
}
const meta = (s, characterId = 'p0') =>
  s.snapshot().messages.find((m) => m.characterId === characterId);
const target = (s, characterId = 'p0') => ({
  sessionId: s.snapshot().sessionId,
  ...meta(s, characterId),
  characterId,
});
const request = (s, type, values = {}) => ({
  ...target(s, values.characterId || 'p0'),
  requestId: TL.uid(),
  type,
  ...values,
});
const command = (s, type, values = {}, actor = 'dm') => s.command(request(s, type, values), actor);
const send = (s, body = 'Synthetic private note', characterId = 'p0') =>
  command(s, 'send', { body, characterId });
function open(s, actor = 'dm') {
  command(s, actor === 'dm' ? 'force-open' : 'open', {}, actor);
  const body = s.body(target(s), 'player');
  command(s, 'ack-opened', { bodyToken: body.bodyToken }, 'player');
  return body;
}

test('messages route by stable ID, never name or initiative, and ordinary projections omit all bodies', () => {
  const { state, service: s, events } = setup();
  const original = TL.clone(state);
  for (let i = 0; i < 8; i++) send(s, 'Private synthetic text ' + i, 'p' + i);
  state.characters.reverse();
  state.characters[0].name = 'Renamed';
  s.reconcile(state);
  for (let i = 0; i < 8; i++) {
    assert.equal(s.body(target(s, 'p' + i), 'dm').body, 'Private synthetic text ' + i);
    assert.throws(() => s.body(target(s, 'p' + i), 'player'), /Open this message/);
  }
  assert.equal(s.snapshot().messages.length, 8);
  for (const projection of [
    s,
    events,
    s.snapshot(),
    state,
    TL.toBackup(state),
    TL.overlayState(state),
  ])
    assert.ok(!JSON.stringify(projection).includes('Private synthetic text'));
  assert.deepEqual(
    state.characters.map((c) => c.hud).reverse(),
    original.characters.map((c) => c.hud)
  );
  assert.throws(() => send(s, 'Inactive note', 'inactive'), /active party/);
  assert.throws(() => send(s, 'Unknown note', 'unknown'), /active party/);
});

test('plain text keeps its content, rejects blanks and limits input to 2,000 Unicode characters', () => {
  const { service: s } = setup();
  const initial = s.snapshot();
  for (const body of [
    undefined,
    null,
    42,
    {},
    [],
    '',
    ' \r\n\t',
    'x'.repeat(2001),
    '🪄'.repeat(2001),
  ])
    assert.throws(() => send(s, body === undefined ? null : body), /1 and 2,000/);
  assert.deepEqual(s.snapshot(), initial);
  send(s, '🪄'.repeat(2000));
  assert.equal(s.body(target(s), 'dm').body, '🪄'.repeat(2000));
  const text = '  <script>synthetic()</script>\nSecond line\t & literal text  ';
  command(s, 'send', { body: text, replaceMessageId: meta(s).messageId });
  assert.equal(s.body(target(s), 'dm').body, text);
});

test('replacement is explicit, retries are idempotent, and stale requests cannot affect a new message', () => {
  const { service: s } = setup();
  const first = request(s, 'send', { body: 'First synthetic note' });
  s.command(first, 'dm');
  const sent = s.snapshot();
  assert.equal(s.command(first, 'dm').result.replayed, true);
  assert.deepEqual(s.snapshot(), sent);
  assert.throws(() => s.command({ ...first, body: 'Changed text' }, 'dm'), /already used/);
  assert.throws(() => send(s, 'Implicit replacement'), /Choose Replace/);
  open(s);
  const old = target(s);
  const oldBody = s.body(old, 'player');
  command(s, 'send', { body: 'Replacement text', replaceMessageId: old.messageId });
  const replacement = s.snapshot();
  assert.notEqual(meta(s).messageId, old.messageId);
  assert.equal(meta(s).unread, true);
  assert.equal(meta(s).open, false);
  assert.equal(meta(s).deliveredAt, null);
  for (const [type, actor] of [
    ['open', 'player'],
    ['force-open', 'dm'],
    ['close', 'player'],
    ['close', 'dm'],
    ['dismiss', 'dm'],
    ['ack-indicator', 'player'],
    ['ack-opened', 'player'],
  ]) {
    assert.throws(
      () => s.command({ ...old, type, requestId: TL.uid(), bodyToken: oldBody.bodyToken }, actor),
      /changed or was dismissed/
    );
    assert.deepEqual(s.snapshot(), replacement);
  }
  assert.throws(
    () => command(s, 'send', { body: 'Stale replacement', replaceMessageId: old.messageId }),
    /Choose Replace/
  );
  const dismiss = request(s, 'dismiss');
  s.command(dismiss, 'dm');
  assert.equal(s.command(dismiss, 'dm').result.replayed, true);
  assert.equal(s.command(first, 'dm').result.replayed, true);
  assert.equal(s.snapshot().messages.length, 0);
});

test('delivery and Opened require the current visible view, fetched text, and a matching acknowledgement', () => {
  const { service: s } = setup();
  s.setOverlay({ connected: false, visible: false });
  send(s);
  const hidden = s.snapshot();
  assert.equal(meta(s).available, false);
  assert.equal(meta(s).deliveredAt, null);
  assert.throws(() => command(s, 'force-open'), /Show this player/);
  assert.throws(() => command(s, 'ack-indicator', {}, 'player'), /Show this player/);
  assert.deepEqual(s.snapshot(), hidden);
  s.setOverlay({ connected: true, visible: true });
  command(s, 'ack-indicator', {}, 'player');
  assert.ok(meta(s).deliveredAt);
  assert.equal(meta(s).openedAt, null);
  command(s, 'force-open');
  assert.equal(meta(s).unread, true);
  assert.equal(meta(s).bodyVisible, false);
  assert.throws(
    () => command(s, 'ack-opened', { bodyToken: 'not-fetched' }, 'player'),
    /Fetch and display/
  );
  const body = s.body(target(s), 'player');
  assert.equal(meta(s).unread, true);
  const ack = request(s, 'ack-opened', { bodyToken: body.bodyToken });
  s.command(ack, 'player');
  assert.equal(meta(s).unread, false);
  assert.equal(meta(s).openedBy, 'dm');
  assert.equal(meta(s).bodyVisible, true);
  const opened = s.snapshot();
  s.command(ack, 'player');
  assert.deepEqual(s.snapshot(), opened);
  command(s, 'close');
  assert.equal(meta(s).unread, false);
  assert.throws(() => s.body(target(s), 'player'), /Open this message/);
  open(s, 'player');
  assert.equal(meta(s).openedBy, 'player');
});

for (const event of [
  'hide-player',
  'expand',
  'collapse',
  'change-display',
  'hide-window',
  'disconnect',
  'reload',
])
  test(
    event + ' closes text and invalidates old view events without losing retained read status',
    () => {
      const { state, service: s } = setup();
      if (event === 'collapse') {
        state.characters[0].hud.expanded = true;
        s.reconcile(state);
      }
      send(s);
      open(s);
      const old = target(s),
        body = s.body(old, 'player');
      if (event === 'hide-player') state.characters[0].hud.visible = false;
      if (event === 'expand') state.characters[0].hud.expanded = true;
      if (event === 'collapse') state.characters[0].hud.expanded = false;
      if (event === 'change-display') state.settings.displayId = 'new-display';
      s.reconcile(state);
      if (event === 'hide-window') s.setOverlay({ connected: true, visible: false });
      if (event === 'disconnect') s.setOverlay({ connected: false, visible: false });
      if (event === 'reload')
        s.setOverlay({ connected: true, visible: true }, { invalidate: true });
      assert.equal(meta(s).open, false);
      assert.equal(meta(s).unread, false);
      assert.equal(meta(s).bodyVisible, false);
      assert.notEqual(meta(s).presentationId, old.presentationId);
      assert.throws(
        () =>
          s.command(
            { ...old, requestId: TL.uid(), type: 'ack-opened', bodyToken: body.bodyToken },
            'player'
          ),
        /changed/
      );
      state.characters[0].hud.visible = true;
      s.reconcile(state);
      s.setOverlay({ connected: true, visible: true });
      assert.equal(meta(s).open, false);
      assert.equal(meta(s).unread, false);
    }
  );

test('click-through retains the open view; only the DM can control it while render acknowledgements remain available', () => {
  const { state, service: s } = setup();
  send(s);
  open(s);
  const before = s.snapshot();
  state.settings.overlayInteractive = false;
  s.reconcile(state);
  assert.deepEqual(s.snapshot(), before);
  assert.throws(() => command(s, 'close', {}, 'player'), /click-through/);
  command(s, 'close');
  assert.throws(() => command(s, 'open', {}, 'player'), /click-through/);
  open(s);
  assert.equal(meta(s).openedBy, 'dm');
  assert.throws(() => command(s, 'ack-indicator'), /not available/);
  assert.throws(() => command(s, 'dismiss', {}, 'player'), /not available/);
  assert.throws(() => command(s, 'send', { body: 'Not DM' }, 'player'), /not available/);
  assert.throws(() => s.body(target(s), '__proto__'), /Unknown/);
  assert.throws(
    () => s.body({ ...target(s), characterId: 'p1' }, 'player'),
    /changed or was dismissed/
  );
  command(s, 'dismiss');
  assert.equal(s.snapshot().messages.length, 0);
});

test('ordinary saves retain messages; removal, session reset and application restart cannot resurrect them', () => {
  const { state, service: s } = setup();
  const sent = request(s, 'send', { body: 'Retained synthetic message' });
  s.command(sent, 'dm');
  const before = s.snapshot();
  state.characters[0].theme = 'wizard';
  state.characters[0].hp--;
  state.characters[0].hud.rotation = 90;
  s.reconcile(TL.normalize(TL.toBackup(state)));
  assert.deepEqual(s.snapshot(), before);
  TL.removeFromParty(state, 'p0');
  s.reconcile(state);
  assert.equal(s.snapshot().messages.length, 0);
  TL.addToParty(state, 'p0');
  s.reconcile(state);
  s.command(sent, 'dm');
  assert.equal(s.snapshot().messages.length, 0);
  send(s);
  const oldSession = s.snapshot().sessionId;
  s.reconcile(state, { reset: true });
  assert.notEqual(s.snapshot().sessionId, oldSession);
  assert.throws(() => s.command(sent, 'dm'), /session has ended/);
  assert.equal(s.snapshot().messages.length, 0);
  assert.equal(new MessageService(state).snapshot().messages.length, 0);
});

test('successful restore alone starts a new message session; save failure and gameplay Undo do not replay messages', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tablelight-message-state-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { state, service: messages } = setup();
  const store = new Store(dir);
  let fail = false;
  const owner = new Service(state, {
    save: (next) => {
      if (fail) throw Error('Synthetic save failure');
      return store.save(next);
    },
    onChange: (snapshot, change) =>
      messages.reconcile(snapshot.state, { reset: change.restored === true }),
  });
  send(messages, 'NEVER_IN_BACKUP');
  assert.equal(owner.snapshot().undoCount, 0);
  const base = owner.snapshot().state,
    edited = TL.clone(base);
  edited.characters[0].hp--;
  await owner.change({ base, edited });
  await owner.undo();
  assert.equal(messages.snapshot().messages.length, 1);
  assert.ok(!fs.readFileSync(store.file, 'utf8').includes('NEVER_IN_BACKUP'));
  const session = messages.snapshot().sessionId;
  fail = true;
  const restored = TL.clone(base);
  restored.characters[0].hp = 3;
  await assert.rejects(owner.change({ edited: restored, restore: true }), /save failure/);
  assert.equal(messages.snapshot().sessionId, session);
  assert.equal(messages.snapshot().messages.length, 1);
  fail = false;
  await owner.change({ edited: restored, restore: true });
  assert.notEqual(messages.snapshot().sessionId, session);
  assert.equal(messages.snapshot().messages.length, 0);
  await owner.undo();
  assert.equal(messages.snapshot().messages.length, 0);
  assert.ok(!fs.readFileSync(store.backup, 'utf8').includes('NEVER_IN_BACKUP'));
});

test('cancelled restore retains messages; confirmed restore clears them only after the save succeeds', async () => {
  const { state, service: messages } = setup();
  const item = TL.createLocalItem(state, 'p0', { name: 'Synthetic request', economy: 'free' });
  let fail = false;
  const owner = new Service(state, {
    save: () => {
      if (fail) throw Error('Synthetic save failure');
    },
    onChange: (snapshot, change) =>
      messages.reconcile(snapshot.state, { reset: change.restored === true }),
  });
  const approval = (type, extra = {}) => ({
    sessionId: owner.snapshot().approvals.id,
    commandId: TL.uid(),
    type,
    ...extra,
  });
  await owner.hud(approval('use', { characterId: 'p0', itemId: item.id }));
  send(messages);
  const before = messages.snapshot();
  const preview = await owner.change({ edited: state, restore: true });
  assert.equal(preview.result.status, 'confirmation-required');
  assert.deepEqual(messages.snapshot(), before);
  await owner.command(approval('cancel-change', { confirmationId: preview.result.confirmationId }));
  assert.deepEqual(messages.snapshot(), before);
  const restored = TL.clone(state);
  restored.characters[0].hp = 3;
  const again = await owner.change({ edited: restored, restore: true });
  const confirm = approval('confirm-change', { confirmationId: again.result.confirmationId });
  fail = true;
  await assert.rejects(owner.command(confirm), /save failure/);
  assert.deepEqual(messages.snapshot(), before);
  fail = false;
  await owner.command(confirm);
  assert.notEqual(messages.snapshot().sessionId, before.sessionId);
  assert.equal(messages.snapshot().messages.length, 0);
});
