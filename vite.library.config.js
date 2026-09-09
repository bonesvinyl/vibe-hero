import { defineConfig } from 'vite';
export default defineConfig({ publicDir: false, build: { outDir: 'dist-extension', emptyOutDir: false, lib: { entry: 'extension/library.js', formats: ['es'], fileName: () => 'library.js' } } });
