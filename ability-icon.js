/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TLIcon = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_BYTES = 300 * 1024;
  const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
  const MAX_EDGE = 256;
  const PREFIX = 'data:image/png;base64,';
  const cache = new Map();
  const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
    for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  function crc32(bytes, start = 0, end = bytes.length) {
    let crc = 0xffffffff;
    for (let i = start; i < end; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function pngInfo(bytes, maxEdge = MAX_EDGE, canonical = true) {
    const invalid = () => {
      throw new Error('The ability icon contains invalid PNG data.');
    };
    if (bytes.length < 45 || ![137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b))
      invalid();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let width,
      height,
      ended = false,
      image = false,
      imageEnded = false;
    const chunks = [];
    for (let offset = 8; offset < bytes.length; ) {
      if (ended || offset + 12 > bytes.length) invalid();
      const length = view.getUint32(offset),
        end = offset + 12 + length;
      if (end > bytes.length) invalid();
      const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (
        !/^[A-Za-z]{4}$/.test(type) ||
        crc32(bytes, offset + 4, end - 4) !== view.getUint32(end - 4)
      )
        invalid();
      if (type === 'acTL' || type === 'fcTL' || type === 'fdAT')
        throw new Error('Choose a static image. Animated icons are not supported.');
      if (offset === 8 && type !== 'IHDR') invalid();
      if (type === 'IHDR') {
        if (offset !== 8 || length !== 13) invalid();
        width = view.getUint32(offset + 8);
        height = view.getUint32(offset + 12);
        if (!width || !height || width > maxEdge || height > maxEdge)
          throw new Error(`Ability icon edges must be between 1 and ${maxEdge} pixels.`);
        if (
          canonical &&
          (bytes[offset + 16] !== 8 ||
            bytes[offset + 17] !== 6 ||
            bytes[offset + 18] ||
            bytes[offset + 19] ||
            bytes[offset + 20])
        )
          invalid();
      } else if (type === 'IDAT') {
        if (imageEnded) invalid();
        image = true;
      } else if (type === 'IEND') {
        if (length || !image) invalid();
        ended = true;
      } else {
        if (image) imageEnded = true;
        if (canonical && !(type === 'sRGB' && length === 1 && bytes[offset + 8] <= 3)) invalid();
      }
      chunks.push({ type, start: offset + 8, length });
      offset = end;
    }
    if (!ended) invalid();
    return { width, height, byteLength: bytes.length, chunks };
  }
  function inspect(value) {
    if (
      typeof value !== 'string' ||
      !value.startsWith(PREFIX) ||
      value.length > PREFIX.length + Math.ceil(MAX_BYTES / 3) * 4
    )
      throw new Error('Ability icons must be PNG images no larger than 300 KiB.');
    if (cache.has(value)) return cache.get(value);
    const encoded = value.slice(PREFIX.length);
    if (
      !encoded ||
      encoded.length % 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)
    )
      throw new Error('The ability icon contains invalid image data.');
    const binary = atob(encoded);
    if (btoa(binary) !== encoded || binary.length > MAX_BYTES)
      throw new Error('The ability icon contains invalid image data.');
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const result = pngInfo(bytes);
    if (cache.size >= 32) cache.delete(cache.keys().next().value);
    cache.set(value, result);
    return result;
  }
  function normalize(value) {
    if (value === undefined || value === '') return '';
    inspect(value);
    return value;
  }
  function checkBudget(state) {
    let total = 0;
    const definitions = [
      ...state.library,
      ...[...state.characters, ...state.roster].flatMap((c) => c.items.filter((it) => it.local)),
    ];
    for (const entry of definitions) {
      if (entry.icon) total += inspect(entry.icon).byteLength;
      if (total > MAX_TOTAL_BYTES)
        throw new Error(
          'Ability icons can use up to 8 MiB in total, including character-only abilities. Remove or replace an icon with a smaller image first.'
        );
    }
  }
  return {
    MAX_BYTES,
    MAX_TOTAL_BYTES,
    MAX_EDGE,
    PREFIX,
    crc32,
    pngInfo,
    inspect,
    normalize,
    checkBudget,
  };
});
