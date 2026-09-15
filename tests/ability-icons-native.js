/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { BrowserWindow, dialog, nativeImage } = require('electron');
const TL = require('../core'),
  Icon = require('../ability-icon');
const { convertIcon, decodeInWindow, inspectSource } = require('../image-import');
const { png, chunk } = require('./icon-fixtures');
module.exports = async ({ app, controller, getOverlay, getState, setOverlay, store }) => {
  const directory = path.dirname(store.directory),
    results = [];
  const run = (code) => controller.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const originalDialog = dialog.showOpenDialog;
  const decode = (data) => decodeInWindow(data, BrowserWindow);
  try {
    const input = await run(`
      const canvas=document.createElement('canvas');canvas.width=600;canvas.height=300;
      const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(240,0,0,0.5)';ctx.fillRect(0,0,300,300);
      ctx.fillStyle='rgba(0,0,240,0.5)';ctx.fillRect(300,0,300,300);
      return Object.fromEntries(['png','jpeg','webp'].map(type=>[type,canvas.toDataURL('image/'+type)]));
    `);
    const converted = {};
    for (const [type, url] of Object.entries(input)) {
      const buffer = Buffer.from(url.split(',')[1], 'base64');
      assert.equal(inspectSource(buffer).type, 'image/' + type);
      const output = await convertIcon(buffer, decode);
      const info = Icon.inspect(output);
      assert.equal(info.width, 256);
      assert.equal(info.height, 128);
      assert.ok(info.byteLength <= Icon.MAX_BYTES);
      assert.ok(info.chunks.every((c) => ['IHDR', 'sRGB', 'IDAT', 'IEND'].includes(c.type)));
      const picture = nativeImage.createFromDataURL(output);
      assert.equal(picture.isEmpty(), false);
      assert.deepEqual(picture.getSize(), { width: 256, height: 128 });
      if (type === 'png') {
        const bitmap = picture.toBitmap();
        assert.ok(bitmap[3] >= 126 && bitmap[3] <= 129, 'Transparency is preserved.');
      }
      converted[type] = output;
    }
    const tiny = await convertIcon(png(2, 1), decode);
    assert.equal(Icon.inspect(tiny).width, 2);
    assert.equal(Icon.inspect(tiny).height, 1);
    const metadata = await convertIcon(
      png(2, 1, { extra: [chunk('tEXt', Buffer.from('Note\0Private source metadata'))] }),
      decode
    );
    assert.equal(
      Buffer.from(metadata.split(',')[1], 'base64').includes(
        Buffer.from('Private source metadata')
      ),
      false
    );
    results.push(
      'PNG, JPEG, and WebP convert to fitted PNG icons; transparency and small dimensions survive and source metadata is removed.'
    );

    const exif = Buffer.from(
      '45786966000049492a0008000000010012010300010000000600000000000000',
      'hex'
    );
    const app1 = Buffer.alloc(exif.length + 4);
    app1[0] = 0xff;
    app1[1] = 0xe1;
    app1.writeUInt16BE(exif.length + 2, 2);
    exif.copy(app1, 4);
    const jpeg = Buffer.from(input.jpeg.split(',')[1], 'base64');
    const oriented = await convertIcon(
      Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]),
      decode
    );
    assert.equal(Icon.inspect(oriented).width, 128);
    assert.equal(Icon.inspect(oriented).height, 256);
    const oversized = await run(
      `const c=document.createElement('canvas');c.width=4097;c.height=1;return c.toDataURL('image/jpeg');`
    );
    await assert.rejects(
      convertIcon(Buffer.from(oversized.split(',')[1], 'base64'), decode),
      /4096/
    );
    const animatedWebp = Buffer.from(input.webp.split(',')[1], 'base64');
    assert.equal(animatedWebp.toString('ascii', 12, 16), 'VP8X');
    animatedWebp[20] |= 2;
    await assert.rejects(convertIcon(animatedWebp, decode), /static/);
    await assert.rejects(
      convertIcon(png(2, 1, { extra: [chunk('acTL', Buffer.alloc(8))] }), decode),
      /static/
    );
    await assert.rejects(
      convertIcon(Buffer.from(input.jpeg.split(',')[1], 'base64').subarray(0, -2), decode)
    );
    results.push(
      'Source orientation is honored; oversized images, animated PNG/WebP, and truncated JPEG input are rejected.'
    );

    const file = path.join(directory, 'user-icon.webp');
    fs.writeFileSync(file, Buffer.from(input.webp.split(',')[1], 'base64'));
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    const imported = await run(`return window.tablelight.abilityIcon();`);
    assert.equal(Icon.inspect(imported).width, 256);
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
    assert.equal(await run(`return window.tablelight.abilityIcon();`), null);
    const c = TL.character(),
      other = TL.character(1),
      inactive = TL.character(2);
    const state = TL.empty();
    state.characters = [c, other];
    state.roster = [inactive];
    state.library = [
      TL.libraryEntry({ id: 'icon-entry', name: 'Icon test', icon: imported, economy: 'free' }),
    ];
    for (const [i, player] of TL.allCharacters(state).entries()) {
      TL.attachItem(state, player.id, 'icon-entry');
      player.hud.rotation = i * 90;
    }
    await run(
      `await commit(()=>{state=TL.normalize(${JSON.stringify(state)});},'Image fixture');await saveQueue;`
    );
    assert.equal(getState().library[0].icon, imported);
    await setOverlay(true);
    const overlay = getOverlay();
    const rejected = await overlay.webContents.executeJavaScript(
      `window.tablelight.abilityIcon().then(()=>false,error=>error.message)`
    );
    assert.match(rejected, /DM window/);
    const before = TL.clone(getState());
    await run(
      `selectedId=state.characters[0].id;editLibraryEntry('icon-entry');document.querySelector('#item-form [name=name]').value='Edited name';document.getElementById('item-form').requestSubmit();await saveQueue;`
    );
    assert.equal(getState().library[0].icon, imported);
    assert.equal(getState().library[0].name, 'Edited name');
    assert.deepEqual(
      getState().characters.map((c) => c.hud),
      before.characters.map((c) => c.hud)
    );
    const saved = JSON.parse(fs.readFileSync(store.file, 'utf8'));
    assert.equal(saved.version, 10);
    assert.equal(saved.library[0].icon, imported);
    assert.equal(saved.characters[0].items[0].icon, undefined);
    assert.equal(saved.roster[0].items[0].icon, undefined);
    assert.equal(store.load().state.characters[1].items[0].icon, imported);
    results.push(
      'The DM-only image bridge supports selection and cancellation; existing editing preserves icons and saves store one shared image without changing HUD placement.'
    );
    fs.writeFileSync(
      path.join(directory, 'ability-icons-results.json'),
      JSON.stringify({ passed: true, results }, null, 2)
    );
  } catch (error) {
    fs.writeFileSync(
      path.join(directory, 'ability-icons-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
  } finally {
    dialog.showOpenDialog = originalDialog;
    setOverlay(false);
    app.quit();
  }
};
