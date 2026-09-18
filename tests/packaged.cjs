const { _electron: electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const yaml = require('js-yaml');
async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'calvito-packaged-'));
  const env = { ...process.env, CALVITO_TEST_PROFILE: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ executablePath: path.resolve('dist/win-unpacked/Calvito.exe'), args: [], env });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    await page.waitForSelector('.home-hero');
    const info = await page.evaluate(() => calvito.getUpdateState());
    assert.equal(info.version, require('../package.json').version);
    assert.equal(info.status, 'idle');
    assert.equal(await app.evaluate(({ app }) => app.isPackaged), true);
    const feed = yaml.load(await fs.readFile('dist/win-unpacked/resources/app-update.yml', 'utf8'));
    assert.equal(feed.owner, 'shodzery'); assert.equal(feed.repo, 'calvitobrowser');
    const latest = yaml.load(await fs.readFile('dist/latest.yml', 'utf8'));
    const installer = await fs.readFile(path.join('dist', latest.path));
    assert.equal(crypto.createHash('sha512').update(installer).digest('base64'), latest.sha512);
    assert.equal(installer.subarray(0, 2).toString(), 'MZ');
    console.log('Packaged EXE passed: launch, version, GitHub update feed, installer SHA-512 and PE signature.');
  } finally { await app.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
