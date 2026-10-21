const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('questNotice', Object.freeze({
  ready: () => ipcRenderer.send('notice:ready'),
  action: (key, action) => ipcRenderer.send('notice:action', {key, action}),
  hold: (key, value) => ipcRenderer.send('notice:hold', {key, value}),
  onShow: callback => ipcRenderer.on('notice:show', (_event, value) => callback(value)),
  onHidden: callback => ipcRenderer.on('notice:hidden', () => callback()),
  onResult: callback => ipcRenderer.on('notice:result', (_event, value) => callback(value)),
}));
