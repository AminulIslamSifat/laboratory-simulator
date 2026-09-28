/// <reference types="vitest" />
import { defineConfig } from 'vite';

// Relative base so the built bundle can be opened from a USB stick or a
// university web folder without a server rewrite rule. This is a lab tool
// that has to run offline.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    assetsInlineLimit: 0
  },
  server: {
    port: 5173,
    open: false
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false
  }
});
