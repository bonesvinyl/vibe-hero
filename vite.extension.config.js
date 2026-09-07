import { defineConfig } from 'vite';
export default defineConfig({
  publicDir: false,
  build: { outDir: 'dist-extension', emptyOutDir: true, lib: { entry: 'extension/overlay.js', name: 'VibeHeroNative', formats: ['iife'], fileName: () => 'overlay.js' } },
});
