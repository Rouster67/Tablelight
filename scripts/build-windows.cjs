/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
if (process.platform !== 'win32') throw new Error('Build the Windows release on Windows.');
const packageInfo = require('../package.json');
const runtime = process.env.TABLELIGHT_ELECTRON_DIST
  ? path.resolve(process.env.TABLELIGHT_ELECTRON_DIST)
  : path.dirname(require('electron'));
if (
  fs.readFileSync(path.join(runtime, 'version'), 'utf8').trim() !==
  packageInfo.devDependencies.electron
)
  throw new Error('The Electron runtime does not match package.json.');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
const target = path.join(dist, 'Tablelight');
if (fs.existsSync(target))
  throw new Error(
    'dist/Tablelight already exists. Move or remove that previous build, then try again.'
  );
fs.cpSync(runtime, target, { recursive: true });
// A local verification runtime may already use the Tablelight name.
const executable = path.join(target, 'electron.exe');
if (fs.existsSync(executable)) fs.renameSync(executable, path.join(target, 'Tablelight.exe'));
if (!fs.existsSync(path.join(target, 'Tablelight.exe')))
  throw new Error('Electron executable is missing.');
// Copy a strict allowlist, never local saves, node_modules, or test outputs.
const appDir = path.join(target, 'resources', 'app');
if (fs.existsSync(appDir)) fs.rmSync(appDir, { recursive: true });
fs.mkdirSync(appDir, { recursive: true });
for (const name of fs.readdirSync(root)) {
  if (
    /\.(js|html|css)$/.test(name) ||
    [
      'icon.png',
      'package.json',
      'package-lock.json',
      'LICENSE',
      'LICENSE.electron.txt',
      'NOTICE.md',
      'THIRD_PARTY_NOTICES.md',
      'README.md',
      'CHANGELOG.md',
      'CONTRIBUTING.md',
      'SECURITY.md',
      '.gitignore',
      '.gitattributes',
      '.editorconfig',
      '.prettierrc.json',
      '.prettierignore',
      'docs',
      'scripts',
      'tests',
      '.github',
    ].includes(name)
  ) {
    fs.cpSync(path.join(root, name), path.join(appDir, name), { recursive: true });
  }
}
fs.copyFileSync(path.join(root, 'docs', 'USER_GUIDE.md'), path.join(target, 'START HERE.md'));
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(target, 'LICENSE.Tablelight.txt'));
fs.copyFileSync(path.join(root, 'NOTICE.md'), path.join(target, 'NOTICE.Tablelight.md'));
fs.copyFileSync(
  path.join(root, 'THIRD_PARTY_NOTICES.md'),
  path.join(target, 'THIRD_PARTY_NOTICES.md')
);
// Pass fixed paths as PowerShell literals; apostrophes are escaped, never interpolated as code.
const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
const zip = path.join(dist, `Tablelight-Windows-v${packageInfo.version}.zip`);
if (fs.existsSync(zip)) fs.unlinkSync(zip);
execFileSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory(${literal(target)}, ${literal(zip)}, [System.IO.Compression.CompressionLevel]::Optimal, $true)`,
  ],
  { stdio: 'inherit', windowsHide: true }
);
console.log('Windows release: ' + zip);
