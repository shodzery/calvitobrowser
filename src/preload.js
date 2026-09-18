const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('calvito', {
  getUpdateState: () => ipcRenderer.invoke('updates:get'),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdateState: callback => ipcRenderer.on('updates:state', (_event, state) => callback(state)),
  onPermissionsCancelled: callback => ipcRenderer.on('permissions:cancelled', () => callback()),
  onPermissionExpired: callback => ipcRenderer.on('permissions:expired', (_event, id) => callback(id)),
  exportBookmarks: items => ipcRenderer.invoke('bookmarks:export', items),
  importBookmarks: () => ipcRenderer.invoke('bookmarks:import'),
  savePDF: id => ipcRenderer.invoke('page:pdf', id),
  onDownloadProgress: callback => ipcRenderer.on('download-progress', (_event, item) => callback(item)),
  loadData: () => ipcRenderer.invoke('storage:load'),
  saveData: (data) => ipcRenderer.invoke('storage:save', data),
  setPreferences: (preferences) => ipcRenderer.invoke('preferences:set', preferences),
  openDownloadFolder: (filePath) => ipcRenderer.invoke('downloads:open', filePath),
  openExternal: (url) => ipcRenderer.invoke('external:open', url),
  showAbout: () => ipcRenderer.invoke('app:about'),
  onBrowserCommand: (callback) => ipcRenderer.on('browser-command', (_event, command) => callback(command)),
  onOpenUrlInTab: (callback) => ipcRenderer.on('open-url-in-tab', (_event, url) => callback(url)),
  onDownloadStarted: (callback) => ipcRenderer.on('download-started', (_event, item) => callback(item)),
  onDownloadFinished: (callback) => ipcRenderer.on('download-finished', (_event, item) => callback(item)),

  // Profiles
  profilesContext: () => ipcRenderer.invoke('profiles:context'),
  createProfile: (profile) => ipcRenderer.invoke('profiles:create', profile),
  deleteProfile: (profileId) => ipcRenderer.invoke('profiles:delete', profileId),
  switchProfile: (profileId) => ipcRenderer.invoke('profiles:switch', profileId),
  startGuestProfile: () => ipcRenderer.invoke('profiles:start-guest'),

  // Site permissions
  onPermissionRequest: (callback) => ipcRenderer.on('permission-request', (_event, request) => callback(request)),
  respondToPermission: (response) => ipcRenderer.invoke('permissions:respond', response),
  listPermissions: () => ipcRenderer.invoke('permissions:list'),
  setPermission: (entry) => ipcRenderer.invoke('permissions:set', entry),
  clearPermission: (origin) => ipcRenderer.invoke('permissions:clear', origin),
  clearAllPermissions: () => ipcRenderer.invoke('permissions:clear-all'),
  onPopupBlocked: (callback) => ipcRenderer.on('popup-blocked', (_event, info) => callback(info)),

  // Ad / tracker blocking
  onAdStatsUpdated: (callback) => ipcRenderer.on('ad-stats-updated', (_event, info) => callback(info)),
  getAdStats: () => ipcRenderer.invoke('adblock:stats'),
  addToAdWhitelist: (origin) => ipcRenderer.invoke('adblock:whitelist-add', origin),
  removeFromAdWhitelist: (origin) => ipcRenderer.invoke('adblock:whitelist-remove', origin),
  listAdWhitelist: () => ipcRenderer.invoke('adblock:whitelist-list'),

  // Cookies / site data
  listSiteData: () => ipcRenderer.invoke('sitedata:list'),
  clearSiteData: (domain) => ipcRenderer.invoke('sitedata:clear', domain),
  clearAllSiteData: () => ipcRenderer.invoke('sitedata:clear-all')
});
