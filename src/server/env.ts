/**
 * A 25-line `.env` loader.
 *
 * ─── Why not `dotenv` ───
 *
 * `dotenv` is a fine package, but it is a dependency, a lockfile entry and a
 * supply-chain surface, all to read a file that has one `KEY=value` per line.
 * Node 20 has `--env-file`, but that is a flag on the process, not something
 * a Vite plugin can turn on for itself, and the plugin is what needs the
 * values.
 *
 * So this reads the file directly. It handles the three things that actually
 * appear in a real `.env`: comments, blank lines, and a value that was quoted
 * because it contained a `#` or a space.
 *
 * ─── The one rule that matters ───
 *
 * A REAL environment variable always wins. On Render there is no `.env` file
 * at all — `MONGODB_URI` is injected by the platform. But if a stale `.env`
 * ever shipped in a build, clobbering the platform value would silently point
 * production at a developer's database. Never overwrite what is already set.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Guards against re-reading the file once per request. */
let loaded = false;

/**
 * Load `<root>/.env` into `process.env`, without overwriting anything.
 *
 * A missing or unreadable file is not an error — it is the normal case on a
 * deployed host, and the caller falls back to the filesystem store.
 */
export function loadEnv(root: string): void {
  if (loaded) return;
  loaded = true;

  let text: string;
  try {
    text = readFileSync(path.join(root, '.env'), 'utf8');
  } catch {
    return;
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq < 1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Strip one layer of matching quotes. `MONGODB_URI` in particular has a
    // URL-encoded `%40` for the `@` in the password, and a user who quotes the
    // whole URI would otherwise send the quotes to the driver as well.
    const first = value[0];
    if ((first === '"' || first === "'") && value.endsWith(first) && value.length > 1) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) process.env[key] = value;
  }
}
