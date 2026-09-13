/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
module.exports = (context) => {
  // electron-builder trims development metadata from the runtime package.json.
  // Retain the original manifests separately so the included source can be rebuilt.
  for (const name of ['package.json', 'package-lock.json'])
    fs.copyFileSync(
      path.join(context.packager.projectDir, name),
      path.join(context.appOutDir, 'resources', 'source-' + name)
    );
};
