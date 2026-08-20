const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('dlpocket', {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  getDependencyStatus: () => ipcRenderer.invoke('deps:status'),
  prepareDependencies: (force = false) => ipcRenderer.invoke('deps:prepare', Boolean(force)),
  startDownload: (options) => ipcRenderer.invoke('download:start', options),
  cancelDownload: (id) => ipcRenderer.invoke('download:cancel', id),
  openDownloadsFolder: (kind = 'base') => ipcRenderer.invoke('folder:open', kind),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: (release) => ipcRenderer.invoke('update:download', release),
  openUpdate: (filePath) => ipcRenderer.invoke('update:open', filePath),
  onDownloadEvent: (callback) => subscribe('download:event', callback),
  onDependencyEvent: (callback) => subscribe('deps:event', callback),
  onUpdateEvent: (callback) => subscribe('update:event', callback)
});
