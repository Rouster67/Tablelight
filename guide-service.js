/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

class GuideService {
  constructor(appDirectory, openPath, readFile = fs.readFile) {
    this.file = path.join(appDirectory, 'docs', 'Tablelight-User-Guide.pdf');
    this.openPath = openPath;
    this.readFile = readFile;
    this.pending = null;
  }
  open(...args) {
    if (args.length)
      throw Error('The user guide control does not accept a file path or arguments.');
    if (!this.pending)
      this.pending = this.openFile().finally(() => {
        this.pending = null;
      });
    return this.pending;
  }
  async openFile() {
    try {
      const bytes = await this.readFile(this.file);
      if (bytes.subarray(0, 5).toString() !== '%PDF-')
        return {
          ok: false,
          message:
            'The bundled guide is damaged. Reinstall this version of Tablelight, then try opening the guide again. Your saved party is stored separately.',
        };
    } catch (error) {
      return {
        ok: false,
        message:
          error.code === 'ENOENT'
            ? 'The bundled guide is missing. Reinstall this version of Tablelight, then try opening the guide again. Your saved party is stored separately.'
            : 'Tablelight cannot read the bundled guide. Check access to the installation folder or reinstall Tablelight, then try opening the guide again. Your saved party is stored separately.',
      };
    }
    try {
      if (await this.openPath(this.file)) throw Error('Viewer unavailable');
      return {
        ok: true,
        message:
          'Guide sent to your PDF viewer. If no window appears, choose a default PDF app in Windows and try again.',
      };
    } catch {
      return {
        ok: false,
        message:
          'Windows could not open the guide. Install or choose a default PDF app in Windows Settings, then try opening the guide again. The PDF is in docs inside the installed app files.',
      };
    }
  }
}
module.exports = { GuideService };
