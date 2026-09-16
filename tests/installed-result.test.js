/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const waitInstalledResult = require('../scripts/wait-installed-result.cjs');
function resultFile(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tablelight-installed-result-'));
  const file = path.join(directory, 'result.json');
  t.after(() => {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(directory);
  });
  return file;
}
test('installer test reports launch failure instead of waiting for the update timeout', async (t) => {
  const error = Object.assign(Error('Synthetic process launch was rejected'), { code: 'EACCES' });
  await assert.rejects(
    waitInstalledResult(resultFile(t), Promise.reject(error), { timeoutMs: 100, intervalMs: 1 }),
    (actual) => actual === error
  );
});
test('normal old-app exit still waits for the restarted app result', async (t) => {
  const file = resultFile(t);
  const report = { passed: true, version: '0.0.2' };
  const timer = setTimeout(() => fs.writeFileSync(file, JSON.stringify(report)), 10);
  t.after(() => clearTimeout(timer));
  assert.deepEqual(
    await waitInstalledResult(file, Promise.resolve(), { timeoutMs: 1000, intervalMs: 1 }),
    report
  );
});
test('installer test reports a missing restart result rather than a false success', async (t) => {
  await assert.rejects(
    waitInstalledResult(resultFile(t), Promise.resolve(), { timeoutMs: 10, intervalMs: 1 }),
    /Installed update timed out/
  );
});
