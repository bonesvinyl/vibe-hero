import { copyFile, mkdir, readdir } from 'node:fs/promises';
await mkdir('dist-extension', { recursive: true });
for (const file of ['manifest.json', 'popup.html', 'popup.js', 'background.js', 'prep-bridge.js', 'offscreen.html', 'library.html', 'library.css']) await copyFile(`extension/${file}`, `dist-extension/${file}`);
console.log('Load the dist-extension folder as an unpacked extension in Chrome, Edge, or Brave.');

await mkdir("dist-extension/sounds", { recursive: true });
for (const file of (await readdir("public/sounds")).filter(file => /\.(mp3|json)$/.test(file))) await copyFile(`public/sounds/${file}`, `dist-extension/sounds/${file}`);

await mkdir("dist-extension/fonts", { recursive: true });
for (const file of ["Nightmare_Hero_Normal.ttf", "BarlowCondensed-Medium.ttf", "BarlowCondensed-SemiBold.ttf", "Barlow-OFL.txt", "SOURCE.txt"]) await copyFile(`public/fonts/${file}`, `dist-extension/fonts/${file}`);

await mkdir('dist-extension/icons', { recursive: true });
for (const size of [16,32,48,128]) await copyFile(`public/icons/vh-${size}.png`, `dist-extension/icons/vh-${size}.png`);
