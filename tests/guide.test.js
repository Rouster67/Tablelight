/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { GuideService } = require('../guide-service');
const { checkGuide } = require('../scripts/check-guide.cjs');
const root = path.resolve(__dirname, '..');

test('guide uses the running app directory, never cwd or a caller-supplied path', async () => {
  for (const directory of [
    path.join(os.tmpdir(), 'ordinary', 'resources', 'app'),
    path.join(os.tmpdir(), 'Tablelight é custom', 'resources', 'app'),
  ]) {
    const seen = [];
    const service = new GuideService(
      directory,
      async (file) => {
        seen.push(file);
        return '';
      },
      async (file) => {
        seen.push(file);
        return Buffer.from('%PDF-1.4\n%%EOF');
      }
    );
    assert.equal((await service.open()).ok, true);
    assert.deepEqual(seen, [
      path.join(directory, 'docs', 'Tablelight-User-Guide.pdf'),
      path.join(directory, 'docs', 'Tablelight-User-Guide.pdf'),
    ]);
    for (const value of ['other.pdf', undefined, null, {}, []])
      assert.throws(() => service.open(value), /does not accept/);
    assert.equal(seen.length, 2);
  }
});
test('guide coalesces pending opens and allows a later retry without changing files', async () => {
  let finish,
    calls = 0;
  const service = new GuideService(
    root,
    () => {
      calls++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    async () => Buffer.from('%PDF-1.4')
  );
  const one = service.open(),
    two = service.open();
  assert.equal(one, two);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  finish('viewer unavailable');
  assert.equal((await one).ok, false);
  service.openPath = async () => '';
  assert.equal((await service.open()).ok, true);
});
test('guide has recoverable missing, access, damaged and viewer errors', async () => {
  for (const code of ['ENOENT', 'EACCES', 'EPERM']) {
    const service = new GuideService(
      root,
      () => assert.fail('Must not open unreadable PDF'),
      async () => {
        throw Object.assign(Error('private path'), { code });
      }
    );
    const result = await service.open();
    assert.equal(result.ok, false);
    assert.match(result.message, /try opening the guide again/);
    assert.doesNotMatch(result.message, /private path/);
  }
  const damaged = new GuideService(
    root,
    () => assert.fail('Damaged PDF'),
    async () => Buffer.from('not a pdf')
  );
  assert.match((await damaged.open()).message, /damaged/);
  for (const fn of [
    async () => 'No association',
    async () => {
      throw Error('OS rejected');
    },
  ]) {
    const service = new GuideService(root, fn, async () => Buffer.from('%PDF-1.4'));
    assert.match((await service.open()).message, /default PDF app/);
  }
});
test('guide packaging rejects missing, changed, stale, wrong-version and unreviewed PDFs', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'tablelight-guide-'));
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/user-guide/manifest.json')));
    const inputs = new Set([
      ...Object.keys(manifest.inputs),
      'package.json',
      'docs/Tablelight-User-Guide.pdf',
      'docs/user-guide/manifest.json',
      'docs/user-guide/review.json',
    ]);
    for (const name of inputs) {
      fs.mkdirSync(path.dirname(path.join(fixture, name)), { recursive: true });
      fs.copyFileSync(path.join(root, name), path.join(fixture, name));
    }
    // Exercise both release states regardless of the checked-in guide's current status.
    manifest.status = 'draft';
    const record = path.join(fixture, 'docs/user-guide/manifest.json');
    fs.writeFileSync(record, JSON.stringify(manifest));
    assert.equal(checkGuide(fixture, { allowDraft: true }).status, 'draft');
    assert.throws(() => checkGuide(fixture), /development draft/);
    const pdf = path.join(fixture, 'docs/Tablelight-User-Guide.pdf'),
      bytes = fs.readFileSync(pdf);
    fs.unlinkSync(pdf);
    assert.throws(() => checkGuide(fixture, { allowDraft: true }));
    fs.writeFileSync(pdf, Buffer.concat([bytes, Buffer.from('changed')]));
    assert.throws(() => checkGuide(fixture, { allowDraft: true }), /changed PDF/);
    fs.writeFileSync(pdf, bytes);
    const ui = path.join(fixture, 'guide-ui.js'),
      old = fs.readFileSync(ui);
    fs.appendFileSync(ui, '// changed');
    assert.throws(() => checkGuide(fixture, { allowDraft: true }), /stale source/);
    fs.writeFileSync(ui, old);
    fs.writeFileSync(record, JSON.stringify({ ...manifest, appVersion: '99.0.0' }));
    assert.throws(() => checkGuide(fixture, { allowDraft: true }), /version mismatch/);
    fs.writeFileSync(record, JSON.stringify({ ...manifest, status: 'final' }));
    const reviewFile = path.join(fixture, 'docs/user-guide/review.json');
    fs.writeFileSync(reviewFile, JSON.stringify({ status: 'draft' }));
    assert.throws(() => checkGuide(fixture), /still needs matching/);
    const approved = {
      status: 'approved',
      appVersion: manifest.appVersion,
      pdfSha256: manifest.pdfSha256,
      coverageComplete: true,
      walkthroughsPassed: true,
      offlineInstallsPassed: true,
      navigationChecked: true,
      viewers: ['Test reader one', 'Test reader two'],
      pagesInspected: Array.from({ length: manifest.pages }, (_, i) => i + 1),
    };
    fs.writeFileSync(reviewFile, JSON.stringify(approved));
    assert.equal(checkGuide(fixture).status, 'final');
    for (const incomplete of [
      { offlineInstallsPassed: false },
      { viewers: ['Test reader one', 'Test reader one'] },
      { pagesInspected: approved.pagesInspected.slice(1) },
      { pdfSha256: 'not the reviewed PDF' },
    ]) {
      fs.writeFileSync(reviewFile, JSON.stringify({ ...approved, ...incomplete }));
      assert.throws(() => checkGuide(fixture), /still needs matching/);
    }
    const waived = {
      ...approved,
      walkthroughsPassed: false,
      coreWalkthroughsPassed: true,
      offlineInstallsPassed: false,
      viewers: [],
      releaseWaivers: {
        appVersion: manifest.appVersion,
        pdfSha256: manifest.pdfSha256,
        approvedBy: 'project-owner',
        approvedOn: '2026-09-16',
        authorization: 'Explicit owner authorization in this synthetic test fixture.',
        reason: 'The named manual checks cannot run in this test fixture.',
        checks: ['installer-upgrade-uninstall', 'offline-pdf-readers', 'physical-tv'],
      },
    };
    fs.writeFileSync(reviewFile, JSON.stringify(waived));
    assert.equal(checkGuide(fixture).status, 'final');
    for (const invalid of [
      { appVersion: '99.0.0' },
      { pdfSha256: 'a different guide' },
      { approvedBy: 'assistant' },
      { approvedOn: '' },
      { authorization: '' },
      { reason: '' },
      { checks: ['all-checks'] },
      { checks: ['physical-tv', 'physical-tv'] },
    ]) {
      fs.writeFileSync(
        reviewFile,
        JSON.stringify({
          ...waived,
          releaseWaivers: { ...waived.releaseWaivers, ...invalid },
        })
      );
      assert.throws(() => checkGuide(fixture), /invalid release waiver/);
    }
    for (const incomplete of [
      { coreWalkthroughsPassed: false },
      { coverageComplete: false },
      { navigationChecked: false },
      { pagesInspected: waived.pagesInspected.slice(1) },
      { releaseWaivers: { ...waived.releaseWaivers, checks: ['offline-pdf-readers'] } },
      { releaseWaivers: { ...waived.releaseWaivers, checks: ['installer-upgrade-uninstall'] } },
    ]) {
      fs.writeFileSync(reviewFile, JSON.stringify({ ...waived, ...incomplete }));
      assert.throws(() => checkGuide(fixture), /still needs matching/);
    }
  } finally {
    assert.ok(path.resolve(fixture).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
test('draft packaging exception is restricted to testing output with no publishing', () => {
  const beforePack = require('../build/before-pack.cjs'),
    old = process.env.TABLELIGHT_ALLOW_DRAFT_GUIDE;
  process.env.TABLELIGHT_ALLOW_DRAFT_GUIDE = '1';
  const context = (output, publish) => ({
    appOutDir: path.join(root, output),
    packager: { projectDir: root, info: { options: { publish } } },
  });
  try {
    assert.throws(() => beforePack(context('dist/win-unpacked', 'never')), /isolated testing/);
    assert.throws(
      () => beforePack(context('dist/testing-guide/win-unpacked', 'always')),
      /publishing disabled/
    );
    beforePack(context('dist/testing-guide/win-unpacked', 'never'));
  } finally {
    if (old === undefined) delete process.env.TABLELIGHT_ALLOW_DRAFT_GUIDE;
    else process.env.TABLELIGHT_ALLOW_DRAFT_GUIDE = old;
  }
});
