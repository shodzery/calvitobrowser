const { app, BrowserWindow, Menu, ipcMain, session, shell, dialog, webContents } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { autoUpdater } = require('electron-updater');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { DEFAULT_PREFERENCES, webUrl, cleanData, cleanPreferences, cleanBookmarks } = require('./core');
const { setupUpdates } = require('./updates');
if (process.env.CALVITO_TEST_PROFILE) {
  app.setPath('userData', process.env.CALVITO_TEST_PROFILE);
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
}
const shellURL = pathToFileURL(path.join(__dirname, 'renderer', 'index.html')).href;
let mainWindow;
let updates;
let guestPartition = `calvito-guest-${randomUUID()}`;
let writeQueue = Promise.resolve();
const ephemeralPermissions = new WeakMap();
const downloadPaths = new Set();

// Only the top-level, local browser UI may call privileged operations.
function handle(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== shellURL) {
      throw new Error('Origen IPC no autorizado');
    }
    return listener(event, ...args);
  });
}

async function atomicWrite(file, value) {
  const text = JSON.stringify(value, null, 2);
  const operation = writeQueue.catch(() => {}).then(async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.tmp`;
    await fs.writeFile(temporary, text, 'utf8');
    await fs.rename(temporary, file);
  });
  writeQueue = operation;
  return operation;
}

function broadcast(channel, payload) {
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  });
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
// Real, separate browsing identities: each profile gets its own persistent
// Electron session partition (its own cookies/localStorage/cache) and its own
// bookmarks/history/downloads/groups/preferences/permissions file on disk.
// "Guest" is a special pseudo-profile: an ephemeral, non-persistent partition
// and an in-memory-only data store that is thrown away on switch/quit — it
// never touches the filesystem, by design.
const DEFAULT_PROFILE_COLORS = ['teal', 'blue', 'purple', 'pink', 'orange', 'yellow'];
const GUEST_ID = 'guest';
let profilesConfig = { profiles: [{ id: 'default', name: 'Personal', emoji: '🙂', color: 'teal' }], activeProfileId: 'default' };
let guestMode = false;
let guestData = null; // set fresh each time guest mode starts; never persisted

let preferences = { ...DEFAULT_PREFERENCES };
let sitePermissions = {}; // { [origin]: { media: 'ask'|'allow'|'block', geolocation, notifications, clipboard, popups } }
let adWhitelist = []; // origins where the ad/tracker blocker is disabled

const DEFAULT_DATA = () => ({
  bookmarks: [], history: [], downloads: [], groups: [],
  session: { tabs: [], activeIndex: 0 },
  notes: '', preferences: { ...DEFAULT_PREFERENCES },
  permissions: {},
  adWhitelist: []
});

function profilesConfigPath() {
  return path.join(app.getPath('userData'), 'calvito-profiles.json');
}

function profileDataPath(profileId) {
  return path.join(app.getPath('userData'), `calvito-data-${profileId}.json`);
}

function legacyDataPath() {
  return path.join(app.getPath('userData'), 'calvito-data.json');
}

async function loadProfilesConfig() {
  try {
    const parsed = JSON.parse(await fs.readFile(profilesConfigPath(), 'utf8'));
    if (Array.isArray(parsed.profiles) && parsed.profiles.length) {
      profilesConfig = { profiles: parsed.profiles, activeProfileId: parsed.activeProfileId || parsed.profiles[0].id };
    }
  } catch {
    // First run, or file missing/corrupt: keep the single default profile.
  }
  // One-time migration: a Tier 1 install may have a single calvito-data.json
  // with no profile concept at all. Adopt it as the "default" profile's data
  // instead of silently discarding the user's history/bookmarks.
  try {
    await fs.access(legacyDataPath());
    await fs.access(profileDataPath('default')).catch(async () => {
      await fs.copyFile(legacyDataPath(), profileDataPath('default'));
    });
  } catch {
    // No legacy file — nothing to migrate.
  }
  await saveProfilesConfig();
}

async function saveProfilesConfig() {
  await atomicWrite(profilesConfigPath(), profilesConfig);
}

function activeProfileId() {
  return profilesConfig.activeProfileId;
}

function partitionForProfile(profileId) {
  return profileId === GUEST_ID ? guestPartition : `persist:calvito-${profileId}`;
}

async function loadData() {
  await writeQueue.catch(() => {});
  if (guestMode) return guestData;
  try {
    const parsed = JSON.parse(await fs.readFile(profileDataPath(activeProfileId()), 'utf8'));
    return cleanData({
      notes: parsed.notes,
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      downloads: Array.isArray(parsed.downloads) ? parsed.downloads : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      session: parsed.session && Array.isArray(parsed.session.tabs) ? parsed.session : { tabs: [], activeIndex: 0 },
      preferences: cleanPreferences(parsed.preferences),
      permissions: parsed.permissions && typeof parsed.permissions === 'object' ? parsed.permissions : {},
      adWhitelist: Array.isArray(parsed.adWhitelist) ? parsed.adWhitelist : []
    });
  } catch {
    return DEFAULT_DATA();
  }
}

async function saveData(data) {
  // Permission decisions belong to main, not to a stale renderer snapshot.
  const cleaned = cleanData({ ...data, permissions: sitePermissions, adWhitelist, preferences });
  if (guestMode) { guestData = cleaned; return; }
  const file = profileDataPath(activeProfileId());
  await atomicWrite(file, cleaned);
}

async function applyLoadedData() {
  const saved = await loadData();
  preferences = saved.preferences;
  sitePermissions = saved.permissions || {};
  adWhitelist = saved.adWhitelist || [];
  return saved;
}

// ---------------------------------------------------------------------------
// Ad / tracker blocking + live stats
// ---------------------------------------------------------------------------
// Host-list blocking only — this is not a categorized filter list like
// EasyList, so "ads" vs "trackers" vs "scripts" below is a heuristic based on
// Chromium's resourceType, not a verified classification. Good enough for a
// rough per-site counter; don't treat the split as authoritative.
const BLOCKED_HOSTS = [
  'doubleclick.net', 'googlesyndication.com', 'google-analytics.com',
  'googletagmanager.com', 'adservice.google.com', 'adnxs.com',
  'amazon-adsystem.com', 'scorecardresearch.com', 'taboola.com',
  'outbrain.com', 'facebook.net', 'connect.facebook.net', 'hotjar.com',
  'criteo.com', 'rubiconproject.com', 'pubmatic.com', 'openx.net'
];

const adStats = { global: { ads: 0, trackers: 0, scripts: 0 }, perSite: new Map() };

function classifyResourceType(resourceType) {
  if (resourceType === 'script') return 'scripts';
  if (resourceType === 'image' || resourceType === 'sub_frame' || resourceType === 'stylesheet') return 'ads';
  return 'trackers';
}

function bumpAdStats(origin, kind) {
  adStats.global[kind] += 1;
  if (!origin) return;
  const bucket = adStats.perSite.get(origin) || { ads: 0, trackers: 0, scripts: 0 };
  bucket[kind] += 1;
  adStats.perSite.set(origin, bucket);
  broadcast('ad-stats-updated', { origin, site: bucket, global: adStats.global });
}

function safeOrigin(url) {
  try { return new URL(url).origin; } catch { return ''; }
}

function isBlocked(url, frameOrigin) {
  if (!preferences.protectionEnabled) return false;
  if (frameOrigin && adWhitelist.includes(frameOrigin)) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Site permissions (camera+mic, location, notifications, clipboard, popups)
// ---------------------------------------------------------------------------
// Electron only exposes a combined 'media' permission for getUserMedia — it
// cannot tell camera and microphone apart at this layer, so both are modeled
// as one "Cámara y micrófono" permission. Permission kinds Electron doesn't
// surface distinctly (e.g. per-site JavaScript, images, sound) are not
// implemented here; see the Tier 2 changelog for the full list of gaps.
const PERMISSION_MAP = { media: 'media', geolocation: 'geolocation', notifications: 'notifications', 'clipboard-read': 'clipboard' };
const pendingPermissionRequests = new Map();

function getPermissionPolicy(origin, kind) {
  const entry = sitePermissions[origin]?.[kind];
  if (entry) return entry;
  return 'ask';
}

function setPermissionPolicy(origin, kind, value) {
  if (!webUrl(origin) || !['media', 'geolocation', 'notifications', 'clipboard', 'popups'].includes(kind) || !['ask', 'allow', 'block'].includes(value)) throw new Error('Permiso inválido');
  sitePermissions[origin] = { ...(sitePermissions[origin] || {}), [kind]: value };
}

function policyForSession(sess, origin, kind) {
  if (sess.isPersistent()) return getPermissionPolicy(origin, kind);
  return ephemeralPermissions.get(sess)?.[origin]?.[kind] || 'ask';
}

function cancelPermissionRequests() {
  for (const pending of pendingPermissionRequests.values()) pending.callback(false);
  pendingPermissionRequests.clear();
  broadcast('permissions:cancelled');
}

const protectedSessions = new WeakSet();

function protectBrowserSession(browserSession) {
  if (protectedSessions.has(browserSession)) return;
  protectedSessions.add(browserSession);

  browserSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) => {
    const kind = PERMISSION_MAP[permission];
    return Boolean(kind && policyForSession(browserSession, safeOrigin(requestingOrigin), kind) === 'allow');
  });

  browserSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const kind = PERMISSION_MAP[permission];
    if (!kind) return callback(false);
    const origin = safeOrigin(details?.requestingUrl || webContents?.getURL());
    if (!webUrl(origin)) return callback(false);
    const policy = policyForSession(browserSession, origin, kind);
    if (policy === 'allow') return callback(true);
    if (policy === 'block') return callback(false);
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    pendingPermissionRequests.set(requestId, { callback, origin, kind, browserSession });
    broadcast('permission-request', { requestId, origin, kind });
    setTimeout(() => {
      const pending = pendingPermissionRequests.get(requestId);
      if (pending) { pending.callback(false); pendingPermissionRequests.delete(requestId); broadcast('permissions:expired', requestId); }
    }, 20000);
  });

  browserSession.webRequest.onBeforeRequest((details, callback) => {
    let frameOrigin = '';
    try { frameOrigin = details.webContentsId ? safeOrigin(webContents.fromId(details.webContentsId)?.getURL() || '') : ''; } catch { frameOrigin = ''; }
    const blocked = isBlocked(details.url, frameOrigin);
    if (blocked) bumpAdStats(frameOrigin, classifyResourceType(details.resourceType));
    callback({ cancel: blocked });
  });

  browserSession.on('will-download', (_event, item) => {
    const safeName = item.getFilename().replace(/[<>:"/\\|?*]/g, '_');
    // Chromium's save dialog prevents silently overwriting an existing file.
    item.setSaveDialogOptions({ title: 'Guardar descarga', defaultPath: path.join(app.getPath('downloads'), safeName) });
    const downloadId = randomUUID();
    const profileId = guestMode ? GUEST_ID : activeProfileId();
    const privateDownload = !browserSession.isPersistent();
    const metadata = { id: downloadId, name: safeName, private: privateDownload, profileId };
    broadcast('download-started', metadata);
    let lastProgress = 0;
    item.on('updated', () => {
      if (Date.now() - lastProgress < 500) return;
      lastProgress = Date.now();
      broadcast('download-progress', { ...metadata, received: item.getReceivedBytes(), total: item.getTotalBytes() });
    });
    item.once('done', (_doneEvent, state) => {
      if (state === 'completed') downloadPaths.add(item.getSavePath());
      broadcast('download-finished', {
        ...metadata,
        state,
        path: item.getSavePath()
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Cookies / site data manager
// ---------------------------------------------------------------------------
// Electron has no API to enumerate every origin that has localStorage or
// IndexedDB data without having visited it, so the list view below is built
// from cookies (which Electron *can* enumerate). Deleting a domain still
// clears its cookies, cache, and storage via clearStorageData({ origin }),
// so removal is thorough even though the inventory is cookie-based.
function currentSession() {
  return guestMode ? session.fromPartition(partitionForProfile(GUEST_ID)) : session.fromPartition(partitionForProfile(activeProfileId()));
}

async function listSiteData() {
  const cookies = await currentSession().cookies.get({});
  const byDomain = new Map();
  cookies.forEach((cookie) => {
    const domain = cookie.domain.replace(/^\./, '');
    byDomain.set(domain, (byDomain.get(domain) || 0) + 1);
  });
  return [...byDomain.entries()].map(([domain, count]) => ({ domain, cookieCount: count })).sort((a, b) => a.domain.localeCompare(b.domain));
}

async function clearSiteData(domain) {
  const sess = currentSession();
  await Promise.allSettled([
    sess.clearStorageData({ origin: `https://${domain}` }),
    sess.clearStorageData({ origin: `http://${domain}` })
  ]);
  const cookies = await sess.cookies.get({ domain });
  await Promise.allSettled(cookies.map((cookie) => sess.cookies.remove(`${cookie.secure ? 'https' : 'http'}://${cookie.domain.replace(/^\./, '')}${cookie.path}`, cookie.name)));
}

