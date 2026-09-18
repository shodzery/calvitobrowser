/* global calvito */
const $ = (selector) => document.querySelector(selector);
const refs = {
  tabs: $('#tabs'), workspace: $('#workspace'), address: $('#address'),
  addressForm: $('#address-form'), addressWrap: $('.address-wrap'),
  suggestions: $('#suggestions'), shield: $('#shield'), star: $('#star'),
  back: $('#back'), forward: $('#forward'), reload: $('#reload'), home: $('#home'),
  status: $('#status'), statusDot: $('#status-dot'), privacy: $('#privacy-status'),
  bookmarkBar: $('#bookmark-bar'), findBar: $('#find-bar'), findInput: $('#find-input'), findCount: $('#find-count'),
  pageMenu: $('#page-menu'), pageMenuButton: $('#page-menu-button'), pageMenuTitle: $('#page-menu-title'), pageMenuUrl: $('#page-menu-url'),
  pinLabel: $('#pin-label'), muteLabel: $('#mute-label'), muteIcon: $('#mute-icon'), zoomLabel: $('#zoom-label'),
  libraryModal: $('#library-sidebar'), libraryContent: $('#library-content'),
  settingsModal: $('#settings-modal'), protectionToggle: $('#protection-toggle'),
  searchEngine: $('#search-engine'), themeSelect: $('#theme-select'),
  restoreSessionToggle: $('#restore-session-toggle'), bookmarkBarToggle: $('#bookmark-bar-toggle'),
  tabContextMenu: $('#tab-context-menu'),
  profileButton: $('#profile-button'), profileAvatar: $('#profile-avatar'), profileMenu: $('#profile-menu'),
  shieldPanel: $('#shield-panel'),
  popupIndicator: $('#popup-indicator'), popupCount: $('#popup-count'), popupList: $('#popup-list'),
  permissionBanner: $('#permission-banner'), permissionTitle: $('#permission-title'), permissionOrigin: $('#permission-origin'),
  permissionRemember: $('#permission-remember'), permissionBlock: $('#permission-block'), permissionAllow: $('#permission-allow')
};

const SEARCH_ENGINES = {
  duckduckgo: 'https://duckduckgo.com/?q=',
  google: 'https://www.google.com/search?q=',
  brave: 'https://search.brave.com/search?q=',
  bing: 'https://www.bing.com/search?q=', ecosia: 'https://www.ecosia.org/search?q='
};

const GROUP_COLORS = ['teal', 'blue', 'purple', 'pink', 'orange', 'yellow'];
const PROFILE_COLORS = ['teal', 'blue', 'purple', 'pink', 'orange', 'yellow'];
const PERMISSION_LABELS = { media: 'usar tu cámara y micrófono', geolocation: 'conocer tu ubicación', notifications: 'enviarte notificaciones', clipboard: 'acceder al portapapeles' };
const PERMISSION_KIND_LABELS = { media: 'Cámara y micrófono', geolocation: 'Ubicación', notifications: 'Notificaciones', clipboard: 'Portapapeles', popups: 'Ventanas emergentes' };

const state = {
  tabs: [],
  activeId: null,
  data: { bookmarks: [], history: [], downloads: [], groups: [], session: { tabs: [], activeIndex: 0 }, preferences: { protectionEnabled: true, searchEngine: 'duckduckgo', theme: 'dark', restoreSession: true, showBookmarkBar: true }, permissions: {}, adWhitelist: [] },
  libraryView: 'bookmarks',
  closedStack: [],
  historyFilter: '',
  partition: 'persist:calvito-default',
  profiles: [],
  activeProfileId: 'default',
  guestMode: false,
  adStats: { global: { ads: 0, trackers: 0, scripts: 0 }, perSite: {} }
};

function originOf(url) {
  try { return new URL(url).origin; } catch { return ''; }
}

