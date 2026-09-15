/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { inflateSync } = require('node:zlib');
const Icon = require('./ability-icon');
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_EDGE = 4096;
const pixelCache = new Set();
function dimensions(width, height) {
  if (!width || !height || width > MAX_SOURCE_EDGE || height > MAX_SOURCE_EDGE)
    throw new Error('Choose an image with edges no larger than 4096 pixels.');
  return { width, height };
}
function inspectSource(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_SOURCE_BYTES)
    throw new Error('Choose an image no larger than 5 MiB.');
  const invalid = () => {
    throw new Error('This image could not be opened. Choose a valid static PNG, JPG, or WebP.');
  };
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    const info = Icon.pngInfo(bytes, MAX_SOURCE_EDGE, false);
    return { type: 'image/png', ...dimensions(info.width, info.height) };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) invalid();
    let size;
    for (let offset = 2; offset < bytes.length; ) {
      if (bytes[offset++] !== 0xff) invalid();
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda) {
        if (!size || offset + 2 > bytes.length) invalid();
        const length = bytes.readUInt16BE(offset);
        if (length < 6 || offset + length >= bytes.length - 2) invalid();
        return { type: 'image/jpeg', ...size };
      }
      if (marker === 0xd9 || marker === 0 || offset + 2 > bytes.length) invalid();
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) invalid();
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (length < 8 || size) invalid();
        size = dimensions(bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3));
      }
      offset += length;
    }
    invalid();
  }
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    if (bytes.length < 20 || bytes.readUInt32LE(4) + 8 !== bytes.length) invalid();
    let size,
      canvas,
      image = false;
    for (let offset = 12; offset < bytes.length; ) {
      if (offset + 8 > bytes.length) invalid();
      const type = bytes.toString('ascii', offset, offset + 4),
        length = bytes.readUInt32LE(offset + 4);
      const start = offset + 8,
        end = start + length;
      if (end + (length % 2) > bytes.length) invalid();
      if (type === 'ANIM' || type === 'ANMF' || (type === 'VP8X' && length && bytes[start] & 2))
        throw new Error('Choose a static image. Animated icons are not supported.');
      if (type === 'VP8X') {
        if (offset !== 12 || length !== 10) invalid();
        canvas = dimensions(bytes.readUIntLE(start + 4, 3) + 1, bytes.readUIntLE(start + 7, 3) + 1);
      } else if (type === 'VP8 ') {
        if (
          image ||
          length < 10 ||
          bytes[start] & 1 ||
          !bytes.subarray(start + 3, start + 6).equals(Buffer.from([0x9d, 1, 0x2a]))
        )
          invalid();
        size = dimensions(
          bytes.readUInt16LE(start + 6) & 0x3fff,
          bytes.readUInt16LE(start + 8) & 0x3fff
        );
        image = true;
      } else if (type === 'VP8L') {
        if (image || length < 5 || bytes[start] !== 0x2f || bytes[start + 4] & 0xe0) invalid();
        const bits = bytes.readUInt32LE(start + 1);
        size = dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
        image = true;
      }
      offset = end + (length % 2);
    }
    if (!image || (canvas && (canvas.width !== size.width || canvas.height !== size.height)))
      invalid();
    return { type: 'image/webp', ...size };
  }
  invalid();
}
function validatePixels(value) {
  if (!value) return;
  const info = Icon.inspect(value);
  if (pixelCache.has(value)) return;
  const bytes = Buffer.from(value.slice(Icon.PREFIX.length), 'base64');
  const compressed = Buffer.concat(
    info.chunks
      .filter((c) => c.type === 'IDAT')
      .map((c) => bytes.subarray(c.start, c.start + c.length))
  );
  const stride = info.width * 4 + 1,
    expected = stride * info.height;
  try {
    const decoded = inflateSync(compressed, { maxOutputLength: expected, info: true });
    if (decoded.buffer.length !== expected || decoded.engine.bytesWritten !== compressed.length)
      throw new Error();
    for (let offset = 0; offset < expected; offset += stride)
      if (decoded.buffer[offset] > 4) throw new Error();
  } catch {
    throw new Error('The ability icon contains damaged PNG pixels.');
  }
  if (pixelCache.size >= 32) pixelCache.delete(pixelCache.values().next().value);
  pixelCache.add(value);
}
function validateStateIcons(state) {
  for (const entry of state.library) validatePixels(entry.icon);
  for (const c of [...state.characters, ...state.roster])
    for (const it of c.items) if (it.local) validatePixels(it.icon);
  return state;
}
async function convertIcon(bytes, decode) {
  const info = inspectSource(bytes);
  const value = await decode(`data:${info.type};base64,${bytes.toString('base64')}`);
  Icon.normalize(value);
  if (!value) throw new Error('The image could not be converted.');
  validatePixels(value);
  return value;
}
async function readIcon(file, decode) {
  const handle = await fs.promises.open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_SOURCE_BYTES)
      throw new Error('Choose an image no larger than 5 MiB.');
    const buffer = Buffer.alloc(MAX_SOURCE_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const result = await handle.read(buffer, length, buffer.length - length, null);
      if (!result.bytesRead) break;
      length += result.bytesRead;
    }
    return await convertIcon(buffer.subarray(0, length), decode);
  } finally {
    await handle.close();
  }
}
async function decodeInWindow(data, BrowserWindow) {
  const win = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      partition: 'ability-icon-decoder',
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  let timer;
  try {
    return await Promise.race([
      (async () => {
        await win.loadFile(path.join(__dirname, 'image-import.html'));
        return win.webContents.executeJavaScript(
          `window.decodeAbilityIcon(${JSON.stringify(data)})`
        );
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('The image took too long to open. Choose a smaller image.')),
          10000
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (!win.isDestroyed()) win.destroy();
  }
}
module.exports = {
  MAX_SOURCE_BYTES,
  MAX_SOURCE_EDGE,
  inspectSource,
  validatePixels,
  validateStateIcons,
  convertIcon,
  readIcon,
  decodeInWindow,
};
