/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
(function () {
  'use strict';
  function control(c, label, type, values = {}, attrs = '') {
    return `<button type="button" data-hud-command="${HUD.esc(JSON.stringify({ type, characterId: c.id, ...values }))}" ${attrs}>${label}</button>`;
  }
  function decorate(el, c, mode) {
    el.classList.add('is-editable');
    el.classList.toggle('is-collapsed', !c.hud.expanded);
    el.querySelectorAll('img').forEach((image) => (image.draggable = false));
    const handle = `<button type="button" class="hud-rotate-handle" title="Drag to rotate this character; hold Shift to snap to 15°" aria-label="Rotate ${HUD.esc(c.name)}">⟳</button>`;
    if (!c.hud.expanded) {
      el.insertAdjacentHTML(
        'beforeend',
        `<div class="bubble-name">${HUD.esc(c.name)}</div><div class="bubble-controls">${control(c, '↶', 'rotate', { amount: -15 }, 'title="Rotate left 15°"')}${handle}${control(c, '↷', 'rotate', { amount: 15 }, 'title="Rotate right 15°"')}${control(c, '＋', 'expand', {}, 'title="Expand character"')}</div>`
      );
      el.querySelector('.portrait').title =
        mode === 'overlay' ? 'Drag to move. Click to expand.' : 'Drag to move this character.';
      return;
    }
    el.insertAdjacentHTML(
      'afterbegin',
      `<div class="hud-toolstrip"><button class="hud-drag-handle" type="button" title="Drag to move only this character">✥ Move</button>${handle}${control(c, '↶', 'rotate', { amount: -15 }, 'title="Rotate left 15°"')}<span class="hud-angle">${Math.round(c.hud.rotation)}°</span>${control(c, '↷', 'rotate', { amount: 15 }, 'title="Rotate right 15°"')}${control(c, '−', 'expand', {}, 'title="Collapse to bubble"')}${control(c, '×', 'hide', {}, 'title="Hide this character"')}</div>`
    );
    if (mode === 'preview') return;
    const card = el.querySelector('.hud-card');
    card.querySelector('[data-concentration-indicator]').outerHTML = control(
      c,
      '<span aria-hidden="true">◉</span> Concentrating',
      'concentration',
      { active: !c.concentrating },
      `class="concentration-toggle ${c.concentrating ? 'is-on' : ''}" aria-pressed="${c.concentrating}" title="${HUD.esc(HUD.concentrationTitle(c))}"`
    );
    card
      .querySelector('.hud-condition-heading')
      .insertAdjacentHTML(
        'beforeend',
        `<button type="button" data-hud-conditions="${HUD.esc(c.id)}" aria-label="Add condition to ${HUD.esc(c.name)}">Add</button>`
      );
    card
      .querySelector('.hud-condition-table')
      .insertAdjacentHTML('afterend', '<div class="hud-condition-picker"></div>');
    card.querySelectorAll('[data-condition-id]').forEach((row) => {
      const condition = c.appliedConditions.find((e) => e.id === row.dataset.conditionId);
      row.insertAdjacentHTML(
        'beforeend',
        '<td>' +
          control(
            c,
            '×',
            'condition-remove',
            { conditionId: condition.id },
            `aria-label="Remove ${HUD.esc(condition.name)}"`
          ) +
          '</td>'
      );
    });
    card.querySelectorAll('.hud-economy>div').forEach((node, i) => {
      if (i < 3) {
        const key = ['action', 'bonus', 'reaction'][i];
        node.insertAdjacentHTML(
          'beforeend',
          `<div class="hud-inline-buttons">${control(c, 'Options', 'panel', { panel: key })}${control(c, c.turn[key] ? 'Spend' : 'Restore', 'economy', { key })}</div>`
        );
      } else
        node.insertAdjacentHTML(
          'beforeend',
          `<div class="hud-inline-buttons">${control(c, '−5', 'move', { amount: -5 })}${control(c, '+5', 'move', { amount: 5 })}</div>`
        );
    });
    card
      .querySelector('.hp-track')
      .insertAdjacentHTML(
        'afterend',
        `<div class="hud-vitals-controls"><span>HP</span>${control(c, '−1', 'hp', { amount: -1 })}${control(c, '−5', 'hp', { amount: -5 })}${control(c, '+1', 'hp', { amount: 1 })}${control(c, '+5', 'hp', { amount: 5 })}${control(c, 'Start turn', 'turn')}</div>`
      );
    card
      .querySelector('.hud-vitals-controls')
      .insertAdjacentHTML(
        'afterend',
        '<div class="hud-temp-controls"><span>Temp HP ' +
          c.tempHp +
          '</span>' +
          control(c, '−1', 'temp-hp', { amount: -1 }, c.tempHp ? '' : 'disabled') +
          control(c, '+1', 'temp-hp', { amount: 1 }) +
          control(c, '+5', 'temp-hp', { amount: 5 }) +
          '</div>'
      );
    card.querySelectorAll('.rank-bubbles').forEach((node) => {
      const kind = node.dataset.rankKind,
        name = node.dataset.rankName,
        rank = kind === 'skill' ? c.skills[name].rank : TL.saveRank(c, name);
      node.innerHTML = [
        ['P', 'Proficiency', rank >= 1, rank ? 0 : 1],
        ['E', 'Expertise', rank === 2, rank === 2 ? 1 : 2],
      ]
        .map(([label, title, active, next]) =>
          control(
            c,
            label,
            'proficiency',
            { kind, name, rank: next },
            'class="rank-bubble ' +
              (active ? 'filled' : '') +
              '" aria-label="' +
              HUD.esc(title + ': ' + name) +
              '" aria-pressed="' +
              active +
              '"'
          )
        )
        .join('');
    });
    card.querySelectorAll('.hud-slots>div').forEach((node, i) => {
      const slot = c.slots.filter((s) => s.max)[i];
      node.insertAdjacentHTML(
        'beforeend',
        control(c, '−', 'slot', { level: slot.level, amount: -1 }, slot.current ? '' : 'disabled') +
          control(
            c,
            '+',
            'slot',
            { level: slot.level, amount: 1 },
            slot.current < slot.max ? '' : 'disabled'
          )
      );
    });
    const panel = card.querySelector('.hud-panel');
    card.querySelector('.hud-nav').innerHTML = HUD.panelChoices
      .map(([key, name]) =>
        control(
          c,
          name,
          'panel',
          { panel: key },
          'aria-pressed="' +
            (c.hud.panel === key && !c.hud.detailId) +
            '" ' +
            (c.hud.panel === key && !c.hud.detailId ? 'class="chosen"' : '')
        )
      )
      .join('');
    const detail = c.items.find((i) => i.id === c.hud.detailId);
    if (detail) {
      const reason = TL.availability(c, detail);
      let use;
      if (detail.kind === 'spell' && detail.level > 0 && detail.usesSlot)
        use = c.slots
          .filter((s) => s.level >= detail.level && s.current)
          .map((s) =>
            control(
              c,
              'Cast L' + s.level,
              'use',
              { itemId: detail.id, level: s.level },
              reason ? 'disabled' : ''
            )
          )
          .join('');
      else use = control(c, 'Use ability', 'use', { itemId: detail.id }, reason ? 'disabled' : '');
      panel.insertAdjacentHTML(
        'beforeend',
        `<div class="hud-use-controls">${use || '<span>No suitable slots remaining</span>'}${reason ? `<small>${HUD.esc(reason)}</small>` : ''}</div>`
      );
    } else {
      card.querySelectorAll('.hud-option').forEach((node, i) => {
        const item = TL.panelItems(c)[Math.min(c.hud.page, HUD.countPages(c) - 1) * 5 + i];
        node.dataset.hudCommand = JSON.stringify({
          type: 'detail',
          characterId: c.id,
          itemId: item.id,
        });
        node.title = 'Show ' + item.name;
        node.insertAdjacentHTML('beforeend', control(c, 'View', 'detail', { itemId: item.id }));
      });
    }
    card.querySelectorAll('.hud-resource').forEach((node) => {
      const resource = c.resources.find((r) => r.id === node.dataset.resourceId);
      node.insertAdjacentHTML(
        'beforeend',
        `<div class="hud-inline-buttons">${control(c, '−', 'resource', { resourceId: resource.id, amount: -1 }, `aria-label="Spend ${HUD.esc(resource.name)}" ${resource.current ? '' : 'disabled'}`)}${control(c, '+', 'resource', { resourceId: resource.id, amount: 1 }, `aria-label="Restore ${HUD.esc(resource.name)}" ${resource.current < resource.max ? '' : 'disabled'}`)}${resource.reset === 'manual' ? control(c, 'Reset', 'resource-reset', { resourceId: resource.id }, `aria-label="Reset ${HUD.esc(resource.name)}" ${resource.current < resource.max ? '' : 'disabled'}`) : ''}</div>`
      );
    });
    if (panel && HUD.countPages(c) > 1)
      panel.insertAdjacentHTML(
        'beforeend',
        `<div class="hud-pagination">${control(c, '← Previous', 'page', { amount: -1 }, c.hud.page > 0 ? '' : 'disabled')}<span>${Math.min(c.hud.page + 1, HUD.countPages(c))} / ${HUD.countPages(c)}</span>${control(c, 'Next →', 'page', { amount: 1 }, c.hud.page < HUD.countPages(c) - 1 ? '' : 'disabled')}</div>`
      );
    card
      .querySelector('.hud-summary')
      .insertAdjacentHTML(
        'beforeend',
        `<div class="hud-size-controls">${control(c, 'Smaller', 'scale', { amount: -0.1 })}${control(c, 'Larger', 'scale', { amount: 0.1 })}<span>Drag portrait to move · drag ⟳ to rotate</span></div>`
      );
  }
  function gestures(stage, config) {
    let drag = null,
      suppressClick = false;
    const character = (id) => config.getState().characters.find((c) => c.id === id);
    const detach = () => {
      document.removeEventListener('pointermove', movePointer, true);
      document.removeEventListener('pointerup', finishPointer, true);
      document.removeEventListener('pointercancel', cancel, true);
    };
    function cancel() {
      if (!drag) return;
      const current = character(drag.id);
      if (current)
        Object.assign(current.hud, {
          x: drag.before.x,
          y: drag.before.y,
          rotation: drag.before.rotation,
        });
      try {
        stage.releasePointerCapture(drag.pointerId);
      } catch {}
      drag = null;
      detach();
      config.onCancel?.();
    }
    stage.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || config.enabled?.() === false) return;
      const node = event.target.closest('.hud-position');
      if (!node) return;
      const rotate = event.target.closest('.hud-rotate-handle');
      const move =
        event.target.closest('.hud-drag-handle,.portrait') ||
        (config.preview && !event.target.closest('button,input,select'));
      if (!rotate && !move) return;
      const c = character(node.dataset.hudId);
      if (!c) return;
      const r = node.getBoundingClientRect(),
        viewport = config.viewport(),
        sr = stage.getBoundingClientRect();
      drag = {
        id: c.id,
        before: TL.clone(c.hud),
        pointerId: event.pointerId,
        rotation: c.hud.rotation,
        rotate: Boolean(rotate),
        startX: event.clientX,
        startY: event.clientY,
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        x: ((r.left + r.width / 2 - sr.left) / viewport.width) * 100,
        y: ((r.top + r.height / 2 - sr.top) / viewport.height) * 100,
        viewport,
        moved: false,
      };
      drag.startAngle = Math.atan2(event.clientY - drag.cy, event.clientX - drag.cx);
      drag.lastAngle = drag.startAngle;
      drag.totalAngle = 0;
      config.onSelect?.(c.id);
      // Keep document listeners as a fallback if Windows declines native pointer capture.
      try {
        stage.setPointerCapture(event.pointerId);
      } catch {}
      document.addEventListener('pointermove', movePointer, true);
      document.addEventListener('pointerup', finishPointer, true);
      document.addEventListener('pointercancel', cancel, true);
      config.onActive?.(true);
      event.preventDefault();
    });
    function movePointer(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const c = character(drag.id),
        node = [...stage.children].find((el) => el.dataset.hudId === drag.id);
      if (!c || !node) {
        cancel();
        return;
      }
      const dx = event.clientX - drag.startX,
        dy = event.clientY - drag.startY;
      if (Math.hypot(dx, dy) > 3) drag.moved = true;
      if (!drag.moved) return;
      if (drag.rotate) {
        const angle = Math.atan2(event.clientY - drag.cy, event.clientX - drag.cx);
        let delta = angle - drag.lastAngle;
        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;
        drag.totalAngle += delta;
        drag.lastAngle = angle;
        let degrees = drag.rotation + (drag.totalAngle * 180) / Math.PI;
        if (event.shiftKey) degrees = Math.round(degrees / 15) * 15;
        c.hud.rotation = ((Math.round(degrees) % 360) + 360) % 360;
        node.style.transform = node.style.transform.replace(
          /rotate\([^)]*\)/,
          `rotate(${c.hud.rotation}deg)`
        );
        const label = node.querySelector('.hud-angle');
        if (label) label.textContent = c.hud.rotation + '°';
      } else {
        c.hud.x = TL.num(drag.x + (dx / drag.viewport.width) * 100, 0, 100);
        c.hud.y = TL.num(drag.y + (dy / drag.viewport.height) * 100, 0, 100);
        node.style.left = (c.hud.x / 100) * drag.viewport.width + 'px';
        node.style.top = (c.hud.y / 100) * drag.viewport.height + 'px';
      }
      event.preventDefault();
    }
    function finishPointer(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const done = drag,
        c = character(done.id);
      drag = null;
      detach();
      try {
        stage.releasePointerCapture(event.pointerId);
      } catch {}
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
      if (c && done.moved)
        config.onCommit(done.id, { x: c.hud.x, y: c.hud.y, rotation: c.hud.rotation }, done.before);
      else if (c && !done.rotate) config.onTap?.(done.id);
      config.onActive?.(false);
      event.preventDefault();
    }
    stage.addEventListener(
      'click',
      (event) => {
        if (suppressClick) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      true
    );
    return {
      get activeId() {
        return drag?.id;
      },
      get isDragging() {
        return Boolean(drag);
      },
      cancel,
    };
  }
  window.HUDControls = { decorate, gestures };
})();