async function clearAllSiteData() {
  await currentSession().clearStorageData();
}

// ---------------------------------------------------------------------------
// Window / menu
// ---------------------------------------------------------------------------
function sendBrowserCommand(command) {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.webContents.send('browser-command', command);
}

function buildMenu() {
  const template = [
    {
      label: 'Calvito',
      submenu: [
        { label: 'Acerca de Calvito', click: () => sendBrowserCommand('about') },
        { type: 'separator' },
        { role: 'quit', label: 'Salir de Calvito' }
      ]
    },
    {
      label: 'Archivo',
      submenu: [
        { label: 'Nueva ventana', accelerator: 'Ctrl+N', click: () => createWindow() },
        { label: 'Nueva pestaña', accelerator: 'Ctrl+T', click: () => sendBrowserCommand('new-tab') },
        { label: 'Nueva pestaña privada', accelerator: 'Ctrl+Shift+P', click: () => sendBrowserCommand('new-private-tab') },
        { type: 'separator' },
        { label: 'Cerrar pestaña', accelerator: 'Ctrl+W', click: () => sendBrowserCommand('close-tab') },
        { label: 'Reabrir pestaña cerrada', accelerator: 'Ctrl+Shift+T', click: () => sendBrowserCommand('reopen-tab') }
      ]
    },
    {
      label: 'Navegar',
      submenu: [
        { label: 'Atrás', accelerator: 'Alt+Left', click: () => sendBrowserCommand('back') },
        { label: 'Adelante', accelerator: 'Alt+Right', click: () => sendBrowserCommand('forward') },
        { label: 'Recargar', accelerator: 'Ctrl+R', click: () => sendBrowserCommand('reload') },
        { label: 'Buscar en la página', accelerator: 'Ctrl+F', click: () => sendBrowserCommand('find') },
        { label: 'Ir al inicio', accelerator: 'Alt+Home', click: () => sendBrowserCommand('home') }
      ]
    },
    {
      label: 'Marcadores',
      submenu: [
        { label: 'Añadir marcador', accelerator: 'Ctrl+D', click: () => sendBrowserCommand('bookmark') },
        { label: 'Ver marcadores', click: () => sendBrowserCommand('bookmarks') }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { label: 'Historial', accelerator: 'Ctrl+H', click: () => sendBrowserCommand('history') },
        { label: 'Descargas', accelerator: 'Ctrl+J', click: () => sendBrowserCommand('downloads') },
        { label: 'Acercar', accelerator: 'Ctrl+Plus', click: () => sendBrowserCommand('zoom-in') },
        { label: 'Alejar', accelerator: 'Ctrl+-', click: () => sendBrowserCommand('zoom-out') },
        { label: 'Restablecer zoom', accelerator: 'Ctrl+0', click: () => sendBrowserCommand('zoom-reset') },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
        { role: 'togglefullscreen', label: 'Pantalla completa' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); return; }
  await loadProfilesConfig();
  await applyLoadedData();
  protectBrowserSession(session.fromPartition(partitionForProfile(activeProfileId())));

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 940,
    minHeight: 620,
    show: false,
    backgroundColor: '#0a0f18',
    title: 'Calvito',
    icon: path.join(__dirname, 'renderer', 'assets', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#ffffff',
      height: 47
    },
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: true,
      backgroundThrottling: !process.env.CALVITO_TEST_PROFILE
    }
  });

  mainWindow = win;
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-attach-webview', (event, prefs, params) => {
    delete prefs.preload;
    prefs.nodeIntegration = false;
    prefs.nodeIntegrationInSubFrames = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
    prefs.webSecurity = true;
    prefs.allowRunningInsecureContent = false;
    const allowedPartition = params.partition === partitionForProfile(guestMode ? GUEST_ID : activeProfileId()) || /^calvito-private-[a-z0-9-]+$/.test(params.partition || '');
    if (!allowedPartition || (params.src && params.src !== 'about:blank' && !webUrl(params.src))) event.preventDefault();
  });

  win.once('ready-to-show', () => win.show());
  await win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
