/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const { esc, portrait, symbols, labels } = HUD;
let state,
  displays = [],
  selectedId = '',
  view = 'character',
  tab = 'action',
  search = '',
  overlayStatus = { visible: false },
  history = [],
  saveError = '',
  dataPath = '',
  toastTimer,
  saveQueue = Promise.resolve(),
  lastFocus;
let previewGesture = null;
let api = window.tablelight;
if (!api) {
  // The ordinary browser is a development preview. Native overlay controls require the desktop app.
  let previewState = TL.empty();
  api = {
    load: async () => ({
      state: previewState,
      native: false,
      status: { visible: false },
      warning: '',
    }),
    save: async (raw) => {
      previewState = TL.clone(raw);
      return { ok: true };
    },
    displays: async () => [
      { id: 'preview', name: 'Desktop preview', primary: true, width: 1920, height: 1080 },
    ],
    overlay: async () => {
      throw new Error('Open Tablelight.exe to display the transparent TV overlay.');
    },
    avatar: async () => {
      throw new Error('Portrait upload is available in Tablelight.exe.');
    },
    exportParty: async () => false,
    importParty: async () => null,
    onState: () => {},
    onDisplays: () => {},
    onOverlay: () => {},
  };
}
const selected = () => state.characters.find((c) => c.id === selectedId) || state.characters[0];
const display = () =>
  displays.find((d) => d.id === state.settings.displayId) ||
  displays.find((d) => !d.primary) ||
  displays[0] || { width: 1920, height: 1080, id: '', name: 'No display' };
const button = (label, action, cls = '', attrs = '') =>
  `<button type="button" class="${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const field = (title, name, value, type = 'text', extra = '') =>
  `<label class="form-field"><span>${title}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const options = (values, current) =>
  values
    .map(
      ([value, label]) =>
        `<option value="${esc(value)}" ${String(current) === String(value) ? 'selected' : ''}>${esc(label)}</option>`
    )
    .join('');