function id() {
  return typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function safeUrl(value = '') {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function prettyUrl(value = '') {
  try {
    const url = new URL(value);
    return `${url.hostname.replace(/^www\./, '')}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return value;
  }
}

function pageTitle(tab) {
  return tab.title || (tab.private ? 'Pestaña privada' : 'Nueva pestaña');
}

function getActiveTab() {
  return state.tabs.find((tab) => tab.id === state.activeId) || null;
}

function snapshotSession() {
  const normalTabs = state.tabs.filter((tab) => !tab.private).slice(0, 20);
  const activeIndex = Math.max(0, normalTabs.findIndex((tab) => tab.id === state.activeId));
  return {
    tabs: normalTabs.map((tab) => ({
      url: tab.url,
      title: pageTitle(tab),
      pinned: Boolean(tab.pinned),
      muted: Boolean(tab.muted),
      zoom: tab.zoom || 1,
      groupId: tab.groupId || null
    })),
    activeIndex
  };
}

function persist() {
  return calvito.saveData({
    notes: state.data.notes || '',
    bookmarks: state.data.bookmarks,
    history: state.data.history.slice(0, 500),
    downloads: state.data.downloads.slice(0, 100),
    groups: state.data.groups,
    session: snapshotSession(),
    preferences: state.data.preferences,
    permissions: state.data.permissions || {},
    adWhitelist: state.data.adWhitelist || []
  }).catch(() => toast('No se pudieron guardar los datos locales.'));
}

function setStatus(text, { loading = false } = {}) {
  refs.status.textContent = text;
  refs.statusDot.classList.toggle('loading', loading);
}

function toast(message) {
  let stack = $('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.append(stack);
  }
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = message;
  stack.append(element);
  window.setTimeout(() => element.remove(), 3600);
}

function homeMarkup(isPrivate) {
  const shortcuts = state.data.bookmarks.slice(0, 5);
  const now = new Date();
  return `
    <section class="home-screen">
      <div class="home-inner">
        <div class="home-topline"><span class="home-wordmark"><img src="assets/icon.png" alt="" /> calvito<span class="home-edition">${isPrivate ? 'PRIVADO' : 'TU ESPACIO'}</span></span><span class="home-clock live-clock">${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
        <div class="home-hero"><span class="eyebrow">MENOS RUIDO. MÁS POSIBILIDADES.</span><h1>Internet, a tu manera<span>.</span></h1><p>Un espacio para explorar, crear y seguir tu curiosidad.</p></div>
        <form class="home-search" data-home-search>
          <span>⌕</span>
          <input aria-label="Buscar en la web" autocomplete="off" placeholder="¿A dónde vamos hoy?" autofocus />
          <button type="submit">Explorar</button>
        </form>
        <div class="home-shortcuts">${shortcuts.map(item => `<button data-url="${esc(item.url)}"><span>${esc((item.title || '?')[0].toUpperCase())}</span>${esc(item.title)}</button>`).join('')}<button data-home-action="bookmarks"><span>＋</span>Tus marcadores</button></div>
        <div class="home-cards">
          <button class="home-card protection-card" data-home-action="shield"><span class="card-symbol">♢</span><span class="card-label">TU PRIVACIDAD</span><strong class="blocked-total">${Object.values(state.adStats.global).reduce((a, b) => a + b, 0)}</strong><span>Solicitudes bloqueadas en esta sesión</span><small>Lista local de dominios · ${state.data.preferences.protectionEnabled ? 'Activa' : 'Pausada'} ↗</small></button>
          <button class="home-card" data-home-action="notes"><span class="card-symbol">✎</span><span class="card-label">IDEAS A MANO</span><strong>Deja una nota.</strong><span>Captura una idea sin salir de tu navegador.</span><small>Abrir tus notas locales ↗</small></button>
          <button class="home-card" data-home-action="commands"><span class="card-symbol">⌘</span><span class="card-label">EN TU RITMO</span><strong>Un atajo a todo.</strong><span>Pestañas, acciones y búsqueda, en un lugar.</span><small>Comandos rápidos <kbd>Ctrl K</kbd></small></button>
        </div>
        <div class="home-bottom"><span>Hecho para tu curiosidad. Abierto por naturaleza.</span><button data-home-action="settings">Personalizar Calvito ↗</button></div>
        ${isPrivate ? '<div class="private-banner"><span>◒</span><span><strong>Pestaña privada.</strong> Sin historial local. Los archivos descargados se conservan.</span></div>' : ''}
      </div>
    </section>`;
}

function createTab({ url = '', private: isPrivate = false, activate = true, title = '', pinned = false, muted = false, zoom = 1, restoring = false, groupId = null } = {}) {
  const tab = {
    id: id(), url: '', title: title || (isPrivate ? 'Pestaña privada' : 'Nueva pestaña'), private: isPrivate,
    pinned, muted, zoom: Math.min(3, Math.max(.5, Number(zoom) || 1)), restoring, loading: false, pane: null, webview: null,
    groupId: isPrivate ? null : (groupId || null), blockedPopups: []
  };
  const pane = document.createElement('section');
  pane.className = 'tab-pane';
  pane.dataset.tabId = tab.id;
  pane.innerHTML = homeMarkup(isPrivate);
  tab.pane = pane;
  refs.workspace.append(pane);
  state.tabs.push(tab);
  wireHome(tab);
  if (activate) activateTab(tab.id);
  if (url) navigate(tab, url);
  if (!isPrivate) persist();
  return tab;
}

function wireHome(tab) {
  const form = tab.pane.querySelector('[data-home-search]');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    navigate(tab, form.querySelector('input').value);
  });
  tab.pane.querySelectorAll('[data-url]').forEach((button) => {
    button.addEventListener('click', () => navigate(tab, button.dataset.url));
  });
  tab.pane.querySelectorAll('[data-home-action]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.homeAction;
    if (action === 'settings') showSettings();
    else if (action === 'commands') openPalette();
    else if (action === 'shield') toggleShieldPanel();
    else showLibrary(action);
  }));
}

function createWebview(tab) {
  if (tab.webview) return tab.webview;
  const webview = document.createElement('webview');
  webview.setAttribute('webpreferences', 'contextIsolation=yes, sandbox=yes, nodeIntegration=no');
  webview.setAttribute('partition', tab.private ? `calvito-private-${tab.id}` : state.partition);
  webview.setAttribute('allowpopups', '');
  webview.setAttribute('aria-label', 'Contenido web');
  tab.pane.append(webview);
  tab.webview = webview;

  webview.addEventListener('dom-ready', () => {
    if (tab.webview !== webview || !webview.isConnected) return;
    try {
      Promise.resolve(webview.setAudioMuted(tab.muted)).catch(() => {});
      Promise.resolve(webview.setZoomFactor(tab.zoom)).catch(() => {});
    } catch { /* the guest can finish initializing after this event */ }
  });
  webview.addEventListener('did-start-loading', () => {
    tab.loading = true;
    if (tab.id === state.activeId) {
      setStatus('Cargando…', { loading: true });
      updateNavigation();
    }
  });
  webview.addEventListener('did-stop-loading', () => {
    tab.loading = false;
    if (tab.id === state.activeId) {
      setStatus('Listo para navegar');
      updateNavigation();
    }
  });
  webview.addEventListener('did-navigate', (event) => {
    syncNavigation(tab, event.url, !tab.restoring);
    tab.restoring = false;
  });
  webview.addEventListener('did-navigate-in-page', (event) => syncNavigation(tab, event.url, false));
  webview.addEventListener('page-title-updated', (event) => {
    event.preventDefault();
    tab.title = event.title || prettyUrl(tab.url);
    renderTabs();
    updatePageControls();
    if (!tab.private) persist();
  });
  webview.addEventListener('page-favicon-updated', (event) => {
    tab.favicon = event.favicons?.[0] || '';
    renderTabs();
  });
  webview.addEventListener('did-fail-load', (event) => {
    if (event.errorCode === -3) return;
    if (event.isMainFrame) {
      showPageError(tab, event.validatedURL || tab.url);
    }
    if (tab.id === state.activeId) setStatus('No se pudo cargar la página');
  });
  webview.addEventListener('update-target-url', (event) => {
    if (tab.id === state.activeId && event.url) setStatus(prettyUrl(event.url));
  });
  webview.addEventListener('found-in-page', (event) => {
    if (tab.id !== state.activeId || refs.findBar.hidden) return;
    const { matches, activeMatchOrdinal, finalUpdate } = event.result;
    if (finalUpdate) refs.findCount.textContent = matches ? `${activeMatchOrdinal}/${matches}` : '0/0';
  });
  return webview;
}

function syncNavigation(tab, url, writeHistory = true) {
  if (!tab.pane.isConnected || !tab.webview) return;
  const normalized = safeUrl(url);
  if (!normalized) return;
  tab.url = normalized;
  tab.pane.classList.add('browsing');
  if (!tab.title || tab.title === 'Nueva pestaña' || tab.title === 'Pestaña privada') tab.title = prettyUrl(normalized);
  if (writeHistory && !tab.private) addHistory(tab);
  if (!tab.private) persist();
  renderTabs();
  if (tab.id === state.activeId) {
    refs.address.value = normalized;
    updateNavigation();
    updatePageControls();
  }
}

function addHistory(tab) {
  if (!tab.url || tab.private) return;
  const existing = state.data.history.find((entry) => entry.url === tab.url);
  const visits = (existing?.visits || 0) + 1;
  state.data.history = state.data.history.filter((entry) => entry.url !== tab.url);
  state.data.history.unshift({ title: pageTitle(tab), url: tab.url, visitedAt: Date.now(), visits });
  state.data.history = state.data.history.slice(0, 500);
  persist();
}

function resolveInput(input) {
  const raw = input.trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return safeUrl(raw) || searchFor(raw);
  if (/^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:\/|$)/i.test(raw)) return safeUrl(`http://${raw}`) || searchFor(raw);
  if (/^[\w-]+(?:\.[\w-]+)+(?:\:\d+)?(?:\/[^\s]*)?$/i.test(raw)) return safeUrl(`https://${raw}`) || searchFor(raw);
  return searchFor(raw);
}

function searchFor(query) {
  const engine = SEARCH_ENGINES[state.data.preferences.searchEngine] || SEARCH_ENGINES.duckduckgo;
  return `${engine}${encodeURIComponent(query)}`;
}

function navigate(tab, input) {
  if (!tab) return;
  const url = resolveInput(input);
  if (!url) return;
  tab.pane.querySelector('.page-error')?.remove();
  const webview = createWebview(tab);
  tab.url = url;
  if (!tab.title || tab.title === 'Nueva pestaña' || tab.title === 'Pestaña privada') tab.title = prettyUrl(url);
  tab.pane.classList.add('browsing');
  renderTabs();
  if (tab.id === state.activeId) {
    refs.address.value = url;
    setStatus('Cargando…', { loading: true });
    updatePageControls();
  }
  try {
    if (webview.getURL()) webview.loadURL(url).catch(() => {});
    else webview.src = url;
  } catch {
    webview.src = url;
  }
  if (!tab.private) persist();
}

function activateTab(tabId) {
  const tab = state.tabs.find((item) => item.id === tabId);
  if (!tab) return;
  state.activeId = tabId;
  state.tabs.forEach((item) => item.pane.classList.toggle('active', item.id === tabId));
  renderTabs();
  refs.address.value = tab.url || '';
  setStatus(tab.loading ? 'Cargando…' : (tab.private ? 'Navegación privada' : 'Listo para navegar'), { loading: tab.loading });
  updateNavigation();
  updatePageControls();
  if (!tab.private) persist();
}

function closeTab(tabId) {
  const index = state.tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return;
  const [tab] = state.tabs.splice(index, 1);
  if (!tab.private && tab.url) {
    state.closedStack.push({ url: tab.url, title: tab.title, pinned: tab.pinned, muted: tab.muted, zoom: tab.zoom, groupId: tab.groupId });
    state.closedStack = state.closedStack.slice(-20);
  }
  const groupId = tab.groupId;
  detachWebview(tab);
  tab.pane.remove();
  if (groupId && !state.tabs.some((item) => item.groupId === groupId)) {
    state.data.groups = state.data.groups.filter((group) => group.id !== groupId);
  }
  if (!state.tabs.length) {
    createTab();
    return;
  }
  if (state.activeId === tabId) activateTab(state.tabs[Math.max(0, index - 1)].id);
  else renderTabs();
  persist();
}

function reopenClosedTab() {
  const entry = state.closedStack.pop();
  if (!entry) return toast('No hay pestañas recientes para reabrir.');
  const groupExists = entry.groupId && state.data.groups.some((group) => group.id === entry.groupId);
  createTab({ ...entry, groupId: groupExists ? entry.groupId : null, restoring: true });
  toast('Pestaña restaurada.');
}

function closeOtherTabs(tabId) {
  [...state.tabs].filter((tab) => tab.id !== tabId && !tab.pinned).forEach((tab) => closeTab(tab.id));
}

function closeTabsToTheRight(tabId) {
  const index = state.tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return;
  [...state.tabs].slice(index + 1).filter((tab) => !tab.pinned).forEach((tab) => closeTab(tab.id));
}

function closeDuplicateTabs() {
  const seen = new Set();
  [...state.tabs].forEach((tab) => {
    if (!tab.url || tab.pinned) return;
    if (seen.has(tab.url)) closeTab(tab.id);
    else seen.add(tab.url);
  });
}

function createGroup(name, color) {
  const group = { id: id(), name: name || 'Grupo', color: color || GROUP_COLORS[state.data.groups.length % GROUP_COLORS.length], collapsed: false };
  state.data.groups.push(group);
  return group;
}

function addTabToGroup(tabId, groupId) {
  const tab = state.tabs.find((item) => item.id === tabId);
  if (!tab || tab.private) return;
  const oldGroupId = tab.groupId;
  tab.groupId = groupId;
  state.tabs = state.tabs.filter((item) => item.id !== tabId);
  let insertAt = state.tabs.length;
  for (let i = state.tabs.length - 1; i >= 0; i -= 1) {
    if (state.tabs[i].groupId === groupId) { insertAt = i + 1; break; }
  }
  state.tabs.splice(insertAt, 0, tab);
  if (oldGroupId && !state.tabs.some((item) => item.groupId === oldGroupId)) {
    state.data.groups = state.data.groups.filter((group) => group.id !== oldGroupId);
  }
  renderTabs();
  persist();
}

function removeTabFromGroup(tabId) {
  const tab = state.tabs.find((item) => item.id === tabId);
  if (!tab || !tab.groupId) return;
  const groupId = tab.groupId;
  tab.groupId = null;
  if (!state.tabs.some((item) => item.groupId === groupId)) {
    state.data.groups = state.data.groups.filter((group) => group.id !== groupId);
  }
  renderTabs();
  persist();
}

function renameGroup(groupId, name) {
  const group = state.data.groups.find((item) => item.id === groupId);
  if (!group) return;
  group.name = name || group.name;
  renderTabs();
  persist();
}

function setGroupColor(groupId, color) {
  const group = state.data.groups.find((item) => item.id === groupId);
  if (!group) return;
  group.color = color;
  renderTabs();
  persist();
}

function toggleGroupCollapse(groupId) {
  const group = state.data.groups.find((item) => item.id === groupId);
  if (!group) return;
  group.collapsed = !group.collapsed;
  renderTabs();
}

function closeGroup(groupId) {
  [...state.tabs].filter((tab) => tab.groupId === groupId).forEach((tab) => closeTab(tab.id));
}

function buildTabButton(tab) {
  const button = document.createElement('button');
  button.className = `tab${tab.id === state.activeId ? ' active' : ''}${tab.private ? ' tab-private' : ''}${tab.pinned ? ' tab-pinned' : ''}${tab.muted ? ' tab-muted' : ''}`;
  button.setAttribute('role', 'tab');
  button.setAttribute('aria-selected', String(tab.id === state.activeId));
  const symbol = tab.pinned ? '⌖' : tab.private ? '◒' : tab.muted ? '◌' : tab.loading ? '◌' : '◉';
  button.title = `${pageTitle(tab)}${tab.muted ? ' · Silenciada' : ''}`;
  button.innerHTML = `<span class="tab-symbol">${symbol}</span><span class="tab-title">${esc(pageTitle(tab))}</span><span class="tab-close" role="button" aria-label="Cerrar pestaña">×</span>`;
  button.addEventListener('click', (event) => {
    if (event.target.closest('.tab-close')) closeTab(tab.id);
    else activateTab(tab.id);
  });
  button.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    openTabContextMenu(event, tab);
  });
  return button;
}

function renderTabs() {
  refs.tabs.replaceChildren();
  let index = 0;
  while (index < state.tabs.length) {
    const tab = state.tabs[index];
    if (!tab.groupId) {
      refs.tabs.append(buildTabButton(tab));
      index += 1;
      continue;
    }
    const group = state.data.groups.find((item) => item.id === tab.groupId);
    const members = [];
    let cursor = index;
    while (cursor < state.tabs.length && state.tabs[cursor].groupId === tab.groupId) {
      members.push(state.tabs[cursor]);
      cursor += 1;
    }
    const wrap = document.createElement('div');
    wrap.className = `tab-group${group?.collapsed ? ' collapsed' : ''}`;
    wrap.style.setProperty('--group-color', `var(--group-${group?.color || 'teal'})`);
    const head = document.createElement('button');
    head.className = 'tab-group-head';
    head.title = 'Contraer/expandir grupo';
    head.innerHTML = `<span class="tab-group-dot"></span><span class="tab-group-name">${esc(group?.name || 'Grupo')}</span>${group?.collapsed ? `<span class="tab-group-count">${members.length}</span>` : ''}`;
    head.addEventListener('click', () => toggleGroupCollapse(tab.groupId));
    wrap.append(head);
    if (!group?.collapsed) {
      members.forEach((member) => wrap.append(buildTabButton(member)));
    }
    refs.tabs.append(wrap);
    index = cursor;
  }
}

function closeTabContextMenu() {
  refs.tabContextMenu.hidden = true;
}

function tabContextMenuBaseHtml(tab) {
  const group = tab.groupId ? state.data.groups.find((item) => item.id === tab.groupId) : null;
  const otherGroups = state.data.groups.filter((item) => item.id !== tab.groupId);
  return `
    <button data-tab-menu="new">Nueva pestaña</button>
    <button data-tab-menu="reload">Recargar pestaña</button>
    <button data-tab-menu="duplicate">Duplicar pestaña</button>
    <button data-tab-menu="pin">${tab.pinned ? 'Desfijar pestaña' : 'Fijar pestaña'}</button>
    <button data-tab-menu="mute">${tab.muted ? 'Activar sonido' : 'Silenciar pestaña'}</button>
    <div class="tab-menu-sep"></div>
    ${tab.private ? '' : `
      ${group ? `<button data-tab-menu="ungroup">Quitar del grupo "${esc(group.name)}"</button>` : ''}
      ${otherGroups.map((item) => `<button data-tab-menu="movegroup" data-group-id="${item.id}"><span class="tab-menu-dot" style="background:var(--group-${item.color})"></span>Mover a "${esc(item.name)}"</button>`).join('')}
      <button data-tab-menu="newgroup">Nuevo grupo…</button>
      ${group ? `<button data-tab-menu="closegroup">Cerrar grupo</button>` : ''}
      <div class="tab-menu-sep"></div>
    `}
    <button data-tab-menu="close">Cerrar pestaña</button>
    <button data-tab-menu="close-others">Cerrar otras pestañas</button>
    <button data-tab-menu="close-right">Cerrar pestañas a la derecha</button>
    <button data-tab-menu="close-duplicates">Cerrar pestañas duplicadas</button>
    <div class="tab-menu-sep"></div>
    <button data-tab-menu="reopen">Reabrir pestaña cerrada</button>
  `;
}

function newGroupFormHtml() {
  return `
    <div class="tab-menu-form">
      <input id="new-group-name" placeholder="Nombre del grupo" autocomplete="off" />
      <div class="tab-menu-colors">
        ${GROUP_COLORS.map((color) => `<button type="button" class="color-swatch" data-color="${color}" style="background:var(--group-${color})"></button>`).join('')}
      </div>
      <button data-tab-menu="create-group" class="tab-menu-primary">Crear grupo</button>
    </div>
  `;
}

function openTabContextMenu(event, tab) {
  const menu = refs.tabContextMenu;
  let pendingColor = GROUP_COLORS[0];
  menu.innerHTML = tabContextMenuBaseHtml(tab);
  menu.hidden = false;
  const rect = refs.tabs.getBoundingClientRect();
  const x = Math.min(event.clientX, window.innerWidth - 240);
  menu.style.left = `${Math.max(rect.left, x)}px`;
  menu.style.top = `${event.clientY}px`;

  function wireActions() {
    menu.querySelectorAll('[data-tab-menu]').forEach((button) => button.addEventListener('click', () => {
      const action = button.dataset.tabMenu;
      if (action === 'new') createTab();
      else if (action === 'reload') tab.webview?.reload();
      else if (action === 'duplicate') { activateTab(tab.id); duplicateTab(); }
      else if (action === 'pin') { activateTab(tab.id); togglePin(); }
      else if (action === 'mute') { activateTab(tab.id); toggleMute(); }
      else if (action === 'ungroup') removeTabFromGroup(tab.id);
      else if (action === 'movegroup') addTabToGroup(tab.id, button.dataset.groupId);
      else if (action === 'closegroup') closeGroup(tab.groupId);
      else if (action === 'close') closeTab(tab.id);
      else if (action === 'close-others') closeOtherTabs(tab.id);
      else if (action === 'close-right') closeTabsToTheRight(tab.id);
      else if (action === 'close-duplicates') closeDuplicateTabs();
      else if (action === 'reopen') reopenClosedTab();
      else if (action === 'newgroup') {
        menu.innerHTML = newGroupFormHtml();
        wireGroupForm();
        return;
      }
      closeTabContextMenu();
    }));
  }

  function wireGroupForm() {
    const input = menu.querySelector('#new-group-name');
    input?.focus();
    menu.querySelectorAll('.color-swatch').forEach((swatch) => swatch.addEventListener('click', () => {
      pendingColor = swatch.dataset.color;
      menu.querySelectorAll('.color-swatch').forEach((item) => item.classList.toggle('selected', item === swatch));
    }));
    menu.querySelector('[data-tab-menu="create-group"]')?.addEventListener('click', () => {
      const group = createGroup(input.value.trim(), pendingColor);
      addTabToGroup(tab.id, group.id);
      closeTabContextMenu();
      toast('Grupo creado.');
    });
  }

  wireActions();
}

function updateNavigation() {
  const tab = getActiveTab();
  const disable = !tab?.webview || !tab.url;
  let canBack = false;
  let canForward = false;
  try {
    canBack = Boolean(tab?.webview?.canGoBack());
    canForward = Boolean(tab?.webview?.canGoForward());
  } catch { /* guest is still initializing */ }
  refs.back.disabled = disable || !canBack;
  refs.forward.disabled = disable || !canForward;
  refs.reload.disabled = disable;
  [refs.back, refs.forward, refs.reload].forEach((button) => button.style.opacity = button.disabled ? '.35' : '1');
}

function updatePageControls() {
  const tab = getActiveTab();
  const bookmarked = Boolean(tab?.url && state.data.bookmarks.some((item) => item.url === tab.url));
  refs.star.classList.toggle('active', bookmarked);
  refs.star.textContent = bookmarked ? '★' : '☆';
  refs.shield.classList.toggle('off', !state.data.preferences.protectionEnabled);
  refs.shield.title = state.data.preferences.protectionEnabled ? 'Protección contra rastreadores activada' : 'Protección contra rastreadores desactivada';
  refs.privacy.textContent = state.data.preferences.protectionEnabled ? 'Protección activa' : 'Protección desactivada';
  updatePopupIndicator();
  if (!refs.shieldPanel.hidden) renderShieldPanel();
}

function updatePopupIndicator() {
  const tab = getActiveTab();
  const count = tab?.blockedPopups?.length || 0;
  refs.popupIndicator.hidden = count === 0;
  refs.popupCount.textContent = String(count);
}

function goHome() {
  const tab = getActiveTab();
  if (!tab) return;
  detachWebview(tab);
  tab.loading = false;
  tab.pane.innerHTML = homeMarkup(tab.private);
  wireHome(tab);
  tab.url = '';
  tab.title = tab.private ? 'Pestaña privada' : 'Nueva pestaña';
  tab.pane.classList.remove('browsing');
  refs.address.value = '';
  renderTabs();
  updateNavigation();
  updatePageControls();
  setStatus(tab.private ? 'Navegación privada' : 'Listo para navegar');
  tab.pane.querySelector('[data-home-search] input')?.focus();
  if (!tab.private) persist();
}

function toggleBookmark() {
  const tab = getActiveTab();
  if (!tab?.url) return toast('Abre una página antes de crear un marcador.');
  const existing = state.data.bookmarks.find((item) => item.url === tab.url);
  if (existing) {
    state.data.bookmarks = state.data.bookmarks.filter((item) => item !== existing);
    toast('Marcador eliminado.');
  } else {
    state.data.bookmarks.unshift({ title: pageTitle(tab), url: tab.url, savedAt: Date.now() });
    toast('Marcador guardado.');
  }
  persist();
  updatePageControls();
  renderBookmarkBar();
  if (!refs.libraryModal.hidden) renderLibrary();
}

function renderBookmarkBar() {
  refs.bookmarkBar.classList.toggle('hidden', !state.data.preferences.showBookmarkBar);
  refs.bookmarkBar.replaceChildren();
  const bookmarks = state.data.bookmarks.slice(0, 10);
  if (!bookmarks.length) {
    const hint = document.createElement('span');
    hint.className = 'bookmark-empty';
    hint.textContent = 'Tus marcadores aparecerán aquí.';
    refs.bookmarkBar.append(hint);
    return;
  }
  bookmarks.forEach((bookmark) => {
    const button = document.createElement('button');
    button.className = 'bookmark-link';
    button.title = bookmark.url;
    button.innerHTML = `<span class="bookmark-symbol">★</span><span class="bookmark-name">${esc(bookmark.title || prettyUrl(bookmark.url))}</span>`;
    button.addEventListener('click', () => navigate(getActiveTab(), bookmark.url));
    refs.bookmarkBar.append(button);
  });
}

function togglePin() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.pinned = !tab.pinned;
  if (tab.pinned) {
    const currentIndex = state.tabs.indexOf(tab);
    state.tabs.splice(currentIndex, 1);
    state.tabs.splice(state.tabs.filter((item) => item.pinned).length, 0, tab);
  }
  renderTabs();
  updatePageMenu();
  if (!tab.private) persist();
  toast(tab.pinned ? 'Pestaña fijada.' : 'Pestaña sin fijar.');
}

function duplicateTab() {
  const tab = getActiveTab();
  if (!tab) return;
  createTab({
    url: tab.url,
    private: tab.private,
    title: tab.title,
    muted: tab.muted,
    zoom: tab.zoom
  });
  refs.pageMenu.hidden = true;
  toast('Pestaña duplicada.');
}

function toggleMute() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.muted = !tab.muted;
  try { tab.webview?.setAudioMuted(tab.muted); } catch { /* guest not ready */ }
  renderTabs();
  updatePageMenu();
  if (!tab.private) persist();
  toast(tab.muted ? 'Sitio silenciado.' : 'Audio activado.');
}

