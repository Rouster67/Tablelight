/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
// Opt-in, synthetic stress check: node --expose-gc scripts/benchmark-ability-icons.cjs
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { serialize, deserialize } = require('node:v8');
const TL = require('../core'),
  { Service } = require('../approval-service');
const { Store } = require('../storage'),
  { packImages, unpackImages } = require('../preload');
const fixture = require('../tests/icon-stress-fixture');
(async () => {
  const resultsRoot = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(resultsRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(resultsRoot, 'icon-performance-'));
  const store = new Store(path.join(directory, 'data'));
  const state = fixture();
  const saves = [],
    broadcasts = [],
    changes = [];
  let peakHeap = 0,
    bytes = 0;
  const service = new Service(state, {
    save: (value) => {
      const start = performance.now();
      store.save(value);
      saves.push(performance.now() - start);
    },
    onChange: (snapshot) => {
      const start = performance.now();
      for (const value of [snapshot, service.overlayState()]) {
        const wire = serialize(packImages(value));
        bytes = Math.max(bytes, wire.byteLength);
        const decoded = unpackImages(deserialize(wire));
        assert.ok(
          decoded.state ? TL.same(decoded.state, snapshot.state) : decoded.characters.length === 8
        );
      }
      broadcasts.push(performance.now() - start);
      peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed);
    },
  });
  const initial = service.snapshot().state;
  for (let i = 0; i < 40; i++) {
    const start = performance.now(),
      edited = service.snapshot().state;
    edited.characters[i % 8].hp = (i % 9) + 1;
    edited.characters[i % 8].resources[0].current--;
    await service.change({ edited });
    changes.push(performance.now() - start);
  }
  assert.equal(service.snapshot().undoCount, 40);
  assert.deepEqual(store.load().state, service.snapshot().state);
  const fullWireBytes = serialize(service.snapshot()).byteLength;
  global.gc?.();
  const retainedHeap = process.memoryUsage().heapUsed;
  for (let i = 0; i < 40; i++) await service.undo();
  assert.ok(TL.same(service.snapshot().state, initial));
  const summarize = (values) => ({
    meanMs: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    maxMs: Math.round(Math.max(...values)),
  });
  const result = {
    definitions: 5000,
    active: 8,
    inactive: 100,
    undoSnapshots: 40,
    imageBytes: 31 * Buffer.from(state.library[0].icon.split(',')[1], 'base64').length,
    updates: summarize(changes),
    save: summarize(saves),
    broadcastCodec: summarize(broadcasts),
    peakSampledHeapMiB: Math.round(peakHeap / 1048576),
    retainedHeapMiB: Math.round(retainedHeap / 1048576),
    repeatedWireMiB: +(fullWireBytes / 1048576).toFixed(2),
    packedWireMiB: +(bytes / 1048576).toFixed(2),
    undoRestoredOriginal: true,
  };
  fs.writeFileSync(path.join(directory, 'performance.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ directory, ...result }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
