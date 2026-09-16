/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs');
module.exports = async function waitInstalledResult(
  file,
  launched,
  { timeoutMs = 150000, intervalMs = 500 } = {}
) {
  let launchError;
  launched.catch((error) => {
    launchError = error;
  });
  const deadline = Date.now() + timeoutMs;
  while (!fs.existsSync(file)) {
    if (launchError) throw launchError;
    if (Date.now() >= deadline) throw Error('Installed update timed out waiting for ' + file);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};
