/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
(function () {
  'use strict';
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
    );
  const symbols = {
    action: '⚔',
    bonus: '◆',
    reaction: '↶',
    free: '✦',
    spell: '✧',
    feature: '◈',
    sheet: '▤',
    resources: '◉',
  };
  const labels = {
    action: 'Actions',
    bonus: 'Bonus actions',
    reaction: 'Reactions',
    free: 'Free / other',
    spell: 'Spells',
    feature: 'Class features',
    sheet: 'Character sheet',
    resources: 'Resources',
  };
  const panelChoices = [
    ['', 'Overview'],
    ['action', 'Action'],
    ['bonus', 'Bonus action'],
    ['reaction', 'Reaction'],
    ['free', 'Free / other'],
    ['spell', 'Spells'],
    ['feature', 'Features'],
    ['sheet', 'Sheet'],
    ['resources', 'Resources'],
  ];
  function rankBubbles(rank, kind, name) {
    return `<span class="rank-bubbles" data-rank-kind="${kind}" data-rank-name="${esc(name)}"><span class="rank-bubble ${rank >= 1 ? 'filled' : ''}" title="Proficiency" aria-label="${esc(name)}: ${rank >= 1 ? 'proficient' : 'not proficient'}">P</span><span class="rank-bubble ${rank === 2 ? 'filled' : ''}" title="Expertise" aria-label="${esc(name)}: ${rank === 2 ? 'expertise' : 'no expertise'}">E</span></span>`;
  }
  function sheetPanel(c) {
    return `<section class="hud-panel"><div class="eyebrow">Skills · P proficiency · E expertise</div><div class="hud-skills">${Object.keys(
      TL.skills
    )
      .map(
        (s) =>
          `<span><span class="hud-training-name">${esc(s)}</span>${rankBubbles(c.skills[s].rank, 'skill', s)}<b>${TL.signed(TL.skillBonus(c, s))}</b></span>`
      )
      .join(
        ''
      )}</div><div class="eyebrow space-top">Saving throws</div><div class="hud-saves">${TL.abilities.map((a) => `<span>${a.toUpperCase()} ${rankBubbles(TL.saveRank(c, a), 'save', a)}<b>${TL.signed(TL.saveBonus(c, a))}</b></span>`).join('')}</div></section>`;
  }
  function overviewPanel(c) {
    return `<section class="hud-panel hud-overview"><div class="eyebrow">Overview</div><div class="hud-overview-data">${[
      ['Class', c.className || 'Adventurer'],
      ['Species', c.species || '—'],
      ['Level', c.level],
      ['Proficiency', TL.signed(c.proficiency)],
    ]
      .map(([label, value]) => `<div><small>${label}</small><b>${esc(value)}</b></div>`)
      .join(
        ''
      )}</div><p class="hud-overview-hint">Choose a section above to view options, the character sheet, or resources.</p></section>`;
  }
  const initial = (c) =>
    c.name
      .split(/\s+/)
      .map((w) => w[0] || '')
      .slice(0, 2)
      .join('')
      .toUpperCase();
  const portrait = (c) =>
    `<div class="portrait" style="--accent:${c.accent};--hp:${Math.max(0, c.hp / c.maxHp) * 100}%">${c.avatar ? `<img src="${c.avatar}" alt="${esc(c.name)}">` : `<span>${esc(initial(c))}</span>`}</div>`;
  function pages(text, size = 640) {
    const out = [];
    let rest = text || 'No description entered.';
    while (rest.length > size) {
      let cut = rest.lastIndexOf(' ', size);
      if (cut < size / 2) cut = size;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    out.push(rest);
    return out;
  }
  function countPages(c) {
    const detail = c.items.find((i) => i.id === c.hud.detailId);
    if (detail) return pages(detail.description).length;
    if (c.hud.panel === 'resources') return Math.max(1, Math.ceil(c.resources.length / 6));
    return Math.max(1, Math.ceil(TL.panelItems(c).length / 5));
  }
  function pips(current, max) {
    return max <= 10
      ? `<span class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < current ? 'filled' : ''}"></i>`).join('')}</span>`
      : `<b>${current} / ${max}</b>`;
  }
  function metadata(it) {
    return [
      ['Range', it.range],
      ['Duration', it.duration],
      ['Concentration', it.requiresConcentration ? 'Required' : ''],
      ['Components', it.components],
      ['Attack', it.attack],
      ['Damage', it.damage],
      ['Save', it.save],
    ].filter((x) => x[1]);
  }
  function resourceIcon(r) {
    const shape = TL.resourceIcons.includes(r.icon) ? r.icon : 'circle';
    const color = /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : '#71c6ac';
    return `<span class="resource-icon resource-icon-${shape}" style="color:${color}" aria-hidden="true"></span>`;
  }
  function resource(r) {
    return `<div class="hud-resource" data-resource-id="${esc(r.id)}"><div class="resource-title">${resourceIcon(r)}<b>${esc(r.name)}</b><strong>${r.current}/${r.max}</strong></div><div class="resource-status"><small>${esc(TL.resourceResetLabels[r.reset])}</small>${r.max <= 10 ? pips(r.current, r.max) : ''}</div></div>`;
  }
  function concentrationTitle(c) {
    return c.concentrating
      ? c.concentration || 'Concentrating · choose an ability'
      : 'Not concentrating';
  }
  function damageConcentrationReminder(c) {
    const label = c?.concentration ? 'Concentrating: ' + c.concentration : 'Concentrating';
    return `<span class="damage-concentration-reminder${c?.concentrating ? ' is-active' : ''}" ${c?.concentrating ? `role="img" title="${esc(label)}" aria-label="${esc(label)}"` : 'aria-hidden="true"'}><span aria-hidden="true">◉</span></span>`;
  }
  function characterStatus(c) {
    return `<div class="hud-status"><span class="concentration-toggle ${c.concentrating ? 'is-on' : ''}" data-concentration-indicator title="${esc(concentrationTitle(c))}"><span aria-hidden="true">◉</span> Concentrating</span><div class="hud-concentration-editor"></div><table class="condition-table hud-condition-table"><caption><div class="hud-condition-heading"><span>Conditions</span></div></caption><tbody>${(c.appliedConditions || []).map((e) => `<tr data-condition-id="${esc(e.id)}"><td tabindex="0" title="${esc(e.description || 'No description entered.')}">${esc(e.name)}</td></tr>`).join('') || '<tr><td class="muted">None</td></tr>'}</tbody></table></div>`;
  }
  function concentrationOptions(c, query = '', mode = 'dm') {
    const choices = TL.concentrationChoices(c, query);
    if (!choices.length)
      return `<p class="hint">${query ? 'No matching concentration abilities.' : 'No abilities marked Requires concentration. Add or edit this character’s abilities on the DM screen to mark them.'}</p>`;
    return choices
      .map((it) => {
        const current = c.concentrating && c.concentrationItemId === it.id;
        const attrs =
          mode === 'dm'
            ? `data-action="concentration-pick" data-character="${esc(c.id)}" data-id="${esc(it.id)}"`
            : `data-hud-concentration-pick="${esc(it.id)}"`;
        return `<div class="condition-choice"><span><b title="${esc(it.description || it.name)}">${esc(it.name)}</b><small>${esc(it.kind)} · ${esc(labels[it.economy])}</small></span><button type="button" class="small" ${attrs} ${current ? 'disabled' : ''}>${current ? 'Current' : 'Concentrate'}</button></div>`;
      })
      .join('');
  }
  function render(c, opacity = 0.94) {
    if (!c.hud.expanded)
      return `<div class="hud-collapsed" title="${esc(c.name)}">${portrait(c)}</div>`;
    const detail = c.items.find((i) => i.id === c.hud.detailId);
    const page = Math.min(c.hud.page, countPages(c) - 1);
    let panel = overviewPanel(c);
    if (detail)
      panel = `<section class="hud-panel"><div class="eyebrow">${esc(detail.kind)} · ${esc(labels[detail.economy] || detail.economy)}${detail.kind === 'spell' ? ` · ${TL.levelLabel(detail)}` : ''}</div><h3>${esc(detail.name)}</h3><div class="hud-metadata">${metadata(
        detail
      )
        .map(([k, v]) => `<span><small>${k}</small>${esc(v)}</span>`)
        .join(
          ''
        )}</div><p class="hud-description">${esc(pages(detail.description)[page])}</p>${countPages(c) > 1 ? `<div class="hud-page">Description ${page + 1} / ${countPages(c)}</div>` : ''}</section>`;
    else if (c.hud.panel === 'sheet') panel = sheetPanel(c);
    else if (c.hud.panel === 'resources')
      panel = `<section class="hud-panel"><div class="eyebrow">Custom resources</div>${
        c.resources
          .slice(page * 6, page * 6 + 6)
          .map(resource)
          .join('') || '<p class="muted">No resources entered.</p>'
      }</section>`;
    else if (c.hud.panel)
      panel = `<section class="hud-panel"><div class="eyebrow">${labels[c.hud.panel]}</div><div class="hud-options">${
        TL.panelItems(c)
          .slice(page * 5, page * 5 + 5)
          .map(
            (it) =>
              `<div class="hud-option ${TL.availability(c, it) ? 'spent' : ''}"><span class="ability-symbol">${symbols[it.kind] || symbols[it.economy]}</span><div><b>${esc(it.name)}</b><small>${esc(it.kind === 'spell' ? TL.levelLabel(it) : labels[it.economy])}${it.resourceId ? ' · ' + esc(c.resources.find((r) => r.id === it.resourceId)?.name) : ''}</small></div><span>${TL.availability(c, it) ? 'Spent' : 'Ready'}</span></div>`
          )
          .join('') || '<p class="muted">No options entered here yet.</p>'
      }</div>${countPages(c) > 1 ? `<div class="hud-page">Options ${page + 1} / ${countPages(c)}</div>` : ''}</section>`;
    return `<div class="hud-card" style="--accent:${c.accent};--panel-opacity:${opacity}"><div class="hud-summary"><header class="hud-header">${portrait(c)}<div class="hud-identity"><h2>${esc(c.name)}</h2><span>${esc(c.className || 'Adventurer')} · Level ${c.level}</span><div class="hud-health"><strong>${c.hp}</strong><span>/ ${c.maxHp} HP</span></div><div class="hud-temp-hp">Temp HP <b>${c.tempHp}</b></div></div><div class="hud-ac"><b>${c.ac}</b><small>AC</small></div></header><div class="hp-track"><i style="width:${(c.hp / c.maxHp) * 100}%"></i></div><div class="hud-economy">${['action', 'bonus', 'reaction'].map((k) => `<div class="${c.turn[k] ? '' : 'spent'}"><b>${symbols[k]}</b><small>${k === 'bonus' ? 'Bonus' : k[0].toUpperCase() + k.slice(1)}</small><i>${c.turn[k] ? 'Ready' : 'Spent'}</i></div>`).join('')}<div class="${c.turn.movement ? '' : 'spent'}"><b>${c.turn.movement}<em>ft</em></b><small>Movement</small><i>of ${c.speed} ft</i></div></div><div class="hud-stats">${TL.abilities.map((a) => `<div><small>${a.toUpperCase()}</small><b>${TL.signed(TL.mod(c.abilities[a]))}</b><span>${c.abilities[a]}</span></div>`).join('')}</div>${characterStatus(c)}${
      c.slots.some((s) => s.max)
        ? `<div class="hud-slots">${c.slots
            .filter((s) => s.max)
            .map((s) => `<div><small>L${s.level}</small>${pips(s.current, s.max)}</div>`)
            .join('')}</div>`
        : ''
    }${
      c.resources.length
        ? `<div class="hud-charges">${c.resources.map(resource).join('')}</div>`
        : ''
    }</div><div class="hud-browser"><nav class="hud-nav" aria-label="Character sections">${panelChoices.map(([key, name]) => `<span class="hud-nav-label ${c.hud.panel === key && !c.hud.detailId ? 'chosen' : ''}">${esc(name)}</span>`).join('')}</nav><div class="hud-section-content">${panel}</div></div></div>`;
  }
  function mount(
    stage,
    state,
    viewportWidth,
    viewportHeight,
    previewScale = 1,
    selectedId = '',
    controls = ''
  ) {
    const previous = new Map(
      [...stage.children].map((el) => [
        el.dataset.hudId,
        {
          key: el.dataset.contentKey,
          summary: el.querySelector('.hud-summary')?.scrollTop || 0,
          section: el.querySelector('.hud-section-content')?.scrollTop || 0,
        },
      ])
    );
    stage.innerHTML = state.characters
      .filter((c) => c.hud.visible)
      .map(
        (c) =>
          `<div class="hud-position ${c.hud.expanded ? 'is-expanded' : ''} ${c.id === selectedId ? 'selected-hud' : ''}" data-hud-id="${esc(c.id)}" style="--accent:${c.accent};z-index:${c.hud.expanded ? 2 : 1}">${render(c, state.settings.opacity)}</div>`
      )
      .join('');
    for (const el of stage.children) {
      const c = state.characters.find((c) => c.id === el.dataset.hudId);
      if (controls) HUDControls.decorate(el, c, controls);
      const w = el.offsetWidth,
        h = el.offsetHeight;
      const scale = c.hud.scale;
      const position = TL.fitHud(c.hud, w, h, viewportWidth, viewportHeight);
      el.dataset.contentKey = JSON.stringify([c.hud.panel, c.hud.detailId, c.hud.page]);
      const old = previous.get(c.id);
      if (old && c.hud.expanded) {
        el.querySelector('.hud-summary').scrollTop = old.summary;
        if (old.key === el.dataset.contentKey)
          el.querySelector('.hud-section-content').scrollTop = old.section;
      }
      el.style.left = position.x * previewScale + 'px';
      el.style.top = position.y * previewScale + 'px';
      el.style.transform = `translate(-50%, -50%) rotate(${c.hud.rotation}deg) scale(${scale * previewScale})`;
    }
  }
  function scroll(stage, command) {
    const root = [...(stage?.children || [])].find(
      (el) => el.dataset.hudId === command.characterId
    );
    const area = command.area === 'summary' ? '.hud-summary' : '.hud-section-content';
    const target = root?.querySelector(area);
    if (target) target.scrollTop += command.direction * Math.max(80, target.clientHeight * 0.8);
  }
  window.HUD = {
    concentrationTitle,
    damageConcentrationReminder,
    concentrationOptions,
    resourceIcon,
    resource,
    scroll,
    esc,
    portrait,
    symbols,
    labels,
    pages,
    countPages,
    pips,
    metadata,
    render,
    mount,
    panelChoices,
  };
})();
