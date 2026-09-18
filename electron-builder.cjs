const { githubRepository } = require('./src/core');
const pkg = require('./package.json');
const repository = githubRepository(process.env.GITHUB_REPOSITORY || pkg.repository?.url);
if (!repository) throw new Error('Configura un repositorio GitHub válido para publicar Calvito.');
const [owner, repo] = repository.split('/');
module.exports = {
  appId: 'com.calvito.browser', productName: 'Calvito',
  directories: { output: 'dist', buildResources: 'build' },
  files: ['src/**/*', 'package.json', 'LICENSE', '!src/renderer/assets/logo-original.png'],
  asar: true,
  win: { icon: 'build/icon.ico', target: [{ target: 'nsis', arch: ['x64'] }, { target: 'portable', arch: ['x64'] }] },
  nsis: { artifactName: 'Calvito-Setup-${version}-${arch}.${ext}', oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true, createStartMenuShortcut: true, deleteAppDataOnUninstall: false, installerLanguages: ['es_ES', 'en_US'] },
  portable: { artifactName: 'Calvito-Portable-${version}-${arch}.${ext}' },
  publish: [{ provider: 'github', owner, repo, releaseType: 'release' }]
};
