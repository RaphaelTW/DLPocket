const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('dlpocket', {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  getDependencyStatus: () => ipcRenderer.invoke('deps:status'),
  getComponentVersions: () => ipcRenderer.invoke('deps:versions'),
  prepareDependencies: (force = false) => ipcRenderer.invoke('deps:prepare', Boolean(force)),
  updateYtDlp: (force = false) => ipcRenderer.invoke('deps:update-yt-dlp', Boolean(force)),
  inspectMedia: (url) => ipcRenderer.invoke('media:inspect', url),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  getHistory: () => ipcRenderer.invoke('history:get'),
  setHistory: (history) => ipcRenderer.invoke('history:set', history),
  getHistoryStats: () => ipcRenderer.invoke('history:stats'),
  openHistoryFile: (filePath) => ipcRenderer.invoke('history:open-file', filePath),
  deleteHistoryFile: (filePath) => ipcRenderer.invoke('history:delete-file', filePath),
  getDiagnostics: () => ipcRenderer.invoke('diagnostics:get'),
  exportDiagnostics: () => ipcRenderer.invoke('diagnostics:export'),
  repairComponents: () => ipcRenderer.invoke('diagnostics:repair'),
  startDownload: (options) => ipcRenderer.invoke('download:start', options),
  cancelDownload: (id) => ipcRenderer.invoke('download:cancel', id),
  pauseDownload: (id) => ipcRenderer.invoke('download:pause', id),
  openDownloadsFolder: (kind = 'base') => ipcRenderer.invoke('folder:open', kind),
  openYtDlpRepository: () => ipcRenderer.invoke('external:yt-dlp'),
  checkForUpdates: (options = {}) => ipcRenderer.invoke('update:check', options),
  downloadUpdate: (release) => ipcRenderer.invoke('update:download', release),
  openUpdate: (filePath) => ipcRenderer.invoke('update:open', filePath),
  installUpdateOnQuit: (filePath) => ipcRenderer.invoke('update:install-on-quit', filePath),
  restartAndUpdate: (filePath) => ipcRenderer.invoke('update:restart', filePath),
  onDownloadEvent: (callback) => subscribe('download:event', callback),
  onDependencyEvent: (callback) => subscribe('deps:event', callback),
  onUpdateEvent: (callback) => subscribe('update:event', callback)
});
