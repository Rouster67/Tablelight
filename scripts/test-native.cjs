/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
if (process.platform !== 'win32')
  throw new Error('Native overlay tests require a Windows desktop session.');
const electron = require('electron');
const resultsRoot = path.join(root, 'test-results');
fs.mkdirSync(resultsRoot, { recursive: true });
const scenarios = [
  'passives-hud',
  'passives-dm',
  'passives',
  'visual-improvements',
  'player-messages-ui',
  'player-messages',
  'character-themes',
  'hud-themes',
  'ability-icons-performance',
  'ability-icons-ui',
  'ability-icons',
  'history',
  'approval-queue',
  'standard',
  'updates',
  'updates-transport',
  'library',
  'library-deletion',
  'ability-fields',
  'duplicates',
  'interactive',
  'layout',
  'session',
  'roster',
  'sidebar',
  'wide-hud',
  'fixed-resources',
  'conditions',
  'condition-picker',
  'concentration',
  'concentration-reminder',
  'concentration-use',
];
const requested = process.argv.slice(2);
if (requested.some((scenario) => !scenarios.includes(scenario)))
  throw new Error('Unknown native test scenario.');
for (const scenario of requested.length ? requested : scenarios) {
  const dir = fs.mkdtempSync(path.join(resultsRoot, scenario + '-'));
  const child = spawnSync(electron, [root, '--self-test'], {
    env: {
      ...process.env,
      TABLELIGHT_TEST_DATA: path.join(dir, 'data'),
      TABLELIGHT_TEST_SCENARIO: scenario,
    },
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  });
  fs.writeFileSync(path.join(dir, 'process.log'), (child.stdout || '') + (child.stderr || ''));
  if (child.error || child.status !== 0)
    throw child.error || new Error(scenario + ' test process failed. See ' + dir);
  if (['character-themes', 'player-messages'].includes(scenario)) {
    const first = JSON.parse(fs.readFileSync(path.join(dir, scenario + '-results.json'), 'utf8'));
    if (!first.passed) throw new Error(first.error + '\nSee ' + dir);
    const restart = spawnSync(electron, [root, '--self-test'], {
      env: {
        ...process.env,
        TABLELIGHT_TEST_DATA: path.join(dir, 'data'),
        TABLELIGHT_TEST_SCENARIO: scenario,
        TABLELIGHT_TEST_RESTART: '1',
      },
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    });
    fs.writeFileSync(
      path.join(dir, 'restart.log'),
      (restart.stdout || '') + (restart.stderr || '')
    );
    if (restart.error || restart.status !== 0)
      throw restart.error || new Error(scenario + ' restart failed. See ' + dir);
    if (!fs.existsSync(path.join(dir, scenario + '-restart-results.json')))
      throw new Error('Missing ' + scenario + ' restart results. See ' + dir);
  }
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('results.json'));
  if (!files.length) throw new Error('No ' + scenario + ' test results. See ' + dir);
  for (const name of files) {
    const result = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    if (!result.passed) throw new Error(scenario + ' failed: ' + result.error + '\nSee ' + dir);
    console.log(scenario + ': ' + result.results.length + ' checks passed.');
  }
}
