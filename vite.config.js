import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    dedupe: ['three']
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    target: 'es2025'
  }
});
