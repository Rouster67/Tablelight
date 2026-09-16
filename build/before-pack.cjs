/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const path = require('node:path');
const { checkGuide } = require('../scripts/check-guide.cjs');
module.exports = (context) => {
  const root = context.packager.projectDir;
  const testing = process.env.TABLELIGHT_ALLOW_DRAFT_GUIDE === '1';
  if (testing) {
    const output = path.relative(root, context.appOutDir).replaceAll('\\', '/');
    if (
      !/^(dist\/testing-[^/]+|test-results\/[^/]+)\//.test(output) ||
      context.packager.info.options.publish !== 'never'
    )
      throw Error(
        'Draft guides are only allowed in isolated testing output with publishing disabled.'
      );
  }
  checkGuide(root, { allowDraft: testing });
};
