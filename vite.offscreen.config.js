import { defineConfig } from 'vite';
export default defineConfig({ publicDir: false, build: { outDir: 'dist-extension', emptyOutDir: false, lib: { entry: 'extension/offscreen.js', formats: ['es'], fileName: () => 'offscreen.js' } } });
