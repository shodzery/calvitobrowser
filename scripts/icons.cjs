const fs = require('node:fs/promises');
const sharp = require('sharp');
async function main() {
  const source = 'src/renderer/assets/logo-original.png';
  await sharp(source).resize(512, 512).png().toFile('src/renderer/assets/icon.png');
  const png = await sharp(source).resize(256, 256).png().toBuffer();
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
  await fs.mkdir('build', { recursive: true });
  await fs.writeFile('build/icon.ico', Buffer.concat([header, png]));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
