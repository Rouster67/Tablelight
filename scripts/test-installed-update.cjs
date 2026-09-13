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
const shortcutName = 'Tablelight Uninstall Test ' + testInstallerGuid;
const shortcutFolders = JSON.parse(
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs')) | ConvertTo-Json",
    ],
    { windowsHide: true, encoding: 'utf8' }
  )
);
const shortcuts = shortcutFolders.map((folder) => path.join(folder, shortcutName + '.lnk'));
const testInclude = path.join(testRoot, 'uninstaller-test.nsh');
if (/["$\r\n]/.test(testRoot)) throw new Error('Unsupported NSIS test path.');
fs.writeFileSync(
  testInclude,
  `!define TABLELIGHT_UNINSTALL_TEST_ROOT "${testRoot}"\n!include "${path.join(root, 'build', 'installer.nsh')}"\n`
);
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
      include: testInclude,
      shortcutName,
      uninstallDisplayName: 'Tablelight Update Test',
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
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
  for (const shortcut of shortcuts) assert.ok(fs.existsSync(shortcut), 'Test shortcut exists.');
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
  // Run an identical copy outside the installation, with NSIS's test destination
  // argument, so awaiting the process includes cleanup instead of only its launcher.
  const uninstaller = path.join(testRoot, 'test-uninstaller.exe');
  fs.copyFileSync(path.join(resolved, 'Uninstall Tablelight Update Test.exe'), uninstaller);
  const uninstall = (args, name) =>
    run(uninstaller, [...args, '_?=' + resolved], path.join(testRoot, name + '.log'), {
      windowsVerbatimArguments: true,
    });
  const unrelated = path.join(testRoot, 'unrelated files');
  fs.mkdirSync(unrelated);
  const unrelatedFile = path.join(unrelated, 'backup.json');
  fs.writeFileSync(unrelatedFile, 'Synthetic unrelated file.');
  await assert.rejects(
    run(
      uninstaller,
      ['/S', '_?=' + unrelated],
      path.join(testRoot, 'reject-unidentified-folder.log'),
      { windowsVerbatimArguments: true }
    ),
    /exited with 2/
  );
  assert.equal(fs.readFileSync(unrelatedFile, 'utf8'), 'Synthetic unrelated file.');
  assert.ok(fs.existsSync(executable), 'An unidentified folder cannot uninstall the app.');
  for (const args of [
    ['/S', '--delete-app-data'],
    ['/S', '--updated', '--delete-app-data'],
  ]) {
    await assert.rejects(uninstall(args, 'blocked-delete-' + args.length), /exited with 2/);
    assert.ok(fs.existsSync(executable), 'A rejected deletion flag does not uninstall the app.');
    for (const name of ['party.json', 'party.previous.json', 'updates.json'])
      assert.deepEqual(
        fs.readFileSync(path.join(testRoot, 'data', name)),
        fs.readFileSync(path.join(testRoot, 'before-install-data', name))
      );
  }
  console.log('Silent deletion flags are rejected, including during an update.');
  await uninstall(['/S', '--updated'], 'update-uninstall');
  assert.ok(!fs.existsSync(executable));
  assert.ok(fs.existsSync(path.join(testRoot, 'cache')), 'Updating keeps its download cache.');
  for (const name of ['party.json', 'party.previous.json', 'updates.json'])
    assert.deepEqual(
      fs.readFileSync(path.join(testRoot, 'data', name)),
      fs.readFileSync(path.join(testRoot, 'before-install-data', name))
    );
  await run(
    path.join(releaseDir, 'Tablelight-Setup-0.0.2-x64.exe'),
    ['/S', '/D=' + installDir],
    path.join(testRoot, 'reinstall.log'),
    { windowsVerbatimArguments: true }
  );
  const external = path.join(testRoot, 'exported-files');
  const linkedCache = path.join(testRoot, 'cache', 'external-link');
  fs.mkdirSync(external, { recursive: true });
  fs.writeFileSync(path.join(external, 'backup.json'), 'Synthetic external backup.');
  fs.mkdirSync(path.dirname(linkedCache), { recursive: true });
  fs.symlinkSync(external, linkedCache, 'junction');
  await assert.rejects(uninstall(['/S'], 'linked-cache-uninstall'), /exited with 2/);
  assert.equal(
    fs.readFileSync(path.join(external, 'backup.json'), 'utf8'),
    'Synthetic external backup.'
  );
  assert.ok(
    fs.lstatSync(linkedCache).isSymbolicLink(),
    'Linked cache is kept instead of followed.'
  );
  assert.equal(fs.realpathSync(linkedCache), fs.realpathSync(external));
  fs.unlinkSync(linkedCache); // Remove only the junction created by this test.
  for (const name of ['party.json', 'party.previous.json', 'updates.json'])
    assert.deepEqual(
      fs.readFileSync(path.join(testRoot, 'data', name)),
      fs.readFileSync(path.join(testRoot, 'before-install-data', name))
    );
  console.log('Linked directories are kept; external files and saved data are preserved.');
  await run(
    path.join(releaseDir, 'Tablelight-Setup-0.0.2-x64.exe'),
    ['/S', '/D=' + installDir],
    path.join(testRoot, 'reinstall-after-link-test.log'),
    { windowsVerbatimArguments: true }
  );
  await uninstall(['/S'], 'uninstall');
  for (const name of ['party.json', 'party.previous.json', 'updates.json']) {
    assert.deepEqual(
      fs.readFileSync(path.join(testRoot, 'data', name)),
      fs.readFileSync(path.join(testRoot, 'before-install-data', name))
    );
  }
  console.log(
    'Test uninstall preserved the party, previous save, and update preference byte for byte.'
  );
  assert.ok(!fs.existsSync(path.join(testRoot, 'cache')), 'Normal uninstall removes update cache.');
  assert.ok(!fs.existsSync(executable), 'Normal uninstall removes the app.');
  for (const shortcut of shortcuts)
    assert.ok(!fs.existsSync(shortcut), 'Test shortcut is removed.');
  assert.ok(!fs.existsSync(installDir), 'The installation folder is removed.');
  for (const key of [
    testRegistryKey,
    `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${testInstallerGuid}`,
  ])
    assert.throws(() =>
      execFileSync('reg.exe', ['query', key], { ...registryOptions, stdio: 'pipe' })
    );
  await run(
    path.join(releaseDir, 'Tablelight-Setup-0.0.2-x64.exe'),
    ['/S', '/D=' + installDir],
    path.join(testRoot, 'reinstall-for-locked-file.log'),
    { windowsVerbatimArguments: true }
  );
  const lockedFile = path.join(resolved, 'synthetic-locked-file.txt');
  const lockedContents = 'Synthetic program file held open during uninstall.';
  const lockReady = path.join(testRoot, 'file-lock-ready.txt');
  const lockRelease = path.join(testRoot, 'file-lock-release.txt');
  fs.writeFileSync(lockedFile, lockedContents);
  fs.mkdirSync(path.join(testRoot, 'cache'), { recursive: true });
  fs.writeFileSync(path.join(testRoot, 'cache', 'synthetic-cache.txt'), 'Synthetic cache.');
  // FileShare.None reproduces a Windows file that the uninstaller cannot delete.
  // Keep the helper outside the installation and release it even if an assertion fails.
  const lockScript = `
$ErrorActionPreference = 'Stop'
$tablelightHeldStream = [IO.File]::Open($env:TABLELIGHT_TEST_LOCK_PATH, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
try {
  [IO.File]::WriteAllText($env:TABLELIGHT_TEST_LOCK_READY, 'ready')
  $tablelightLockTimer = [Diagnostics.Stopwatch]::StartNew()
  while (-not [IO.File]::Exists($env:TABLELIGHT_TEST_LOCK_RELEASE)) {
    if ($tablelightLockTimer.ElapsedMilliseconds -gt 45000) { throw 'Timed out waiting to release the test file.' }
    Start-Sleep -Milliseconds 100
  }
} finally {
  $tablelightHeldStream.Dispose()
}
`;
  let lockError;
  const fileHolder = run(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', lockScript],
    path.join(testRoot, 'file-lock-helper.log'),
    {
      timeout: 60000,
      env: {
        ...process.env,
        TABLELIGHT_TEST_LOCK_PATH: lockedFile,
        TABLELIGHT_TEST_LOCK_READY: lockReady,
        TABLELIGHT_TEST_LOCK_RELEASE: lockRelease,
      },
    }
  );
  fileHolder.catch((error) => {
    lockError = error;
  });
  try {
    const readyDeadline = Date.now() + 15000;
    while (!fs.existsSync(lockReady)) {
      if (lockError) throw lockError;
      if (Date.now() > readyDeadline) throw new Error('Test file lock was not ready in time.');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await assert.rejects(
      run(
        uninstaller,
        ['/S', '_?=' + resolved],
        path.join(testRoot, 'locked-program-file-uninstall.log'),
        { windowsVerbatimArguments: true, timeout: 30000 }
      ),
      /exited with 2/
    );
    assert.ok(fs.existsSync(lockedFile), 'A locked program file remains for a later cleanup.');
    assert.ok(!fs.existsSync(executable), 'Other program files are removed.');
    assert.ok(!fs.existsSync(path.join(testRoot, 'cache')), 'Ordinary cache cleanup still runs.');
    assert.equal(fs.readFileSync(unrelatedFile, 'utf8'), 'Synthetic unrelated file.');
    assert.equal(
      fs.readFileSync(path.join(external, 'backup.json'), 'utf8'),
      'Synthetic external backup.'
    );
    for (const name of ['party.json', 'party.previous.json', 'updates.json'])
      assert.deepEqual(
        fs.readFileSync(path.join(testRoot, 'data', name)),
        fs.readFileSync(path.join(testRoot, 'before-install-data', name))
      );
  } finally {
    fs.writeFileSync(lockRelease, 'release');
    await fileHolder;
  }
  assert.equal(path.dirname(lockedFile), resolved);
  assert.ok(!fs.lstatSync(resolved).isSymbolicLink());
  assert.ok(!fs.lstatSync(lockedFile).isSymbolicLink());
  assert.equal(fs.readFileSync(lockedFile, 'utf8'), lockedContents);
  assert.deepEqual(fs.readdirSync(resolved), [path.basename(lockedFile)]);
  fs.unlinkSync(lockedFile); // Only the synthetic file held open by this test.
  fs.rmdirSync(resolved); // Non-recursive: unexpected leftover files must fail the test.
  console.log('Locked program files report failure while saves and unrelated files survive.');
  await run(
    path.join(releaseDir, 'Tablelight-Setup-0.0.2-x64.exe'),
    ['/S', '/D=' + installDir],
    path.join(testRoot, 'reinstall-without-cache.log'),
    { windowsVerbatimArguments: true }
  );
  assert.ok(!fs.existsSync(path.join(testRoot, 'cache')));
  await uninstall(['/S'], 'uninstall-without-cache');
  assert.ok(!fs.existsSync(installDir));
  console.log('Uninstall succeeds when its download cache is already absent.');
  for (const record of ['missing', 'stale']) {
    await run(
      path.join(releaseDir, 'Tablelight-Setup-0.0.2-x64.exe'),
      ['/S', '/D=' + installDir],
      path.join(testRoot, 'reinstall-' + record + '-record.log'),
      { windowsVerbatimArguments: true }
    );
    if (record === 'missing')
      execFileSync('reg.exe', ['delete', testRegistryKey, '/f'], registryOptions);
    else
      execFileSync(
        'reg.exe',
        ['add', testRegistryKey, '/v', 'InstallLocation', '/t', 'REG_SZ', '/d', unrelated, '/f'],
        registryOptions
      );
    // Exercise the real launcher without NSIS's direct-test destination override.
    await run(
      path.join(installDir, 'Uninstall Tablelight Update Test.exe'),
      ['/S'],
      path.join(testRoot, 'normal-launch-' + record + '-record.log')
    );
    const deadline = Date.now() + 30000;
    while (fs.existsSync(installDir) || shortcuts.some((shortcut) => fs.existsSync(shortcut))) {
      if (Date.now() > deadline)
        throw new Error('Uninstall left files with a ' + record + ' record.');
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.equal(fs.readFileSync(unrelatedFile, 'utf8'), 'Synthetic unrelated file.');
    for (const name of ['party.json', 'party.previous.json', 'updates.json'])
      assert.deepEqual(
        fs.readFileSync(path.join(testRoot, 'data', name)),
        fs.readFileSync(path.join(testRoot, 'before-install-data', name))
      );
    for (const key of [
      testRegistryKey,
      `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${testInstallerGuid}`,
    ])
      assert.throws(() =>
        execFileSync('reg.exe', ['query', key], { ...registryOptions, stdio: 'pipe' })
      );
    console.log(
      'Normal uninstaller handles a ' + record + ' record without touching unrelated files.'
    );
  }
  if (process.argv.includes('--prepare-uninstall-ui')) {
    await run(
      path.join(releaseDir, 'Tablelight-Setup-0.0.2-x64.exe'),
      ['/S', '/D=' + installDir],
      path.join(testRoot, 'reinstall-for-ui.log'),
      { windowsVerbatimArguments: true }
    );
    fs.mkdirSync(path.join(testRoot, 'cache'), { recursive: true });
    fs.writeFileSync(
      path.join(testRoot, 'cache', 'synthetic-cache.txt'),
      'Synthetic update cache.'
    );
    fs.writeFileSync(path.join(testRoot, 'external-backup.json'), 'Synthetic exported backup.');
    fs.writeFileSync(
      path.join(testRoot, 'uninstaller-test.json'),
      JSON.stringify({ root: testRoot, installDir, guid: testInstallerGuid, shortcuts }, null, 2)
    );
    console.log(
      'Uninstall UI test ready: ' + path.join(installDir, 'Uninstall Tablelight Update Test.exe')
    );
  }
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    server.closeAllConnections();
    server.close();
  });
