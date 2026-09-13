/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const semver = require('semver');

class UpdatePreferences {
  constructor(directory) {
    this.file = path.join(directory, 'updates.json');
    this.enabled = true;
    this.error = '';
    try {
      const value = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (typeof value.automaticChecks !== 'boolean') throw new Error('Invalid preference');
      this.enabled = value.automaticChecks;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.enabled = false;
        this.error = 'The update setting could not be read. Automatic checks are off.';
      }
    }
  }
  set(enabled) {
    if (typeof enabled !== 'boolean') throw new Error('Choose on or off for automatic checks.');
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file + '.tmp', JSON.stringify({ automaticChecks: enabled }) + '\n');
      fs.renameSync(this.file + '.tmp', this.file);
    } catch {
      throw new Error('The update setting could not be saved. Try again.');
    }
    this.enabled = enabled;
    this.error = '';
  }
}

class UpdateService extends EventEmitter {
  constructor({
    version,
    preferences,
    adapter,
    beforeInstall = async () => {},
    installFailed = () => {},
  }) {
    super();
    this.version = version;
    this.preferences = preferences;
    this.adapter = adapter;
    this.beforeInstall = beforeInstall;
    this.installFailed = installFailed;
    this.phase = 'idle';
    this.availableVersion = '';
    this.progress = 0;
    this.message = '';
    this.promptVersion = '';
    this.checkedAt = '';
    this.operation = null;
    this.operationKind = '';
    this.checkWasAutomatic = false;
    this.cancelled = false;
    this.downloaded = false;
    adapter?.on('progress', (percent) => {
      if (this.phase !== 'downloading') return;
      this.progress = Math.max(0, Math.min(100, Number(percent) || 0));
      this.publish();
    });
    adapter?.on('install-error', () => this.failInstall());
  }
  snapshot() {
    return {
      supported: Boolean(this.adapter),
      enabled: this.preferences.enabled,
      preferenceError: this.preferences.error,
      phase: this.phase,
      version: this.version,
      availableVersion: this.availableVersion,
      progress: this.progress,
      message: this.message,
      promptVersion: this.promptVersion,
      checkedAt: this.checkedAt,
    };
  }
  publish() {
    this.emit('change', this.snapshot());
  }
  setEnabled(enabled) {
    this.preferences.set(enabled);
    if (!enabled) {
      this.promptVersion = '';
      if (this.operationKind === 'check' && this.checkWasAutomatic) {
        this.cancelled = true;
        this.adapter?.cancel();
      }
    }
    this.publish();
    return this.snapshot();
  }
  check(automatic = false) {
    if (!this.adapter || (automatic && !this.preferences.enabled))
      return Promise.resolve(this.snapshot());
    if (this.operation) return this.operation;
    if (this.downloaded) return Promise.resolve(this.snapshot());
    this.phase = 'checking';
    this.message = '';
    this.cancelled = false;
    this.checkWasAutomatic = automatic;
    this.operationKind = 'check';
    this.publish();
    this.operation = (async () => {
      try {
        const result = await this.adapter.check();
        if (this.cancelled) {
          this.phase = this.availableVersion ? 'available' : 'idle';
          return;
        }
        const latest = semver.valid(result?.version);
        if (!latest || semver.prerelease(latest)) throw new Error('Not a stable version');
        this.checkedAt = new Date().toISOString();
        this.availableVersion = semver.gt(latest, this.version) && result.available ? latest : '';
        this.phase = this.availableVersion ? 'available' : 'current';
        this.promptVersion = automatic && this.preferences.enabled ? this.availableVersion : '';
      } catch (error) {
        this.phase = this.availableVersion ? 'available' : 'idle';
        if (!this.cancelled)
          this.message =
            error.code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND'
              ? 'The latest release does not include in-app update information yet. You can open the Release page to check it.'
              : 'Could not check for updates. Check your connection and try again later.';
      }
    })()
      .finally(() => {
        this.operation = null;
        this.operationKind = '';
        this.publish();
      })
      .then(() => this.snapshot());
    return this.operation;
  }
  dismiss() {
    this.promptVersion = '';
    this.publish();
    return this.snapshot();
  }
  update() {
    if (this.operation || !this.adapter || !this.availableVersion)
      throw new Error('An update is not ready. Check again first.');
    this.promptVersion = '';
    this.operationKind = 'update';
    this.cancelled = false;
    this.message = '';
    this.progress = this.downloaded ? 100 : 0;
    this.phase = this.downloaded ? 'saving' : 'downloading';
    this.publish();
    this.operation = (async () => {
      try {
        if (!this.downloaded) {
          await this.adapter.download();
          if (this.cancelled) return;
          this.downloaded = true;
        }
        this.phase = 'saving';
        this.publish();
        await this.beforeInstall();
        this.phase = 'installing';
        this.publish();
        this.adapter.install();
      } catch {
        this.installFailed();
        this.phase = this.downloaded ? 'ready' : 'available';
        if (!this.cancelled)
          this.message = this.downloaded
            ? 'The update is downloaded, but Tablelight could not save or start installation. Your app is still open. Resolve any save error and try again.'
            : 'The update could not be downloaded or verified. Your current app is still available. Try again later.';
      }
    })()
      .finally(() => {
        if (this.cancelled) {
          this.phase = 'available';
          this.message = 'Download canceled.';
        }
        this.operation = null;
        this.operationKind = '';
        this.publish();
      })
      .then(() => this.snapshot());
    return this.operation;
  }
  cancelDownload() {
    if (this.phase === 'downloading') {
      this.cancelled = true;
      this.adapter.cancel();
    }
    return this.snapshot();
  }
  failInstall() {
    if (this.phase !== 'installing') return;
    this.installFailed();
    this.phase = 'ready';
    this.message =
      'The installer could not start. Try again or download the installer from the official release page.';
    this.publish();
  }
  dispose() {
    this.cancelled = true;
    this.adapter?.cancel();
  }
}
module.exports = { UpdatePreferences, UpdateService };
