/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
let clicks = 0;
document.getElementById('map-button').onclick = (event) =>
  (event.target.textContent = 'Map test: ' + ++clicks + ' clicks');
