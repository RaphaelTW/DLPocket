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
  getComponentVersions: () => ipcRenderer.invoke('deps:versions'),
  prepareDependencies: (force = false) => ipcRenderer.invoke('deps:prepare', Boolean(force)),
  updateYtDlp: (force = false) => ipcRenderer.invoke('deps:update-yt-dlp', Boolean(force)),
  inspectMedia: (url) => ipcRenderer.invoke('media:inspect', url),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  getHistory: () => ipcRenderer.invoke('history:get'),
  setHistory: (history) => ipcRenderer.invoke('history:set', history),
  startDownload: (options) => ipcRenderer.invoke('download:start', options),
  cancelDownload: (id) => ipcRenderer.invoke('download:cancel', id),
  openDownloadsFolder: (kind = 'base') => ipcRenderer.invoke('folder:open', kind),
  openYtDlpRepository: () => ipcRenderer.invoke('external:yt-dlp'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: (release) => ipcRenderer.invoke('update:download', release),
  openUpdate: (filePath) => ipcRenderer.invoke('update:open', filePath),
  installUpdateOnQuit: (filePath) => ipcRenderer.invoke('update:install-on-quit', filePath),
  onDownloadEvent: (callback) => subscribe('download:event', callback),
  onDependencyEvent: (callback) => subscribe('deps:event', callback),
  onUpdateEvent: (callback) => subscribe('update:event', callback)
});
