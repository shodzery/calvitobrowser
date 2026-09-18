const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'calvito-smoke-'));
  const server = http.createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<title>Calvito test page</title><h1>Navigation works</h1><script>document.body.dataset.node = typeof require; localStorage.setItem("test", "normal")</script>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const environment = { ...process.env, CALVITO_TEST_PROFILE: profile };
  delete environment.ELECTRON_RUN_AS_NODE;
  let app;
  const errors = [];
  try {
    app = await electron.launch({ args: ['.'], env: environment, timeout: 30000 });
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.stack));
    await page.waitForSelector('.home-hero');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
    await page.locator('[data-home-action="notes"]').dispatchEvent('click');
    await page.locator('#local-notes').fill('A persistent Calvito idea');
    await page.keyboard.press('Escape');
    await page.locator('#command-button').dispatchEvent('click');
    await page.locator('#palette-input').fill('privada');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.tab-private');
    assert.equal(await page.evaluate(() => state.tabs.length), 2);
    await page.keyboard.press('Control+w');
    await page.locator('#address').fill(url);
    await page.locator('#address').press('Enter');
    await page.waitForFunction(() => state.tabs.some(tab => tab.title === 'Calvito test page'), null, { polling: 100 });
    assert.equal(await page.evaluate(() => getActiveTab().webview.executeJavaScript('typeof require')), 'undefined');
    await page.evaluate(() => toggleBookmark());
    await page.evaluate(() => createTab({ private: true, url: getActiveTab().url }));
    await page.waitForFunction(() => getActiveTab().title === 'Calvito test page', null, { polling: 100 });
    assert.equal(await page.evaluate(() => getActiveTab().webview.executeJavaScript('typeof window.calvito')), 'undefined');
    const snapshot = await page.evaluate(() => snapshotSession());
    assert.equal(snapshot.tabs.length, 1);
    await page.evaluate(async () => {
      await persist();
      const profiles = await calvito.createProfile({ name: 'Work', color: 'blue', emoji: 'W' });
      state.profiles = profiles;
      await switchToProfile(profiles.at(-1).id);
    });
    assert.equal(await page.evaluate(() => state.data.notes), '');
    assert.equal(await page.evaluate(() => state.data.bookmarks.length), 0);
    await page.evaluate(() => switchToProfile('default'));
    assert.equal(await page.evaluate(() => state.data.notes), 'A persistent Calvito idea');
    assert.equal(await page.evaluate(() => state.data.bookmarks.length), 1);
    await page.evaluate(async () => {
      await calvito.setPermission({ origin: 'https://example.org', kind: 'notifications', value: 'block' });
      await persist();
    });
    assert.equal(await page.evaluate(async () => (await calvito.loadData()).permissions['https://example.org'].notifications), 'block');
    await page.evaluate(() => startGuestMode());
    const guestPartition = await page.evaluate(() => state.partition);
    await page.evaluate(() => switchToProfile('default'));
    await page.evaluate(() => startGuestMode());
    assert.notEqual(await page.evaluate(() => state.partition), guestPartition);
    await page.evaluate(() => switchToProfile('default'));
    const oldCount = await page.evaluate(() => state.tabs.length);
    await page.keyboard.press('Control+Shift+t');
    assert.equal(await page.evaluate(() => state.tabs.length), oldCount);
    await page.evaluate(() => goHome());
    assert.equal(await app.evaluate(({ webContents }) => webContents.getAllWebContents().filter(contents => contents.getType() === 'webview').length), 0);
    await page.locator('#settings').dispatchEvent('click');
    await page.locator('#theme-select').selectOption('light');
    await page.locator('#accent-select').selectOption('violet');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.keyboard.press('Escape');
    await page.evaluate(() => updatePreferences({ theme: 'dark', accent: 'mint' }));
    await page.evaluate(() => document.querySelector('.toast-stack')?.remove());
    await page.evaluate(() => { document.activeElement.blur(); state.data.bookmarks = []; renderBookmarkBar(); goHome(); document.activeElement.blur(); });
    await page.mouse.move(20, 900);
    await fs.mkdir('docs/screenshots', { recursive: true });
    await page.screenshot({ path: 'docs/screenshots/calvito-home.png' });
    await page.evaluate(() => showSettings());
    await page.locator('#update-message').waitFor();
    assert.match(await page.locator('#update-message').textContent(), /desarrollo/);
    await page.screenshot({ path: 'docs/screenshots/calvito-settings.png' });
    await page.evaluate(() => persist());
    assert.deepEqual(errors, []);
    console.log('Electron smoke passed: navigation, sandbox, commands, private tabs, notes, profiles, bookmarks, themes, updates.');
  } catch (error) {
    console.error('Renderer errors:', errors);
    if (app) await (await app.firstWindow()).screenshot({ path: 'docs/smoke-failure.png', timeout: 5000 }).catch(() => {});
    throw error;
  } finally {
    if (app) await app.close();
    server.close();
    // The temporary test profile is kept for diagnosis; real user data is never touched.
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
