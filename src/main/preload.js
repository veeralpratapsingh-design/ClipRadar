'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('clipradar', {
  getState: () => call('state:get'),
  resolveChannel: (input) => call('channels:resolve', input),
  addChannels: (list) => call('channels:add', list),
  updateChannel: (id, patch) => call('channels:update', id, patch),
  removeChannel: (id) => call('channels:remove', id),
  setVideoStatus: (id, status) => call('videos:status', id, status),
  saveSettings: (patch) => call('settings:save', patch),
  testTelegram: (token, chatId) => call('telegram:test', token, chatId),
  checkNow: () => call('check:now'),
  openExternal: (url) => call('open:external', url),
  showDataFolder: () => call('app:show-data'),
  onStateChanged: (cb) => {
    const fn = () => cb();
    ipcRenderer.on('state:changed', fn);
    return () => ipcRenderer.removeListener('state:changed', fn);
  }
});
