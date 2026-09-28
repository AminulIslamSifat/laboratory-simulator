/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Build config.
 *
 * ─── Why a single file ───
 * The old build was eight plain `<script src='js/...'>` tags. It ran from
 * anywhere: a static server, a USB stick, `file://`, a university web folder.
 * The first TypeScript cut-over kept that only under Vite's dev server and
 * broke every other way the file used to open:
 *
 *   · a module bundle (`type="module"` + `crossorigin`) is blocked by CORS
 *     on `file://`, so double-clicking dist/index.html gave a blank page
 *   · the source entry `/src/main.ts` is a `.ts` file at an absolute path,
 *     which any plain static server hands over as `video/mp2t` - the browser
 *     refuses to execute it and the page is blank again
 *
 * `viteSingleFile` inlines the JS and CSS into ONE html file. That restores
 * the property the old build had: open the file, any way, and it runs. There
 * is no second asset to 404 and no module fetch to be blocked.
 *
 * ─── Why base is still relative ───
 * The built file is opened from a directory that is not the project root, so
 * any absolute `/asset` reference breaks. `base: './'` keeps every emitted
 * path relative, which the single-file plugin then has almost nothing left to
 * rewrite.
 *
 * ─── Why sourcemaps stay on ───
 * They land beside the html, not inside it, so they cost a student nothing at
 * runtime. When something does go wrong on a lab machine, a stack trace that
 * points at `simulator.ts` instead of `index.js:1:48211` is worth the file.
 */
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    // The whole point is one file. Vite's default 4 kB inlining threshold
    // would leave larger assets as separate requests, which is the failure
    // mode this config exists to prevent.
    assetsInlineLimit: 100 * 1024 * 1024,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // One chunk, one name. With a single output file the content hash
        // only creates a name a static host would have to be told about.
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]'
      }
    }
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
