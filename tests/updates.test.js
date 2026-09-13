/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { UpdatePreferences, UpdateService } = require('../update-service');
const { allowedReleaseUrl, publicHeaders, UpdateAdapter } = require('../update-adapter');
function fixture(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tablelight-updates-'));
  t.after(() => {
    if (
      path.dirname(dir) !== path.resolve(os.tmpdir()) ||
      !path.basename(dir).startsWith('tablelight-updates-')
    )
      throw new Error('Unexpected temporary directory');
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const adapter = new EventEmitter();
  Object.assign(adapter, {
    checks: 0,
    downloads: 0,
    installs: 0,
    cancellations: 0,
    async check() {
      this.checks++;
      return { version: '1.10.0', available: true };
    },
    async download() {
      this.downloads++;
    },
    install() {
      this.installs++;
    },
    cancel() {
      this.cancellations++;
    },
  });
  const preferences = new UpdatePreferences(dir);
  const service = new UpdateService({ version: '1.9.2', preferences, adapter, ...options });
  return { service, adapter, preferences, dir };
}
test('update preferences persist separately and unreadable preferences turn automatic checks off', (t) => {
  const { preferences, dir } = fixture(t);
  assert.equal(preferences.enabled, true);
  preferences.set(false);
  assert.equal(new UpdatePreferences(dir).enabled, false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'updates.json'))), {
    automaticChecks: false,
  });
  assert.equal(fs.existsSync(path.join(dir, 'party.json')), false);
  assert.throws(() => preferences.set('false'), /on or off/);
  fs.writeFileSync(path.join(dir, 'updates.json'), '{broken');
  const corrupt = new UpdatePreferences(dir);
  assert.equal(corrupt.enabled, false);
  assert.ok(corrupt.error);
});
test('launch checks offer a newer version without downloading and Later leaves the version available', async (t) => {
  const { service, adapter } = fixture(t);
  await service.check(true);
  assert.equal(service.snapshot().availableVersion, '1.10.0');
  assert.equal(service.snapshot().promptVersion, '1.10.0');
  service.dismiss();
  assert.equal(service.snapshot().promptVersion, '');
  assert.equal(service.snapshot().availableVersion, '1.10.0');
  assert.equal(adapter.downloads, 0);
  assert.equal(adapter.installs, 0);
});
test('disabled launch checks send nothing; an explicit manual check still works without a launch prompt', async (t) => {
  const { service, adapter } = fixture(t);
  service.setEnabled(false);
  await service.check(true);
  assert.equal(adapter.checks, 0);
  await service.check();
  assert.equal(adapter.checks, 1);
  assert.equal(service.snapshot().promptVersion, '');
  assert.equal(service.snapshot().phase, 'available');
});
test('equal, older, prerelease, and invalid versions never offer an installation', async (t) => {
  const { service, adapter } = fixture(t);
  for (const version of ['1.9.2', '1.9.1', '1.10.0-beta.1', 'not-a-version']) {
    adapter.check = async () => ({ version, available: true });
    await service.check(true);
    assert.equal(service.snapshot().availableVersion, '', version);
    assert.equal(service.snapshot().promptVersion, '', version);
    assert.throws(() => service.update(), /not ready/);
  }
});
test('check failure is contained and can be retried; unsupported copies never check', async (t) => {
  const { service, adapter, preferences } = fixture(t);
  adapter.check = () => {
    throw new Error('private network diagnostic');
  };
  await service.check(true);
  assert.equal(service.snapshot().phase, 'idle');
  assert.equal(service.snapshot().promptVersion, '');
  assert.doesNotMatch(service.snapshot().message, /private network/);
  adapter.check = async () => ({ version: '1.10.0', available: true });
  await service.check();
  assert.equal(service.snapshot().phase, 'available');
  const unsupported = new UpdateService({ version: '1.9.2', preferences });
  await unsupported.check();
  assert.equal(unsupported.snapshot().supported, false);
});
test('a release without updater metadata explains the manual release-page fallback', async (t) => {
  const { service, adapter } = fixture(t);
  adapter.check = async () => {
    throw Object.assign(new Error('Missing latest.yml'), {
      code: 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND',
    });
  };
  await service.check();
  assert.match(service.snapshot().message, /Release page/);
  assert.equal(service.snapshot().availableVersion, '');
});
test('concurrent checks share a request; disabling a pending automatic check cancels and suppresses its late result', async (t) => {
  const { service, adapter } = fixture(t);
  let finish;
  adapter.check = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const first = service.check(true);
  assert.equal(service.check(), first);
  service.setEnabled(false);
  finish({ version: '1.10.0', available: true });
  await first;
  assert.equal(adapter.cancellations, 1);
  assert.equal(service.snapshot().availableVersion, '');
  assert.equal(service.snapshot().promptVersion, '');
});
test('successful update saves before installing; save failure keeps the download for a retry', async (t) => {
  let canSave = false;
  const order = [];
  const { service, adapter } = fixture(t, {
    beforeInstall: async () => {
      order.push('save');
      if (!canSave) throw new Error('Disk full');
    },
  });
  adapter.download = async () => {
    adapter.downloads++;
    order.push('download');
  };
  adapter.install = () => {
    adapter.installs++;
    order.push('install');
  };
  await service.check();
  await service.update();
  assert.equal(service.snapshot().phase, 'ready');
  assert.equal(adapter.installs, 0);
  assert.deepEqual(order, ['download', 'save']);
  canSave = true;
  await service.update();
  assert.deepEqual(order, ['download', 'save', 'save', 'install']);
  assert.equal(adapter.downloads, 1);
});
test('failed or canceled downloads cannot install and allow retry', async (t) => {
  const { service, adapter } = fixture(t);
  await service.check();
  adapter.download = async () => {
    throw new Error('Checksum mismatch');
  };
  await service.update();
  assert.equal(service.snapshot().phase, 'available');
  assert.equal(adapter.installs, 0);
  let finish;
  adapter.download = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const pending = service.update();
  assert.throws(() => service.update(), /not ready/);
  service.cancelDownload();
  finish();
  await pending;
  assert.equal(adapter.installs, 0);
  assert.equal(service.snapshot().phase, 'available');
  adapter.download = async () => {};
  await service.update();
  assert.equal(adapter.installs, 1);
});
test('release transport permits only project release locations and strips tracking and credential headers', () => {
  for (const url of [
    'https://github.com/Rouster67/Tablelight/releases.atom',
    'https://api.github.com/repos/Rouster67/Tablelight/releases/latest',
    'https://release-assets.githubusercontent.com/asset',
  ])
    assert.equal(allowedReleaseUrl(url), true);
  for (const url of [
    'https://example.com/update.exe',
    'http://github.com/Rouster67/Tablelight/releases',
    'https://github.com/other/repo/releases',
    'https://github.com.evil.test/Rouster67/Tablelight/releases',
    'https://user:pass@github.com/Rouster67/Tablelight/releases',
    'https://github.com:444/Rouster67/Tablelight/releases',
    'http://127.0.0.1:5000/latest.yml',
  ])
    assert.equal(allowedReleaseUrl(url), false);
  assert.deepEqual(
    publicHeaders({
      'X-User-Staging-ID': 'secret',
      Cookie: 'secret',
      Authorization: 'secret',
      accept: 'application/json',
    }),
    { accept: 'application/json' }
  );
});
test('the real updater is configured to require consent and to use stable releases with full verified downloads', (t) => {
  const { dir } = fixture(t);
  const adapter = new UpdateAdapter({
    testApp: {
      version: '1.9.2',
      name: 'Tablelight',
      isPackaged: true,
      userDataPath: dir,
      whenReady: async () => {},
    },
  });
  assert.equal(adapter.updater.autoDownload, false);
  assert.equal(adapter.updater.autoInstallOnAppQuit, false);
  assert.equal(adapter.updater.allowPrerelease, false);
  assert.equal(adapter.updater.allowDowngrade, false);
  assert.equal(adapter.updater.disableWebInstaller, true);
  assert.equal(adapter.updater.disableDifferentialDownload, true);
});
