/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const { crc32, deflateSync } = require('node:zlib');
function chunk(type, data) {
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length);
  result.write(type, 4, 4, 'ascii');
  data.copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, result.length - 4)), result.length - 4);
  return result;
}
function png(
  width = 2,
  height = 1,
  { pixel = [80, 120, 180, 90], extra = [], compressed, filter = 0, level = 6 } = {}
) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rows[y * (width * 4 + 1)] = filter;
    for (let x = 0; x < width; x++)
      for (let c = 0; c < 4; c++) rows[y * (width * 4 + 1) + 1 + x * 4 + c] = pixel[c];
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    ...extra,
    chunk('IDAT', compressed ?? deflateSync(rows, { level })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const dataUrl = (bytes) => 'data:image/png;base64,' + bytes.toString('base64');
module.exports = { chunk, png, dataUrl };
