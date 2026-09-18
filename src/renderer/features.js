/* global calvito, state, $, refs, esc, toast, getActiveTab, createTab, navigate,
   showLibrary, showSettings, handleCommand, updatePreferences, renderBookmarkBar, persist */
let paletteItems = [];
let paletteIndex = 0;
let previousFocus = null;
const systemTheme = matchMedia('(prefers-color-scheme: light)');

function applyAppearance() {
  const prefs = state.data.preferences;
  document.documentElement.dataset.theme = prefs.theme === 'system' ? (systemTheme.matches ? 'light' : 'dark') : prefs.theme;
  document.documentElement.dataset.accent = prefs.accent || 'mint';
  document.documentElement.dataset.motion = prefs.reduceMotion ? 'reduced' : 'full';
}
systemTheme.addEventListener('change', () => applyAppearance());

function syncExtraSettings() {
  $('#accent-select').value = state.data.preferences.accent || 'mint';
  $('#motion-toggle').checked = Boolean(state.data.preferences.reduceMotion);
  $('#updates-toggle').checked = state.data.preferences.autoCheckUpdates !== false;
  calvito.getUpdateState().then(renderUpdateState);
}

function renderUpdateState(info) {
  $('#app-version').textContent = info.version;
  $('#update-message').textContent = info.message;
  $('#update-progress').hidden = info.status !== 'downloading';
  $('#update-progress').value = info.progress;
  $('#check-updates').disabled = ['checking', 'downloading', 'ready', 'unavailable'].includes(info.status);
  $('#download-update').hidden = info.status !== 'available';
  $('#install-update').hidden = info.status !== 'ready';
  $('#settings').classList.toggle('has-update', ['available', 'ready'].includes(info.status));
}

function commandEntries() {
  return [
    ['Nueva pestaña', 'Ctrl+T', () => createTab()],
    ['Nueva pestaña privada', 'Ctrl+Shift+P', () => createTab({ private: true })],
    ['Marcadores', 'Ctrl+D para guardar', () => showLibrary('bookmarks')],
    ['Historial', 'Ctrl+H', () => showLibrary('history')],
    ['Descargas', 'Ctrl+J', () => showLibrary('downloads')],
    ['Notas locales', 'Tu bloc de ideas', () => showLibrary('notes')],
    ['Modo enfoque', 'Ctrl+Shift+F', () => toggleFocus()],
    ['Reabrir pestaña cerrada', 'Ctrl+Shift+T', () => handleCommand('reopen-tab')],
    ['Guardar página como PDF', 'Exportar página', () => savePagePDF()],
    ['Ajustes y actualizaciones', 'Personaliza Calvito', () => showSettings()],
    ...state.tabs.map(tab => [tab.title, tab.private ? 'Cambiar a pestaña privada' : 'Cambiar a pestaña', () => activateTab(tab.id)])
  ].map(([label, hint, run]) => ({ label, hint, run }));
}

function openPalette() {
  previousFocus = document.activeElement;
  $('#command-palette').hidden = false;
  $('#palette-input').value = '';
  renderPalette();
  $('#palette-input').focus();
}
function closePalette() {
  $('#command-palette').hidden = true;
  if (previousFocus?.isConnected) previousFocus.focus();
}
function renderPalette() {
  const query = $('#palette-input').value.trim().toLowerCase();
  paletteItems = commandEntries().filter(item => `${item.label} ${item.hint}`.toLowerCase().includes(query)).slice(0, 9);
  if (query) paletteItems.push({ label: `Buscar «${$('#palette-input').value.trim()}»`, hint: 'En tu buscador', run: () => navigate(getActiveTab(), query) });
  paletteIndex = 0;
  $('#palette-results').innerHTML = paletteItems.map((item, index) => `<button id="command-${index}" role="option" aria-selected="${index === 0}" data-command="${index}"><span>${esc(item.label)}</span><small>${esc(item.hint)}</small></button>`).join('');
  $('#palette-results').querySelectorAll('button').forEach(button => button.addEventListener('click', () => runPaletteItem(Number(button.dataset.command))));
  markPaletteItem();
}
function markPaletteItem() {
  $('#palette-results').querySelectorAll('button').forEach((button, index) => { button.classList.toggle('selected', index === paletteIndex); button.setAttribute('aria-selected', String(index === paletteIndex)); });
  $('#palette-input').setAttribute('aria-activedescendant', `command-${paletteIndex}`);
  $(`#command-${paletteIndex}`)?.scrollIntoView({ block: 'nearest' });
}
function runPaletteItem(index) { const item = paletteItems[index]; closePalette(); item?.run(); }

