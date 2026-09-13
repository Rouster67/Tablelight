/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http'),
  assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');
if (process.platform !== 'win32') throw new Error('Installer tests require Windows.');
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
const testRoot = fs.mkdtempSync(path.join(root, 'test-results', 'installed-update-'));
const installDir = path.join(testRoot, 'installed app');
const testInstallerGuid = randomUUID();
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
  if (name.endsWith('.exe') && !request.url.startsWith('/assets/')) {
    response.writeHead(302, { Location: '/assets/' + name });
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
      guid: testInstallerGuid,
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
  c.avatar =
    'data:image/png;base64,' + fs.readFileSync(path.join(root, 'icon.png')).toString('base64');
  c.abilities.int = 17;
  c.slots[0] = { level: 1, max: 3, current: 1 };
  c.resources = [
    {
      id: 'test-pool',
      name: 'Synthetic pool',
      max: 5,
      current: 2,
      reset: 'long',
      icon: 'diamond',
      color: '#123456',
    },
  ];
  state.characters = [c];
  state.activeId = c.id;
  state.roster = [{ ...TL.character(1), name: 'Synthetic saved player', avatar: c.avatar }];
  state.library = [
    TL.libraryEntry({
      name: 'Synthetic spell',
      kind: 'spell',
      level: 1,
      requiresConcentration: true,
      description: 'Synthetic spell text.',
    }),
    TL.libraryEntry({
      name: 'Synthetic action',
      kind: 'action',
      description: 'Synthetic action text.',
    }),
    TL.libraryEntry({
      name: 'Synthetic feature',
      kind: 'feature',
      description: 'Synthetic feature text.',
    }),
    TL.libraryEntry({
      name: 'Unassigned ability',
      description: 'Retain unused library entries too.',
    }),
  ];
  const concentration = TL.attachItem(state, c.id, state.library[0].id, {
    resourceId: 'test-pool',
    resourceCost: 2,
  });
  TL.attachItem(state, c.id, state.library[1].id);
  TL.attachItem(state, state.roster[0].id, state.library[2].id, { disabled: true });
  TL.setConcentration(c, true, concentration.id);
  state.conditionLibrary = [
    TL.conditionEntry({
      name: 'Active condition',
      description: 'Synthetic active condition text.',
    }),
    TL.conditionEntry({
      name: 'Saved-player condition',
      description: 'Synthetic saved-player condition text.',
    }),
    TL.conditionEntry({
      name: 'Unassigned condition',
      description: 'Retain unused conditions too.',
    }),
  ];
  TL.assignCondition(state, c.id, state.conditionLibrary[0].id);
  TL.assignCondition(state, state.roster[0].id, state.conditionLibrary[1].id);
  state.settings.opacity = 0.81;
  state.settings.soloExpand = true;
  state.settings.hudControlsVersion = 1;
  fs.mkdirSync(path.join(testRoot, 'data'), { recursive: true });
  fs.writeFileSync(
    path.join(testRoot, 'data', 'party.json'),
    JSON.stringify(TL.toBackup(state), null, 2)
  );
  c.hp = 22; // The old app makes this last edit before updating.
  fs.writeFileSync(path.join(testRoot, 'expected-party.json'), JSON.stringify(TL.toBackup(state)));
  console.log('Installing isolated test version in ' + installDir);
  await run(
    path.join(first, 'Tablelight-Setup-0.0.1-x64.exe'),
    ['/S', '/D=' + installDir],
    path.join(testRoot, 'install.log'),
    { windowsVerbatimArguments: true }
  );
  const executable = path.join(installDir, 'Tablelight Update Test.exe');
  assert.ok(fs.existsSync(executable));
  // Only this run's synthetic app owns this fresh registry key. Remove its path
  // record so the update must preserve the running app's custom folder itself.
  const testRegistryKey = `HKCU\\Software\\${testInstallerGuid}`;
  const registryOptions = { windowsHide: true, encoding: 'utf8' };
  const registeredPath = execFileSync(
    'reg.exe',
    ['query', testRegistryKey, '/v', 'InstallLocation'],
    registryOptions
  );
  assert.ok(registeredPath.includes(installDir));
  execFileSync(
    'reg.exe',
    ['delete', testRegistryKey, '/v', 'InstallLocation', '/f'],
    registryOptions
  );
  console.log('Testing a custom folder with spaces and no saved installation path.');
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
  assert.ok(requests.some((request) => request.url.startsWith('/assets/')));
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
  for (const name of ['party.json', 'party.previous.json', 'updates.json']) {
    assert.deepEqual(
      fs.readFileSync(path.join(testRoot, 'data', name)),
      fs.readFileSync(path.join(testRoot, 'before-install-data', name))
    );
  }
  console.log(
    'Test uninstall preserved the party, previous save, and update preference byte for byte.'
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    server.closeAllConnections();
    server.close();
  });
