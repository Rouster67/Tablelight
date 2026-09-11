/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('tablelight', {
  license: () => ipcRenderer.invoke('app:license'),
  load: () => ipcRenderer.invoke('party:load'),
  save: (state) => ipcRenderer.invoke('party:save', state),
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
