/**
 * Bench save/load API — a Vite dev-server plugin.
 *
 * ─── Why this exists ───
 *
 * The app runs in a browser, and a browser sandbox cannot write to disk. The
 * Vite dev server, however, is ordinary Node running on this machine with full
 * filesystem access — it was simply never asked to write anything.
 *
 * This plugin gives it the bench routes:
 *
 *   POST /api/bench/save    { roll, name, bench }
 *   GET  /api/bench/list    [?roll=]
 *   GET  /api/bench/load    ?roll=&name=
 *   POST /api/bench/delete  { roll, name }
 *   GET  /api/bench/rolls
 *
 * ─── Two backends, one set of routes ───
 *
 * The storage itself is behind `BenchStore` (see src/server/bench-store.ts).
 * MongoDB is preferred: it makes a bench reachable from any machine, which is
 * the whole point of asking for a roll number. The filesystem store is the
 * fallback, used when MONGODB_URI is unset or the cluster cannot be reached,
 * so `npm run dev` on a machine with no credentials still saves benches.
 *
 * The backend is chosen ONCE, lazily, on the first request. Choosing it at
 * plugin-construction time would block Vite startup on a network round trip
 * to Atlas; choosing it per request would mean a fresh connection attempt for
 * every save.
 *
 * ─── Path safety ───
 * The old version of this file resolved names against a benches directory and
 * checked the result. That check now lives in the stores themselves, because
 * it is a property of where the bytes land, and the two backends land them in
 * different places. See `normName` and `FsBenchStore.fileFor`.
 */

import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv } from './src/server/env.js';
import { MongoBenchStore } from './src/server/mongo-store.js';
import { FsBenchStore } from './src/server/fs-store.js';
import {
  isBenchShape, normName, normRoll,
  type BenchStore
} from './src/server/bench-store.js';

/** Cap on a request body, so a malformed POST cannot exhaust memory. */
const MAX_BODY = 8 * 1024 * 1024;

function send(res: ServerResponse, code: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Length', Buffer.byteLength(text));
  res.end(text);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function benchApi(): Plugin {
  let root = process.cwd();

  /**
   * The chosen store, once. `null` means "not decided yet"; the promise is
   * cached so concurrent first requests share one connection attempt.
   */
  let storePromise: Promise<BenchStore> | null = null;

  /**
   * Pick a backend and remember it.
   *
   * Never rejects. A failure to reach Atlas is not an error the user should
   * see — it is the signal to fall back to disk, which is what the previous
   * version of this file did unconditionally.
   */
  function getStore(): Promise<BenchStore> {
    if (!storePromise) {
      storePromise = (async (): Promise<BenchStore> => {
        loadEnv(root);
        const uri = process.env.MONGODB_URI;
        const dbName = process.env.MONGODB_DB || 'eee_sim';

        if (uri) {
          try {
            const store = await MongoBenchStore.connect(uri, dbName);
            console.log('[bench] storage: MongoDB (' + dbName + ')');
            return store;
          } catch (err) {
            console.warn(
              '[bench] MongoDB unreachable, falling back to files:',
              (err as Error).message
            );
          }
        } else {
          console.log('[bench] storage: filesystem (MONGODB_URI not set)');
        }

        return new FsBenchStore(root);
      })();
    }
    return storePromise;
  }

  /** Close a Mongo pool so Ctrl-C does not leave the process hanging. */
  async function shutdown(): Promise<void> {
    if (!storePromise) return;
    try {
      const store = await storePromise;
      const closeable = store as Partial<{ close: () => Promise<void> }>;
      if (typeof closeable.close === 'function') await closeable.close();
    } catch {
      // Shutting down; a failure here has nothing left to report to.
    }
  }

  function attach(server: ViteDevServer | PreviewServer): void {
    root = server.config.root;

    server.middlewares.use((req, res, next) => {
      const url = req.url || '';
      if (!url.startsWith('/api/bench/')) { next(); return; }

      const route = url.split('?')[0];
      const query = new URL(url, 'http://localhost').searchParams;

      void (async () => {
        try {
          const store = await getStore();

          if (route === '/api/bench/save' && req.method === 'POST') {
            const parsed = JSON.parse(await readBody(req)) as {
              roll?: string; name?: string; bench?: unknown;
            };
            const roll = normRoll(parsed.roll || '');
            if (!roll) { send(res, 400, { ok: false, error: 'roll required' }); return; }

            const name = normName(parsed.name || '');
            if (!name) { send(res, 400, { ok: false, error: 'name required' }); return; }

            if (!isBenchShape(parsed.bench)) {
              send(res, 400, { ok: false, error: 'bench must have devices[] and wires[]' });
              return;
            }

            const info = await store.save(roll, name, parsed.bench);
            send(res, 200, { ok: true, ...info, where: store.where, backend: store.kind });
            return;
          }

          if (route === '/api/bench/list' && req.method === 'GET') {
            const roll = query.get('roll') || undefined;
            const benches = await store.list(roll || undefined);
            send(res, 200, { ok: true, where: store.where, backend: store.kind, benches });
            return;
          }

          if (route === '/api/bench/load' && req.method === 'GET') {
            const roll = normRoll(query.get('roll') || '');
            const name = normName(query.get('name') || '');
            if (!roll || !name) { send(res, 400, { ok: false, error: 'roll and name required' }); return; }
            const bench = await store.load(roll, name);
            if (!bench) { send(res, 404, { ok: false, error: 'not found' }); return; }
            send(res, 200, { ok: true, bench });
            return;
          }

          if (route === '/api/bench/delete' && req.method === 'POST') {
            const parsed = JSON.parse(await readBody(req)) as { roll?: string; name?: string };
            const roll = normRoll(parsed.roll || '');
            const name = normName(parsed.name || '');
            if (!roll || !name) { send(res, 400, { ok: false, error: 'roll and name required' }); return; }
            await store.remove(roll, name);
            send(res, 200, { ok: true });
            return;
          }

          if (route === '/api/bench/rolls' && req.method === 'GET') {
            const rolls = await store.rolls();
            send(res, 200, { ok: true, rolls });
            return;
          }

          send(res, 404, { ok: false, error: 'unknown bench route' });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[bench]', msg);
          send(res, 500, { ok: false, error: msg });
        }
      })();
    });

    server.httpServer?.on('close', () => { void shutdown(); });
  }

  return {
    name: 'eee-bench-api',
    configureServer: attach,
    // The preview server serves the built dist/ the same way; wire the same
    // routes so Save works from `vite preview` and the packaged single file.
    configurePreviewServer: attach
  };
}
