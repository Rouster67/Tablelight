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
  const pages = TL.textPages;
  function abilityThumbnail(it, size = '') {
    let icon = '';
    try {
      icon = TL.abilityIcon(it.icon);
    } catch {
      // A damaged image must never hide the ability or change its reserved space.
    }
    return `<span class="ability-symbol ability-thumbnail ${size === 'large' ? 'ability-thumbnail-large' : ''}" aria-hidden="true"><span>${symbols[it.kind] || symbols[it.economy] || symbols.action}</span>${icon ? `<img src="${icon}" alt="" decoding="async">` : ''}</span>`;
  }
  if (typeof document !== 'undefined') {
    document.addEventListener(
      'load',
      (event) => {
        if (event.target.matches?.('.ability-thumbnail > img'))
          event.target.parentElement.classList.add('image-ready');
      },
      true
    );
    document.addEventListener(
      'error',
      (event) => {
        if (event.target.matches?.('.ability-thumbnail > img')) {
          event.target.parentElement.classList.remove('image-ready');
          event.target.remove();
        }
      },
      true
    );
  }
  function abilityName(it) {
    const icon = it.local
      ? '<span class="ability-local-icon" role="img" aria-label="Character-only ability" title="Only on this character"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="7" r="3.5"></circle><path d="M5 21v-3a7 7 0 0 1 14 0v3"></path></svg></span>'
      : '';
    return icon + esc(it.name);
  }
  function countPages(c) {
    const detail = c.items.find((i) => i.id === c.hud.detailId);
    if (detail) return TL.abilityTextPages(detail).length;
    if (c.hud.panel === 'resources') return Math.max(1, Math.ceil(c.resources.length / 6));
    return Math.max(1, Math.ceil(TL.panelItems(c).length / 5));
  }
  function pips(current, max) {
    return max <= 10
      ? `<span class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < current ? 'filled' : ''}"></i>`).join('')}</span>`
      : `<b>${current} / ${max}</b>`;
  }
  function abilityDetails(it, c) {
    const pool = c?.resources.find((r) => r.id === it.resourceId);
    return {
      metadata: [
        ['Trigger', it.trigger],
        ['Duration', it.duration],
        ['Range', it.range],
        ['Area', it.area],
        ['Casting Time', it.castingTime],
        ['Spell Level', it.level == null ? '' : TL.levelLabel(it)],
        ['Components', it.components],
        ['School', it.school],
        ['Attack', it.attack],
        ['Save', it.save],
        ['On Save', it.onSave],
        ['Damage / Healing', it.damage],
        ['Concentration', it.requiresConcentration ? 'Yes' : ''],
        ['Linked resource pool', pool?.name],
        ['Charges spent per use', pool ? String(it.resourceCost) : ''],
      ].filter((x) => x[1]),
      description: it.description || 'No description entered.',
      sections: TL.abilityTextSections(it),
      source: it.source || '',
    };
  }
  function sourceReference(source) {
    return source ? `<p class="ability-source"><small>Reference</small> ${esc(source)}</p>` : '';
  }
  function renderTextSections(sections, textClass) {
    return sections
      .map(({ label, text }) =>
        label
          ? `<div class="ability-text-section ${label === 'Upcast / upgrades' ? 'ability-upgrades' : ''}"><h4>${esc(label)}</h4><p class="${textClass}">${esc(text)}</p></div>`
          : `<p class="${textClass}">${esc(text)}</p>`
      )
      .join('');
  }
  function renderAbilityDetails(it, c) {
    const details = abilityDetails(it, c);
    return `<div class="ability-detail-heading">${abilityThumbnail(it, 'large')}<b>${abilityName(it)}</b></div><div class="detail-meta">${details.metadata
      .map(([label, value]) => `<div><small>${esc(label)}</small>${esc(value)}</div>`)
      .join(
        ''
      )}</div>${renderTextSections(details.sections, 'description-text')}${sourceReference(details.source)}`;
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
      return `<p class="hint">${query ? 'No matching concentration abilities.' : 'No abilities marked Concentration. Add or edit this character’s abilities on the DM screen to mark them.'}</p>`;
    return choices
      .map((it) => {
        const current = c.concentrating && c.concentrationItemId === it.id;
        const attrs =
          mode === 'dm'
            ? `data-action="concentration-pick" data-character="${esc(c.id)}" data-id="${esc(it.id)}"`
            : `data-hud-concentration-pick="${esc(it.id)}"`;
        return `<div class="condition-choice"><span><b title="${esc(it.description || it.name)}">${abilityName(it)}</b><small>${esc(it.kind)} · ${esc(labels[it.economy])}</small></span><button type="button" class="small" ${attrs} ${current ? 'disabled' : ''}>${current ? 'Current' : 'Concentrate'}</button></div>`;
      })
      .join('');
  }
  function pendingRequests(c, interactive) {
    if (!c.pendingRequests?.length) return '';
    return `<section class="hud-pending-requests" aria-label="Pending ability requests"><b>Awaiting DM approval</b>${c.pendingRequests.map((r) => `<div class="hud-pending-use ${r.urgent ? 'urgent' : ''}"><span>${r.urgent ? '<small>Urgent · Reaction</small>' : ''}${esc(r.name)}${r.slotLevel ? `<small>Level ${r.slotLevel} slot reserved</small>` : ''}</span><button type="button" data-cancel-request="${esc(r.id)}" data-character="${esc(c.id)}" ${interactive ? '' : 'disabled'} aria-label="Cancel request for ${esc(r.name)}">Cancel</button></div>`).join('')}<small>Costs are reserved until the DM decides.</small></section>`;
  }
  function render(c, opacity = 0.94, interactive = false) {
    if (!c.hud.expanded)
      return `<div class="hud-collapsed" title="${esc(c.name)}">${portrait(c)}</div>`;
    const detail = c.items.find((i) => i.id === c.hud.detailId),
      details = detail && abilityDetails(detail, c);
    const page = Math.min(c.hud.page, countPages(c) - 1);
    let panel = overviewPanel(c);
    if (detail)
      panel = `<section class="hud-panel"><div class="eyebrow">${esc(detail.kind)} · ${esc(labels[detail.economy] || detail.economy)}${detail.kind === 'spell' ? ` · ${TL.levelLabel(detail)}` : ''}</div><div class="ability-detail-heading">${abilityThumbnail(detail, 'large')}<h3>${abilityName(detail)}</h3></div><div class="hud-metadata">${details.metadata
        .map(([k, v]) => `<span><small>${k}</small>${esc(v)}</span>`)
        .join(
          ''
        )}</div>${renderTextSections(TL.abilityTextPages(detail)[page], 'hud-description')}${countPages(c) > 1 ? `<div class="hud-page">Details ${page + 1} / ${countPages(c)}</div>` : ''}${sourceReference(details.source)}</section>`;
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
              `<div class="hud-option ${TL.availability(c, it) ? 'spent' : ''}">${abilityThumbnail(it)}<div><b>${abilityName(it)}</b><small>${esc(it.kind === 'spell' ? TL.levelLabel(it) : labels[it.economy])}${it.resourceId ? ' · ' + esc(c.resources.find((r) => r.id === it.resourceId)?.name) : ''}</small></div><span>${TL.availability(c, it) ? 'Spent' : 'Ready'}</span></div>`
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
    }</div><div class="hud-browser"><nav class="hud-nav" aria-label="Character sections">${panelChoices.map(([key, name]) => `<span class="hud-nav-label ${c.hud.panel === key && !c.hud.detailId ? 'chosen' : ''}">${esc(name)}</span>`).join('')}</nav><div class="hud-section-content">${panel}</div></div>${pendingRequests(c, interactive)}</div>`;
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
          section: el.querySelector('.hud-section-content')?.scrollTop || 0,
          pending: el.querySelector('.hud-pending-requests')?.scrollTop || 0,
        },
      ])
    );
    stage.innerHTML = state.characters
      .filter((c) => c.hud.visible)
      .map(
        (c) =>
          `<div class="hud-position ${c.hud.expanded ? 'is-expanded' : ''} ${c.hud.expanded && c.pendingRequests?.length ? 'has-pending-requests' : ''} ${c.id === selectedId ? 'selected-hud' : ''}" data-hud-id="${esc(c.id)}" style="--accent:${c.accent};z-index:${c.hud.expanded ? 2 : 1}">${render(c, state.settings.opacity, state.settings.overlayInteractive)}</div>`
      )
      .join('');
    for (const el of stage.children) {
      const c = state.characters.find((c) => c.id === el.dataset.hudId);
      if (controls) HUDControls.decorate(el, c, controls);
      el.dataset.contentKey = JSON.stringify([c.hud.panel, c.hud.detailId, c.hud.page]);
      const old = previous.get(c.id);
      if (old && c.hud.expanded) {
        if (old.key === el.dataset.contentKey)
          el.querySelector('.hud-section-content').scrollTop = old.section;
        const pending = el.querySelector('.hud-pending-requests');
        if (pending) pending.scrollTop = old.pending;
      }
    }
    fit(stage, state, viewportWidth, viewportHeight, previewScale);
  }
  function fit(stage, state, viewportWidth, viewportHeight, previewScale = 1) {
    for (const el of stage.children) {
      const c = state.characters.find((c) => c.id === el.dataset.hudId);
      if (!c) continue;
      const position = TL.fitHud(
        c.hud,
        el.offsetWidth,
        el.offsetHeight,
        viewportWidth,
        viewportHeight
      );
      el.style.left = position.x * previewScale + 'px';
      el.style.top = position.y * previewScale + 'px';
      el.style.transform = `translate(-50%, -50%) rotate(${c.hud.rotation}deg) scale(${c.hud.scale * previewScale})`;
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
    abilityDetails,
    abilityName,
    abilityThumbnail,
    renderAbilityDetails,
    render,
    mount,
    fit,
    panelChoices,
  };
})();
