/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
// Shared with main: the sandboxed preload cannot require local utility modules.
// Box each distinct PNG once for Electron's structured clone reference table, then
// restore ordinary immutable strings before exposing state to either screen.
function packImages(value, images = new Map()) {
  if (typeof value === 'string' && value.startsWith('data:image/png;base64,')) {
    if (!images.has(value)) images.set(value, new String(value));
    return images.get(value);
  }
  if (Array.isArray(value)) return value.map((v) => packImages(v, images));
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, packImages(v, images)]));
  return value;
}
function unpackImages(value) {
  if (value instanceof String) return value.valueOf();
  if (Array.isArray(value)) return value.map(unpackImages);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, unpackImages(v)]));
  return value;
}
if (process.type !== 'renderer') module.exports = { packImages, unpackImages };
else {
  const { contextBridge, ipcRenderer } = require('electron');
  const invokeState = (channel, ...args) =>
    ipcRenderer.invoke(channel, ...args.map((v) => packImages(v))).then(unpackImages);
  contextBridge.exposeInMainWorld('tablelight', {
    openGuide: (...args) => {
      if (args.length)
        return Promise.reject(new Error('The user guide control does not accept arguments.'));
      return ipcRenderer.invoke('guide:open');
    },
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
    load: () => invokeState('party:load'),
    save: (state) => invokeState('party:save', state),
    changeParty: (value) => invokeState('party:change', value),
    undo: () => invokeState('party:undo'),
    flush: () => ipcRenderer.invoke('party:flush'),
    messages: () => ipcRenderer.invoke('messages:snapshot'),
    messageCommand: (request) => ipcRenderer.invoke('messages:command', request),
    messageBody: (request) => ipcRenderer.invoke('messages:body', request),
    onMessages: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('messages:state', listener);
      return () => ipcRenderer.removeListener('messages:state', listener);
    },
    approvalCommand: (value) => invokeState('approval:command', value),
    onApprovals: (callback) => {
      const listener = (_event, value) => callback(unpackImages(value));
      ipcRenderer.on('approval:state', listener);
      return () => ipcRenderer.removeListener('approval:state', listener);
    },
    displays: () => ipcRenderer.invoke('display:list'),
    overlay: (options) => ipcRenderer.invoke('display:overlay', options),
    hudCommand: (command) => invokeState('hud:command', command),
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
    importParty: () => invokeState('file:import'),
    onState: (callback) => {
      const listener = (_event, value) => callback(unpackImages(value));
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
}