function changeZoom(amount) {
  const tab = getActiveTab();
  if (!tab?.webview) return toast('Abre una página para cambiar el zoom.');
  tab.zoom = Math.round(Math.min(3, Math.max(.5, (tab.zoom || 1) + amount)) * 10) / 10;
  try { tab.webview.setZoomFactor(tab.zoom); } catch { /* guest not ready */ }
  updatePageMenu();
  if (!tab.private) persist();
}

function resetZoom() {
  const tab = getActiveTab();
  if (!tab?.webview) return;
  tab.zoom = 1;
  try { tab.webview.setZoomFactor(1); } catch { /* guest not ready */ }
  updatePageMenu();
  if (!tab.private) persist();
}

function updatePageMenu() {
  const tab = getActiveTab();
  refs.pageMenuTitle.textContent = tab ? pageTitle(tab) : 'Pestaña nueva';
  refs.pageMenuUrl.textContent = tab?.url ? prettyUrl(tab.url) : 'Sin página abierta';
  refs.pinLabel.textContent = tab?.pinned ? 'Desfijar pestaña' : 'Fijar pestaña';
  refs.muteLabel.textContent = tab?.muted ? 'Activar audio' : 'Silenciar sitio';
  refs.muteIcon.textContent = tab?.muted ? '◌' : '◉';
  refs.zoomLabel.textContent = `${Math.round((tab?.zoom || 1) * 100)}%`;
}

