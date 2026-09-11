/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const TL = require('./core');
class Store {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, 'party.json');
    this.backup = path.join(directory, 'party.previous.json');
  }
  load() {
    fs.mkdirSync(this.directory, { recursive: true });
    if (!fs.existsSync(this.file) && !fs.existsSync(this.backup))
      return { state: TL.empty(), warning: '' };
    try {
      return { state: TL.normalize(JSON.parse(fs.readFileSync(this.file, 'utf8'))), warning: '' };
    } catch (error) {
      try {
        return {
          state: TL.normalize(JSON.parse(fs.readFileSync(this.backup, 'utf8'))),
          warning: 'Your last save could not be read. The previous backup was recovered.',
        };
      } catch {
        throw new Error(
          'Your party files could not be read. They have been kept intact in ' +
            this.directory +
            '. Restore an exported backup after restarting with those files moved aside.'
        );
      }
    }
  }
  save(raw) {
    const state = TL.normalize(raw),
      content = JSON.stringify(TL.toBackup(state), null, 2),
      temp = this.file + '.tmp';
    fs.mkdirSync(this.directory, { recursive: true });
    fs.writeFileSync(temp, content, 'utf8');
    const fd = fs.openSync(temp, 'r+');
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    if (fs.existsSync(this.file)) {
      try {
        TL.normalize(JSON.parse(fs.readFileSync(this.file, 'utf8')));
        fs.copyFileSync(this.file, this.backup);
      } catch (error) {
        if (error.code) throw error;
      }
    }
    fs.renameSync(temp, this.file);
    return state;
  }
}
module.exports = { Store };
