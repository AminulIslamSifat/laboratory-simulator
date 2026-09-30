/**
 * Bench save/load API — a Vite dev-server plugin.
 *
 * ─── Why this exists ───
 *
 * The app runs in a browser, and a browser sandbox cannot write to disk. The
 * Vite dev server, however, is ordinary Node running on this machine with full
 * filesystem access — it was simply never asked to write anything.
 *
 * This plugin gives it three routes:
 *
 *   POST /api/bench/save    { name, bench }   write <dir>/<name>.json
 *   GET  /api/bench/list                      list *.json in the folder
 *   GET  /api/bench/load?name=<file>          read one back
 *   POST /api/bench/delete  { name }          remove one
 *
 * Benches land in `<project>/benches/` as plain JSON. No download prompt, no
 * browser folder picker, no Electron. The server writes the file, exactly as
 * a backend is supposed to.
 *
 * ─── Path safety ───
 * The name arrives from the client, so it is sanitised and the resolved path
 * is checked to be inside the benches directory. A name like `../../.ssh/id`
 * must not be able to write outside the folder.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Where benches live, relative to the project root. */
const BENCH_DIR = 'benches';

/** Cap on a request body, so a malformed POST cannot exhaust memory. */
const MAX_BODY = 8 * 1024 * 1024;

/**
 * Turn a user-typed name into a safe file name.
 *
 * Everything outside [A-Za-z0-9._-] collapses to an underscore, runs are
 * squashed, and the result is capped. This is deliberately stricter than the
 * path check below: it makes a bad name impossible rather than merely caught.
 */
function toFileName(name: string): string {
  const base = String(name || '')
    .trim()
    // Drop a trailing `.json` BEFORE sanitising. The client legitimately sends
    // both forms: a bare name on save (`Meow-1`) and a file name on
    // load/delete (`Meow-1.json`, because that is what the listing returned).
    // Appending `.json` unconditionally turned the second form into
    // `Meow-1.json.json`, so load 404'd with ENOENT and delete silently
    // no-op'd (fs.rm force:true). Stripping first makes this idempotent: it
    // maps both `Meow-1` and `Meow-1.json` to `Meow-1.json`.
    .replace(/\.json$/i, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 80);
  return (base || 'bench') + '.json';
}

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

  /** Absolute path of the bench folder, created on demand. */
  function dirPath(): string {
    return path.join(root, BENCH_DIR);
  }

  /**
   * Resolve a file name inside the bench folder, refusing anything that
   * escapes it. Returns null when the name is not safe.
   */
  function safePath(fileName: string): string | null {
    const dir = dirPath();
    const full = path.resolve(dir, toFileName(fileName));
    // `path.relative` gives a path starting with '..' when `full` is outside
    // `dir`. Checking that is more reliable than a string prefix test, which
    // 'benches-evil' would defeat.
    const rel = path.relative(dir, full);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    return full;
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
          if (route === '/api/bench/save' && req.method === 'POST') {
            const raw = await readBody(req);
            const parsed = JSON.parse(raw) as { name?: string; bench?: unknown };
            const bench = parsed.bench as { devices?: unknown; wires?: unknown } | undefined;
            if (!bench || !Array.isArray(bench.devices) || !Array.isArray(bench.wires)) {
              send(res, 400, { ok: false, error: 'bench must have devices[] and wires[]' });
              return;
            }
            const full = safePath(parsed.name || 'bench');
            if (!full) { send(res, 400, { ok: false, error: 'bad name' }); return; }
            await fs.mkdir(dirPath(), { recursive: true });
            await fs.writeFile(full, JSON.stringify(parsed.bench, null, 2), 'utf8');
            send(res, 200, { ok: true, file: path.basename(full), dir: dirPath() });
            return;
          }

          if (route === '/api/bench/list' && req.method === 'GET') {
            await fs.mkdir(dirPath(), { recursive: true });
            const names = await fs.readdir(dirPath());
            const out: Array<{ name: string; file: string; savedAt: number; devices: number; wires: number }> = [];
            for (const n of names) {
              if (!n.toLowerCase().endsWith('.json')) continue;
              const full = path.join(dirPath(), n);
              try {
                const [stat, text] = await Promise.all([fs.stat(full), fs.readFile(full, 'utf8')]);
                const bench = JSON.parse(text) as { devices?: unknown[]; wires?: unknown[] };
                out.push({
                  name: n.replace(/\.json$/i, ''),
                  file: n,
                  savedAt: stat.mtimeMs,
                  devices: Array.isArray(bench.devices) ? bench.devices.length : 0,
                  wires: Array.isArray(bench.wires) ? bench.wires.length : 0
                });
              } catch {
                // A file we cannot read or parse is not a bench. Skip it rather
                // than failing the whole listing.
                continue;
              }
            }
            out.sort((a, b) => b.savedAt - a.savedAt);
            send(res, 200, { ok: true, dir: dirPath(), benches: out });
            return;
          }

          if (route === '/api/bench/load' && req.method === 'GET') {
            const full = safePath(query.get('name') || '');
            if (!full) { send(res, 400, { ok: false, error: 'bad name' }); return; }
            const text = await fs.readFile(full, 'utf8');
            send(res, 200, { ok: true, bench: JSON.parse(text) });
            return;
          }

          if (route === '/api/bench/delete' && req.method === 'POST') {
            const raw = await readBody(req);
            const parsed = JSON.parse(raw) as { name?: string };
            const full = safePath(parsed.name || '');
            if (!full) { send(res, 400, { ok: false, error: 'bad name' }); return; }
            await fs.rm(full, { force: true });
            send(res, 200, { ok: true });
            return;
          }

          send(res, 404, { ok: false, error: 'unknown bench route' });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // ENOENT on load is a normal miss, not a server fault.
          const code = /ENOENT/.test(msg) ? 404 : 500;
          send(res, code, { ok: false, error: msg });
        }
      })();
    });
  }

  return {
    name: 'eee-bench-api',
    configureServer: attach,
    // The preview server serves the built dist/ the same way; wire the same
    // routes so Save works from `vite preview` and the packaged single file.
    configurePreviewServer: attach
  };
}