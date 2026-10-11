const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('yukinoSpeed', {
  version: '1.0.0',
  start: config => ipcRenderer.invoke('speed:start', config),
  pause: () => ipcRenderer.invoke('speed:pause'), resume: () => ipcRenderer.invoke('speed:resume'), stop: () => ipcRenderer.invoke('speed:stop'),
  limits: limits => ipcRenderer.invoke('speed:limits', limits), state: () => ipcRenderer.invoke('speed:state'),
  records: () => ipcRenderer.invoke('speed:records'), probe: url => ipcRenderer.invoke('speed:probe', url),
  onState: listener => { const wrapped = (_event, state) => listener(state); ipcRenderer.on('speed:state', wrapped); return () => ipcRenderer.removeListener('speed:state', wrapped); },
});
