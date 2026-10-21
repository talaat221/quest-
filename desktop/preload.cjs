const { contextBridge, ipcRenderer } = require('electron');
const subscribe = (channel, callback) => {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld('questDesktop', Object.freeze({
  version: 1,
  configure: value => ipcRenderer.invoke('quest:configure', value),
  notify: value => ipcRenderer.invoke('quest:notify', value),
  cancel: value => ipcRenderer.invoke('quest:cancel', value),
  actionResult: value => ipcRenderer.invoke('quest:action-result', value),
  getSettings: () => ipcRenderer.invoke('quest:settings'),
  updateSettings: value => ipcRenderer.invoke('quest:update-settings', value),
  onAction: callback => subscribe('quest:action', callback),
  onWake: callback => subscribe('quest:wake', callback),
  onRemoved: callback => subscribe('quest:removed', callback),
}));