handle('storage:load', () => loadData());
handle('storage:save', (_event, data) => saveData(data));
handle('preferences:set', (_event, nextPreferences) => {
  preferences = cleanPreferences({ ...preferences, ...nextPreferences });
  return preferences;
});
handle('downloads:open', async (_event, filePath) => {
  const saved = await loadData();
  if (typeof filePath === 'string' && (downloadPaths.has(filePath) || saved.downloads.some(item => item.path === filePath && item.state === 'completed'))) shell.showItemInFolder(filePath);
});
handle('external:open', (_event, url) => { if (webUrl(url)) return shell.openExternal(url); });
handle('app:about', () => dialog.showMessageBox(BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0], {
  type: 'info',
  title: 'Calvito',
  message: 'Calvito Browser',
  detail: `Versión ${app.getVersion()} · Chromium ${process.versions.chrome}\nCódigo abierto · Licencia MIT\nhttps://github.com/shodzery/calvitobrowser`
}));

handle('profiles:context', () => ({
  profiles: profilesConfig.profiles,
  activeProfileId: guestMode ? GUEST_ID : profilesConfig.activeProfileId,
  guestMode,
  partition: guestMode ? partitionForProfile(GUEST_ID) : partitionForProfile(activeProfileId())
}));

handle('profiles:create', async (_event, { name, emoji, color }) => {
  const id = `p${Date.now().toString(36)}`;
  profilesConfig.profiles.push({ id, name: name || 'Perfil', emoji: emoji || '👤', color: color || DEFAULT_PROFILE_COLORS[profilesConfig.profiles.length % DEFAULT_PROFILE_COLORS.length] });
  await saveProfilesConfig();
  return profilesConfig.profiles;
});

