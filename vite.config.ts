/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { benchApi } from './bench-api';

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
/**
 * Port and bind address for BOTH the dev server and `vite preview`.
 *
 * A container host (Render, Fly, Railway…) assigns the port through $PORT and
 * can only reach a server bound to 0.0.0.0 — the default localhost bind is
 * invisible from outside the container, so the health check fails and the
 * deploy never goes live. Locally neither var is set, so the dev server keeps
 * 5173 on localhost and stays off the LAN.
 */
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.PORT ? '0.0.0.0' : 'localhost';

/**
 * Hostnames Vite will answer for.
 *
 * Vite rejects any request whose `Host` header is not on this list. That is a
 * DNS-rebinding guard, and it defaults to localhost only — which is why a
 * deployed instance answers with "Blocked request. This host is not allowed."
 * even though the container is healthy and the port is correct.
 *
 * A platform assigns the hostname, and preview deploys get a random subdomain
 * (`<service>-pr-123.onrender.com`), so the list has to name the PLATFORM's
 * domain rather than one exact host. A leading dot matches subdomains too.
 * Override with ALLOWED_HOSTS="a.com,b.com" for a different host.
 */
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || '.onrender.com,localhost')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export default defineConfig({
  base: './',
  plugins: [viteSingleFile(), benchApi()],
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
    host: HOST,
    port: PORT,
    open: false,
    allowedHosts: ALLOWED_HOSTS
  },
  // `vite preview` serves the built dist/ AND mounts the bench-api plugin, so
  // Save writes real files on the host with no browser API and no download
  // fallback. Same bind rules as the dev server above.
  preview: {
    host: HOST,
    port: PORT,
    allowedHosts: ALLOWED_HOSTS
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false
  }
});