function togglePageMenu() {
  const shouldOpen = refs.pageMenu.hidden;
  refs.pageMenu.hidden = !shouldOpen;
  if (shouldOpen) updatePageMenu();
}

function startFind() {
  const tab = getActiveTab();
  if (!tab?.webview) return toast('Abre una página para buscar dentro de ella.');
  refs.pageMenu.hidden = true;
  refs.findBar.hidden = false;
  refs.findInput.focus();
  refs.findInput.select();
  if (refs.findInput.value) findInPage(true, false);
}

function findInPage(forward = true, findNext = false) {
  const tab = getActiveTab();
  const text = refs.findInput.value;
  if (!tab?.webview || !text) {
    refs.findCount.textContent = '0/0';
    return;
  }
  try { tab.webview.findInPage(text, { forward, findNext }); } catch { refs.findCount.textContent = '0/0'; }
}

function closeFind() {
  const tab = getActiveTab();
  try { tab?.webview?.stopFindInPage('clearSelection'); } catch { /* guest not ready */ }
  refs.findBar.hidden = true;
  refs.findCount.textContent = '0/0';
}

function renderSuggestions() {
  const query = refs.address.value.trim().toLowerCase();
  if (query.length < 2) {
    refs.suggestions.hidden = true;
    return;
  }
  const matches = [...state.data.bookmarks.map((item) => ({ ...item, kind: '★' })), ...state.data.history.map((item) => ({ ...item, kind: '◴' }))]
    .filter((item) => `${item.title} ${item.url}`.toLowerCase().includes(query))
    .filter((item, index, list) => list.findIndex((other) => other.url === item.url) === index)
    .slice(0, 5);
  const search = { title: `Buscar “${refs.address.value.trim()}”`, url: searchFor(refs.address.value.trim()), kind: '⌕', search: true };
  const items = [search, ...matches];
  refs.suggestions.innerHTML = items.map((item, index) => `<button class="suggestion" data-index="${index}"><span class="suggestion-icon">${item.kind}</span><span class="suggestion-main">${esc(item.title)}</span><span class="suggestion-url">${item.search ? 'con tu motor elegido' : esc(prettyUrl(item.url))}</span></button>`).join('');
  refs.suggestions.hidden = false;
  refs.suggestions.querySelectorAll('.suggestion').forEach((button) => {
    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
      const item = items[Number(button.dataset.index)];
      refs.suggestions.hidden = true;
      navigate(getActiveTab(), item.url);
    });
  });
}

