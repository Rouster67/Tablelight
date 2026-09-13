/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const { EventEmitter } = require('node:events');
const { NsisUpdater, CancellationToken } = require('electron-updater');
const { ElectronHttpExecutor } = require('electron-updater/out/electronHttpExecutor');

const RELEASE_PAGE = 'https://github.com/Rouster67/Tablelight/releases/latest';
const RELEASE_HOSTS = new Set([
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com',
  'github-releases.githubusercontent.com',
]);
function allowedReleaseUrl(url, testOrigin = '') {
  const value = new URL(url);
  if (value.username || value.password) return false;
  if (testOrigin && value.origin === testOrigin) return true;
  if (value.protocol !== 'https:' || (value.port && value.port !== '443')) return false;
  if (RELEASE_HOSTS.has(value.hostname)) return true;
  if (value.hostname === 'github.com') return value.pathname.startsWith('/Rouster67/Tablelight/');
  return (
    value.hostname === 'api.github.com' && value.pathname.startsWith('/repos/Rouster67/Tablelight/')
  );
}
function publicHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) => !['x-user-staging-id', 'cookie', 'authorization'].includes(name.toLowerCase())
    )
  );
}
class ReleaseHttpExecutor extends ElectronHttpExecutor {
  constructor(testOrigin) {
    super();
    this.active = new Set();
    this.tokens = new Set();
    this.cancelled = false;
    this.idleTimeout = 60000;
    this.testOrigin = testOrigin;
  }
  request(options, token = new CancellationToken(), data) {
    this.tokens.add(token);
    if (this.cancelled) token.cancel();
    return super.request(options, token, data).finally(() => this.tokens.delete(token));
  }
  download(url, destination, options) {
    const token = options.cancellationToken;
    this.tokens.add(token);
    if (this.cancelled) token.cancel();
    return super.download(url, destination, options).finally(() => this.tokens.delete(token));
  }
  createRequest(options, callback) {
    const url = `${options.protocol || 'https:'}//${options.hostname || options.host}${options.port ? ':' + options.port : ''}${options.path || '/'}`;
    if (!allowedReleaseUrl(url, this.testOrigin))
      throw new Error('Unexpected update download destination.');
    const request = super.createRequest(
      { ...options, headers: publicHeaders(options.headers), useSessionCookies: false },
      callback
    );
    this.active.add(request);
    let timer;
    const touch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => this.cancel(), this.idleTimeout);
      timer.unref();
    };
    const finish = () => {
      clearTimeout(timer);
      this.active.delete(request);
    };
    touch();
    request.on('response', (response) => {
      response.on('data', touch);
      response.on('end', finish);
      response.on('error', finish);
    });
    request.on('error', finish);
    request.on('abort', finish);
    // Electron can close the outgoing request while its response is still arriving.
    // Only response completion, an error, or an abort ends the idle deadline.
    return request;
  }
  cancel() {
    this.cancelled = true;
    for (const token of this.tokens) token.cancel();
    for (const request of this.active) {
      request.abort();
    }
    this.active.clear();
  }
}
class UpdateAdapter extends EventEmitter {
  constructor({ testFeed, testApp, checkTimeout = 12000 } = {}) {
    super();
    this.updater = new NsisUpdater(undefined, testApp);
    this.executor = new ReleaseHttpExecutor(testFeed ? new URL(testFeed).origin : '');
    this.updater.httpExecutor = this.executor;
    this.updater.setFeedURL(
      testFeed
        ? { provider: 'generic', url: testFeed }
        : { provider: 'github', owner: 'Rouster67', repo: 'Tablelight', private: false }
    );
    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = false;
    this.updater.allowPrerelease = false;
    this.updater.allowDowngrade = false;
    this.updater.disableWebInstaller = true;
    this.updater.disableDifferentialDownload = true;
    this.updater.logger = null;
    this.updater.requestHeaders = { 'User-Agent': 'Tablelight-updater' };
    this.updater.on('download-progress', (value) => this.emit('progress', value.percent));
    this.updater.on('error', () => this.emit('install-error'));
    this.token = null;
    this.checkTimeout = checkTimeout;
  }
  async check() {
    // Let an aborted library check release its shared promise before a retry.
    await new Promise((resolve) => setImmediate(resolve));
    this.executor.cancelled = false;
    let timer;
    try {
      const result = await Promise.race([
        this.updater.checkForUpdates(),
        new Promise((_resolve, reject) => {
          timer = setTimeout(() => {
            this.cancel();
            reject(new Error('Update check timed out.'));
          }, this.checkTimeout);
        }),
      ]);
      this.token = result?.cancellationToken;
      return { version: result?.updateInfo.version, available: result?.isUpdateAvailable === true };
    } finally {
      clearTimeout(timer);
    }
  }
  download() {
    this.executor.cancelled = false;
    this.token = new CancellationToken();
    return this.updater.downloadUpdate(this.token);
  }
  cancel() {
    this.token?.cancel();
    this.executor.cancel();
  }
  install() {
    this.updater.quitAndInstall(true, true);
  }
}
module.exports = { UpdateAdapter, RELEASE_PAGE, allowedReleaseUrl, publicHeaders };