function toast(message, error = false) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = 'visible' + (error ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ''), error ? 8000 : 3300);
}
function persist() {
  const snapshot = TL.clone(state);
  saveQueue = saveQueue
    .catch(() => {})
    .then(() => api.save(snapshot))
    .then(() => {
      if (saveError) {
        saveError = '';
        render();
      }
      setSaveText('Saved on this laptop');
    })
    .catch((error) => {
      saveError = 'Changes could not be saved. Keep the app open and retry. ' + error.message;
      setSaveText('Save failed');
      toast(saveError, true);
      render();
    });
  setSaveText('Saving…');
  return saveQueue;
}
function setSaveText(text) {
  const el = document.getElementById('save-status');
  if (el) el.textContent = text;
}
function commit(change, message, rerender = true) {
  const before = TL.clone(state);
  try {
    change();
    state = TL.normalize(state);
    history.push(before);
    if (history.length > 40) history.shift();
    persist();
    if (rerender) render();
    if (message) toast(message);
    return true;
  } catch (error) {
    state = before;
    toast(error.message, true);
    return false;
  }
}
function undo() {
  if (!history.length) return;
  state = history.pop();
  if (!state.characters.some((c) => c.id === selectedId))
    selectedId = state.characters[0]?.id || '';
  persist();
  render();
  toast('Last change undone');
}
function expand(c, panel = '', detailId = '') {
  if (state.settings.soloExpand) state.characters.forEach((x) => (x.hud.expanded = false));
  c.hud.expanded = true;
  c.hud.visible = true;
  c.hud.panel = panel;
  c.hud.detailId = detailId;
  c.hud.page = 0;
}
function render() {
  if (!state || previewGesture?.isDragging) return;
  const c = selected();
  if (c) selectedId = c.id;
  const oldScroll = window.scrollY;
  const sidebarState = captureSidebarState();
  document.getElementById('app').innerHTML =
    `<div class="app-shell">${renderSidebar()}<main class="main"><header class="topbar"><div class="breadcrumb">Dungeon Master <span class="muted"> / </span> <b>${view === 'display' ? 'TV & layout' : view === 'help' ? 'Setup & help' : view === 'condition-library' ? 'Condition library' : view === 'library' ? 'Ability library' : view === 'roster' ? 'Players & party' : 'Session console'}</b></div><div class="row">${button('↶ Undo', 'undo', 'subtle small', history.length ? '' : 'disabled')}${button(state.settings.overlayInteractive ? 'HUD controls: on' : 'Click-through', 'toggle-interactive', state.settings.overlayInteractive ? 'active small' : 'small')}${button(overlayStatus.visible ? '● Hide TV overlay' : '▱ Show TV overlay', 'toggle-overlay', overlayStatus.visible ? 'active' : 'primary')}</div></header>${saveError ? `<div class="save-warning">${esc(saveError)} ${button('Retry save', 'retry-save', 'small')}</div>` : ''}<div class="content">${view === 'roster' ? renderRoster() : view === 'help' ? renderHelp() : view === 'condition-library' ? renderConditionLibrary() : view === 'library' ? renderLibrary() : view === 'display' ? renderDisplay() : c ? renderCharacter(c) : renderWelcome()}</div></main></div>`;
  if (view === 'display') requestAnimationFrame(paintPreview);
  window.scrollTo(0, oldScroll);
  restoreSidebarState(sidebarState);
  refreshConditionPicker();
  refreshConcentrationPicker();
  refreshDamageReminder();
}
function renderWelcome() {
  return `<div class="empty-state"><div class="eyebrow">A new adventure starts here</div><div class="empty-art space-top">✧</div><h1>Your table. Their adventure.</h1><p>A quiet control room for you. A living character HUD for every player. Add your first adventurer, then bring your tabletop to life.</p>${button('+ Create a character', 'add-character', 'primary')} ${button('Choose saved players', 'view-roster', 'subtle')} <div class="empty-features"><div><b>Build your party</b><p>Enter your own stats, spells, actions, and features. Save as many players as you need. Bring up to eight into the active party.</p></div><div><b>Set the table</b><p>Place and rotate each portrait to face its player, right from your laptop.</p></div><div><b>Run the moment</b><p>Reveal choices. Spend resources. Keep the map available beneath the HUD.</p></div></div></div>`;
}
function economyTile(c, k) {
  const title = k === 'bonus' ? 'Bonus action' : k[0].toUpperCase() + k.slice(1);
  return `<div class="combat-tile economy-tile ${c.turn[k] ? '' : 'spent'}"><div class="tile-label">${title}<span>${symbols[k]}</span></div><div class="tile-value">${c.turn[k] ? 'Ready' : 'Spent'}</div><div class="tile-toggle">${button('Show options', 'panel', 'small', `data-panel="${k}"`)}${button(c.turn[k] ? 'Spend' : 'Restore', 'toggle-economy', 'small', `data-key="${k}"`)}</div></div>`;
}
function renderCharacter(c) {
  return `<div class="character-hero" style="--accent:${c.accent}">${portrait(c)}<div><div class="eyebrow">${c.id === state.activeId ? 'Current turn' : 'Party member'}</div><h1>${esc(c.name)}</h1><p class="muted">Level ${c.level} ${esc(c.className || 'adventurer')}${c.species ? ' · ' + esc(c.species) : ''}</p></div><div class="hero-tools">${button(c.hud.visible ? 'Hide this bubble' : 'Show this bubble', 'toggle-character-visible', 'subtle')}${button('Position & rotate', 'position-character', 'subtle')}${button('Edit character', 'edit-character', 'subtle')}${button('Remove from party', 'roster-remove', 'subtle', `data-id="${esc(c.id)}"`)}${button('Delete character', 'roster-delete', 'danger subtle', `data-id="${esc(c.id)}"`)}${button(c.hud.expanded ? 'Collapse to portrait' : 'Expand player HUD', 'toggle-expand', c.hud.expanded ? 'active' : 'primary')}</div></div><div class="combat-strip"><div class="combat-tile"><div class="tile-label">Hit points<span>♡</span></div><div class="tile-value">${c.hp}<small>/ ${c.maxHp}</small></div><div class="tile-toggle hp-controls"><span class="damage-controls">${HUD.damageConcentrationReminder(c)}${button('− Damage', 'hp-damage', 'small')}</span>${button('+ Heal', 'hp-heal', 'small')}</div>${button('Temp HP: ' + c.tempHp, 'temp-hp', 'small temp-hp-button')}</div>${economyTile(c, 'action')}${economyTile(c, 'bonus')}${economyTile(c, 'reaction')}<div class="combat-tile"><div class="tile-label">Movement <span>➝</span></div><div class="tile-value">${c.turn.movement}<small>/ ${c.speed} ft</small></div><div class="tile-toggle">${button('− 5', 'move', 'small', 'data-amount="-5"')}${button('+ 5', 'move', 'small', 'data-amount="5"')}${button('Set', 'move-set', 'small')}</div></div></div><div class="spread wrap" style="margin-bottom:19px"><div class="quick-tools">${button('↻ Start turn', 'start-turn')}${button('Next turn →', 'next-turn')}${button('Short rest', 'short-rest', 'subtle')}${button('Long rest', 'long-rest', 'subtle')}</div><span class="hint">${c.hud.expanded ? 'HUD expanded' : 'Portrait only'} · ${c.hud.visible ? 'Visible on TV' : 'Hidden on TV'}</span></div><div class="work-grid"><div class="gap"><section class="card"><div class="tabs" role="tablist">${[
    ['action', 'Actions'],
    ['bonus', 'Bonus'],
    ['reaction', 'Reactions'],
    ['spell', 'Spells'],
    ['feature', 'Features'],
    ['free', 'Other'],
    ['sheet', 'Sheet'],
  ]
    .map(([key, label]) =>
      button(
        label,
        'tab',
        'tab ' + (tab === key ? 'active' : ''),
        `data-tab="${key}" role="tab" aria-selected="${tab === key}"`
      )
    )
    .join(
      ''
    )}</div>${tab === 'sheet' ? renderSheet(c) : `<div class="list-toolbar"><input id="ability-search" placeholder="Find ${esc(labels[tab]?.toLowerCase() || 'an ability')}…" aria-label="Search abilities" value="${esc(search)}">${button('+ Add', 'add-item', 'small')}${button('Show on TV', 'panel', 'small', `data-panel="${tab}"`)}</div><div id="ability-list" class="ability-list">${renderAbilityList(c)}</div>`}</section>${renderCharacterStatus(c)}<section class="card"><div class="card-heading spread"><h3>At a glance</h3>${button('Show full sheet', 'panel', 'small', 'data-panel="sheet"')}</div><div class="card-body"><div class="stats-grid">${TL.abilities.map((a) => `<div class="stat-box"><small>${a.toUpperCase()}</small><b>${TL.signed(TL.mod(c.abilities[a]))}</b><span>${c.abilities[a]}</span></div>`).join('')}</div><div class="spread wrap space-top"><span class="hint">AC <b>${c.ac}</b> · Proficiency <b>${TL.signed(c.proficiency)}</b> · Initiative <b>${TL.signed(c.initiative)}</b></span></div></div></section></div><aside class="right-rail gap">${renderHudRemote(c)}<section class="card"><div class="card-heading spread"><h3>Spell slots</h3>${button('Edit', 'edit-character', 'small subtle')}</div><div class="card-body">${
    c.slots
      .filter((s) => s.max > 0)
      .map(
        (s) =>
          `<div class="slot-row"><span>Level ${s.level}<br>${HUD.pips(s.current, s.max)}</span><div class="resource-adjust">${button('−', 'slot', 'icon small', `data-level="${s.level}" data-amount="-1" aria-label="Spend level ${s.level} slot" ${s.current ? '' : 'disabled'}`)}<b>${s.current}/${s.max}</b>${button('+', 'slot', 'icon small', `data-level="${s.level}" data-amount="1" aria-label="Restore level ${s.level} slot" ${s.current < s.max ? '' : 'disabled'}`)}</div></div>`
      )
      .join('') ||
    '<p class="hint">Add your slot totals in Edit character. No spells are preloaded.</p>'
  }<p class="hint space-top">Spell DC ${c.spellDC ?? 8 + c.proficiency + TL.mod(c.abilities[c.spellAbility])} · Attack ${TL.signed(c.spellAttack ?? c.proficiency + TL.mod(c.abilities[c.spellAbility]))}</p></div></section>${renderCharacterResources(c)}</aside></div>`;
}
function filteredItems(c) {
  return c.items.filter(
    (i) =>
      (tab === 'spell' || tab === 'feature' ? i.kind === tab : i.economy === tab) &&
      (!search || (i.name + ' ' + i.description).toLowerCase().includes(search.toLowerCase()))
  );
}
function renderAbilityList(c) {
  return (
    filteredItems(c)
      .map((it) => {
        const reason = TL.availability(c, it);
        return `<div class="ability-row ${reason ? 'spent' : ''}"><span class="ability-symbol">${symbols[it.kind] || symbols[it.economy]}</span><div class="ability-main"><b>${esc(it.name)}</b><small>${esc(labels[it.economy])}${it.kind === 'spell' ? ' · ' + TL.levelLabel(it) : ''}${it.resourceId ? ' · ' + it.resourceCost + ' ' + esc(c.resources.find((r) => r.id === it.resourceId)?.name) : ''}</small>${reason ? `<small>${esc(reason)}</small>` : ''}</div><div class="ability-controls character-ability-controls">${button('View', 'view-item', 'small', `data-id="${esc(it.id)}"`)}${button('Use', 'use-item', 'small primary', `data-id="${esc(it.id)}" ${reason ? 'disabled' : ''}`)}${button('Edit', 'edit-item', 'small subtle', `data-id="${esc(it.id)}"`)}${button('Remove from character', 'delete-item', 'small subtle danger ability-remove', `data-id="${esc(it.id)}" aria-label="Remove ${esc(it.name)} from ${esc(c.name)}"`)}</div></div>`;
      })
      .join('') ||
    `<div class="empty-inline">${search ? 'No matching abilities.' : 'Your rules, your choices.<br>Add your own ' + esc(labels[tab]?.toLowerCase() || 'abilities') + ' to this character.'}</div>`
  );
}
function renderSheet(c) {
  return renderCharacterSheet(c);
}
function renderHudRemote(c) {
  return renderCurrentDisplay(c);
}
function renderDisplay() {
  const c = selected(),
    d = display();
  return `<div class="page-heading"><div class="eyebrow">Make room for the adventure</div><h1 class="space-top">Set your table</h1><p>Every character has a separate bubble. Drag its portrait to move it; drag ⟳ or use the arrow buttons to rotate it.</p></div><div class="display-grid"><div class="gap"><section class="card"><div class="card-heading spread"><h3>TV layout</h3><span class="badge">${d.width} × ${d.height}</span></div><div class="preview-outer"><div class="preview" id="preview" style="aspect-ratio:${d.width}/${d.height}"><div class="preview-watermark">Your battle map<small>Transparent area on the TV</small></div><div id="preview-stage" class="preview-stage"></div></div></div><div class="display-caption">${overlayStatus.visible ? '● Overlay is live. Changes appear on the TV immediately.' : 'Overlay is hidden. Arrange everything before showing it.'}</div></section><section class="card"><div class="card-body spread wrap"><div><b>Seat the party</b><p class="hint">Distribute portraits around the table, facing outward.</p></div>${button('Arrange around TV', 'auto-layout', 'subtle', c ? '' : 'disabled')}</div></section><section class="card"><div class="card-body gap"><div class="spread"><div><b>Display</b><p class="hint">Choose the TV in Windows extended display mode.</p></div>${button('Refresh', 'refresh-displays', 'small')}</div><select id="display-select" aria-label="TV display">${options(
    displays.map((d) => [
      d.id,
      `${d.name} · ${d.width} × ${d.height}${d.primary ? ' · primary' : ''}`,
    ]),
    d.id
  )}</select>${displays.length < 2 ? '<p class="note">One display is connected. You can preview or test here; select your TV after connecting HDMI and choosing Extend in Windows.</p>' : ''}<label class="row hint"><input type="checkbox" id="overlay-interactive" ${state.settings.overlayInteractive ? 'checked' : ''}>Interact with HUDs directly on the TV</label><p class="hint">When enabled, each bubble has its own controls. Empty space still passes clicks to the map. Ctrl + Alt + I switches modes.</p><label class="row hint"><input type="checkbox" id="solo-expand" ${state.settings.soloExpand ? 'checked' : ''}>Expand one player at a time</label><label class="form-field"><span>HUD background opacity · ${Math.round(state.settings.opacity * 100)}%</span><input type="range" id="opacity" min="40" max="100" step="1" value="${state.settings.opacity * 100}"></label></div></section></div><aside class="gap display-controls">${
    c
      ? `<section class="card"><div class="card-heading"><h3>Player placement</h3></div><div class="card-body"><select id="layout-character" aria-label="Player to position">${options(
          state.characters.map((x) => [x.id, x.name]),
          c.id
        )}</select><div class="row space-top">${portrait(c)}<div><b>${esc(c.name)}</b><p class="hint">${c.hud.expanded ? 'HUD expanded' : 'Portrait only'}</p></div></div><label class="inline-label"><input type="checkbox" id="hud-visible" ${c.hud.visible ? 'checked' : ''}>Visible on TV</label><div class="placement-grid"><label>Horizontal %<input id="hud-x" type="number" min="0" max="100" step="0.1" value="${c.hud.x.toFixed(1)}"></label><label>Vertical %<input id="hud-y" type="number" min="0" max="100" step="0.1" value="${c.hud.y.toFixed(1)}"></label></div><label>Rotation · degrees<input id="hud-rotation" type="number" min="0" max="359" value="${c.hud.rotation}"></label><input aria-label="Rotate HUD" id="rotation-range" type="range" min="0" max="359" value="${c.hud.rotation}"><div class="rotation-buttons">${[0, 90, 180, 270].map((a) => button(a + '°', 'rotate', 'small', `data-angle="${a}"`)).join('')}</div><label>HUD size · ${Math.round(c.hud.scale * 100)}%<input id="hud-scale" type="range" min="40" max="250" value="${c.hud.scale * 100}"></label><div class="gap space-top">${button(c.hud.expanded ? 'Collapse to portrait' : 'Expand player HUD', 'toggle-expand', 'primary')}${button('Show actions', 'panel', 'subtle', 'data-panel="action"')}${button('Show sheet', 'panel', 'subtle', 'data-panel="sheet"')}</div><p class="hint space-top">Position is the HUD’s center. Expanded HUDs keep your chosen size. They move inward at screen edges; reduce HUD size if a rotated card is larger than the TV.</p></div></section>${c.hud.expanded ? renderHudRemote(c) : ''}`
      : '<section class="card"><div class="card-body">Add a character to start arranging your table.</div></section>'
  }<section class="card"><div class="card-body"><div class="eyebrow">Quick hide</div><p class="hint space-top"><span class="key">Ctrl</span> + <span class="key">Alt</span> + <span class="key">H</span><br>Hides the overlay, even while another app is in focus.</p></div></section></aside></div>`;
}
function paintPreview() {
  const p = document.getElementById('preview'),
    stage = document.getElementById('preview-stage');
  if (!p || !stage) return;
  const d = display();
  const width = Math.min(
    p.parentElement.clientWidth - 40,
    (Math.max(280, innerHeight - 370) * d.width) / d.height
  );
  p.style.width = width + 'px';
  p.style.height = (width * d.height) / d.width + 'px';
  p.style.margin = '0 auto';
  HUD.mount(
    stage,
    state,
    d.width,
    d.height,
    p.clientWidth / d.width,
    selectedId,
    state.settings.overlayInteractive ? 'overlay' : 'preview'
  );
  if (!stage.hudGesture) {
    stage.hudGesture = HUDControls.gestures(stage, {
      preview: true,
      getState: () => state,
      viewport: () => ({ width: p.clientWidth, height: p.clientHeight }),
      onSelect: (id) => {
        selectedId = id;
      },
      onCommit: (id, placement, before) => {
        const c = state.characters.find((c) => c.id === id);
        Object.assign(c.hud, { x: before.x, y: before.y, rotation: before.rotation });
        commit(() => TL.hudCommand(state, { type: 'placement', characterId: id, ...placement }));
      },
      onTap: () => render(),
      onCancel: () => render(),
    });
    stage.addEventListener('click', (event) => {
      const conditions = event.target.closest('[data-hud-conditions]');
      if (conditions) {
        addConditions(conditions.dataset.hudConditions, true);
        return;
      }
      const el = event.target.closest('[data-hud-command]');
      if (el && !el.disabled) {
        const command = JSON.parse(el.dataset.hudCommand);
        if (command.type === 'concentration' && command.active)
          editConcentration(command.characterId);
        else commit(() => TL.hudCommand(state, command));
      }
    });
  }
  previewGesture = stage.hudGesture;
}
window.addEventListener('resize', () => {
  if (view === 'display') paintPreview();
});
function renderHelp() {
  return `<div class="page-heading"><div class="eyebrow">Ready for game night</div><h1 class="space-top">A little setup. A lot of adventure.</h1><p>Your map stays in D&D Beyond. Tablelight supplies the character HUD.</p></div><div class="work-grid"><section class="card"><div class="card-body"><h2>From laptop to battle mat</h2><div class="note"><b>Free software · GPL-3.0-or-later</b><p class="hint">Copyright (C) 2026 Tablelight contributors. You may use, modify, and share Tablelight under the GPL. No warranty is provided.</p>${button('Read license', 'show-license', 'small space-top')}</div><div class="step-list"><div class="step"><div><b>Extend your display</b><p>Connect the TV over HDMI. Press Windows + P and choose Extend. Keep the DM browser and Tablelight on your laptop; move the player browser onto the TV.</p></div></div><div class="step"><div><b>Save players and choose your party</b><p>Open Players & party to create, search, edit, or delete saved players. Add up to eight to the active party. Remove from party keeps a player saved; Delete character removes them. Only active members appear in the session console and TV overlay. Enter stats, upload portraits, and set slot totals. Add your own full spells, actions, bonus actions, reactions, and features. Nothing is preloaded.</p></div></div><div class="step"><div><b>Build your shared library</b><p>Use + Add on a character to Create new or Choose existing. Search and edit entries in Ability library. Shared edits update every linked character; each keeps separate resource links and availability. Removing a character keeps the library.</p></div></div><div class="step"><div><b>Connect abilities to their costs</b><p>Create custom resources in Edit character, below spell slots. Choose a name, maximum, reset rule, shape icon, and color. When editing an ability, choose its action cost and any pool it spends. Spells can spend a selected slot level. To use a special spell pool, disable standard slot spending and link your custom resource.</p></div></div><div class="step"><div><b>Arrange the TV overlay</b><p>Open TV & layout. Select the TV, drag each portrait, and rotate it toward its player. Click Show TV overlay. With HUD controls on, drag any portrait to move that character, drag its ⟳ handle to rotate it, and click the portrait to expand or collapse it. Empty areas pass clicks to the map. Turn HUD controls off for full click-through.</p></div></div><div class="step"><div><b>Run turns from your laptop</b><p>Show options reveals an action list on the TV. View opens an ability’s text for the player; use the page arrows for longer descriptions. Use spends its linked costs. Spent choices turn gray. Start turn restores action, bonus action, reaction, movement, and resources set to Per turn for that character. Next turn follows the sidebar party order. Use Initiative order to sort rolls, or drag players and use the arrows to rearrange them.</p></div></div></div><div class="note">Tablelight is a manual tracker. You decide which rules apply, when reactions refresh, and what an ability does. It does not read or change D&D Beyond. A spell’s damage, healing, movement, conditions, and concentration are applied manually.</div><div class="separator"></div><h3>Use the HUDs directly</h3><p class="hint space-top">Every player has an independent bubble. Multiple HUDs can stay expanded at different rotations. Each expanded HUD includes Move, Rotate, Collapse, and Hide controls, plus HP, movement, turn costs, options, slots, resources, and description pages. Click an option to read it and use its ability controls to spend costs. Changes also update your laptop and are saved automatically. Ctrl + Alt + I switches between interactive HUDs and click-through mode. Per-character Show / Hide buttons are also available on the laptop.</p><div class="separator"></div><h3>Concentration & conditions</h3><p class="hint space-top">Mark Requires concentration when editing any ability. Click Concentrating on an expanded HUD to choose from that character’s assigned, flagged abilities. Choosing one lights the icon; hover to read its name and click again to end concentration. The DM also has Choose ability / Change ability. Selection does not spend costs. Cancel leaves concentration unchanged. Click Add beside Conditions on the DM page to search saved conditions or Create new. Save &amp; add saves a new definition to the library and applies it to this character. The TV also has Add beside Conditions, for choosing existing entries only. Already-applied entries show Added. Assigned conditions appear below the HUD icon; hover for descriptions and use × to remove one. Shared edits update every assigned character. Remove assignments before deleting a library entry.</p><div class="separator"></div><h3>Rests & corrections</h3><p class="hint space-top">Short rest restores pools configured for short rest; apply any healing manually. Long rest restores HP, standard spell slots, turn controls, and both short-rest and long-rest pools; it clears temporary HP and concentration. Manual pools, conditions, and unavailable ability flags stay as you set them. You choose one character or the full party before resting. Use Undo for mistakes, or the + and Restore controls for individual corrections.</p><div class="separator"></div><h3>Keep a backup</h3><p class="hint space-top">Changes, portraits, and the shared library save automatically on this laptop. Export a party backup before major edits or when moving to another computer. Restore replaces all saved players, the active party, and the library after confirmation and can be undone during this session.</p><div class="row space-top">${button('Export party backup', 'export', 'primary')}${button('Restore backup', 'import', 'subtle')}</div><p class="hint space-top">Saved party folder: ${esc(dataPath || 'Desktop app data folder')}</p></div></section><aside class="gap"><section class="card"><div class="card-heading"><h3>Keyboard controls</h3></div><div class="card-body gap"><p class="hint"><span class="key">Ctrl + Alt + H</span><br>Hide TV overlay from any app.</p><p class="hint"><span class="key">Ctrl + Alt + O</span><br>Toggle TV overlay from any app.</p><p class="hint"><span class="key">Ctrl + Alt + I</span><br>Toggle direct HUD interaction.</p><p class="hint"><span class="key">Ctrl + Z</span><br>Undo the last Tablelight change when you are not typing in a field.</p><p class="hint"><span class="key">Esc</span><br>Close a dialog.</p></div></section><section class="card"><div class="card-heading"><h3>Display tips</h3></div><div class="card-body gap"><p class="hint">The TV overlay starts hidden each time you open Tablelight. Show it when you are ready.</p><p class="hint">If you unplug the selected TV, the overlay hides. Reconnect, select the TV again, then show it.</p><p class="hint">Use the HUD size slider to adjust readability for your TV. Different Windows scaling settings are handled in display coordinates.</p><p class="hint">If a fullscreen application covers the overlay, use a normal or borderless browser window.</p></div></section></aside></div>`;
}
function modal(title, body, footer = '', narrow = false) {
  lastFocus = document.activeElement;
  document.getElementById('modal-root').innerHTML =
    `<div class="modal-backdrop"><section class="modal ${narrow ? 'narrow' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><h2 id="modal-title">${title}</h2>${button('✕', 'close-modal', 'subtle', 'aria-label="Close dialog"')}</header><div class="modal-body">${body}<div id="form-error" class="form-error" role="alert"></div></div>${footer ? `<footer class="modal-footer">${footer}</footer>` : ''}</section></div>`;
  requestAnimationFrame(() =>
    document.querySelector('.modal input,.modal textarea,.modal select,.modal button')?.focus()
  );
}
function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
  if (lastFocus?.isConnected) lastFocus.focus();
}
function formError(message) {
  const el = document.getElementById('form-error');
  if (el) el.textContent = message;
  else toast(message, true);
}
function submitForm(id, handler) {
  document.getElementById(id).addEventListener('submit', async (event) => {
    event.preventDefault();
    const b = document.querySelector(`[form="${id}"]`);
    if (b) b.disabled = true;
    try {
      await handler(new FormData(event.target));
    } catch (error) {
      formError(error.message);
    } finally {
      if (b?.isConnected) b.disabled = false;
    }
  });
}
function editCharacter(isNew = false, playerId = selectedId) {
  const draft = TL.clone(
      isNew ? TL.character(state.characters.length) : TL.findCharacter(state, playerId)
    ),
    original = TL.clone(draft);
  const f = (title, key, type = 'text', extra = '') => field(title, key, draft[key], type, extra);
  modal(
    isNew ? 'Create an adventurer' : 'Edit ' + esc(draft.name),
    `<form id="character-form">${isNew ? `<div class="note roster-create"><label class="row"><input type="checkbox" name="addToParty" ${state.characters.length < TL.PARTY_LIMIT ? 'checked' : 'disabled'}>Add to active party</label><p class="hint">${state.characters.length < TL.PARTY_LIMIT ? 'Leave unchecked to save this player for later.' : 'Your party has eight players. This new player will be saved in the roster.'}</p></div>` : ''}<div class="row" style="margin-bottom:22px"><div id="avatar-preview">${portrait(draft)}</div><div class="gap"><div class="row">${button('Upload portrait', 'upload-avatar', 'subtle')}${button('Remove image', 'remove-avatar', 'small subtle')}</div><span class="hint">PNG, JPG, or WebP. Saved with your character.</span></div></div><div class="form-grid">${f('Character name', 'name', 'text', 'required maxlength="100"')}${f('Class / subclass', 'className', 'text', 'maxlength="120"')}${f('Species', 'species', 'text', 'maxlength="120"')}${f('Level', 'level', 'number', 'min="1" max="30" required')}${f('Armor class', 'ac', 'number', 'min="0" max="99" required')}${f('Speed (feet)', 'speed', 'number', 'min="0" max="999" required')}${f('Current HP', 'hp', 'number', 'min="0" max="9999" required')}${f('Maximum HP', 'maxHp', 'number', 'min="1" max="9999" required')}${f('Temporary HP', 'tempHp', 'number', 'min="0" max="9999" required')}${f('Proficiency bonus', 'proficiency', 'number', 'min="0" max="20" required')}${f('Initiative order value', 'initiative', 'number', 'min="-99" max="999" required')}${f('Player color', 'accent', 'color')}</div><div class="form-section"><h3>Ability scores</h3><div class="stats-grid">${TL.abilities.map((a) => field(a.toUpperCase(), 'ability-' + a, draft.abilities[a], 'number', 'min="1" max="30" required')).join('')}</div>${renderEditorSaves(draft)}</div><div class="form-section"><h3>Skills</h3>${renderEditorSkills(draft)}</div><div class="form-section"><h3>Spellcasting</h3><div class="form-grid"><label class="form-field"><span>Spellcasting ability</span><select name="spellAbility">${options(
      TL.abilities.map((a) => [a, a.toUpperCase()]),
      draft.spellAbility
    )}</select></label>${field('Spell DC override', 'spellDC', draft.spellDC ?? '', 'number', 'min="0" max="99" placeholder="Automatic"')}${field('Spell attack override', 'spellAttack', draft.spellAttack ?? '', 'number', 'min="-99" max="99" placeholder="Automatic"')}</div><p class="space-top">Maximum standard spell slots. Raising a maximum adds available slots; lowering it caps remaining slots.</p><div class="form-slots">${draft.slots.map((s) => field('Level ' + s.level, 'slot-' + s.level, s.max, 'number', 'min="0" max="30" required')).join('')}</div></div>${renderResourceEditor(draft)}<div class="form-section"><h3>DM notes</h3><p>These stay on your laptop.</p><textarea name="notes" maxlength="40000" rows="4">${esc(draft.notes)}</textarea></div></form>`,
    `${isNew ? '<span class="hint">All abilities are entered by you.</span>' : button('Delete character', 'roster-delete', 'danger subtle', `data-id="${esc(draft.id)}"`)}<div class="row">${button('Cancel', 'close-modal', 'subtle')}<button type="submit" form="character-form" class="primary">Save character</button></div>`
  );
  bindResourceEditor(draft);
  document.querySelector('[data-action="upload-avatar"]').onclick = async () => {
    try {
      const value = await api.avatar();
      if (value) {
        draft.avatar = value;
        document.getElementById('avatar-preview').innerHTML = portrait(draft);
      }
    } catch (error) {
      formError(error.message);
    }
  };
  document.querySelector('[data-action="remove-avatar"]').onclick = () => {
    draft.avatar = '';
    document.getElementById('avatar-preview').innerHTML = portrait(draft);
  };
  submitForm('character-form', (data) => {
    readResourceEditor(draft);
    for (const k of ['name', 'className', 'species', 'notes', 'accent', 'spellAbility'])
      draft[k] = data.get(k).trim();
    if (!draft.name) throw new Error('Enter a character name.');
    for (const k of ['level', 'ac', 'speed', 'hp', 'maxHp', 'tempHp', 'proficiency', 'initiative'])
      draft[k] = Number(data.get(k));
    if (draft.hp > draft.maxHp) throw new Error('Current HP cannot exceed maximum HP.');
    for (const a of TL.abilities) draft.abilities[a] = Number(data.get('ability-' + a));
    draft.saves = TL.abilities.filter((a) => Number(data.get('save-rank-' + a)) > 0);
    draft.saveExpertise = TL.abilities.filter((a) => Number(data.get('save-rank-' + a)) === 2);
    Object.keys(TL.skills).forEach(
      (s, i) =>
        (draft.skills[s] = {
          rank: Number(data.get('skill-rank-' + i)),
          override:
            data.get('skill-override-' + i) === '' ? null : Number(data.get('skill-override-' + i)),
        })
    );
    for (const k of ['spellDC', 'spellAttack'])
      draft[k] = data.get(k) === '' ? null : Number(data.get(k));
    draft.slots.forEach((s) => {
      const max = Number(data.get('slot-' + s.level));
      s.current = Math.min(max, s.current + Math.max(0, max - s.max));
      s.max = max;
    });
    if (isNew) draft.turn = TL.freshTurn(draft);
    const success = commit(() => {
      if (isNew) {
        state.roster.push(draft);
        if (data.has('addToParty')) TL.addToParty(state, draft.id);
      } else {
        const collection = state.characters.some((c) => c.id === draft.id)
          ? state.characters
          : state.roster;
        const index = collection.findIndex((c) => c.id === draft.id);
        const current = collection[index];
        if (!current) throw new Error('This player no longer exists.');
        const merged = TL.mergeChanges(original, draft, current);
        merged.saves = [...current.saves];
        merged.saveExpertise = [...current.saveExpertise];
        for (const ability of TL.abilities)
          if (TL.saveRank(original, ability) !== TL.saveRank(draft, ability))
            TL.setRank(merged, 'save', ability, TL.saveRank(draft, ability));
        collection[index] = merged;
      }
      if (state.characters.some((c) => c.id === draft.id)) {
        selectedId = draft.id;
        if (view !== 'roster') view = 'character';
      } else view = 'roster';
    }, 'Character saved');
    if (success) closeModal();
  });
}
function editItem(id) {
  const c = selected(),
    it = c?.items.find((i) => i.id === id);
  if (it) editLibraryEntry(it.libraryId, c.id, it.id);
  else addItemChoice();
}
function confirmAction(title, text, handler, label = 'Confirm') {
  modal(
    title,
    `<p>${text}</p>`,
    `<span></span><div class="row">${button('Cancel', 'close-modal', 'subtle')}<button id="confirm-action" class="primary">${label}</button></div>`,
    true
  );
  document.getElementById('confirm-action').onclick = () => {
    closeModal();
    handler();
  };
}
function amountModal(title, initial, handler, damageCharacterId = '') {
  modal(
    title,
    `<form id="amount-form">${field('Amount', 'amount', initial, 'number', 'min="0" max="9999" required autofocus')}</form>`,
    `<span></span><div class="row">${button('Cancel', 'close-modal', 'subtle')}${damageCharacterId ? `<span class="damage-controls" data-damage-character="${esc(damageCharacterId)}">${HUD.damageConcentrationReminder(state.characters.find((c) => c.id === damageCharacterId))}` : ''}<button type="submit" form="amount-form" class="primary">Apply</button>${damageCharacterId ? '</span>' : ''}</div>`,
    true
  );
  submitForm('amount-form', (data) => {
    handler(Number(data.get('amount')));
    closeModal();
  });
}
function refreshDamageReminder() {
  const controls = document.querySelector('[data-damage-character]');
  if (!controls) return;
  const c = state.characters.find((c) => c.id === controls.dataset.damageCharacter);
  if (!c) {
    closeModal();
    return;
  }
  controls.querySelector('.damage-concentration-reminder').outerHTML =
    HUD.damageConcentrationReminder(c);
  document.getElementById('modal-title').textContent = 'Damage · ' + c.name;
}
function showItem(id) {
  const c = selected(),
    it = c.items.find((i) => i.id === id);
  if (!it) return;
  commit(() => expand(selected(), it.economy, it.id));
  modal(
    esc(it.name),
    `<div class="eyebrow">${esc(it.kind)} · ${esc(labels[it.economy])}</div><div class="detail-meta">${HUD.metadata(
      it
    )
      .map(([k, v]) => `<div><small>${k}</small>${esc(v)}</div>`)
      .join(
        ''
      )}</div><p class="description-text">${esc(it.description || 'No description entered.')}</p><div class="separator"></div><div id="detail-remote">${detailRemote(c)}</div>`,
    `<div class="row">${button('Edit', 'edit-item', 'subtle', `data-id="${esc(id)}"`)}${button(it.disabled ? 'Mark available' : 'Mark unavailable', 'disable-item', 'subtle', `data-id="${esc(id)}"`)}</div><div class="row">${button('Close', 'close-modal', 'subtle')}${button('Use ability', 'use-item', 'primary', `data-id="${esc(id)}" ${TL.availability(c, it) ? 'disabled' : ''}`)}</div>`
  );
}
function detailRemote(c) {
  const n = HUD.countPages(c);
  return `<div class="spread"><span class="hint">TV description: page ${Math.min(c.hud.page + 1, n)} / ${n}</span><div class="row">${button('← Previous', 'hud-page', 'small', `data-amount="-1" ${c.hud.page ? '' : 'disabled'}`)}${button('Next →', 'hud-page', 'small', `data-amount="1" ${c.hud.page < n - 1 ? '' : 'disabled'}`)}</div></div>`;
}
function useItem(id) {
  const c = selected(),
    it = c.items.find((i) => i.id === id);
  if (!it) return;
  const reason = TL.availability(c, it);
  if (reason) {
    toast(reason, true);
    return;
  }
  const apply = (level) => {
    commit(() => {
      const target = selected();
      TL.spend(
        target,
        target.items.find((i) => i.id === id),
        level
      );
      expand(target, it.economy, it.id);
    }, it.name + ' used');
    closeModal();
  };
  if (it.kind === 'spell' && it.level > 0 && it.usesSlot) {
    modal(
      'Use ' + esc(it.name),
      `<form id="cast-form"><label class="form-field"><span>Spend a spell slot</span><select name="level">${options(
        c.slots
          .filter((s) => s.level >= it.level && s.current > 0)
          .map((s) => [s.level, 'Level ' + s.level + ' · ' + s.current + ' remaining']),
        c.slots.find((s) => s.level >= it.level && s.current > 0)?.level
      )}</select></label><p class="hint space-top">Also spends ${it.economy === 'free' ? 'no turn action' : esc(labels[it.economy].toLowerCase())}${it.resourceId ? ' and ' + it.resourceCost + ' ' + esc(c.resources.find((r) => r.id === it.resourceId)?.name) : ''}. Damage, healing, and other effects are manual.</p></form>`,
      `<span></span><div class="row">${button('Cancel', 'close-modal', 'subtle')}<button type="submit" form="cast-form" class="primary">Cast & spend</button></div>`,
      true
    );
    submitForm('cast-form', (data) => apply(Number(data.get('level'))));
  } else apply();
}
function restDialog(type) {
  const c = selected();
  modal(
    type === 'short' ? 'Take a short rest' : 'Take a long rest',
    `<form id="rest-form"><label class="form-field"><span>Who is resting?</span><select name="scope">${options(
      [
        ['selected', c.name],
        ['party', 'The whole party'],
      ],
      'selected'
    )}</select></label><p class="hint space-top">${type === 'short' ? 'Restores all charges in pools configured for short rest. Apply any healing yourself.' : 'Restores HP, slots, turn controls, and pools configured for short or long rest. Clears temporary HP and concentration. Conditions, manual pools, and unavailable flags remain unchanged.'}</p></form>`,
    `<span></span><div class="row">${button('Cancel', 'close-modal', 'subtle')}<button type="submit" form="rest-form" class="primary">Apply rest</button></div>`,
    true
  );
  submitForm('rest-form', (data) => {
    commit(() => {
      (data.get('scope') === 'party' ? state.characters : [selected()]).forEach((x) =>
        TL.rest(x, type)
      );
    }, 'Rest applied');
    closeModal();
  });
}
function autoLayout() {
  const n = state.characters.length;
  if (!n) return;
  confirmAction(
    'Arrange the party?',
    'This updates every player’s position and rotation. You can fine-tune each one afterward or use Undo.',
    () =>
      commit(() => {
        const spots =
          n <= 2
            ? [
                [50, 84, 0],
                [50, 16, 180],
              ]
            : n <= 4
              ? [
                  [28, 84, 0],
                  [72, 84, 0],
                  [72, 16, 180],
                  [28, 16, 180],
                ]
              : n <= 6
                ? [
                    [28, 86, 0],
                    [72, 86, 0],
                    [90, 50, 270],
                    [72, 14, 180],
                    [28, 14, 180],
                    [10, 50, 90],
                  ]
                : [
                    [28, 86, 0],
                    [72, 86, 0],
                    [90, 66, 270],
                    [90, 34, 270],
                    [72, 14, 180],
                    [28, 14, 180],
                    [10, 34, 90],
                    [10, 66, 90],
                  ];
        state.characters.forEach((c, i) => {
          const [x, y, rotation] = spots[i];
          Object.assign(c.hud, { x, y, rotation, expanded: false, visible: true });
        });
      }, 'Party arranged'),
    'Arrange party'
  );
}
document.addEventListener('click', async (event) => {
  const b = event.target.closest('[data-action]');
  if (!b || b.disabled) return;
  const action = b.dataset.action,
    id = b.dataset.id,
    c = selected();
  try {
    if (
      action.startsWith('view-') &&
      [
        'view-character',
        'view-display',
        'view-help',
        'view-library',
        'view-condition-library',
        'view-roster',
      ].includes(action)
    ) {
      view = action.slice(5);
      render();
      return;
    }
    if (
      handleRosterAction(b) ||
      handleSessionAction(b) ||
      handleLibraryAction(b) ||
      handleConditionAction(b)
    )
      return;
    switch (action) {
      case 'show-license': {
        const text = api.license ? await api.license() : 'See LICENSE in the source folder.';
        modal(
          'GNU General Public License',
          `<p class="hint">Copyright (C) 2026 Tablelight contributors · GPL-3.0-or-later · No warranty. You may use, modify, and share this program under these terms.</p><pre class="license-text">${esc(text)}</pre>`,
          button('Close', 'close-modal', 'subtle')
        );
        break;
      }
      case 'select':
        selectedId = id;
        view = 'character';
        search = '';
        render();
        break;
      case 'add-character':
        editCharacter(true);
        break;
      case 'edit-character':
        editCharacter();
        break;
      case 'close-modal':
        closeModal();
        break;
      case 'undo':
        undo();
        break;
      case 'retry-save':
        persist();
        break;
      case 'toggle-overlay':
        await saveQueue;
        overlayStatus = await api.overlay({
          visible: !overlayStatus.visible,
          displayId: display().id,
        });
        render();
        break;
      case 'toggle-interactive':
        commit(() => (state.settings.overlayInteractive = !state.settings.overlayInteractive));
        break;
      case 'toggle-character-visible':
        commit(() => (selected().hud.visible = !selected().hud.visible));
        break;
      case 'position-character':
        view = 'display';
        render();
        break;
      case 'toggle-expand':
        commit(() => {
          if (selected().hud.expanded) selected().hud.expanded = false;
          else expand(selected());
        });
        break;
      case 'panel':
        commit(() => expand(selected(), b.dataset.panel));
        break;
      case 'toggle-economy':
        commit(() => (selected().turn[b.dataset.key] = !selected().turn[b.dataset.key]));
        break;
      case 'move':
        commit(
          () =>
            (selected().turn.movement = TL.integer(
              selected().turn.movement + Number(b.dataset.amount),
              0,
              9999
            ))
        );
        break;
      case 'move-set':
        amountModal('Set remaining movement', c.turn.movement, (amount) =>
          commit(() => (selected().turn.movement = amount))
        );
        break;
      case 'hp-damage':
        amountModal(
          'Damage · ' + esc(c.name),
          1,
          (amount) =>
            commit(
              () =>
                TL.damage(
                  state.characters.find((target) => target.id === c.id),
                  amount
                ),
              'Damage applied'
            ),
          c.id
        );
        break;
      case 'hp-heal':
        amountModal('Heal · ' + esc(c.name), 1, (amount) =>
          commit(() => TL.heal(selected(), amount), 'Healing applied')
        );
        break;
      case 'start-turn':
        commit(() => {
          TL.startTurn(selected());
          state.activeId = selectedId;
        }, 'Turn refreshed');
        break;
      case 'next-turn':
        commit(() => {
          const next = TL.nextTurn(state);
          selectedId = next.id;
          expand(next);
        }, 'Next turn');
        break;
      case 'short-rest':
        restDialog('short');
        break;
      case 'long-rest':
        restDialog('long');
        break;
      case 'tab':
        tab = b.dataset.tab;
        search = '';
        render();
        break;
      case 'add-item':
        editItem();
        break;
      case 'edit-item':
        editItem(id);
        break;
      case 'view-item':
        showItem(id);
        break;
      case 'use-item':
        useItem(id);
        break;
      case 'disable-item':
        commit(() => {
          const it = selected().items.find((i) => i.id === id);
          it.disabled = !it.disabled;
        });
        closeModal();
        break;
      case 'slot':
        commit(() => {
          const s = selected().slots[Number(b.dataset.level) - 1];
          s.current = TL.integer(s.current + Number(b.dataset.amount), 0, s.max);
        });
        break;
      case 'resource':
        commit(() => {
          const r = selected().resources.find((r) => r.id === id);
          r.current = TL.integer(r.current + Number(b.dataset.amount), 0, r.max);
        });
        break;
      case 'resource-reset':
        commit(() => TL.resetResource(selected(), id));
        break;
      case 'delete-character':
        deleteSavedPlayer(id || c?.id);
        break;
      case 'delete-item':
        confirmAction(
          'Remove ability from character?',
          'The entry stays in your shared library for reuse. This removes only this character’s link and settings. It can be undone.',
          () =>
            commit(() => {
              selected().items = selected().items.filter((i) => i.id !== id);
              if (selected().hud.detailId === id) selected().hud.detailId = '';
            }, 'Ability removed from character'),
          'Remove from character'
        );
        break;
      case 'hud-page':
        commit(
          () => (selected().hud.page = Math.max(0, selected().hud.page + Number(b.dataset.amount)))
        );
        if (document.getElementById('detail-remote'))
          document.getElementById('detail-remote').innerHTML = detailRemote(selected());
        break;
      case 'rotate':
        commit(() => (selected().hud.rotation = Number(b.dataset.angle)));
        break;
      case 'auto-layout':
        autoLayout();
        break;
      case 'refresh-displays':
        displays = await api.displays();
        render();
        break;
      case 'export':
        await saveQueue;
        if (saveError)
          throw new Error(
            'Resolve the save error before exporting so your backup includes the latest changes.'
          );
        if (await api.exportParty()) toast('Party backup exported');
        break;
      case 'import': {
        const imported = await api.importParty();
        if (imported)
          confirmAction(
            'Replace your current party?',
            `The backup contains ${TL.allCharacters(imported).length} saved player(s), with ${imported.characters.length} in the active party. All current players, party membership, and the shared library will be replaced. Export a backup first if you want to keep both.`,
            () =>
              commit(() => {
                state = imported;
                selectedId = state.characters[0]?.id || '';
              }, 'Party restored'),
            'Restore party'
          );
        break;
      }
    }
  } catch (error) {
    toast(error.message, true);
  }
});
document.addEventListener('input', (event) => {
  if (event.target.id === 'ability-search') {
    search = event.target.value;
    document.getElementById('ability-list').innerHTML = renderAbilityList(selected());
  }
});
document.addEventListener('change', async (event) => {
  const el = event.target,
    id = el.id;
  try {
    if (id === 'layout-character') {
      selectedId = el.value;
      render();
    }
    if (id === 'display-select') {
      commit(() => (state.settings.displayId = el.value));
      await saveQueue;
      if (overlayStatus.visible) {
        overlayStatus = await api.overlay({ visible: true, displayId: el.value });
        render();
      }
    }
    if (id === 'overlay-interactive')
      commit(() => (state.settings.overlayInteractive = el.checked));
    if (id === 'solo-expand')
      commit(() => {
        state.settings.soloExpand = el.checked;
        if (el.checked)
          state.characters.forEach((c) => {
            if (c.id !== selectedId) c.hud.expanded = false;
          });
      });
    if (id === 'opacity') commit(() => (state.settings.opacity = Number(el.value) / 100));
    if (id === 'hud-visible') commit(() => (selected().hud.visible = el.checked));
    if (['hud-x', 'hud-y', 'hud-rotation', 'rotation-range', 'hud-scale'].includes(id))
      commit(() => {
        const c = selected();
        if (id === 'hud-x') c.hud.x = Number(el.value);
        if (id === 'hud-y') c.hud.y = Number(el.value);
        if (id === 'hud-rotation' || id === 'rotation-range') c.hud.rotation = Number(el.value);
        if (id === 'hud-scale') c.hud.scale = Number(el.value) / 100;
      });
  } catch (error) {
    toast(error.message, true);
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModal();
    return;
  }
  if (
    event.ctrlKey &&
    event.key.toLowerCase() === 'z' &&
    !event.target.closest('input,textarea,select,[contenteditable]')
  ) {
    event.preventDefault();
    undo();
  }
  if (event.key === 'Tab' && document.querySelector('.modal')) {
    const nodes = [
        ...document.querySelectorAll(
          '.modal button:not(:disabled),.modal input:not(:disabled),.modal select:not(:disabled),.modal textarea:not(:disabled)'
        ),
      ],
      first = nodes[0],
      last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
api.onHudCommand?.(async (command) => {
  const success = commit(() => TL.hudCommand(state, command));
  if (!success) throw new Error('That HUD action is not available.');
  await saveQueue;
  if (saveError) throw new Error(saveError);
});
api.onDisplays((value) => {
  displays = value;
  render();
});
api.onOverlay((value) => {
  overlayStatus = value;
  render();
});
(async () => {
  try {
    const loaded = await api.load();
    state = TL.normalize(loaded.state);
    overlayStatus = loaded.status || { visible: false };
    dataPath = loaded.dataPath || '';
    displays = await api.displays();
    if (!displays.some((d) => d.id === state.settings.displayId))
      state.settings.displayId = display().id;
    selectedId = state.activeId || state.characters[0]?.id || '';
    render();
    if (loaded.warning) toast(loaded.warning, true);
  } catch (error) {
    document.getElementById('app').innerHTML =
      `<div class="empty-state"><h1>Unable to open your party</h1><p>${esc(error.message)}</p></div>`;
  }
})();
