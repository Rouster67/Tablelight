/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  vm = require('node:vm');
const { deflateSync } = require('node:zlib');
const TL = require('../core'),
  Icon = require('../ability-icon');
const { Store } = require('../storage');
const {
  inspectSource,
  convertIcon,
  readIcon,
  validatePixels,
  MAX_SOURCE_BYTES,
} = require('../image-import');
const { chunk, png, dataUrl } = require('./icon-fixtures');
const red = dataUrl(png(2, 1, { pixel: [240, 0, 0, 128] }));
const blue = dataUrl(png(2, 1, { pixel: [0, 0, 240, 255] }));
function party() {
  const state = TL.empty();
  state.library = [
    TL.libraryEntry({
      id: 'shared',
      name: 'User ability',
      icon: red,
      description: 'Original details',
      source: 'Homebrew',
      upgrades: 'User upgrades',
    }),
    TL.libraryEntry({ id: 'unused', name: 'Unused', icon: blue }),
  ];
  state.characters = [TL.character(), TL.character(1)];
  state.roster = [TL.character(2)];
  for (const [i, c] of TL.allCharacters(state).entries()) {
    c.resources = [{ id: 'pool', name: 'Pool', max: 5, current: 4 - i, reset: 'long' }];
    c.hud.rotation = 90 * i;
    c.hud.scale = 0.7 + i / 10;
    c.hud.visible = i !== 1;
    c.hud.expanded = i === 0;
    c.notes = 'Private notes';
    TL.attachItem(state, c.id, 'shared', {
      resourceId: 'pool',
      resourceCost: i + 1,
      disabled: i === 2,
    });
    c.hud.detailId = c.items[0].id;
  }
  return TL.normalize(state);
}
test('icons round trip once per definition and preserve active/inactive character state and local copies', () => {
  const state = party();
  const c = state.characters[0];
  TL.createLocalItem(state, c.id, { name: 'Local user ability', icon: blue });
  const normalized = TL.normalize(state),
    backup = TL.toBackup(normalized);
  assert.equal(backup.version, 10);
  assert.equal(backup.library[0].icon, red);
  assert.equal(backup.library[1].icon, blue);
  for (const c of TL.allCharacters(backup)) assert.equal(c.items[0].icon, undefined);
  assert.equal(backup.characters[0].items[1].icon, blue);
  assert.deepEqual(TL.normalize(JSON.parse(JSON.stringify(backup))), normalized);
  const before = TL.clone(normalized);
  normalized.library[0].icon = blue;
  const edited = TL.normalize(normalized);
  for (const [i, c] of TL.allCharacters(edited).entries()) {
    const expected = TL.allCharacters(before)[i];
    expected.items[0].icon = blue;
    assert.deepEqual(c, expected);
  }
  normalized.library[0].icon = '';
  assert.equal(TL.normalize(normalized).characters[0].items[0].icon, '');
  assert.equal(TL.normalize(normalized).characters[0].items[1].icon, blue);
});
test('formats 1–9 gain blank icons without losing state; legacy artwork stays distinct', () => {
  for (let version = 1; version <= 9; version++) {
    const raw = TL.toBackup(party());
    raw.version = version;
    for (const entry of raw.library) delete entry.icon;
    const original = TL.clone(raw),
      restored = TL.normalize(raw);
    assert.equal(restored.version, 10);
    assert.equal(restored.library[0].icon, '');
    const expected = TL.clone(original);
    expected.version = 10;
    for (const entry of expected.library) entry.icon = '';
    assert.deepEqual(TL.toBackup(restored), expected);
    assert.deepEqual(raw, original);
  }
  const a = TL.character(),
    b = TL.character(1);
  a.items = [TL.item({ name: 'Same', icon: red })];
  b.items = [TL.item({ name: 'Same', icon: blue })];
  const state = TL.normalize({ version: 1, characters: [a, b] });
  assert.equal(state.library.length, 2);
  assert.notEqual(state.characters[0].items[0].libraryId, state.characters[1].items[0].libraryId);
  assert.throws(() => TL.normalize({ ...TL.empty(), version: 11 }), /supported/);
});
test('stored icons reject bad types, base64, dimensions, checksums, animation, and metadata', () => {
  assert.equal(Icon.normalize(undefined), '');
  assert.equal(Icon.normalize(red), red);
  assert.equal(Icon.inspect(dataUrl(png(256, 256))).width, 256);
  const broken = png();
  broken[broken.length - 1] ^= 1;
  for (const invalid of [
    null,
    false,
    {},
    'https://example.invalid/icon.png',
    'data:image/svg+xml;base64,PHN2Zz4=',
    red + '!',
    red + 'AAAA',
    dataUrl(broken),
    dataUrl(png().subarray(0, -1)),
    dataUrl(png(257, 1)),
    dataUrl(png(1, 257)),
    dataUrl(png(1, 1, { extra: [chunk('acTL', Buffer.alloc(8))] })),
    dataUrl(png(1, 1, { extra: [chunk('tEXt', Buffer.from('secret'))] })),
    dataUrl(Buffer.alloc(Icon.MAX_BYTES + 1)),
  ])
    assert.throws(() => TL.libraryEntry({ icon: invalid }), /icon|PNG|static|image/i);
});
test('the total budget counts shared definitions once and also counts independent local images', () => {
  const icon = dataUrl(png(256, 256, { level: 0 })),
    bytes = Icon.inspect(icon).byteLength;
  const count = Math.floor(Icon.MAX_TOTAL_BYTES / bytes),
    state = TL.empty();
  state.library = Array.from({ length: count }, (_, i) =>
    TL.libraryEntry({ id: 'entry-' + i, icon })
  );
  state.characters = Array.from({ length: 8 }, (_, i) => TL.character(i));
  for (const c of state.characters)
    for (const entry of state.library) TL.attachItem(state, c.id, entry.id);
  assert.doesNotThrow(() => TL.normalize(state));
  TL.createLocalItem(state, state.characters[0].id, { icon });
  assert.throws(() => TL.normalize(state), /8 MiB/);
});
test('pixel validation rejects damaged or oversized compressed data and invalid scanline filters', () => {
  validatePixels(red);
  for (const value of [
    dataUrl(png(2, 1, { compressed: Buffer.from('invalid deflate') })),
    dataUrl(png(2, 1, { compressed: deflateSync(Buffer.alloc(10)) })),
    dataUrl(png(2, 1, { compressed: deflateSync(Buffer.alloc(8)) })),
    dataUrl(
      png(2, 1, {
        compressed: Buffer.concat([deflateSync(Buffer.alloc(9)), Buffer.from('trailing')]),
      })
    ),
    dataUrl(png(2, 1, { filter: 5 })),
  ])
    assert.throws(() => validatePixels(value), /damaged PNG pixels/);
});
test('invalid icons never replace a save; fresh-folder restore and previous-save recovery preserve images', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tablelight-icons-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new Store(path.join(dir, 'original')),
    state = party();
  store.save(state);
  state.characters[0].hp = 6;
  store.save(state);
  const saved = fs.readFileSync(store.file),
    previous = fs.readFileSync(store.backup);
  const invalid = TL.clone(state);
  invalid.library[0].icon = dataUrl(png(2, 1, { filter: 9 }));
  assert.throws(() => store.save(invalid), /damaged/);
  assert.throws(() => store.validate(TL.toBackup(invalid)), /damaged/);
  assert.deepEqual(fs.readFileSync(store.file), saved);
  assert.deepEqual(fs.readFileSync(store.backup), previous);
  assert.equal(fs.existsSync(store.file + '.tmp'), false);
  const fresh = new Store(path.join(dir, 'fresh'));
  fresh.save(JSON.parse(saved));
  assert.deepEqual(fresh.load().state, store.load().state);
  fs.writeFileSync(store.file, JSON.stringify(TL.toBackup(invalid)));
  const recovered = store.load();
  assert.ok(recovered.warning);
  assert.equal(recovered.state.library[0].icon, red);
  assert.equal(recovered.state.characters[0].hp, 10);
});
test('source validation precedes decoding, reads bounded files, and leaves originals unchanged', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tablelight-icon-input-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'art.png'),
    source = png(600, 300);
  fs.writeFileSync(file, source);
  let calls = 0;
  const decode = async (value) => {
    calls++;
    assert.ok(value.startsWith('data:image/png;base64,'));
    return red;
  };
  assert.equal(await readIcon(file, decode), red);
  assert.equal(calls, 1);
  assert.deepEqual(fs.readFileSync(file), source);
  assert.equal(inspectSource(png(4096, 1)).width, 4096);
  for (const input of [
    Buffer.alloc(0),
    Buffer.alloc(MAX_SOURCE_BYTES + 1),
    Buffer.from('<svg/>'),
    Buffer.from('GIF89a'),
    source.subarray(0, -1),
    png(4097, 1),
    png(1, 1, { extra: [chunk('acTL', Buffer.alloc(8))] }),
  ])
    await assert.rejects(convertIcon(input, decode));
  assert.equal(calls, 1);
  fs.writeFileSync(file, Buffer.alloc(MAX_SOURCE_BYTES + 1));
  await assert.rejects(readIcon(file, decode), /5 MiB/);
  assert.equal(calls, 1);
});
test('browser validation matches Node and shared/local conversions retain icons', () => {
  const context = vm.createContext({ atob, btoa, crypto: require('node:crypto').webcrypto });
  for (const file of ['ability-icon.js', 'core.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  assert.equal(context.TL.libraryEntry({ icon: red }).icon, red);
  assert.throws(() => context.TL.libraryEntry({ icon: red.slice(0, -1) }));
  const state = party(),
    copy = TL.duplicateLibraryEntry(state, 'shared');
  assert.equal(copy.icon, red);
  const local = TL.copyLibraryItemLocally(state, state.characters[0].id, 'shared');
  assert.equal(local.icon, red);
  assert.equal(local.local, true);
});

test('source size boundaries and malformed WebP containers fail before pixel decoding', () => {
  const padding = MAX_SOURCE_BYTES - png(1, 1).length - 12;
  const exact = png(1, 1, { extra: [chunk('tEXt', Buffer.alloc(padding))] });
  assert.equal(exact.length, MAX_SOURCE_BYTES);
  assert.equal(inspectSource(exact).type, 'image/png');
  assert.throws(() => inspectSource(Buffer.concat([exact, Buffer.alloc(1)])), /5 MiB/);
  const webp = (type, payload) => {
    const data = Buffer.alloc(20 + payload.length + (payload.length % 2));
    data.write('RIFF');
    data.writeUInt32LE(data.length - 8, 4);
    data.write('WEBP', 8);
    data.write(type, 12);
    data.writeUInt32LE(payload.length, 16);
    payload.copy(data, 20);
    return data;
  };
  const lossless = Buffer.alloc(5);
  lossless[0] = 0x2f;
  lossless.writeUInt32LE((128 - 1) | ((64 - 1) << 14), 1);
  assert.deepEqual(inspectSource(webp('VP8L', lossless)), {
    type: 'image/webp',
    width: 128,
    height: 64,
  });
  lossless.writeUInt32LE(4096, 1);
  assert.throws(() => inspectSource(webp('VP8L', lossless)), /4096/);
  const malformed = webp('VP8L', Buffer.from([0x2f, 0, 0, 0, 0]));
  malformed.writeUInt32LE(100, 16);
  for (const source of [
    malformed,
    webp('VP8 ', Buffer.alloc(9)),
    webp('VP8L', Buffer.alloc(5)),
    webp('ANMF', Buffer.alloc(0)),
    webp('VP8X', Buffer.from([2, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
  ])
    assert.throws(() => inspectSource(source));
});

test('a failed icon save leaves the authoritative approval state and Undo history unchanged', async (t) => {
  const { Service } = require('../approval-service');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tablelight-icon-transaction-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new Store(dir),
    state = party();
  store.save(state);
  const service = new Service(state, { save: (value) => store.save(value) });
  const before = service.snapshot(),
    edited = TL.clone(before.state);
  edited.library[0].icon = dataUrl(png(2, 1, { filter: 7 }));
  await assert.rejects(service.change({ base: before.state, edited }), /damaged/);
  assert.deepEqual(service.snapshot(), before);
  assert.deepEqual(store.load().state, before.state);
});