handle('profiles:delete', async (_event, profileId) => {
  if (!profilesConfig.profiles.some(profile => profile.id === profileId) || profileId === activeProfileId()) return { error: 'Cambia de perfil antes de eliminarlo.' };
  if (profilesConfig.profiles.length <= 1) return { error: 'No puedes eliminar tu único perfil.' };
  profilesConfig.profiles = profilesConfig.profiles.filter((profile) => profile.id !== profileId);
  if (profilesConfig.activeProfileId === profileId) profilesConfig.activeProfileId = profilesConfig.profiles[0].id;
  await saveProfilesConfig();
  await fs.unlink(profileDataPath(profileId)).catch(() => {});
  return { profiles: profilesConfig.profiles, activeProfileId: profilesConfig.activeProfileId };
});

handle('profiles:switch', async (_event, profileId) => {
  if (!profilesConfig.profiles.some(profile => profile.id === profileId)) throw new Error('Perfil desconocido');
  cancelPermissionRequests();
  await writeQueue;
  guestMode = false;
  guestData = null;
  profilesConfig.activeProfileId = profileId;
  await saveProfilesConfig();
  const saved = await applyLoadedData();
  protectBrowserSession(session.fromPartition(partitionForProfile(profileId)));
  return { partition: partitionForProfile(profileId), data: saved };
});

