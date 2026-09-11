/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function check(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'test-results', 'test-data', '.git'].includes(entry.name))
      continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) check(file);
    else if (/\.(?:js|cjs)$/.test(entry.name))
      execFileSync(process.execPath, ['--check', file], { stdio: 'inherit', windowsHide: true });
  }
}
check(root);
console.log('JavaScript syntax checks passed.');
