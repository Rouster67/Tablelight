/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
window.decodeAbilityIcon = async (data) => {
  const image = new Image();
  image.src = data;
  try {
    await image.decode();
    const width = image.naturalWidth,
      height = image.naturalHeight;
    if (!width || !height || width > 4096 || height > 4096)
      throw new Error('Image dimensions are not supported.');
    const ratio = Math.min(1, 256 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch {
    throw new Error('This image could not be opened. Choose a valid static PNG, JPG, or WebP.');
  } finally {
    image.src = '';
  }
};