handle('profiles:start-guest', async () => {
  cancelPermissionRequests();
  await writeQueue;
  guestPartition = `calvito-guest-${randomUUID()}`;
  guestMode = true;
  guestData = DEFAULT_DATA();
  preferences = { ...DEFAULT_PREFERENCES };
  sitePermissions = {};
  adWhitelist = [];
  protectBrowserSession(session.fromPartition(partitionForProfile(GUEST_ID)));
  return { partition: partitionForProfile(GUEST_ID), data: guestData };
});

handle('permissions:respond', async (_event, { requestId, allow, remember }) => {
  const pending = pendingPermissionRequests.get(requestId);
  if (!pending) return;
  pendingPermissionRequests.delete(requestId);
  const { origin, kind, browserSession } = pending;
  if (remember) {
    if (browserSession.isPersistent()) {
      setPermissionPolicy(origin, kind, allow ? 'allow' : 'block');
      await saveData(await loadData());
    } else {
      const policies = ephemeralPermissions.get(browserSession) || {};
      policies[origin] = { ...(policies[origin] || {}), [kind]: allow ? 'allow' : 'block' };
      ephemeralPermissions.set(browserSession, policies);
    }
  }
  pending.callback(Boolean(allow));
});
handle('permissions:list', () => sitePermissions);
handle('permissions:set', async (_event, { origin, kind, value }) => { setPermissionPolicy(origin, kind, value); await saveData(await loadData()); return sitePermissions; });
handle('permissions:clear', async (_event, origin) => { delete sitePermissions[origin]; await saveData(await loadData()); return sitePermissions; });
handle('permissions:clear-all', async () => { sitePermissions = {}; await saveData(await loadData()); return sitePermissions; });

