/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
// Windows hit-tests the HUD regions directly, without a hover/ignore-mouse race.
function hudRegions(frames, viewportWidth, viewportHeight) {
  // Eight HUDs, eight independent collapsed-message cards, and one notice.
  if (!Array.isArray(frames) || frames.length > 17) throw new Error('Invalid HUD regions.');
  const rects = [];
  for (const f of frames) {
    if (
      !f ||
      !['cx', 'cy', 'width', 'height', 'rotation'].every((k) => Number.isFinite(f[k])) ||
      f.width <= 0 ||
      f.height <= 0 ||
      f.width > 10000 ||
      f.height > 1000000 ||
      Math.abs(f.cx) > 100000 ||
      Math.abs(f.cy) > 100000
    )
      throw new Error('Invalid HUD frame.');
    const angle = (f.rotation * Math.PI) / 180,
      cos = Math.cos(angle),
      sin = Math.sin(angle);
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([x, y]) => {
      const dx = x * (f.width / 2 + 4),
        dy = y * (f.height / 2 + 4);
      return { x: f.cx + dx * cos - dy * sin, y: f.cy + dx * sin + dy * cos };
    });
    const top = Math.max(0, Math.floor(Math.min(...corners.map((p) => p.y))));
    const bottom = Math.min(viewportHeight, Math.ceil(Math.max(...corners.map((p) => p.y))));
    // Horizontal strips follow rotated edges instead of covering their empty corners.
    for (let y = top; y < bottom; y += 2) {
      const height = Math.min(2, bottom - y),
        xs = [];
      for (const p of corners) if (p.y >= y && p.y <= y + height) xs.push(p.x);
      for (let i = 0; i < 4; i++) {
        const a = corners[i],
          b = corners[(i + 1) % 4];
        for (const edge of [y, y + height])
          if (a.y !== b.y && edge >= Math.min(a.y, b.y) && edge <= Math.max(a.y, b.y))
            xs.push(a.x + ((b.x - a.x) * (edge - a.y)) / (b.y - a.y));
      }
      if (!xs.length) continue;
      const x = Math.max(0, Math.floor(Math.min(...xs))),
        right = Math.min(viewportWidth, Math.ceil(Math.max(...xs)));
      if (right <= x) continue;
      const last = rects[rects.length - 1];
      if (last && last.x === x && last.width === right - x && last.y + last.height === y)
        last.height += height;
      else rects.push({ x, y, width: right - x, height });
    }
  }
  return rects;
}
module.exports = { hudRegions };
