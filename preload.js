/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('tablelight', {
  license: () => ipcRenderer.invoke('app:license'),
  updateStatus: () => ipcRenderer.invoke('updates:status'),
  setUpdateChecks: (enabled) => ipcRenderer.invoke('updates:enabled', enabled),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  dismissUpdate: () => ipcRenderer.invoke('updates:dismiss'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  cancelUpdate: () => ipcRenderer.invoke('updates:cancel'),
  releasePage: () => ipcRenderer.invoke('updates:release-page'),
  onUpdates: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('updates:state', listener);
    return () => ipcRenderer.removeListener('updates:state', listener);
  },
  load: () => ipcRenderer.invoke('party:load'),
  save: (state) => ipcRenderer.invoke('party:save', state),
  changeParty: (value) => ipcRenderer.invoke('party:change', value),
  undo: () => ipcRenderer.invoke('party:undo'),
  flush: () => ipcRenderer.invoke('party:flush'),
  approvalCommand: (value) => ipcRenderer.invoke('approval:command', value),
  onApprovals: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('approval:state', listener);
    return () => ipcRenderer.removeListener('approval:state', listener);
  },
  displays: () => ipcRenderer.invoke('display:list'),
  overlay: (options) => ipcRenderer.invoke('display:overlay', options),
  hudCommand: (command) => ipcRenderer.invoke('hud:command', command),
  searchConditions: (query) => ipcRenderer.invoke('hud:conditions', query),
  scrollHud: (command) => ipcRenderer.invoke('hud:scroll', command),
  onHudScroll: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('hud:scroll', listener);
    return () => ipcRenderer.removeListener('hud:scroll', listener);
  },
  hudRegions: (frames) => ipcRenderer.send('hud:regions', frames),
  hudDragging: (active) => ipcRenderer.send('hud:dragging', Boolean(active)),
  onHudCommand: (callback) => {
    const listener = (_event, request) => {
      Promise.resolve()
        .then(() => callback(request.command))
        .then(
          () => ipcRenderer.send('hud:result', { id: request.id }),
          (error) => ipcRenderer.send('hud:result', { id: request.id, error: error.message })
        );
    };
    ipcRenderer.on('hud:request', listener);
    return () => ipcRenderer.removeListener('hud:request', listener);
  },
  avatar: () => ipcRenderer.invoke('file:avatar'),
  abilityIcon: () => ipcRenderer.invoke('file:ability-icon'),
  exportParty: () => ipcRenderer.invoke('file:export'),
  importParty: () => ipcRenderer.invoke('file:import'),
  onState: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('party:state', listener);
    return () => ipcRenderer.removeListener('party:state', listener);
  },
  onDisplays: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('display:changed', listener);
    return () => ipcRenderer.removeListener('display:changed', listener);
  },
  onOverlay: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('display:status', listener);
    return () => ipcRenderer.removeListener('display:status', listener);
  },
});
