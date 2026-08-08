import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * The content script, as a single self-contained IIFE.
 *
 * `emptyOutDir: false` matters — this build runs after the main one and must
 * not delete it.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@setu/core': resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome114',
    sourcemap: false,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'SetuLens',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        extend: true,
        // The content script must never leak globals into the host page.
        inlineDynamicImports: true,
      },
    },
  },
  define: {
    __SETU_API_BASE__: JSON.stringify(process.env.VITE_SETU_API_BASE ?? 'http://localhost:3000'),
  },
});
