/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const test = require('node:test'),
  assert = require('node:assert/strict');
const TL = require('../core'),
  { MessageService } = require('../message-service');
const { pages, Client } = require('../message-client');
const { hudRegions } = require('../window-shape');
test('message pages preserve every Unicode code point, whitespace, line break and literal tag without empty trailing pages', () => {
  for (const text of [
    '',
    'hello',
    'x'.repeat(2000),
    '🪄'.repeat(2000),
    '\r\n'.repeat(900),
    ' <script>literal</script>\n'.repeat(70),
  ]) {
    const split = pages(text);
    assert.equal(split.join(''), text);
    assert.ok(split.every((p) => [...p].length <= 320));
    assert.ok(split.length === 1 || split.every((p) => p.length));
  }
});
test('reading pages and scrolling are session-only, recipient-checked and remain DM-controlled in click-through', () => {
  const state = TL.empty();
  state.settings.overlayInteractive = false;
  state.characters = [
    { ...TL.character(), id: 'a' },
    { ...TL.character(), id: 'b' },
  ];
  const before = TL.clone(state),
    s = new MessageService(state);
  s.setOverlay({ connected: true, visible: true });
  const target = () => ({ sessionId: s.snapshot().sessionId, ...s.snapshot().messages[0] });
  const cmd = (type, data = {}, actor = 'dm') =>
    s.command({ ...target(), requestId: TL.uid(), type, ...data }, actor);
  cmd('send', { characterId: 'a', body: 'Long synthetic message '.repeat(70) });
  assert.throws(() => cmd('page', { page: 1 }), /Open this message/);
  cmd('force-open');
  const old = target();
  const fetched = s.body(old, 'player');
  cmd('page', { page: 1 });
  assert.equal(target().page, 1);
  assert.throws(
    () =>
      s.command(
        { ...old, type: 'ack-opened', requestId: TL.uid(), bodyToken: fetched.bodyToken },
        'player'
      ),
    /changed/
  );
  assert.throws(() => cmd('page', { page: 100 }), /no such page/);
  assert.throws(() => cmd('page', { page: 0 }, 'player'), /click-through/);
  assert.throws(() => cmd('scroll', { direction: 1 }, 'player'), /click-through/);
  assert.throws(() => cmd('scroll', { direction: 0 }), /valid scroll/);
  const scroll = { ...target(), type: 'scroll', requestId: TL.uid(), direction: 1 };
  s.command(scroll, 'dm');
  const after = s.snapshot();
  s.command(scroll, 'dm');
  assert.deepEqual(s.snapshot(), after);
  assert.equal(target().scrollSequence, 1);
  cmd('close');
  cmd('force-open');
  assert.equal(target().page, 1);
  assert.equal(target().scrollSequence, 0);
  assert.deepEqual(state, before);
  assert.equal(new MessageService(state).snapshot().messages.length, 0);
});
test('a late initial snapshot cannot revive a retired session or roll back newer message metadata', async () => {
  let listener, resolve;
  const c = new Client({
    onMessages: (f) => {
      listener = f;
      return () => {};
    },
    messages: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  const pending = c.refresh();
  listener({ sessionId: 'new', revision: 2, messages: [] });
  resolve({ sessionId: 'old', revision: 30, messages: [{ body: 'Old response' }] });
  await pending;
  assert.equal(c.state.sessionId, 'new');
  c.accept({ sessionId: 'new', revision: 1, messages: [] });
  assert.equal(c.state.revision, 2);
  listener({ sessionId: 'next', revision: 0, messages: [] });
  c.accept({ sessionId: 'new', revision: 100, messages: [] });
  assert.equal(c.state.sessionId, 'next');
  c.destroy();
});
test('native geometry accepts eight HUDs plus eight message cards and a notice, while excluding empty rotated corners', () => {
  const frames = Array.from({ length: 17 }, (_, i) => ({
    cx: 100 + i * 500,
    cy: 300,
    width: 200,
    height: 100,
    rotation: 35,
  }));
  const regions = hudRegions(frames, 9000, 800);
  const contains = (x, y) =>
    regions.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
  for (const f of frames) {
    assert.ok(contains(f.cx, f.cy));
    assert.equal(contains(f.cx + 100, f.cy - 90), false);
  }
  assert.throws(() => hudRegions([...frames, frames[0]], 9000, 800), /Invalid HUD regions/);
});
