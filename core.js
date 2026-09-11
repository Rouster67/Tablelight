/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TL = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const skills = {
    Acrobatics: 'dex',
    'Animal Handling': 'wis',
    Arcana: 'int',
    Athletics: 'str',
    Deception: 'cha',
    History: 'int',
    Insight: 'wis',
    Intimidation: 'cha',
    Investigation: 'int',
    Medicine: 'wis',
    Nature: 'int',
    Perception: 'wis',
    Performance: 'cha',
    Persuasion: 'cha',
    Religion: 'int',
    'Sleight of Hand': 'dex',
    Stealth: 'dex',
    Survival: 'wis',
  };
  const colors = [
    '#71c6ac',
    '#d2a461',
    '#a699dc',
    '#83b5e0',
    '#dd8f98',
    '#bed479',
    '#deac81',
    '#7acbd6',
  ];
  const resourceIcons = ['circle', 'square', 'diamond', 'triangle', 'hexagon', 'star'];
  const resourceResetLabels = {
    short: 'Short or long rest',
    long: 'Long rest',
    turn: 'Start turn',
    manual: 'Manual',
  };
  const PARTY_LIMIT = 8;
  // Active players live in characters; saved players outside the party live in roster.
  // Each player exists exactly once. There is no fixed limit on saved players.
  const allCharacters = (state) => [...state.characters, ...(state.roster || [])];
  const findCharacter = (state, id) =>
    state.characters.find((c) => c.id === id) || state.roster?.find((c) => c.id === id);
  function addToParty(state, id) {
    if (state.characters.some((c) => c.id === id))
      throw new Error('This player is already in the party.');
    if (state.characters.length >= PARTY_LIMIT)
      throw new Error('The party is full (8 players). Remove someone from the party first.');
    const index = state.roster.findIndex((c) => c.id === id);
    if (index < 0) throw new Error('This saved player no longer exists.');
    const [c] = state.roster.splice(index, 1);
    state.characters.push(c);
    if (!state.activeId) state.activeId = c.id;
  }
  function removeFromParty(state, id) {
    const index = state.characters.findIndex((c) => c.id === id);
    if (index < 0) throw new Error('This player is not in the party.');
    const [c] = state.characters.splice(index, 1);
    state.roster.push(c);
    if (state.activeId === id)
      state.activeId = state.characters[index % state.characters.length]?.id || '';
  }
  function deletePlayer(state, id) {
    if (!findCharacter(state, id)) throw new Error('This player no longer exists.');
    if (state.characters.some((c) => c.id === id)) removeFromParty(state, id);
    state.roster = state.roster.filter((c) => c.id !== id);
  }
  function overlayState(state) {
    // The TV receives only the active party, never the saved roster or DM notes.
    return {
      version: state.version,
      characters: state.characters.map((c) => {
        const player = clone(c);
        delete player.notes;
        return player;
      }),
      activeId: state.activeId,
      settings: clone(state.settings),
    };
  }
  const uid = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const num = (value, min, max, fallback = min) =>
    Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  const integer = (value, min, max, fallback = min) => Math.round(num(value, min, max, fallback));
  const str = (value, max = 20000) => (typeof value === 'string' ? value.slice(0, max) : '');
  const mod = (score) => Math.floor((score - 10) / 2);
  const signed = (n) => (n >= 0 ? '+' + n : String(n));
  const skillBonus = (c, name) =>
    c.skills[name]?.override !== null && c.skills[name]?.override !== undefined
      ? c.skills[name].override
      : mod(c.abilities[skills[name]]) + (c.skills[name]?.rank || 0) * c.proficiency;
  const saveRank = (c, ability) =>
    c.saveExpertise?.includes(ability) ? 2 : c.saves.includes(ability) ? 1 : 0;
  const saveBonus = (c, ability) =>
    mod(c.abilities[ability]) + saveRank(c, ability) * c.proficiency;
  function setRank(c, kind, name, rank) {
    if (!Number.isInteger(rank) || rank < 0 || rank > 2)
      throw new Error('Choose a valid proficiency rank.');
    if (kind === 'skill' && Object.hasOwn(skills, name)) c.skills[name].rank = rank;
    else if (kind === 'save' && abilities.includes(name)) {
      c.saves = abilities.filter((a) => (a === name ? rank > 0 : c.saves.includes(a)));
      c.saveExpertise = abilities.filter((a) =>
        a === name ? rank === 2 : c.saveExpertise?.includes(a)
      );
    } else throw new Error('Unknown skill or saving throw.');
  }
  const levelLabel = (it) =>
    it.level === null || it.level === undefined
      ? 'No spell level'
      : it.level === 0
        ? 'Cantrip'
        : 'Level ' + it.level;
  const normalizeSpellLevel = (raw) =>
    raw.kind !== 'spell' || raw.level === null || raw.level === undefined || raw.level === ''
      ? null
      : integer(raw.level, 0, 9);
  const freshTurn = (c) => ({ action: true, bonus: true, reaction: true, movement: c.speed });
  function item(data = {}) {
    return {
      id: uid(),
      name: 'New ability',
      kind: 'action',
      economy: 'action',
      level: null,
      usesSlot: true,
      requiresConcentration: false,
      resourceId: '',
      resourceCost: 1,
      range: '',
      duration: '',
      components: '',
      attack: '',
      damage: '',
      save: '',
      description: '',
      disabled: false,
      ...data,
    };
  }
  // Definitions are shared; bindings and spent state belong to individual characters.
  const definitionFields = [
    'name',
    'kind',
    'economy',
    'level',
    'usesSlot',
    'requiresConcentration',
    'range',
    'duration',
    'components',
    'attack',
    'damage',
    'save',
    'description',
  ];
  function libraryEntry(raw = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new Error('Each library entry must be an object.');
    const defaults = item(),
      entry = { id: str(raw.id, 300) || uid() };
    for (const key of definitionFields)
      entry[key] = str(raw[key] ?? defaults[key], key === 'description' ? 40000 : 300);
    entry.name = entry.name.trim() || 'Unnamed ability';
    entry.kind = ['action', 'spell', 'feature'].includes(raw.kind) ? raw.kind : 'action';
    entry.economy = ['action', 'bonus', 'reaction', 'free'].includes(raw.economy)
      ? raw.economy
      : 'action';
    entry.level = normalizeSpellLevel(raw);
    entry.usesSlot = raw.usesSlot !== false;
    entry.requiresConcentration = raw.requiresConcentration === true;
    return entry;
  }
  const definitionKey = (entry) => JSON.stringify(definitionFields.map((key) => entry[key]));
  function attachItem(state, characterId, libraryId, settings = {}) {
    const c = findCharacter(state, characterId),
      entry = state.library.find((e) => e.id === libraryId);
    if (!c || !entry) throw new Error('Character or library entry no longer exists.');
    if (c.items.some((it) => it.libraryId === libraryId))
      throw new Error('This character already has this library entry.');
    if (c.items.length >= 500) throw new Error('This character already has 500 abilities.');
    const binding = item({
      ...entry,
      id: uid(),
      libraryId,
      resourceId: settings.resourceId || '',
      resourceCost: settings.resourceCost ?? 1,
      disabled: settings.disabled === true,
    });
    if (binding.resourceId && !c.resources.some((r) => r.id === binding.resourceId))
      throw new Error('Choose a resource belonging to this character.');
    c.items.push(binding);
    return binding;
  }
  function removeLibraryEntry(state, id) {
    if (allCharacters(state).some((c) => c.items.some((it) => it.libraryId === id)))
      throw new Error('Remove this entry from its characters before deleting it from the library.');
    state.library = state.library.filter((entry) => entry.id !== id);
  }
  function conditionEntry(raw = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new Error('Invalid condition entry.');
    return {
      id: str(raw.id, 100) || uid(),
      name: str(raw.name, 300).trim() || 'Condition',
      description: str(raw.description, 40000),
    };
  }
  function assignCondition(state, characterId, conditionId) {
    const c = findCharacter(state, characterId);
    if (!c || !state.conditionLibrary.some((e) => e.id === conditionId))
      throw new Error('Character or condition no longer exists.');
    if (!c.conditionIds.includes(conditionId)) c.conditionIds.push(conditionId);
  }
  function searchConditions(state, query = '') {
    if (typeof query !== 'string' || query.length > 300)
      throw new Error('Enter a condition search of up to 300 characters.');
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const matches = state.conditionLibrary
      .filter((e) =>
        words.every((word) => (e.name + ' ' + e.description).toLowerCase().includes(word))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      entries: matches
        .slice(0, 100)
        .map((e) => ({ id: e.id, name: e.name, description: e.description })),
      total: matches.length,
    };
  }
  function unassignCondition(state, characterId, conditionId) {
    const c = findCharacter(state, characterId);
    if (!c) throw new Error('Character no longer exists.');
    c.conditionIds = c.conditionIds.filter((id) => id !== conditionId);
  }
  function removeConditionEntry(state, id) {
    if (allCharacters(state).some((c) => c.conditionIds.includes(id)))
      throw new Error(
        'Remove this condition from its characters before deleting it from the library.'
      );
    state.conditionLibrary = state.conditionLibrary.filter((e) => e.id !== id);
  }
  function concentrationChoices(c, query = '') {
    const words = str(query, 300).toLowerCase().trim().split(/\s+/).filter(Boolean);
    return c.items
      .filter(
        (it) =>
          it.requiresConcentration &&
          words.every((word) => (it.name + ' ' + it.description).toLowerCase().includes(word))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  function setConcentration(c, active, itemId = '') {
    if (!c || typeof active !== 'boolean' || typeof itemId !== 'string')
      throw new Error('Invalid concentration setting.');
    const it = active && c.items.find((it) => it.id === itemId && it.requiresConcentration);
    if (active && !it)
      throw new Error('Choose one of this character’s abilities marked Requires concentration.');
    c.concentrating = active;
    c.concentrationItemId = active ? it.id : '';
    c.concentration = active ? it.name : '';
  }
  function toBackup(state) {
    const backup = normalize(state);
    for (const c of allCharacters(backup))
      c.items = c.items.map((it) => ({
        id: it.id,
        libraryId: it.libraryId,
        resourceId: it.resourceId,
        resourceCost: it.resourceCost,
        disabled: it.disabled,
      }));
    for (const c of allCharacters(backup)) {
      delete c.appliedConditions;
      delete c.conditions;
    }
    return backup;
  }
  function character(index = 0) {
    const c = {
      id: uid(),
      name: 'New adventurer',
      className: '',
      species: '',
      level: 1,
      avatar: '',
      accent: colors[index % colors.length],
      hp: 10,
      maxHp: 10,
      tempHp: 0,
      ac: 10,
      speed: 30,
      proficiency: 2,
      initiative: 0,
      spellAbility: 'wis',
      spellDC: null,
      spellAttack: null,
      abilities: Object.fromEntries(abilities.map((a) => [a, 10])),
      skills: Object.fromEntries(Object.keys(skills).map((s) => [s, { rank: 0, override: null }])),
      saves: [],
      saveExpertise: [],
      slots: Array.from({ length: 9 }, (_, i) => ({ level: i + 1, max: 0, current: 0 })),
      resources: [],
      items: [],
      conditions: '',
      conditionIds: [],
      appliedConditions: [],
      concentrating: false,
      concentration: '',
      concentrationItemId: '',
      notes: '',
      hud: {
        x: 18 + (index % 4) * 21,
        y: index < 4 ? 82 : 18,
        rotation: index < 4 ? 0 : 180,
        scale: 1,
        expanded: false,
        visible: true,
        panel: '',
        detailId: '',
        page: 0,
      },
    };
    c.turn = freshTurn(c);
    return c;
  }
  function normalizeCharacter(raw, index) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new Error('Each character must be an object.');
    const c = character(index);
    for (const key of [
      'id',
      'name',
      'className',
      'species',
      'conditions',
      'concentration',
      'concentrationItemId',
      'notes',
    ])
      c[key] = str(raw[key] ?? c[key], key === 'notes' ? 40000 : 300);
    if (
      raw.conditionIds !== undefined &&
      (!Array.isArray(raw.conditionIds) || raw.conditionIds.some((id) => typeof id !== 'string'))
    )
      throw new Error('Character conditions must be a list of condition IDs.');
    c.conditionIds = [...new Set(raw.conditionIds || [])];
    if (c.conditionIds.length > 500) throw new Error('A character can have up to 500 conditions.');
    c.legacyConditionText = raw.conditionIds === undefined ? c.conditions.trim() : '';
    c.concentrating =
      typeof raw.concentrating === 'boolean' ? raw.concentrating : Boolean(c.concentration.trim());
    if (!c.concentrating) {
      c.concentration = '';
      c.concentrationItemId = '';
    }
    if (!c.id) c.id = uid();
    if (!c.name.trim()) c.name = 'Adventurer';
    if (/^#[\da-f]{6}$/i.test(raw.accent || '')) c.accent = raw.accent;
    if (
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw.avatar || '') &&
      raw.avatar.length < 3000000
    )
      c.avatar = raw.avatar;
    c.maxHp = integer(raw.maxHp ?? c.maxHp, 1, 9999);
    c.hp = integer(raw.hp ?? c.hp, 0, c.maxHp);
    c.tempHp = integer(raw.tempHp, 0, 9999);
    for (const [key, min, max] of [
      ['ac', 0, 99],
      ['speed', 0, 999],
      ['proficiency', 0, 20],
      ['level', 1, 30],
      ['initiative', -99, 999],
    ])
      c[key] = integer(raw[key] ?? c[key], min, max);
    for (const key of abilities) c.abilities[key] = integer(raw.abilities?.[key] ?? 10, 1, 30);
    for (const name of Object.keys(skills))
      c.skills[name] = {
        rank: integer(raw.skills?.[name]?.rank, 0, 2),
        override:
          raw.skills?.[name]?.override === null || raw.skills?.[name]?.override === undefined
            ? null
            : integer(raw.skills[name].override, -99, 99),
      };
    c.saves = Array.isArray(raw.saves) ? abilities.filter((a) => raw.saves.includes(a)) : [];
    c.saveExpertise = Array.isArray(raw.saveExpertise)
      ? abilities.filter((a) => raw.saveExpertise.includes(a))
      : [];
    c.saves = abilities.filter((a) => c.saves.includes(a) || c.saveExpertise.includes(a));
    c.spellAbility = abilities.includes(raw.spellAbility) ? raw.spellAbility : 'wis';
    for (const k of ['spellDC', 'spellAttack'])
      c[k] =
        raw[k] === null || raw[k] === undefined || raw[k] === '' ? null : integer(raw[k], -99, 99);
    c.slots = c.slots.map((s, i) => {
      const r = Array.isArray(raw.slots) ? raw.slots[i] : null;
      const max = integer(r?.max, 0, 30);
      return { level: i + 1, max, current: integer(r?.current, 0, max) };
    });
    c.resources = (Array.isArray(raw.resources) ? raw.resources : []).slice(0, 60).map((r) => {
      const max = integer(r.max, 1, 999);
      return {
        id: str(r.id, 100) || uid(),
        name: str(r.name, 120) || 'Resource',
        max,
        current: integer(r.current, 0, max),
        reset: ['short', 'long', 'turn', 'manual'].includes(r.reset) ? r.reset : 'long',
        icon: resourceIcons.includes(r.icon) ? r.icon : 'circle',
        color: /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : c.accent,
      };
    });
    if (new Set(c.resources.map((r) => r.id)).size !== c.resources.length)
      throw new Error('Resource IDs must be unique within a character.');
    c.items = (Array.isArray(raw.items) ? raw.items : []).slice(0, 500).map((r) => {
      const it = item();
      for (const k of [
        'id',
        'name',
        'range',
        'duration',
        'components',
        'attack',
        'damage',
        'save',
        'description',
        'resourceId',
      ])
        it[k] = str(r[k] ?? it[k], k === 'description' ? 40000 : 300);
      if (!it.id) it.id = uid();
      it.libraryId = str(r.libraryId, 300);
      it.kind = ['action', 'spell', 'feature'].includes(r.kind) ? r.kind : 'action';
      it.economy = ['action', 'bonus', 'reaction', 'free'].includes(r.economy)
        ? r.economy
        : 'action';
      it.level = normalizeSpellLevel(r);
      it.usesSlot = r.usesSlot !== false;
      it.requiresConcentration = r.requiresConcentration === true;
      it.resourceCost = integer(r.resourceCost ?? 1, 1, 999);
      it.disabled = r.disabled === true;
      if (it.resourceId && !c.resources.some((x) => x.id === it.resourceId))
        throw new Error('An ability refers to a missing resource.');
      return it;
    });
    if (new Set(c.items.map((i) => i.id)).size !== c.items.length)
      throw new Error('Ability IDs must be unique within a character.');
    c.turn = {
      action: raw.turn?.action !== false,
      bonus: raw.turn?.bonus !== false,
      reaction: raw.turn?.reaction !== false,
      movement: integer(raw.turn?.movement ?? c.speed, 0, 9999),
    };
    for (const k of ['x', 'y']) c.hud[k] = num(raw.hud?.[k] ?? c.hud[k], 0, 100);
    c.hud.rotation = ((num(raw.hud?.rotation, -36000, 36000) % 360) + 360) % 360;
    c.hud.scale = num(raw.hud?.scale ?? 1, 0.4, 2.5);
    c.hud.expanded = raw.hud?.expanded === true;
    c.hud.visible = raw.hud?.visible !== false;
    c.hud.panel = [
      'action',
      'bonus',
      'reaction',
      'free',
      'spell',
      'feature',
      'sheet',
      'resources',
      '',
    ].includes(raw.hud?.panel)
      ? raw.hud.panel
      : '';
    c.hud.detailId = c.items.some((i) => i.id === raw.hud?.detailId) ? raw.hud.detailId : '';
    c.hud.page = integer(raw.hud?.page, 0, 999);
    return c;
  }
  function normalize(raw) {
    if (!raw || ![1, 2, 3, 4].includes(raw.version) || !Array.isArray(raw.characters))
      throw new Error('This is not a supported Tablelight party backup.');
    if (raw.characters.length > PARTY_LIMIT)
      throw new Error('A party can contain up to eight players.');
    if ((raw.version >= 3 || raw.roster !== undefined) && !Array.isArray(raw.roster))
      throw new Error('The saved player roster must be a list.');
    const chars = raw.characters.map(normalizeCharacter);
    const roster = (raw.roster || []).map(normalizeCharacter);
    const players = [...chars, ...roster];
    if (new Set(players.map((c) => c.id)).size !== players.length)
      throw new Error('Character IDs must be unique.');
    // Old versions computed initiative order without displaying it in the sidebar.
    if (raw.settings?.partyOrderVersion !== 1) chars.sort((a, b) => b.initiative - a.initiative);
    if (raw.library !== undefined && !Array.isArray(raw.library))
      throw new Error('The shared library must be a list.');
    if ((raw.library?.length || 0) > 5000)
      throw new Error('The library can contain up to 5,000 entries.');
    const library = (raw.library || []).map(libraryEntry),
      byId = new Map(library.map((e) => [e.id, e]));
    if (byId.size !== library.length) throw new Error('Library IDs must be unique.');
    const byContent = new Map(library.map((e) => [definitionKey(e), e]));
    for (const c of players)
      for (const it of c.items) {
        let entry = byId.get(it.libraryId);
        if (it.libraryId && !entry)
          throw new Error('An ability refers to a missing library entry.');
        // Upgrade old saves by exact content, preserving item IDs, resource links and HUD selections.
        if (!it.libraryId) {
          const definition = libraryEntry(it),
            key = definitionKey(definition);
          entry = byContent.get(key);
          if (!entry) {
            entry = { ...definition, id: uid() };
            library.push(entry);
            byId.set(entry.id, entry);
            byContent.set(key, entry);
          }
          it.libraryId = entry.id;
        }
        for (const key of definitionFields) it[key] = entry[key];
      }
    for (const c of players) {
      if (c.concentrationItemId) {
        const current = c.items.find(
          (it) => it.id === c.concentrationItemId && it.requiresConcentration
        );
        if (current) c.concentration = current.name;
        else setConcentration(c, false);
      }
    }
    if (library.length > 5000) throw new Error('The library can contain up to 5,000 entries.');
    if (
      (raw.version === 4 || raw.conditionLibrary !== undefined) &&
      !Array.isArray(raw.conditionLibrary)
    )
      throw new Error('The condition library must be a list.');
    const conditionLibrary = (raw.conditionLibrary || []).map(conditionEntry);
    const conditionsById = new Map(conditionLibrary.map((e) => [e.id, e]));
    if (conditionsById.size !== conditionLibrary.length)
      throw new Error('Condition library IDs must be unique.');
    for (const c of players) {
      if (c.legacyConditionText) {
        let entry = conditionLibrary.find(
          (e) => e.name === c.legacyConditionText && !e.description
        );
        if (!entry) {
          entry = conditionEntry({ name: c.legacyConditionText });
          conditionLibrary.push(entry);
          conditionsById.set(entry.id, entry);
        }
        c.conditionIds.push(entry.id);
      }
      delete c.legacyConditionText;
      c.appliedConditions = c.conditionIds.map((id) => {
        const entry = conditionsById.get(id);
        if (!entry) throw new Error('A character refers to a missing condition.');
        return clone(entry);
      });
      c.conditions = c.appliedConditions.map((e) => e.name).join(', ');
    }
    if (conditionLibrary.length > 5000)
      throw new Error('The condition library can contain up to 5,000 entries.');
    return {
      version: 4,
      conditionLibrary,
      libraryVersion: 1,
      library,
      demo: raw.demo === true,
      characters: chars,
      roster,
      activeId: chars.some((c) => c.id === raw.activeId) ? raw.activeId : chars[0]?.id || '',
      settings: {
        displayId: raw.settings?.displayId == null ? null : String(raw.settings.displayId),
        opacity: num(raw.settings?.opacity ?? 0.94, 0.4, 1),
        soloExpand: raw.settings?.soloExpand === true,
        overlayInteractive: raw.settings?.overlayInteractive !== false,
        hudControlsVersion: integer(raw.settings?.hudControlsVersion, 0, 1),
        partyOrderVersion: 1,
      },
    };
  }
  function empty() {
    return normalize({ version: 1, characters: [], settings: {} });
  }
  function availability(c, it, slotLevel) {
    if (it.disabled) return 'Marked unavailable by the DM';
    if (it.economy !== 'free' && !c.turn[it.economy])
      return (
        { action: 'Action', bonus: 'Bonus action', reaction: 'Reaction' }[it.economy] +
        ' already spent'
      );
    if (it.resourceId) {
      const r = c.resources.find((r) => r.id === it.resourceId);
      if (!r || r.current < it.resourceCost) return 'Not enough ' + (r?.name || 'resource charges');
    }
    if (it.kind === 'spell' && it.level > 0 && it.usesSlot) {
      if (slotLevel === undefined) {
        if (!c.slots.some((s) => s.level >= it.level && s.current > 0))
          return 'No suitable spell slot remaining';
      } else {
        const s = c.slots.find((s) => s.level === Number(slotLevel));
        if (!s || s.level < it.level || s.current < 1) return 'No suitable spell slot remaining';
      }
    }
    return '';
  }
  function spend(c, it, slotLevel) {
    const reason = availability(c, it, slotLevel);
    if (reason) throw new Error(reason);
    if (it.kind === 'spell' && it.level > 0 && it.usesSlot && slotLevel === undefined)
      throw new Error('Choose a spell slot level.');
    if (it.economy !== 'free') c.turn[it.economy] = false;
    if (it.resourceId) c.resources.find((r) => r.id === it.resourceId).current -= it.resourceCost;
    if (it.kind === 'spell' && it.level > 0 && it.usesSlot)
      c.slots.find((s) => s.level === Number(slotLevel)).current--;
  }
  function damage(c, amount) {
    amount = integer(amount, 0, 99999);
    const absorbed = Math.min(c.tempHp, amount);
    c.tempHp -= absorbed;
    c.hp = Math.max(0, c.hp - (amount - absorbed));
  }
  function heal(c, amount) {
    c.hp = Math.min(c.maxHp, c.hp + integer(amount, 0, 99999));
  }
  function startTurn(c) {
    c.turn = freshTurn(c);
    c.resources.forEach((r) => {
      if (r.reset === 'turn') r.current = r.max;
    });
  }
  function resetResource(c, id) {
    const r = c.resources.find((r) => r.id === id);
    if (!r) throw new Error('Resource not found.');
    if (r.reset !== 'manual')
      throw new Error(
        'This resource resets on ' + resourceResetLabels[r.reset].toLowerCase() + '.'
      );
    r.current = r.max;
  }
  function rest(c, type) {
    c.resources.forEach((r) => {
      if (r.reset === 'short' || (type === 'long' && r.reset === 'long')) r.current = r.max;
    });
    if (type === 'long') {
      c.hp = c.maxHp;
      c.tempHp = 0;
      c.slots.forEach((s) => (s.current = s.max));
      c.turn = freshTurn(c);
      c.concentration = '';
      c.concentrating = false;
      c.concentrationItemId = '';
    }
  }
  function panelItems(c) {
    const p = c.hud.panel;
    return c.items.filter((i) =>
      p === 'spell' || p === 'feature' ? i.kind === p : i.economy === p
    );
  }
  function reorderParty(state, ids) {
    if (
      !Array.isArray(ids) ||
      ids.length !== state.characters.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !state.characters.some((c) => c.id === id))
    )
      throw new Error('The party changed. Reopen initiative order and try again.');
    state.characters = ids.map((id) => state.characters.find((c) => c.id === id));
  }
  function moveParty(state, id, amount) {
    const from = state.characters.findIndex((c) => c.id === id);
    if (from < 0 || !Number.isInteger(amount)) throw new Error('Choose a party member to move.');
    const ids = state.characters.map((c) => c.id),
      to = integer(from + amount, 0, ids.length - 1);
    ids.splice(from, 1);
    ids.splice(to, 0, id);
    reorderParty(state, ids);
  }
  function nextTurn(state) {
    if (!state.characters.length) throw new Error('Add a character first.');
    const index = state.characters.findIndex((c) => c.id === state.activeId);
    const next = state.characters[(index + 1) % state.characters.length];
    state.activeId = next.id;
    startTurn(next);
    return next;
  }
  function fitHud(hud, width, height, viewportWidth, viewportHeight) {
    const rad = (hud.rotation * Math.PI) / 180,
      scale = hud.scale;
    const boxWidth = (Math.abs(width * Math.cos(rad)) + Math.abs(height * Math.sin(rad))) * scale;
    const boxHeight = (Math.abs(width * Math.sin(rad)) + Math.abs(height * Math.cos(rad))) * scale;
    const x = num(
      (hud.x / 100) * viewportWidth,
      Math.min(boxWidth / 2 + 8, viewportWidth / 2),
      Math.max(viewportWidth / 2, viewportWidth - boxWidth / 2 - 8)
    );
    const y = num(
      (hud.y / 100) * viewportHeight,
      Math.min(boxHeight / 2 + 8, viewportHeight / 2),
      Math.max(viewportHeight / 2, viewportHeight - boxHeight / 2 - 8)
    );
    return { x, y };
  }
  // Apply only fields changed in an editor, preserving live HUD changes while the form was open.
  function mergeChanges(before, edited, current) {
    if (JSON.stringify(before) === JSON.stringify(edited))
      return current === undefined ? undefined : clone(current);
    if (
      edited &&
      before &&
      typeof edited === 'object' &&
      !Array.isArray(edited) &&
      !Array.isArray(before)
    ) {
      const result = current && typeof current === 'object' ? clone(current) : {};
      for (const key of Object.keys(edited))
        if (!['__proto__', 'constructor', 'prototype'].includes(key))
          result[key] = mergeChanges(before[key], edited[key], current?.[key]);
      return result;
    }
    if (Array.isArray(edited) && Array.isArray(before) && Array.isArray(current)) {
      const key = edited.every((v) => v && typeof v === 'object' && 'id' in v)
        ? 'id'
        : edited.every((v) => v && typeof v === 'object' && 'level' in v)
          ? 'level'
          : null;
      if (key && before.every((v) => v && key in v) && current.every((v) => v && key in v)) {
        const out = current
          .filter(
            (v) => !before.some((b) => b[key] === v[key]) || edited.some((e) => e[key] === v[key])
          )
          .map(clone);
        for (const row of edited) {
          const old = before.find((v) => v[key] === row[key]),
            index = out.findIndex((v) => v[key] === row[key]);
          if (!old) {
            if (index < 0) out.push(clone(row));
            else out[index] = clone(row);
          } else if (index >= 0) out[index] = mergeChanges(old, row, out[index]);
        }
        return out;
      }
    }
    return edited === undefined ? undefined : clone(edited);
  }
  function hudCommand(state, command) {
    if (!command || typeof command !== 'object') throw new Error('Invalid HUD control.');
    if (command.type === 'interactive') {
      state.settings.overlayInteractive =
        command.value === undefined ? !state.settings.overlayInteractive : command.value === true;
      return;
    }
    const c = state.characters.find((c) => c.id === command.characterId);
    if (!c) throw new Error('This character is no longer in the party.');
    const amount = () => {
      if (!Number.isFinite(command.amount)) throw new Error('Enter a valid amount.');
      return command.amount;
    };
    const show = () => {
      if (state.settings.soloExpand)
        state.characters.forEach((x) => {
          if (x.id !== c.id) x.hud.expanded = false;
        });
      c.hud.expanded = true;
      c.hud.visible = true;
    };
    switch (command.type) {
      case 'placement':
        for (const k of ['x', 'y', 'rotation', 'scale'])
          if (command[k] !== undefined) {
            if (!Number.isFinite(command[k])) throw new Error('Invalid placement.');
            c.hud[k] =
              k === 'rotation'
                ? ((command[k] % 360) + 360) % 360
                : k === 'scale'
                  ? num(command[k], 0.4, 2.5)
                  : num(command[k], 0, 100);
          }
        break;
      case 'rotate':
        c.hud.rotation = (((c.hud.rotation + amount()) % 360) + 360) % 360;
        break;
      case 'scale':
        c.hud.scale = num(c.hud.scale + amount(), 0.4, 2.5);
        break;
      case 'expand':
        if (c.hud.expanded) c.hud.expanded = false;
        else show();
        break;
      case 'hide':
        c.hud.visible = false;
        break;
      case 'panel':
        if (
          ![
            '',
            'action',
            'bonus',
            'reaction',
            'free',
            'spell',
            'feature',
            'sheet',
            'resources',
          ].includes(command.panel)
        )
          throw new Error('Unknown panel.');
        show();
        c.hud.panel = command.panel;
        c.hud.detailId = '';
        c.hud.page = 0;
        break;
      case 'detail':
        if (!c.items.some((i) => i.id === command.itemId)) throw new Error('Ability not found.');
        show();
        c.hud.detailId = command.itemId;
        c.hud.page = 0;
        break;
      case 'page':
        c.hud.page = integer(c.hud.page + amount(), 0, 999);
        break;
      case 'turn':
        startTurn(c);
        state.activeId = c.id;
        break;
      case 'economy':
        if (!['action', 'bonus', 'reaction'].includes(command.key))
          throw new Error('Unknown turn cost.');
        c.turn[command.key] = !c.turn[command.key];
        break;
      case 'move':
        c.turn.movement = integer(c.turn.movement + amount(), 0, 9999);
        break;
      case 'hp':
        if (amount() < 0) damage(c, -amount());
        else heal(c, amount());
        break;
      case 'temp-hp':
        c.tempHp = integer(c.tempHp + amount(), 0, 9999);
        break;
      case 'proficiency':
        setRank(c, command.kind, command.name, command.rank);
        break;
      case 'slot': {
        const s = c.slots.find((s) => s.level === command.level);
        if (!s) throw new Error('Slot not found.');
        s.current = integer(s.current + amount(), 0, s.max);
        break;
      }
      case 'concentration':
        setConcentration(c, command.active, command.itemId ?? '');
        break;
      case 'condition-remove':
        unassignCondition(state, c.id, command.conditionId);
        break;
      case 'condition-add':
        assignCondition(state, c.id, command.conditionId);
        break;
      case 'resource-reset':
        resetResource(c, command.resourceId);
        break;
      case 'resource': {
        const r = c.resources.find((r) => r.id === command.resourceId);
        if (!r) throw new Error('Resource not found.');
        r.current = integer(r.current + amount(), 0, r.max);
        break;
      }
      case 'use': {
        const it = c.items.find((i) => i.id === command.itemId);
        if (!it) throw new Error('Ability not found.');
        spend(c, it, command.level);
        break;
      }
      default:
        throw new Error('Unknown HUD control.');
    }
  }
  return {
    conditionEntry,
    searchConditions,
    assignCondition,
    unassignCondition,
    removeConditionEntry,
    setConcentration,
    concentrationChoices,
    resourceIcons,
    resourceResetLabels,
    startTurn,
    resetResource,
    PARTY_LIMIT,
    allCharacters,
    findCharacter,
    addToParty,
    removeFromParty,
    deletePlayer,
    overlayState,
    abilities,
    skills,
    colors,
    uid,
    clone,
    num,
    integer,
    str,
    mod,
    signed,
    skillBonus,
    saveRank,
    saveBonus,
    setRank,
    levelLabel,
    reorderParty,
    moveParty,
    nextTurn,
    freshTurn,
    item,
    character,
    normalize,
    empty,
    availability,
    spend,
    damage,
    heal,
    rest,
    panelItems,
    fitHud,
    mergeChanges,
    hudCommand,
    definitionFields,
    libraryEntry,
    attachItem,
    removeLibraryEntry,
    toBackup,
  };
});