handle('adblock:stats', () => ({ global: adStats.global, perSite: Object.fromEntries(adStats.perSite) }));
handle('adblock:whitelist-add', (_event, origin) => { if (!adWhitelist.includes(origin)) adWhitelist.push(origin); return adWhitelist; });
handle('adblock:whitelist-remove', (_event, origin) => { adWhitelist = adWhitelist.filter((item) => item !== origin); return adWhitelist; });
handle('adblock:whitelist-list', () => adWhitelist);

handle('sitedata:list', () => listSiteData());
handle('sitedata:clear', (_event, domain) => clearSiteData(domain));
handle('sitedata:clear-all', () => clearAllSiteData());

handle('updates:get', () => updates.getState());
handle('updates:check', () => updates.check());
handle('updates:download', () => updates.download());
handle('updates:install', () => updates.install());
handle('bookmarks:export', async (_event, bookmarks) => {
  const result = await dialog.showSaveDialog(mainWindow, { title: 'Exportar marcadores', defaultPath: 'calvito-marcadores.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (result.canceled) return false;
  await fs.writeFile(result.filePath, JSON.stringify(cleanBookmarks(bookmarks), null, 2), 'utf8');
  return true;
});
handle('bookmarks:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { title: 'Importar marcadores de Calvito', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
  if (result.canceled) return null;
  const info = await fs.stat(result.filePaths[0]);
  if (info.size > 5 * 1024 * 1024) throw new Error('El archivo es demasiado grande');
  return cleanBookmarks(JSON.parse(await fs.readFile(result.filePaths[0], 'utf8')));
});
handle('page:pdf', async (_event, contentId) => {
  const contents = webContents.fromId(Number(contentId));
  if (!contents || contents.getType() !== 'webview' || contents.hostWebContents !== mainWindow.webContents) throw new Error('Pestaña inválida');
  const result = await dialog.showSaveDialog(mainWindow, { title: 'Guardar página como PDF', defaultPath: 'pagina.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (result.canceled) return false;
  await fs.writeFile(result.filePath, await contents.printToPDF({ printBackground: true }));
  return true;
});

app.whenReady().then(async () => {
  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() === 'webview') {
      protectBrowserSession(contents.session);
      const guard = (event, url) => { if (!webUrl(url)) event.preventDefault(); };
      contents.on('will-navigate', guard);
      contents.on('will-redirect', guard);
      contents.on('before-input-event', (event, input) => {
        if (input.type !== 'keyDown' || !input.control) return;
        const key = input.key.toLowerCase();
        const command = input.shift ? ({ t: 'reopen-tab', p: 'new-private-tab', f: 'focus' })[key] : ({ t: 'new-tab', w: 'close-tab', l: 'address', k: 'commands', f: 'find', h: 'history', j: 'downloads', d: 'bookmark', r: 'reload' })[key];
        if (command) { event.preventDefault(); broadcast('browser-command', command); }
      });
      contents.setWindowOpenHandler(({ url }) => {
        if (!webUrl(url)) return { action: 'deny' };
        const origin = safeOrigin(contents.getURL());
        const policy = policyForSession(contents.session, origin, 'popups');
        if (policy === 'allow') {
          broadcast('open-url-in-tab', { url, private: !contents.session.isPersistent() });
        } else {
          broadcast('popup-blocked', { webContentsId: contents.id, url, origin });
        }
        return { action: 'deny' };
      });
    }
  });
  buildMenu();

  updates = setupUpdates({ app, autoUpdater, broadcast });
  await createWindow();
  if (preferences.autoCheckUpdates) setTimeout(() => updates.check(), 15000).unref();
  setInterval(() => { if (preferences.autoCheckUpdates) updates.check(); }, 4 * 60 * 60 * 1000).unref();
});

app.on('window-all-closed', () => {
  // Private-tab and guest-profile data already live in non-persistent,
  // in-memory partitions and disappear on their own when the process exits.
  // Persistent profile data intentionally survives so cookies/logins and
  // "restore session" keep working across restarts.
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
