/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http'),
  assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
if (process.platform !== 'win32') throw new Error('Installer tests require Windows.');
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
const testRoot = fs.mkdtempSync(path.join(root, 'test-results', 'installed-update-'));
const installDir = path.join(testRoot, 'installed app');
const requests = [];
let releaseDir;
const server = http.createServer((request, response) => {
  requests.push({ method: request.method, url: request.url, headers: request.headers });
  const name = path.basename(new URL(request.url, 'http://localhost').pathname);
  if (!releaseDir || !['latest.yml', 'Tablelight-Setup-0.0.2-x64.exe'].includes(name)) {
    response.statusCode = 404;
    response.end();
    return;
  }
  const file = path.join(releaseDir, name);
  if (!fs.existsSync(file)) {
    response.statusCode = 404;
    response.end();
    return;
  }
  response.setHeader('Content-Length', fs.statSync(file).size);
  fs.createReadStream(file).pipe(response);
});
function run(executable, args, log, options = {}) {
  return new Promise((resolve, reject) => {
    const fd = fs.openSync(log, 'a');
    const child = spawn(executable, args, {
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', fd, fd],
      ...options,
    });
    child.on('error', (error) => {
      fs.closeSync(fd);
      reject(error);
    });
    child.on('exit', (code) => {
      fs.closeSync(fd);
      code === 0
        ? resolve()
        : reject(new Error('Test process exited with ' + code + '. See ' + log));
    });
  });
}
async function buildVersion(version, feed) {
  const output = path.join(testRoot, 'build-' + version);
  const config = {
    ...require('../electron-builder.cjs'),
    appId: 'io.github.rouster67.tablelight.updatetest',
    productName: 'Tablelight Update Test',
    electronDist: path.dirname(require('electron')),
    directories: { output, buildResources: path.join(root, 'build') },
    extraMetadata: {
      name: 'tablelight-update-test',
      version,
      updateTest: { root: testRoot, feed },
    },
    nsis: {
      ...require('../electron-builder.cjs').nsis,
      shortcutName: 'Tablelight Update Test',
      uninstallDisplayName: 'Tablelight Update Test',
      createDesktopShortcut: false,
      createStartMenuShortcut: false,
    },
    publish: [{ provider: 'generic', url: feed }],
  };
  const file = path.join(testRoot, 'config-' + version + '.json');
  fs.writeFileSync(file, JSON.stringify(config, null, 2));
  console.log('Building isolated installer ' + version + '…');
  await run(
    process.execPath,
    [
      require.resolve('electron-builder/out/cli/cli.js'),
      '--config',
      file,
      '--win',
      'nsis',
      '--x64',
      '--publish',
      'never',
    ],
    path.join(testRoot, 'build-' + version + '.log')
  );
  assert.ok(fs.existsSync(path.join(output, `Tablelight-Setup-${version}-x64.exe`)));
  return output;
}
(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const feed = `http://127.0.0.1:${server.address().port}/`;
  const first = await buildVersion('0.0.1', feed);
  releaseDir = await buildVersion('0.0.2', feed);
  const TL = require('../core');
  const state = TL.empty();
  const c = TL.character(0);
  c.name = 'Synthetic update player';
  c.maxHp = 42;
  c.hp = 23;
  c.notes = 'Private synthetic note survives the update.';
  state.characters = [c];
  state.activeId = c.id;
  state.roster = [{ ...TL.character(1), name: 'Synthetic saved player' }];
  state.settings.hudControlsVersion = 1;
  fs.mkdirSync(path.join(testRoot, 'data'), { recursive: true });
  fs.writeFileSync(
    path.join(testRoot, 'data', 'party.json'),
    JSON.stringify(TL.toBackup(state), null, 2)
  );
  console.log('Installing isolated test version in ' + installDir);
  await run(
    path.join(first, 'Tablelight-Setup-0.0.1-x64.exe'),
    ['/S', '/D=' + installDir],
    path.join(testRoot, 'install.log'),
    { windowsVerbatimArguments: true }
  );
  const executable = path.join(installDir, 'Tablelight Update Test.exe');
  assert.ok(fs.existsSync(executable));
  console.log('Running the real update and restart…');
  const oldProcess = run(executable, [], path.join(testRoot, 'application.log'));
  oldProcess.catch(() => {});
  const resultFile = path.join(testRoot, 'installed-results.json');
  const started = Date.now();
  while (!fs.existsSync(resultFile)) {
    if (Date.now() - started > 150000)
      throw new Error('Installed update timed out. See ' + testRoot);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const result = JSON.parse(fs.readFileSync(resultFile));
  if (!result.passed) throw new Error(result.error);
  assert.equal(result.executable.toLowerCase(), executable.toLowerCase());
  assert.ok(requests.some((request) => request.url.includes('Tablelight-Setup-0.0.2-x64.exe')));
  for (const request of requests) {
    assert.equal(request.headers['x-user-staging-id'], undefined);
    assert.equal(request.headers.cookie, undefined);
    assert.equal(request.headers.authorization, undefined);
    assert.equal(request.method, 'GET');
  }
  await oldProcess;
  console.log('Installed update passed: ' + result.results.length + ' checks. ' + testRoot);
  // Only uninstall the dedicated test application after confirming its exact location and identity.
  const resolved = path.resolve(installDir);
  if (!resolved.startsWith(path.resolve(testRoot) + path.sep))
    throw new Error('Unexpected test installation directory.');
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(resolved, 'resources', 'app', 'package.json'))).name,
    'tablelight-update-test'
  );
  await run(
    path.join(resolved, 'Uninstall Tablelight Update Test.exe'),
    ['/S'],
    path.join(testRoot, 'uninstall.log')
  );
  assert.ok(fs.existsSync(path.join(testRoot, 'data', 'party.json')));
  console.log('Test uninstall preserved the isolated saved data.');
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    server.closeAllConnections();
    server.close();
  });
