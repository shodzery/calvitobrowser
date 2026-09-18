const { execFileSync } = require('node:child_process');
for (const file of ['src/main.js', 'src/preload.js', 'src/core.js', 'src/updates.js', 'src/renderer/app.js', 'src/renderer/features.js', 'electron-builder.cjs']) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
console.log('Syntax checks passed.');
