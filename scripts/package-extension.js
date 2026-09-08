import { copyFile, mkdir } from 'node:fs/promises';
await mkdir('dist-extension', { recursive: true });
for (const file of ['manifest.json', 'popup.html', 'popup.js']) await copyFile(`extension/${file}`, `dist-extension/${file}`);
console.log('Load the dist-extension folder as an unpacked extension in Chrome, Edge, or Brave.');

await mkdir("dist-extension/sounds", { recursive: true });
for (const file of ["cheer1.mp3", "cheer2.mp3", "boo1.mp3", "boo2.mp3"]) await copyFile(`public/sounds/${file}`, `dist-extension/sounds/${file}`);
