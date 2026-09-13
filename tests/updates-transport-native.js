/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http');
const assert = require('node:assert/strict'),
  crypto = require('node:crypto');
const { UpdateAdapter } = require('../update-adapter');
module.exports = async ({ app, store }) => {
  const directory = path.dirname(store.directory),
    results = [],
    requests = [];
  const payload = Buffer.from('Synthetic installer bytes. Never executed.');
  let mode = 'good',
    adapter;
  const deadline = setTimeout(() => {
    fs.writeFileSync(
      path.join(directory, 'transport-results.json'),
      JSON.stringify(
        {
          passed: false,
          results,
          error: 'Transport test exceeded 20 seconds in ' + mode,
          requests,
          activeRequests: adapter?.executor.active.size,
          tokens: adapter?.executor.tokens.size,
        },
        null,
        2
      )
    );
    adapter?.cancel();
    server.closeAllConnections();
    app.quit();
  }, 20000);
  const sha512 = crypto.createHash('sha512').update(payload).digest('base64');
  const server = http.createServer((request, response) => {
    requests.push({ url: request.url, headers: request.headers, method: request.method });
    if (mode === 'slow') return;
    if (mode === 'redirect-loop') {
      response.writeHead(302, { Location: '/loop' });
      response.end();
      return;
    }
    if (request.url.startsWith('/latest.yml')) {
      response.end(
        JSON.stringify({
          version: '1.10.0',
          files: [
            {
              url: 'fixture.exe',
              size: payload.length,
              sha512: mode === 'corrupt' ? 'A'.repeat(86) + '==' : sha512,
            },
          ],
        })
      );
    } else if (request.url === '/fixture.exe' || request.url === '/installer-bytes.exe') {
      if (request.url === '/fixture.exe' && mode.startsWith('redirect-')) {
        const destination =
          mode === 'redirect-blocked'
            ? `http://localhost:${server.address().port}/blocked.exe`
            : '/installer-bytes.exe';
        response.writeHead(302, { Location: destination });
        response.end();
        return;
      }
      response.setHeader('Content-Length', payload.length);
      if (mode === 'slow-download') {
        response.write(payload.subarray(0, 3));
        return;
      }
      response.end(payload);
    } else {
      response.statusCode = 404;
      response.end();
    }
  });
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const feed = `http://127.0.0.1:${server.address().port}/`;
    const config = path.join(directory, 'app-update.yml');
    fs.writeFileSync(config, JSON.stringify({ updaterCacheDirName: 'transport-cache' }));
    const testApp = {
      version: '1.9.2',
      name: 'Tablelight Transport Test',
      isPackaged: true,
      userDataPath: store.directory,
      baseCachePath: directory,
      appUpdateConfigPath: config,
      whenReady: () => app.whenReady(),
      onQuit: () => {
        throw new Error('Must not register automatic installation');
      },
      quit: () => {
        throw new Error('Must not quit');
      },
    };
    adapter = new UpdateAdapter({ testFeed: feed, testApp });
    adapter.updater.logger = Object.fromEntries(
      ['info', 'warn', 'error', 'debug'].map((level) => [
        level,
        (value) =>
          fs.appendFileSync(path.join(directory, 'transport.log'), level + ': ' + value + '\n'),
      ])
    );
    mode = 'corrupt';
    assert.deepEqual(await adapter.check(), { version: '1.10.0', available: true });
    assert.equal(
      requests.some((r) => r.url === '/fixture.exe'),
      false
    );
    await assert.rejects(() => adapter.download(), /checksum|sha512/i);
    results.push(
      'The real updater checks metadata without downloading, and rejects an installer with the wrong checksum.'
    );
    mode = 'good';
    await adapter.check();
    mode = 'slow-download';
    adapter.executor.idleTimeout = 250;
    await assert.rejects(() => adapter.download(), /canceled|cancelled|timed out/i);
    assert.equal(adapter.executor.active.size, 0);
    results.push('A stalled installer download is canceled without hanging or installing.');
    adapter.executor.idleTimeout = 60000;
    const canceled = adapter.download();
    const cancellation = setTimeout(() => adapter.cancel(), 100);
    await assert.rejects(() => canceled, /canceled|cancelled/i);
    clearTimeout(cancellation);
    assert.equal(adapter.executor.active.size, 0);
    results.push('Cancel download aborts a real partial transfer and permits a new download.');
    mode = 'redirect-blocked';
    await assert.rejects(() => adapter.download(), /Unexpected update download destination/);
    assert.equal(
      requests.some((request) => request.url === '/blocked.exe'),
      false
    );
    results.push(
      'An unexpected installer redirect rejects the download without contacting that destination or raising an uncaught error.'
    );
    mode = 'redirect-loop';
    let startRequests = requests.length;
    await assert.rejects(() => adapter.download(), /Too many redirects/);
    assert.ok(requests.length - startRequests <= adapter.executor.maxRedirects + 1);
    startRequests = requests.length;
    await assert.rejects(() => adapter.check(), /Too many redirects/);
    assert.ok(requests.length - startRequests <= adapter.executor.maxRedirects + 1);
    results.push('Metadata and installer redirect loops fail after a bounded number of requests.');
    mode = 'redirect-allowed';
    await adapter.check();
    adapter.executor.idleTimeout = 60000;
    const files = await adapter.download();
    assert.deepEqual(fs.readFileSync(files[0]), payload);
    results.push(
      'A permitted installer redirect succeeds on retry and still verifies the downloaded bytes.'
    );
    for (const request of requests) {
      assert.equal(request.headers['x-user-staging-id'], undefined);
      assert.equal(request.headers.cookie, undefined);
      assert.equal(request.headers.authorization, undefined);
      assert.equal(request.method, 'GET');
    }
    results.push(
      'The real download verifies its SHA-512 digest; metadata and download requests send no rollout identifier, cookies, credentials, or request body.'
    );
    mode = 'slow';
    adapter.checkTimeout = 250;
    const start = Date.now();
    await assert.rejects(() => adapter.check(), /timed out|canceled/i);
    assert.ok(Date.now() - start < 2500);
    assert.equal(adapter.executor.active.size, 0);
    results.push('A stalled update check times out and aborts its network request.');
    mode = 'good';
    adapter.checkTimeout = 12000;
    assert.equal((await adapter.check()).available, true);
    results.push('A new check succeeds after a network timeout.');
    fs.writeFileSync(
      path.join(directory, 'transport-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'transport-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
  } finally {
    clearTimeout(deadline);
    adapter?.cancel();
    server.closeAllConnections();
    server.close();
    app.quit();
  }
};
