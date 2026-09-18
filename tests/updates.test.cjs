const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { setupUpdates } = require('../src/updates');
function fixture(options = {}) {
  const updater = new EventEmitter();
  let installed = 0, checked = 0, downloaded = 0;
  updater.checkForUpdates = async () => { checked++; updater.emit('checking-for-update'); updater.emit('update-available', { version: '1.2.0' }); };
  updater.downloadUpdate = async () => { downloaded++; updater.emit('download-progress', { percent: 50 }); updater.emit('update-downloaded', { version: '1.2.0' }); };
  updater.quitAndInstall = () => { installed++; };
  const controller = setupUpdates({ app: { isPackaged: true, getVersion: () => '1.1.0' }, autoUpdater: updater, broadcast: () => {}, portable: false, feedExists: true, ...options });
  return { controller, updater, counters: () => ({ installed, checked, downloaded }) };
}
test('update flow checks, downloads, and installs only in the correct state', async () => {
  const { controller, counters } = fixture();
  controller.install(); await controller.download();
  assert.equal(counters().installed, 0); assert.equal(counters().downloaded, 0);
  await controller.check(); assert.equal(controller.getState().status, 'available');
  await controller.download(); assert.equal(controller.getState().status, 'ready');
  await controller.check(); assert.equal(counters().checked, 1);
  controller.install(); assert.equal(counters().installed, 1);
});
test('portable and development builds do not contact an update feed', async () => {
  for (const options of [{ portable: true }, { feedExists: false }, { app: { isPackaged: false, getVersion: () => '1.1.0' } }]) {
    const { controller, counters } = fixture(options);
    await controller.check(); await controller.download(); controller.install();
    assert.equal(controller.getState().status, 'unavailable');
    assert.deepEqual(counters(), { installed: 0, checked: 0, downloaded: 0 });
  }
});
test('network failures return a recoverable state', async () => {
  const { controller, updater } = fixture();
  updater.checkForUpdates = async () => { throw new Error('offline'); };
  await controller.check(); assert.equal(controller.getState().status, 'error');
});
