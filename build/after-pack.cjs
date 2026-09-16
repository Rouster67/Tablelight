/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
module.exports = (context) => {
  // electron-builder's default exclusions can omit an extensionless LICENSE from app files.
  // The DM license action reads this exact path, independently of the root-level notice.
  fs.copyFileSync(
    path.join(context.packager.projectDir, 'LICENSE'),
    path.join(context.appOutDir, 'resources', 'app', 'LICENSE')
  );
  // electron-builder trims development metadata from the runtime package.json.
  // Retain the original manifests separately so the included source can be rebuilt.
  for (const name of ['package.json', 'package-lock.json'])
    fs.copyFileSync(
      path.join(context.packager.projectDir, name),
      path.join(context.appOutDir, 'resources', 'source-' + name)
    );
};
