const { existsSync } = require('node:fs');
const path = require('node:path');

// Updates are downloaded only after an explicit click, and never interrupt browsing.
function setupUpdates({ app, autoUpdater, broadcast, portable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR), feedExists = existsSync(path.join(process.resourcesPath || '', 'app-update.yml')) }) {
  const enabled = app.isPackaged && !portable && feedExists;
  let state = { status: enabled ? 'idle' : 'unavailable', version: app.getVersion(), progress: 0,
    message: !app.isPackaged ? 'Modo desarrollo. Las actualizaciones se prueban con la versión instalada.' : portable ? 'Edición portable: descarga una nueva versión desde GitHub.' : !feedExists ? 'Compilación local sin repositorio. La edición publicada en GitHub incluirá actualizaciones.' : 'Busca una nueva versión de Calvito.' };
  const update = patch => { state = { ...state, ...patch }; broadcast('updates:state', state); return state; };
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.on('checking-for-update', () => update({ status: 'checking', message: 'Consultando GitHub…' }));
  autoUpdater.on('update-available', info => update({ status: 'available', availableVersion: info.version, message: `Calvito ${info.version} está disponible.` }));
  autoUpdater.on('update-not-available', () => update({ status: 'current', message: 'Tienes la versión más reciente.' }));
  autoUpdater.on('download-progress', info => update({ status: 'downloading', progress: Math.round(info.percent), message: `Descargando actualización: ${Math.round(info.percent)} %` }));
  autoUpdater.on('update-downloaded', info => update({ status: 'ready', availableVersion: info.version, progress: 100, message: 'Actualización lista. Reinicia cuando quieras instalarla.' }));
  autoUpdater.on('error', () => update({ status: 'error', message: 'No se pudo obtener la actualización. Comprueba la conexión y que el repositorio tenga una versión publicada.' }));
  return {
    getState: () => ({ ...state }),
    async check() {
      if (!enabled || ['checking', 'downloading', 'ready'].includes(state.status)) return state;
      try { await autoUpdater.checkForUpdates(); } catch { update({ status: 'error', message: 'No se pudo consultar GitHub. Inténtalo de nuevo más tarde.' }); }
      return state;
    },
    async download() {
      if (!enabled || state.status !== 'available') return state;
      update({ status: 'downloading', progress: 0, message: 'Preparando descarga…' });
      try { await autoUpdater.downloadUpdate(); } catch { update({ status: 'error', message: 'La descarga falló. Vuelve a buscar actualizaciones para reintentar.' }); }
      return state;
    },
    install() { if (enabled && state.status === 'ready') autoUpdater.quitAndInstall(false, true); }
  };
}
module.exports = { setupUpdates };