function toggleFocus() {
  const active = document.body.classList.toggle('focus-mode');
  $('#focus-exit').hidden = !active;
  refs.pageMenu.hidden = true;
}

async function savePagePDF() {
  const tab = getActiveTab();
  refs.pageMenu.hidden = true;
  if (!tab?.webview || !tab.url) return toast('Abre una página para guardarla como PDF.');
  try { if (await calvito.savePDF(tab.webview.getWebContentsId())) toast('PDF guardado.'); }
  catch { toast('No se pudo guardar el PDF. Espera a que la página termine de cargar.'); }
}

function showPageError(tab, url) {
  tab.pane.querySelector('.page-error')?.remove();
  const panel = document.createElement('section');
  panel.className = 'page-error';
  panel.innerHTML = `<span class="eyebrow">VOLVAMOS A INTENTARLO</span><h1>No pudimos abrir esta página.</h1><p></p><span>Comprueba tu conexión y la dirección. Calvito mantiene las comprobaciones de seguridad activas.</span><button class="text-button">Reintentar</button>`;
  panel.querySelector('p').textContent = url;
  panel.querySelector('button').addEventListener('click', () => navigate(tab, tab.url));
  tab.pane.append(panel);
}

function wireFeatures() {
  $('#command-button').addEventListener('click', openPalette);
  $('[data-close-palette]').addEventListener('click', closePalette);
  $('#focus-exit').addEventListener('click', toggleFocus);
  $('#palette-input').addEventListener('input', renderPalette);
  $('#palette-input').addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); paletteIndex = (paletteIndex + (event.key === 'ArrowDown' ? 1 : -1) + paletteItems.length) % paletteItems.length; markPaletteItem(); }
    if (event.key === 'Enter') { event.preventDefault(); runPaletteItem(paletteIndex); }
  });
  document.addEventListener('keydown', event => {
    if (event.ctrlKey && event.key.toLowerCase() === 'k') { event.preventDefault(); openPalette(); }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); toggleFocus(); }
    if (event.key === 'Escape') { if (!$('#command-palette').hidden) closePalette(); if (document.body.classList.contains('focus-mode')) toggleFocus(); }
    if (event.key === 'Tab') {
      const modal = ['#command-palette', '#settings-modal', '#library-sidebar'].map(selector => $(selector)).find(node => !node.hidden);
      if (!modal) return;
      const focusable = [...modal.querySelectorAll('button, input, select, textarea')].filter(node => !node.disabled && node.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    }
  });
  $('#accent-select').addEventListener('change', event => updatePreferences({ accent: event.target.value }));
  $('#motion-toggle').addEventListener('change', event => updatePreferences({ reduceMotion: event.target.checked }));
  $('#updates-toggle').addEventListener('change', event => updatePreferences({ autoCheckUpdates: event.target.checked }));
  $('#check-updates').addEventListener('click', () => calvito.checkUpdates().then(renderUpdateState));
  $('#download-update').addEventListener('click', () => calvito.downloadUpdate().then(renderUpdateState));
  $('#install-update').addEventListener('click', async () => { await persist(); await calvito.installUpdate(); });
  $('#source-code').addEventListener('click', () => calvito.openExternal('https://github.com/shodzery/calvitobrowser'));
  calvito.onUpdateState(renderUpdateState);
  calvito.onPermissionsCancelled(() => { refs.permissionBanner.hidden = true; });
  calvito.onPermissionExpired(requestId => { if (refs.permissionBanner.dataset.requestId === requestId) refs.permissionBanner.hidden = true; });
  $('#export-bookmarks').addEventListener('click', async () => {
    try { if (await calvito.exportBookmarks(state.data.bookmarks)) toast('Marcadores exportados.'); } catch { toast('No se pudo exportar el archivo.'); }
  });
  $('#import-bookmarks').addEventListener('click', async () => {
    try {
      const imported = await calvito.importBookmarks();
      if (!imported) return;
      state.data.bookmarks = [...new Map([...state.data.bookmarks, ...imported].map(item => [item.url, item])).values()];
      await persist(); renderBookmarkBar(); toast(`${imported.length} marcadores leídos.`);
    } catch { toast('Elige un archivo JSON de marcadores válido de Calvito.'); }
  });
}
