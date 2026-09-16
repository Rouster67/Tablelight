/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
function checkGuide(root, { allowDraft = false } = {}) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/user-guide/manifest.json'), 'utf8')
  );
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const fail = (message) => {
    throw Error('User guide: ' + message);
  };
  if (manifest.schema !== 1 || manifest.appVersion !== version)
    fail('version mismatch; rebuild for this app version.');
  if (!['draft', 'final'].includes(manifest.status)) fail('unknown review status.');
  const pdf = fs.readFileSync(path.join(root, 'docs/Tablelight-User-Guide.pdf'));
  if (
    manifest.pdf !== 'docs/Tablelight-User-Guide.pdf' ||
    pdf.subarray(0, 5).toString() !== '%PDF-' ||
    !pdf.subarray(-100).toString().includes('%%EOF') ||
    hash(pdf) !== manifest.pdfSha256
  )
    fail('missing, damaged or changed PDF; regenerate it.');
  if (
    !Number.isInteger(manifest.pages) ||
    manifest.pages < 1 ||
    manifest.bookmarks < 1 ||
    manifest.links < 1
  )
    fail('missing pages or navigation.');
  if (!manifest.inputs || !Object.keys(manifest.inputs).length) fail('missing source record.');
  for (const [name, expected] of Object.entries(manifest.inputs)) {
    const file = path.resolve(root, name);
    if (!file.startsWith(path.resolve(root) + path.sep) || hash(fs.readFileSync(file)) !== expected)
      fail('stale source or screenshot: ' + name + '; recapture/rebuild before packaging.');
  }
  if (manifest.status !== 'final') {
    if (!allowDraft)
      fail('development draft; complete the illustrated guide and review before a release build.');
  } else {
    const review = JSON.parse(
      fs.readFileSync(path.join(root, 'docs/user-guide/review.json'), 'utf8')
    );
    const waivers = review.releaseWaivers;
    const allowedWaivers = new Set([
      'installer-upgrade-uninstall',
      'offline-pdf-readers',
      'physical-tv',
    ]);
    if (
      waivers !== undefined &&
      (!waivers ||
        waivers.appVersion !== version ||
        waivers.pdfSha256 !== manifest.pdfSha256 ||
        waivers.approvedBy !== 'project-owner' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(waivers.approvedOn || '') ||
        typeof waivers.authorization !== 'string' ||
        !waivers.authorization.trim() ||
        typeof waivers.reason !== 'string' ||
        !waivers.reason.trim() ||
        !Array.isArray(waivers.checks) ||
        !waivers.checks.length ||
        new Set(waivers.checks).size !== waivers.checks.length ||
        waivers.checks.some((check) => !allowedWaivers.has(check)))
    )
      fail('invalid release waiver; record owner authorization for this exact version and PDF.');
    const waived = (check) => waivers?.checks.includes(check) === true;
    if (
      review.status !== 'approved' ||
      review.pdfSha256 !== manifest.pdfSha256 ||
      review.appVersion !== version ||
      !['coverageComplete', 'navigationChecked'].every((k) => review[k] === true) ||
      !(
        review.walkthroughsPassed === true ||
        (review.coreWalkthroughsPassed === true && waived('installer-upgrade-uninstall'))
      ) ||
      !(review.offlineInstallsPassed === true || waived('installer-upgrade-uninstall')) ||
      !Array.isArray(review.viewers) ||
      !(new Set(review.viewers).size >= 2 || waived('offline-pdf-readers')) ||
      JSON.stringify(review.pagesInspected) !==
        JSON.stringify(Array.from({ length: manifest.pages }, (_, i) => i + 1))
    )
      fail(
        'final PDF still needs matching all-page, coverage, walkthrough, navigation and installation review.'
      );
  }
  return manifest;
}
module.exports = { checkGuide };
if (require.main === module) {
  try {
    const result = checkGuide(path.resolve(__dirname, '..'), {
      allowDraft: process.argv.includes('--allow-draft'),
    });
    console.log(
      `Guide checked: ${result.status}, version ${result.appVersion}, ${result.pages} pages.`
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
