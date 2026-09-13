/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { build, Platform, Arch } = require('electron-builder');
const root = path.resolve(__dirname, '..');
if (process.platform !== 'win32') throw new Error('Build the Windows release on Windows.');
const runtime = path.dirname(require('electron'));
if (
  fs.readFileSync(path.join(runtime, 'version'), 'utf8').trim() !==
  require('../package.json').devDependencies.electron
)
  throw new Error('The Electron runtime does not match package.json.');
build({
  projectDir: root,
  targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
  publish: 'never',
  config: { electronDist: runtime },
})
  .then((files) => {
    console.log('Windows installer and update metadata built in dist. Nothing was published.');
    for (const file of files) console.log(file);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
