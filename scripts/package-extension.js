import { copyFile, mkdir } from 'node:fs/promises';
await mkdir('dist-extension', { recursive: true });
for (const file of ['manifest.json', 'popup.html', 'popup.js', 'background.js', 'prep-bridge.js', 'offscreen.html', 'library.html', 'library.js']) await copyFile(`extension/${file}`, `dist-extension/${file}`);
console.log('Load the dist-extension folder as an unpacked extension in Chrome, Edge, or Brave.');

await mkdir("dist-extension/sounds", { recursive: true });
for (const file of ["cheer1.mp3", "cheer2.mp3", "boo1.mp3", "boo2.mp3"]) await copyFile(`public/sounds/${file}`, `dist-extension/sounds/${file}`);

await mkdir("dist-extension/fonts", { recursive: true });
for (const file of ["Nightmare_Hero_Normal.ttf", "SOURCE.txt"]) await copyFile(`public/fonts/${file}`, `dist-extension/fonts/${file}`);
