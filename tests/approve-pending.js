/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
// Existing feature scenarios still verify spending after the newly required DM approval.
// approval-queue-native exercises the actual review buttons and all pending states separately.
module.exports = async function approvePending(controller) {
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const start = Date.now();
  while (!(await run('return approvalState.pending.length > 0;'))) {
    if (Date.now() - start > 10000) throw new Error('No ability request reached the DM.');
    await new Promise((r) => setTimeout(r, 30));
  }
  await run(`const r=approvalState.pending[0],c=state.characters.find(c=>c.id===r.characterId),it=c.items.find(it=>it.id===r.itemId);
    await api.approvalCommand(approvalCommand('approve',{requestId:r.id,confirmedConcentration:TL.concentrationUseWarning(c,it)?.token||''}));`);
};
