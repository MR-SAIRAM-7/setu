import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Main extension build: service worker + the two React surfaces.
 *
 * The content script is built SEPARATELY (vite.content.config.ts) as an IIFE,
 * because a statically-declared MV3 content script cannot be an ES module.
 * Bundling both in one pass is the single most common way this build breaks.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@setu/core': resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome114',
    // MV3 forbids remote code; everything must be inlined or bundled.
    modulePreload: false,
    sourcemap: process.env.NODE_ENV !== 'production',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        sidepanel: resolve(__dirname, 'sidepanel.html'),
        options: resolve(__dirname, 'options.html'),
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  define: {
    __SETU_API_BASE__: JSON.stringify(process.env.VITE_SETU_API_BASE ?? 'http://localhost:3000'),
  },
});