function showLibrary(view = state.libraryView) {
  state.libraryView = view;
  refs.libraryModal.hidden = false;
  document.querySelectorAll('.library-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.libraryView === view));
  renderLibrary();
}

function emptyState(title, text) {
  return `<div class="empty-state"><div class="empty-icon">⌁</div><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
}

function historyBuckets(entries) {
  const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const today = startOfDay(Date.now());
  const day = 86400000;
  const buckets = [
    { label: 'Hoy', items: [] },
    { label: 'Ayer', items: [] },
    { label: 'Últimos 7 días', items: [] },
    { label: 'Últimos 30 días', items: [] },
    { label: 'Más antiguo', items: [] }
  ];
  entries.forEach((entry) => {
    const entryDay = startOfDay(entry.visitedAt || 0);
    const diff = (today - entryDay) / day;
    if (diff <= 0) buckets[0].items.push(entry);
    else if (diff <= 1) buckets[1].items.push(entry);
    else if (diff <= 7) buckets[2].items.push(entry);
    else if (diff <= 30) buckets[3].items.push(entry);
    else buckets[4].items.push(entry);
  });
  return buckets.filter((bucket) => bucket.items.length);
}

function libraryItem(item, type, extra = '') {
  const icon = type === 'bookmarks' ? '★' : type === 'history' ? '◴' : type === 'tabs' ? '◉' : '↓';
  return `<div class="library-item" data-open-url="${esc(item.url || item.path || '')}">
    <span class="library-item-icon">${icon}</span>
    <div class="library-item-copy"><div class="library-item-title">${esc(item.title || item.name)}</div><div class="library-item-url">${esc(prettyUrl(item.url || item.path || ''))}</div></div>
    ${extra}<button class="library-item-action" data-remove="${esc(item.url || item.path || '')}" aria-label="Eliminar">×</button>
  </div>`;
}

async function renderLibrary() {
  const view = state.libraryView;
  let html = '';
  if (view === 'notes') {
    html = `<div class="notes-heading"><strong>Tu bloc de ideas</strong><span>Solo en este perfil</span></div><textarea id="local-notes" class="local-notes" maxlength="100000" aria-label="Notas locales" placeholder="Una idea, una lista, algo que no quieres olvidar…">${esc(state.data.notes || '')}</textarea><p class="notes-status" role="status">${state.guestMode ? 'Temporal: se descarta al salir del modo invitado.' : 'Guardado en este equipo.'}</p>`;
  } else if (view === 'bookmarks') {
    html = state.data.bookmarks.length ? `<div class="library-list">${state.data.bookmarks.map((item) => libraryItem(item, view)).join('')}</div>` : emptyState('Aún no hay marcadores', 'Guarda sitios con la estrella de la barra de navegación.');
  } else if (view === 'history') {
    const query = state.historyFilter.trim().toLowerCase();
    const filtered = query
      ? state.data.history.filter((item) => `${item.title} ${item.url}`.toLowerCase().includes(query))
      : state.data.history;
    const toolbar = `<div class="library-tools"><input id="history-search" class="library-search" type="search" placeholder="Buscar en el historial" autocomplete="off" value="${esc(state.historyFilter)}" /><button class="text-button" data-clear-history>Limpiar historial</button></div>`;
    if (!state.data.history.length) {
      html = toolbar + emptyState('Tu historial está vacío', 'Las pestañas privadas nunca se guardan aquí.');
    } else if (!filtered.length) {
      html = toolbar + emptyState('Sin resultados', 'No hay páginas en tu historial que coincidan con la búsqueda.');
    } else {
      html = toolbar + historyBuckets(filtered).map((bucket) => `
        <div class="library-section-label">${esc(bucket.label)}</div>
        <div class="library-list">${bucket.items.map((item) => libraryItem(item, view, item.visits > 1 ? `<span class="visit-count">${item.visits}×</span>` : '')).join('')}</div>
      `).join('');
    }
  } else if (view === 'tabs') {
    html = state.tabs.length ? `<div class="library-list">${state.tabs.map((tab) => `<div class="library-item" data-activate-tab="${tab.id}"><span class="library-item-icon">${tab.private ? '◒' : tab.pinned ? '⌖' : tab.muted ? '◌' : '◉'}</span><div class="library-item-copy"><div class="library-item-title">${esc(pageTitle(tab))}</div><div class="library-item-url">${esc(tab.private ? 'Pestaña privada' : (prettyUrl(tab.url) || 'Nueva pestaña'))}</div></div><button class="library-item-action" data-close-tab="${tab.id}" aria-label="Cerrar pestaña">×</button></div>`).join('')}</div>` : emptyState('No hay pestañas abiertas', 'Crea una pestaña nueva para empezar a explorar.');
  } else if (view === 'sitedata') {
    const items = await calvito.listSiteData();
    html = items.length
      ? `<div class="library-tools"><button class="text-button" data-clear-sitedata-all>Borrar todos los datos del sitio</button></div><div class="library-list">${items.map((item) => `
        <div class="library-item">
          <span class="library-item-icon">◐</span>
          <div class="library-item-copy"><div class="library-item-title">${esc(item.domain)}</div><div class="library-item-url">${item.cookieCount} cookie(s)</div></div>
          <button class="library-item-action" data-remove-domain="${esc(item.domain)}" aria-label="Eliminar">×</button>
        </div>`).join('')}</div>`
      : emptyState('No hay datos de sitios guardados', 'Las cookies y otros datos aparecerán aquí mientras navegas.');
  } else if (view === 'permissions') {
    const perms = await calvito.listPermissions();
    const entries = Object.entries(perms).filter(([, kinds]) => Object.keys(kinds).length);
    html = entries.length
      ? `<div class="library-tools"><button class="text-button" data-clear-permissions-all>Restablecer todo</button></div>` + entries.map(([origin, kinds]) => `
        <div class="permission-site"><strong>${esc(origin)}</strong>
          ${Object.entries(kinds).map(([kind, value]) => `
            <div class="permission-row">
              <span>${esc(PERMISSION_KIND_LABELS[kind] || kind)}</span>
              <select data-perm-origin="${esc(origin)}" data-perm-kind="${kind}">
                <option value="ask" ${value === 'ask' ? 'selected' : ''}>Preguntar</option>
                <option value="allow" ${value === 'allow' ? 'selected' : ''}>Permitir</option>
                <option value="block" ${value === 'block' ? 'selected' : ''}>Bloquear</option>
              </select>
            </div>`).join('')}
        </div>`).join('')
      : emptyState('No has definido permisos', 'Los permisos que concedas o bloquees a los sitios (cámara, micrófono, ubicación, notificaciones…) aparecerán aquí.');
  } else if (view === 'downloads') {
    html = state.data.downloads.length ? `<div class="library-list">${state.data.downloads.map((item) => libraryItem({ title: item.name, path: item.path }, view, `<span class="download-state ${item.state === 'completed' ? 'complete' : ''}">${item.state === 'completed' ? 'Completada' : esc(item.state)}</span>`)).join('')}</div>` : emptyState('No hay descargas recientes', 'Las descargas aparecerán aquí mientras usas Calvito.');
  }
  refs.libraryContent.innerHTML = html;
  refs.libraryContent.querySelector('#local-notes')?.addEventListener('input', event => { state.data.notes = event.target.value; persist(); });
  const historySearch = refs.libraryContent.querySelector('#history-search');
  if (historySearch) {
    historySearch.addEventListener('input', () => {
      state.historyFilter = historySearch.value;
      const caret = historySearch.selectionStart;
      renderLibrary();
      const refreshed = refs.libraryContent.querySelector('#history-search');
      refreshed?.focus();
      refreshed?.setSelectionRange(caret, caret);
    });
  }
  refs.libraryContent.querySelectorAll('[data-open-url]').forEach((row) => row.addEventListener('click', (event) => {
    if (event.target.closest('[data-remove]')) return;
    const url = row.dataset.openUrl;
    if (!url) return;
    refs.libraryModal.hidden = true;
    if (view === 'downloads') calvito.openDownloadFolder(url);
    else navigate(getActiveTab(), url);
  }));
  refs.libraryContent.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    const key = button.dataset.remove;
    if (view === 'bookmarks') state.data.bookmarks = state.data.bookmarks.filter((item) => item.url !== key);
    if (view === 'history') state.data.history = state.data.history.filter((item) => item.url !== key);
    if (view === 'downloads') state.data.downloads = state.data.downloads.filter((item) => item.path !== key);
    persist();
    renderLibrary();
    updatePageControls();
  }));
  refs.libraryContent.querySelectorAll('[data-activate-tab]').forEach((row) => row.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-tab]')) return;
    activateTab(row.dataset.activateTab);
    refs.libraryModal.hidden = true;
  }));
  refs.libraryContent.querySelectorAll('[data-close-tab]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    closeTab(button.dataset.closeTab);
    renderLibrary();
  }));
  refs.libraryContent.querySelector('[data-clear-history]')?.addEventListener('click', () => {
    state.data.history = [];
    persist();
    renderLibrary();
    toast('Historial eliminado.');
  });
  refs.libraryContent.querySelectorAll('[data-remove-domain]').forEach((button) => button.addEventListener('click', async (event) => {
    event.stopPropagation();
    await calvito.clearSiteData(button.dataset.removeDomain);
    toast('Datos del sitio eliminados.');
    renderLibrary();
  }));
  refs.libraryContent.querySelector('[data-clear-sitedata-all]')?.addEventListener('click', async () => {
    await calvito.clearAllSiteData();
    toast('Todos los datos del sitio fueron eliminados.');
    renderLibrary();
  });
  refs.libraryContent.querySelectorAll('[data-perm-origin]').forEach((select) => select.addEventListener('change', async () => {
    await calvito.setPermission({ origin: select.dataset.permOrigin, kind: select.dataset.permKind, value: select.value });
    toast('Permiso actualizado.');
  }));
  refs.libraryContent.querySelector('[data-clear-permissions-all]')?.addEventListener('click', async () => {
    await calvito.clearAllPermissions();
    toast('Permisos restablecidos.');
    renderLibrary();
  });
}

function renderShieldPanel() {
  const tab = getActiveTab();
  const origin = tab?.url ? originOf(tab.url) : '';
  const site = (origin && state.adStats.perSite[origin]) || { ads: 0, trackers: 0, scripts: 0 };
  const global = state.adStats.global || { ads: 0, trackers: 0, scripts: 0 };
  const whitelisted = Boolean(origin && state.data.adWhitelist?.includes(origin));
  refs.shieldPanel.innerHTML = `
    <div class="shield-head">${state.data.preferences.protectionEnabled ? 'Protección activa' : 'Protección desactivada'}</div>
    ${origin ? `<div class="shield-site">${esc(origin)}${whitelisted ? ' · permitido' : ''}</div>` : '<div class="shield-site">Sin sitio activo</div>'}
    <div class="shield-row"><span>Anuncios bloqueados</span><strong>${site.ads}</strong></div>
    <div class="shield-row"><span>Rastreadores bloqueados</span><strong>${site.trackers}</strong></div>
    <div class="shield-row"><span>Scripts bloqueados</span><strong>${site.scripts}</strong></div>
    <div class="shield-row muted"><span>Total global (esta sesión)</span><strong>${global.ads + global.trackers + global.scripts}</strong></div>
    <div class="tab-menu-sep"></div>
    ${origin ? `<button id="shield-whitelist-toggle">${whitelisted ? 'Reactivar protección en este sitio' : 'Permitir anuncios en este sitio'}</button>` : ''}
    <button id="shield-toggle-global">${state.data.preferences.protectionEnabled ? 'Desactivar protección global' : 'Activar protección global'}</button>
  `;
  refs.shieldPanel.querySelector('#shield-whitelist-toggle')?.addEventListener('click', () => toggleSiteWhitelist(origin));
  refs.shieldPanel.querySelector('#shield-toggle-global')?.addEventListener('click', () => {
    updatePreferences({ protectionEnabled: !state.data.preferences.protectionEnabled });
    renderShieldPanel();
  });
}

async function toggleSiteWhitelist(origin) {
  if (!origin) return;
  const listed = state.data.adWhitelist?.includes(origin);
  const updated = listed ? await calvito.removeFromAdWhitelist(origin) : await calvito.addToAdWhitelist(origin);
  state.data.adWhitelist = updated;
  persist();
  renderShieldPanel();
  toast(listed ? 'Protección reactivada para este sitio.' : 'Anuncios permitidos en este sitio.');
}

function toggleShieldPanel() {
  const opening = refs.shieldPanel.hidden;
  closeAllPopovers();
  if (!opening) return;
  renderShieldPanel();
  refs.shieldPanel.hidden = false;
}

function renderPopupList() {
  const tab = getActiveTab();
  const items = tab?.blockedPopups || [];
  refs.popupList.innerHTML = items.length
    ? items.map((item, index) => `
      <div class="popup-list-row">
        <span class="popup-list-url" title="${esc(item.url)}">${esc(item.url)}</span>
        <button data-open-popup="${index}">Abrir</button>
        ${tab.private ? '' : `<button data-allow-popup-origin="${esc(item.origin)}">Permitir siempre</button>`}
      </div>`).join('') + `<button id="clear-popups" class="text-button">Descartar todo</button>`
    : `<div class="popup-list-empty">No hay ventanas emergentes bloqueadas.</div>`;
  refs.popupList.querySelectorAll('[data-open-popup]').forEach((button) => button.addEventListener('click', () => {
    const item = items[Number(button.dataset.openPopup)];
    if (item) createTab({ url: item.url, private: Boolean(tab.private) });
  }));
  refs.popupList.querySelectorAll('[data-allow-popup-origin]').forEach((button) => button.addEventListener('click', async () => {
    await calvito.setPermission({ origin: button.dataset.allowPopupOrigin, kind: 'popups', value: 'allow' });
    toast('Ventanas emergentes permitidas en este sitio.');
  }));
  refs.popupList.querySelector('#clear-popups')?.addEventListener('click', () => {
    const activeTab = getActiveTab();
    if (activeTab) activeTab.blockedPopups = [];
    updatePopupIndicator();
    closeAllPopovers();
  });
}

function togglePopupList() {
  const opening = refs.popupList.hidden;
  closeAllPopovers();
  if (!opening) return;
  renderPopupList();
  refs.popupList.hidden = false;
}

function showPermissionBanner({ requestId, origin, kind }) {
  refs.permissionTitle.textContent = `Un sitio quiere ${PERMISSION_LABELS[kind] || 'un permiso'}`;
  refs.permissionOrigin.textContent = origin || 'Sitio desconocido';
  refs.permissionRemember.checked = false;
  refs.permissionBanner.dataset.requestId = requestId;
  refs.permissionBanner.dataset.origin = origin;
  refs.permissionBanner.dataset.kind = kind;
  refs.permissionBanner.hidden = false;
}

function resolvePermission(allow) {
  const { requestId, origin, kind } = refs.permissionBanner.dataset;
  calvito.respondToPermission({ requestId, allow, remember: refs.permissionRemember.checked, origin, kind });
  refs.permissionBanner.hidden = true;
}

function closeAllPopovers() {
  refs.shieldPanel.hidden = true;
  refs.popupList.hidden = true;
  refs.profileMenu.hidden = true;
}

function profileMeta(profileId) {
  return state.profiles.find((profile) => profile.id === profileId);
}

function updateProfileButton() {
  refs.profileAvatar.textContent = state.guestMode ? '🕶️' : (profileMeta(state.activeProfileId)?.emoji || '🙂');
  refs.profileButton.title = state.guestMode ? 'Modo invitado' : `Perfil: ${profileMeta(state.activeProfileId)?.name || 'Personal'}`;
}

function newProfileFormHtml() {
  return `
    <div class="tab-menu-form">
      <input id="new-profile-name" placeholder="Nombre del perfil" autocomplete="off" />
      <div class="tab-menu-colors">
        ${PROFILE_COLORS.map((color) => `<button type="button" class="color-swatch" data-color="${color}" style="background:var(--group-${color})"></button>`).join('')}
      </div>
      <button id="create-profile" class="tab-menu-primary">Crear perfil</button>
    </div>
  `;
}

function renderProfileMenu() {
  const menu = refs.profileMenu;
  menu.innerHTML = `
    ${state.profiles.map((profile) => `
      <button data-switch-profile="${profile.id}" class="${!state.guestMode && profile.id === state.activeProfileId ? 'active' : ''}">
        <span class="tab-menu-dot" style="background:var(--group-${profile.color})"></span>${esc(profile.emoji)} ${esc(profile.name)}
        ${!state.guestMode && profile.id === state.activeProfileId ? '<span class="profile-current">Actual</span>' : ''}
      </button>
    `).join('')}
    <div class="tab-menu-sep"></div>
    <button data-start-guest class="${state.guestMode ? 'active' : ''}">🕶️ Modo invitado${state.guestMode ? ' (activo)' : ''}</button>
    <div class="tab-menu-sep"></div>
    <button data-new-profile>+ Nuevo perfil</button>
  `;
  menu.querySelectorAll('[data-switch-profile]').forEach((button) => button.addEventListener('click', () => {
    closeAllPopovers();
    switchToProfile(button.dataset.switchProfile);
  }));
  menu.querySelector('[data-start-guest]')?.addEventListener('click', () => {
    closeAllPopovers();
    startGuestMode();
  });
  menu.querySelector('[data-new-profile]')?.addEventListener('click', () => {
    let pendingColor = PROFILE_COLORS[0];
    menu.innerHTML = newProfileFormHtml();
    menu.querySelector('#new-profile-name')?.focus();
    menu.querySelectorAll('.color-swatch').forEach((swatch) => swatch.addEventListener('click', () => {
      pendingColor = swatch.dataset.color;
      menu.querySelectorAll('.color-swatch').forEach((item) => item.classList.toggle('selected', item === swatch));
    }));
    menu.querySelector('#create-profile')?.addEventListener('click', async () => {
      const name = menu.querySelector('#new-profile-name').value.trim();
      const profiles = await calvito.createProfile({ name: name || 'Perfil', emoji: '👤', color: pendingColor });
      state.profiles = profiles;
      closeAllPopovers();
      toast('Perfil creado.');
    });
  });
}

function toggleProfileMenu() {
  const opening = refs.profileMenu.hidden;
  closeAllPopovers();
  if (!opening) return;
  renderProfileMenu();
  refs.profileMenu.hidden = false;
}

function detachWebview(tab) {
  const view = tab.webview;
  tab.webview = null;
  if (!view) return;
  let guestId;
  try { guestId = view.getWebContentsId(); } catch { /* not attached yet */ }
  // Electron 44's disconnectedCallback may detach an already-destroyed guest.
  // Handle only that synchronous lifecycle race, never page or application errors.
  const alreadyDetached = event => {
    if (guestId && event.message === `Uncaught Error: Invalid guestInstanceId: ${guestId}` && event.error?.stack?.includes('disconnectedCallback')) event.preventDefault();
  };
  window.addEventListener('error', alreadyDetached);
  try { view.remove(); } finally { window.removeEventListener('error', alreadyDetached); }
}

function teardownAllTabs() {
  state.tabs.forEach((tab) => { detachWebview(tab); tab.pane?.remove(); });
  state.tabs = [];
  state.activeId = null;
  state.closedStack = [];
}

function loadTabsFromProfileData() {
  const restore = state.data.preferences.restoreSession && !state.guestMode && Array.isArray(state.data.session?.tabs) ? state.data.session.tabs.slice(0, 20) : [];
  if (restore.length) {
    restore.forEach((savedTab) => createTab({ ...savedTab, activate: false, restoring: Boolean(savedTab.url) }));
    const target = state.tabs[Math.min(state.data.session.activeIndex || 0, state.tabs.length - 1)];
    if (target) activateTab(target.id);
  } else {
    createTab();
  }
}

function applyProfileSwitchResult(result, activeId, guest) {
  teardownAllTabs();
  state.partition = result.partition;
  state.guestMode = guest;
  state.activeProfileId = activeId;
  state.data = {
    ...state.data,
    ...result.data,
    preferences: { ...state.data.preferences, ...(result.data.preferences || {}) },
    permissions: result.data.permissions || {},
    adWhitelist: result.data.adWhitelist || []
  };
  applyAppearance();
  renderBookmarkBar();
  loadTabsFromProfileData();
  updatePageControls();
  updateProfileButton();
}

async function switchToProfile(profileId) {
  if (!state.guestMode && profileId === state.activeProfileId) return;
  await persist();
  teardownAllTabs();
  const result = await calvito.switchProfile(profileId);
  applyProfileSwitchResult(result, profileId, false);
  toast(`Perfil cambiado a ${profileMeta(profileId)?.name || 'Personal'}.`);
}

async function startGuestMode() {
  await persist();
  teardownAllTabs();
  const result = await calvito.startGuestProfile();
  applyProfileSwitchResult(result, 'guest', true);
  toast('Modo invitado activado: nada se guardará al salir.');
}


function showSettings() {
  refs.protectionToggle.checked = state.data.preferences.protectionEnabled;
  refs.searchEngine.value = state.data.preferences.searchEngine;
  refs.themeSelect.value = state.data.preferences.theme;
  refs.restoreSessionToggle.checked = state.data.preferences.restoreSession;
  refs.bookmarkBarToggle.checked = state.data.preferences.showBookmarkBar;
  refs.settingsModal.hidden = false;
  syncExtraSettings();
}

function updatePreferences(next) {
  state.data.preferences = { ...state.data.preferences, ...next };
  applyAppearance();
  calvito.setPreferences(state.data.preferences);
  persist();
  updatePageControls();
  renderBookmarkBar();
}

function handleCommand(command) {
  const tab = getActiveTab();
  if (command === 'new-tab') createTab();
  if (command === 'new-private-tab') createTab({ private: true });
  if (command === 'close-tab' && tab) closeTab(tab.id);
  if (command === 'back') tab?.webview?.canGoBack() && tab.webview.goBack();
  if (command === 'forward') tab?.webview?.canGoForward() && tab.webview.goForward();
  if (command === 'reload') tab?.webview?.reload();
  if (command === 'home') goHome();
  if (command === 'bookmark') toggleBookmark();
  if (command === 'bookmarks') showLibrary('bookmarks');
  if (command === 'history') showLibrary('history');
  if (command === 'downloads') showLibrary('downloads');
  if (command === 'find') startFind();
  if (command === 'zoom-in') changeZoom(.1);
  if (command === 'zoom-out') changeZoom(-.1);
  if (command === 'zoom-reset') resetZoom();
  if (command === 'about') calvito.showAbout();
  if (command === 'reopen-tab') reopenClosedTab();
  if (command === 'address') { refs.address.focus(); refs.address.select(); }
  if (command === 'commands') openPalette();
  if (command === 'focus') toggleFocus();
}

function wireUI() {
  $('#new-tab').addEventListener('click', () => createTab());
  refs.back.addEventListener('click', () => handleCommand('back'));
  refs.forward.addEventListener('click', () => handleCommand('forward'));
  refs.reload.addEventListener('click', () => handleCommand('reload'));
  refs.home.addEventListener('click', goHome);
  refs.star.addEventListener('click', toggleBookmark);
  refs.shield.addEventListener('click', (event) => { event.stopPropagation(); toggleShieldPanel(); });
  refs.profileButton.addEventListener('click', (event) => { event.stopPropagation(); toggleProfileMenu(); });
  refs.popupIndicator.addEventListener('click', (event) => { event.stopPropagation(); togglePopupList(); });
  refs.permissionAllow.addEventListener('click', () => resolvePermission(true));
  refs.permissionBlock.addEventListener('click', () => resolvePermission(false));
  $('#library').addEventListener('click', () => showLibrary());
  refs.pageMenuButton.addEventListener('click', (event) => { event.stopPropagation(); togglePageMenu(); });
  $('#settings').addEventListener('click', showSettings);
  refs.addressForm.addEventListener('submit', (event) => {
    event.preventDefault();
    refs.suggestions.hidden = true;
    navigate(getActiveTab(), refs.address.value);
  });
  refs.address.addEventListener('input', renderSuggestions);
  refs.address.addEventListener('focus', renderSuggestions);
  refs.address.addEventListener('blur', () => window.setTimeout(() => { refs.suggestions.hidden = true; }, 140));
  $('#clear-address').addEventListener('click', () => { refs.address.value = ''; refs.address.focus(); refs.suggestions.hidden = true; });
  document.querySelectorAll('[data-close-modal]').forEach((node) => node.addEventListener('click', () => { refs.libraryModal.hidden = true; }));
  document.querySelectorAll('[data-close-settings]').forEach((node) => node.addEventListener('click', () => { refs.settingsModal.hidden = true; }));
  document.querySelectorAll('.library-tab').forEach((node) => node.addEventListener('click', () => showLibrary(node.dataset.libraryView)));
  refs.protectionToggle.addEventListener('change', () => updatePreferences({ protectionEnabled: refs.protectionToggle.checked }));
  refs.searchEngine.addEventListener('change', () => updatePreferences({ searchEngine: refs.searchEngine.value }));
  refs.themeSelect.addEventListener('change', () => updatePreferences({ theme: refs.themeSelect.value }));
  refs.restoreSessionToggle.addEventListener('change', () => updatePreferences({ restoreSession: refs.restoreSessionToggle.checked }));
  refs.bookmarkBarToggle.addEventListener('change', () => updatePreferences({ showBookmarkBar: refs.bookmarkBarToggle.checked }));
  refs.findInput.addEventListener('input', () => findInPage(true, false));
  refs.findInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); findInPage(!event.shiftKey, true); }
    if (event.key === 'Escape') { event.preventDefault(); closeFind(); }
  });
  $('#find-previous').addEventListener('click', () => findInPage(false, true));
  $('#find-next').addEventListener('click', () => findInPage(true, true));
  $('#find-close').addEventListener('click', closeFind);
  document.querySelectorAll('[data-page-action]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.pageAction;
    if (action === 'pin') togglePin();
    if (action === 'duplicate') duplicateTab();
    if (action === 'mute') toggleMute();
    if (action === 'zoom-in') changeZoom(.1);
    if (action === 'zoom-out') changeZoom(-.1);
    if (action === 'zoom-reset') resetZoom();
    if (action === 'find') startFind();
    if (action === 'pdf') savePagePDF();
    if (action === 'focus') toggleFocus();
    if (action === 'external') {
      const tab = getActiveTab();
      if (tab?.url) calvito.openExternal(tab.url);
      else toast('Abre una página antes de enviarla al navegador predeterminado.');
      refs.pageMenu.hidden = true;
    }
  }));
  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (event.ctrlKey && key === 'l') { event.preventDefault(); refs.address.focus(); refs.address.select(); }
    if (event.ctrlKey && !event.shiftKey && key === 't') { event.preventDefault(); createTab(); }
    if (event.ctrlKey && event.shiftKey && key === 'p') { event.preventDefault(); createTab({ private: true }); }
    if (event.ctrlKey && event.shiftKey && key === 't') { event.preventDefault(); reopenClosedTab(); }
    if (event.ctrlKey && key === 'w') { event.preventDefault(); const tab = getActiveTab(); if (tab) closeTab(tab.id); }
    if (event.ctrlKey && key === 'd') { event.preventDefault(); toggleBookmark(); }
    if (event.ctrlKey && key === 'h') { event.preventDefault(); showLibrary('history'); }
    if (event.ctrlKey && key === 'j') { event.preventDefault(); showLibrary('downloads'); }
    if (event.ctrlKey && !event.shiftKey && key === 'f') { event.preventDefault(); startFind(); }
    if (event.ctrlKey && key === 'tab') {
      event.preventDefault();
      const current = state.tabs.findIndex((tab) => tab.id === state.activeId);
      const next = (current + (event.shiftKey ? -1 : 1) + state.tabs.length) % state.tabs.length;
      activateTab(state.tabs[next].id);
    }
    if (event.key === 'Escape') {
      refs.suggestions.hidden = true;
      refs.libraryModal.hidden = true;
      refs.settingsModal.hidden = true;
      refs.pageMenu.hidden = true;
      closeTabContextMenu();
      closeAllPopovers();
      if (!refs.findBar.hidden) closeFind();
    }
  });
  document.addEventListener('click', (event) => {
    if (!refs.pageMenu.hidden && !refs.pageMenu.contains(event.target) && event.target !== refs.pageMenuButton) refs.pageMenu.hidden = true;
    if (!refs.tabContextMenu.hidden && !refs.tabContextMenu.contains(event.target)) closeTabContextMenu();
    if (!refs.shieldPanel.hidden && !refs.shieldPanel.contains(event.target) && event.target !== refs.shield) refs.shieldPanel.hidden = true;
    if (!refs.popupList.hidden && !refs.popupList.contains(event.target) && event.target !== refs.popupIndicator) refs.popupList.hidden = true;
    if (!refs.profileMenu.hidden && !refs.profileMenu.contains(event.target) && event.target !== refs.profileButton) refs.profileMenu.hidden = true;
  });
}

async function boot() {
  try {
    const saved = await calvito.loadData();
    state.data = {
      ...state.data,
      ...saved,
      session: { ...state.data.session, ...(saved.session || {}) },
      preferences: { ...state.data.preferences, ...(saved.preferences || {}) },
      permissions: saved.permissions || {},
      adWhitelist: saved.adWhitelist || []
    };
    const context = await calvito.profilesContext();
    state.profiles = context.profiles;
    state.activeProfileId = context.activeProfileId;
    state.guestMode = context.guestMode;
    state.partition = context.partition;
    state.adStats = await calvito.getAdStats();
  } catch {
    toast('Calvito inició sin datos locales previos.');
  }
  applyAppearance();
  wireUI();
  wireFeatures();
  renderBookmarkBar();
  updateProfileButton();
  loadTabsFromProfileData();
  updatePageControls();
  calvito.onBrowserCommand(handleCommand);
  calvito.onOpenUrlInTab((info) => createTab(info));
  calvito.onPermissionRequest(showPermissionBanner);
  calvito.onPopupBlocked(({ webContentsId, url, origin }) => {
    const tab = state.tabs.find((item) => {
      try { return item.webview && item.webview.getWebContentsId() === webContentsId; } catch { return false; }
    });
    if (!tab) return;
    tab.blockedPopups = tab.blockedPopups || [];
    tab.blockedPopups.push({ url, origin });
    if (tab.id === state.activeId) updatePopupIndicator();
  });
  calvito.onAdStatsUpdated(({ origin, site, global }) => {
    state.adStats.global = global;
    state.adStats.perSite[origin] = site;
    document.querySelectorAll('.blocked-total').forEach(node => { node.textContent = Object.values(global).reduce((a, b) => a + b, 0); });
    const tab = getActiveTab();
    if (tab?.url && originOf(tab.url) === origin && !refs.shieldPanel.hidden) renderShieldPanel();
  });
  calvito.onDownloadStarted((download) => {
    if (download.private || download.profileId !== state.activeProfileId) { toast(`Descarga privada: ${download.name}`); return; }
    state.data.downloads = state.data.downloads.filter((item) => item.name !== download.name);
    state.data.downloads.unshift({ ...download, state: 'in-progress', path: '' });
    persist();
    toast(`Descargando ${download.name}…`);
  });
  calvito.onDownloadFinished((download) => {
    if (download.private || download.profileId !== state.activeProfileId) { toast(`Descarga ${download.state === 'completed' ? 'terminada' : 'interrumpida'}: ${download.name}`); return; }
    const item = state.data.downloads.find((entry) => entry.id === download.id);
    if (item) Object.assign(item, download);
    else state.data.downloads.unshift(download);
    persist();
    if (download.state === 'completed') toast(`Descarga terminada: ${download.name}`);
    else toast(`La descarga no se completó: ${download.name}`);
    if (!refs.libraryModal.hidden && state.libraryView === 'downloads') renderLibrary();
  });
}

boot();

setInterval(() => {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hour = now.getHours();
  let greeting = 'Buenas noches';
  if (hour >= 6 && hour < 12) greeting = 'Buenos días';
  else if (hour >= 12 && hour < 19) greeting = 'Buenas tardes';

  document.querySelectorAll('.live-clock').forEach(el => {
    if (el.textContent !== time) el.textContent = time;
  });
  document.querySelectorAll('.live-greeting').forEach(el => {
    const text = greeting + '.';
    if (el.textContent !== text) el.textContent = text;
  });
}, 1000);
